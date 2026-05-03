package com.mostwanted.app

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.mostwanted.app.splash.SplashBridge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
import com.mostwanted.app.api.ApiService
import com.mostwanted.app.service.FcmService
import com.mostwanted.app.service.LocationService
import com.mostwanted.app.ui.navigation.AppNavGraph
import com.mostwanted.app.ui.navigation.Routes
import com.mostwanted.app.ui.theme.MostWantedTheme
import com.mostwanted.app.repository.EventRepository
import com.mostwanted.app.util.AppErrorMessages
import com.mostwanted.app.util.PreferencesHelper
import com.mostwanted.app.util.ServerConnectionStore
import com.mostwanted.app.viewmodel.AuthViewModel
import com.mostwanted.app.viewmodel.MainViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AppActivity : ComponentActivity() {
    private val authViewModel: AuthViewModel by viewModels()
    private val mainViewModel: MainViewModel by viewModels()
    private lateinit var prefs: PreferencesHelper
    private val sessionEvents = MutableStateFlow(0)

    private val runtimeSummaryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            /*
             A teljes állapot (`liveGameStatus`, maradási szabály, stb.) kizárólag a Retrofit
             `/countdown` hívásokból jön (`refreshRuntimeStatusFromApi`), mert itt a Gson
             `GameCountdownResponse` néhány mezője megbízhatóan kitöltődik — a LocationService-es
             JSON roundtrip többszörös felülírást / mező-elvesztést okozott.
             */
            val text = intent?.getStringExtra(LocationService.EXTRA_RUNTIME_SUMMARY)
            if (!text.isNullOrBlank()) {
                mainViewModel.updateRuntimeSummaryLineFallback(text)
            }
        }
    }

    private val messageReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val message = intent?.getStringExtra(FcmService.EXTRA_MESSAGE) ?: return
            mainViewModel.updateMessage(message)
        }
    }

    private val forceLogoutReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            prefs.setLoggingOut(true)
            stopService(Intent(this@AppActivity, LocationService::class.java))
            runBlocking(Dispatchers.IO) {
                try {
                    EventRepository(applicationContext).clearAll()
                } catch (e: Exception) {
                    android.util.Log.e("AppActivity", "force logout purge: ${e.message}", e)
                }
            }
            prefs.clear()
            authViewModel.resetCredentialsAndStatus()
            mainViewModel.resetAllSessionUi(this@AppActivity)
            sessionEvents.update { it + 1 }
        }
    }

    private val loginPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { permissions ->
        val fine = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarse = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (fine || coarse) {
            performLogin()
        } else {
            authViewModel.setError("A helymeghatározás engedélye kötelező a bejelentkezéshez.")
        }
    }

    private val servicePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { permissions ->
        val fine = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarse = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (fine || coarse) {
            startLocationService()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        SplashBridge.install(this)
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isNavigationBarContrastEnforced = false
        }
        prefs = PreferencesHelper(this)
        prefs.setLoggingOut(false)
        if (!ServerConnectionStore.isConfigured(this)) {
            if (prefs.isLoggedIn() || prefs.getToken() != null) {
                prefs.clear()
            }
        }
        mainViewModel.initialize(this)
        mainViewModel.loadVehicleState(this)

        registerAppReceivers()

        if (isSessionActive()) {
            mainViewModel.startLiveClock()
            refreshRuntimeStatusFromApi()
            checkPermissionsAndStartLocationService()
        }

        setContent {
            MostWantedTheme {
                val authUiState by authViewModel.uiState.collectAsStateWithLifecycle()
                val homeUiState by mainViewModel.uiState.collectAsStateWithLifecycle()
                val clockTick by mainViewModel.clockTick.collectAsStateWithLifecycle()
                val sessionTick by sessionEvents.collectAsStateWithLifecycle()
                val isLoggedIn = remember(sessionTick) { isSessionActive() }
                val pairNumber = remember(sessionTick) { prefs.getPairNumber() }
                val serverConfigEpoch = remember { mutableIntStateOf(0) }

                key(serverConfigEpoch.intValue) {
                    val navController = rememberNavController()
                    val startDestination = run {
                        if (!ServerConnectionStore.isConfigured(this@AppActivity)) {
                            Routes.serverSetup(false)
                        } else if (isSessionActive()) {
                            Routes.Home
                        } else {
                            Routes.Login
                        }
                    }

                    LaunchedEffect(isLoggedIn, serverConfigEpoch.intValue) {
                        if (!ServerConnectionStore.isConfigured(this@AppActivity)) return@LaunchedEffect
                        val target = if (isLoggedIn) Routes.Home else Routes.Login
                        if (navController.currentDestination?.route != target) {
                            navController.navigate(target) {
                                popUpTo(navController.graph.startDestinationId) { inclusive = true }
                                launchSingleTop = true
                            }
                        }
                    }

                    LaunchedEffect(isLoggedIn, serverConfigEpoch.intValue) {
                        if (!ServerConnectionStore.isConfigured(this@AppActivity)) return@LaunchedEffect
                        if (!isLoggedIn) return@LaunchedEffect
                        // STARTED: frissül akkor is, ha csak háttérbe csúsztatod az appot (RESUMED állna le).
                        this@AppActivity.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
                            while (isActive) {
                                refreshRuntimeStatusFromApi()
                                delay(1_000L)
                            }
                        }
                    }

                    AppNavGraph(
                        navController = navController,
                        startDestination = startDestination,
                        authUiState = authUiState,
                        homeUiState = homeUiState,
                        clockTick = clockTick,
                        pairNumber = pairNumber,
                        onPairNumberChange = authViewModel::updatePairNumber,
                        onPasswordChange = authViewModel::updatePassword,
                        onLoginClick = ::checkPermissionsAndLogin,
                        onNavigateToServerSetup = {
                            navController.navigate(Routes.serverSetup(true))
                        },
                        onServerSetupComplete = { serverConfigEpoch.intValue += 1 },
                        onHelpClick = {
                        mainViewModel.updateMessage("Segítségkérés küldése…")
                        lifecycleScope.launch(Dispatchers.IO) {
                            try {
                                ApiService.create(this@AppActivity).postHelpRequest()
                                withContext(Dispatchers.Main) {
                                    mainViewModel.updateMessage(
                                        "Segítségkérést elküldtük. Kövesd az adminisztrátori utasításokat.",
                                    )
                                    mainViewModel.pushSystemEvent(
                                        context = this@AppActivity,
                                        title = "Segítségkérés",
                                        body = "A pár segítségkérést küldött a gyors műveletek közül.",
                                        type = "help_request",
                                        priority = "warning",
                                    )
                                }
                            } catch (e: Exception) {
                                withContext(Dispatchers.Main) {
                                    mainViewModel.updateMessage(
                                        AppErrorMessages.fromThrowable(
                                            e,
                                            fallback = "A segítségkérés elküldése nem sikerült. Próbáld újra.",
                                        ),
                                    )
                                }
                            }
                        }
                    },
                    onVehicleToggle = {
                        if (homeUiState.vehicleMode) {
                            mainViewModel.stopVehicle(this)
                        } else {
                            mainViewModel.startVehicle(this)
                        }
                    },
                    onLogoutClick = ::logoutAndResetSession,
                    onMarkEventRead = { eventId ->
                        mainViewModel.markEventRead(this, eventId)
                    },
                    onMarkAllRead = {
                        mainViewModel.markAllEventsRead(this)
                    },
                    onClearEvents = {
                        mainViewModel.clearEvents(this)
                    },
                )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (ServerConnectionStore.isConfigured(this) && isSessionActive()) {
            refreshRuntimeStatusFromApi()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(messageReceiver)
        } catch (_: Exception) {
        }
        try {
            unregisterReceiver(forceLogoutReceiver)
        } catch (_: Exception) {
        }
        try {
            unregisterReceiver(runtimeSummaryReceiver)
        } catch (_: Exception) {
        }
    }

    private fun isSessionActive(): Boolean = prefs.isLoggedIn() && prefs.getToken() != null

    private fun registerAppReceivers() {
        ContextCompat.registerReceiver(
            this,
            messageReceiver,
            IntentFilter(FcmService.ACTION_MESSAGE_RECEIVED),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        ContextCompat.registerReceiver(
            this,
            forceLogoutReceiver,
            IntentFilter("com.mostwanted.app.FORCE_LOGOUT"),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        ContextCompat.registerReceiver(
            this,
            runtimeSummaryReceiver,
            IntentFilter(LocationService.ACTION_RUNTIME_SUMMARY),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
    }

    private fun checkPermissionsAndLogin() {
        authViewModel.clearError()
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        )
        if (Build.VERSION.SDK_INT >= 33) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            performLogin()
        } else {
            loginPermissionLauncher.launch(missing.toTypedArray())
        }
    }

    private fun performLogin() {
        authViewModel.login(this) {
            mainViewModel.loadVehicleState(this)
            mainViewModel.prepareSessionUi()
            mainViewModel.startLiveClock()
            refreshRuntimeStatusFromApi()
            checkPermissionsAndStartLocationService()
            sessionEvents.update { it + 1 }
        }
    }

    private fun logoutAndResetSession() {
        prefs.setLoggingOut(true)
        stopService(Intent(this, LocationService::class.java))
        val appCtx = applicationContext
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val apiService = ApiService.create(appCtx)
                apiService.deviceLogout()
            } catch (e: Exception) {
                android.util.Log.e("AppActivity", "Logout error: ${e.message}", e)
            } finally {
                withContext(NonCancellable + Dispatchers.IO) {
                    try {
                        EventRepository(appCtx).clearAll()
                    } catch (e: Exception) {
                        android.util.Log.e("AppActivity", "clear events: ${e.message}", e)
                    }
                }
                withContext(NonCancellable + Dispatchers.Main) {
                    prefs.clear()
                    authViewModel.resetCredentialsAndStatus()
                    mainViewModel.resetAllSessionUi(this@AppActivity)
                    sessionEvents.update { it + 1 }
                }
            }
        }
    }

    private fun checkPermissionsAndStartLocationService() {
        val fineGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        if (fineGranted || coarseGranted) {
            startLocationService()
            return
        }
        servicePermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ),
        )
    }

    private fun startLocationService() {
        val serviceIntent = Intent(this, LocationService::class.java)
        ContextCompat.startForegroundService(this, serviceIntent)
    }

    private fun refreshRuntimeStatusFromApi() {
        if (!ServerConnectionStore.isConfigured(this)) return
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiService.create(this@AppActivity).getGameCountdown()
                mainViewModel.updateLiveStatusFromResponse(response)
            } catch (e: Exception) {
                android.util.Log.w("AppActivity", "countdown: ${e.message}")
            }
        }
    }
}
