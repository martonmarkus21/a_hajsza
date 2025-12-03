package com.mostwanted.app

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModelProvider
import com.mostwanted.app.service.FcmService
import com.mostwanted.app.service.LocationService
import com.mostwanted.app.util.PreferencesHelper
import com.mostwanted.app.viewmodel.MainViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var viewModel: MainViewModel
    private lateinit var messageTextView: TextView
    private lateinit var helpButton: Button
    private lateinit var vehicleButton: Button
    private lateinit var logoutButton: Button
    private lateinit var prefs: PreferencesHelper
    private lateinit var pairInfoTextView: TextView

    private val messageReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val message = intent?.getStringExtra(FcmService.EXTRA_MESSAGE)
            if (message != null) {
                viewModel.updateMessage(message)
            }
        }
    }

    private val forceLogoutReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            android.util.Log.d("MainActivity", "Force logout broadcast received")
            // Stop location service
            val serviceIntent = Intent(this@MainActivity, LocationService::class.java)
            stopService(serviceIntent)
            
            // Clear preferences
            prefs.clear()
            
            // Go back to login
            val loginIntent = Intent(this@MainActivity, LoginActivity::class.java)
            loginIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(loginIntent)
            finish()
        }
    }

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true) {
            startLocationService()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefs = PreferencesHelper(this)

        // Check if logged in
        if (!prefs.isLoggedIn() || prefs.getToken() == null) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)

        viewModel = ViewModelProvider(this)[MainViewModel::class.java]

        messageTextView = findViewById(R.id.messageTextView)
        helpButton = findViewById(R.id.helpButton)
        vehicleButton = findViewById(R.id.vehicleButton)
        logoutButton = findViewById(R.id.logoutButton)
        pairInfoTextView = findViewById(R.id.pairInfoTextView)

        // Set pair info - only show pair number, not name (name is admin-only)
        val pairNumber = prefs.getPairNumber()
        pairInfoTextView.text = "Pár #$pairNumber"

        setupObservers()
        setupButtons()
        checkPermissions()

        // Register for FCM messages
        val filter = IntentFilter(FcmService.ACTION_MESSAGE_RECEIVED)
        ContextCompat.registerReceiver(
            this,
            messageReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        // Register for force logout
        val forceLogoutFilter = IntentFilter("com.mostwanted.app.FORCE_LOGOUT")
        ContextCompat.registerReceiver(
            this,
            forceLogoutReceiver,
            forceLogoutFilter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(messageReceiver)
        } catch (e: Exception) {
            // Receiver might not be registered
        }
        try {
            unregisterReceiver(forceLogoutReceiver)
        } catch (e: Exception) {
            // Receiver might not be registered
        }
    }

    private fun setupObservers() {
        viewModel.message.observe(this) { message ->
            messageTextView.text = message
        }

        viewModel.vehicleMode.observe(this) { isActive ->
            vehicleButton.text = if (isActive) "Jármű STOP" else "Jármű START"
            val color = if (isActive) {
                ContextCompat.getColor(this, android.R.color.holo_red_dark)
            } else {
                ContextCompat.getColor(this, android.R.color.holo_green_dark)
            }
            vehicleButton.setBackgroundColor(color)
        }
    }

    private fun setupButtons() {
        helpButton.setOnClickListener {
            viewModel.updateMessage("Segítség kérése elküldve. Várj a válaszra!")
        }

        vehicleButton.setOnClickListener {
            if (viewModel.vehicleMode.value == true) {
                viewModel.stopVehicle(this)
            } else {
                viewModel.startVehicle(this)
            }
        }

        logoutButton.setOnClickListener {
            // Stop location service first
            val serviceIntent = Intent(this, LocationService::class.java)
            stopService(serviceIntent)
            
            // Call logout API (before clearing preferences, so token is still available)
            CoroutineScope(Dispatchers.Main).launch {
                try {
                    val apiService = com.mostwanted.app.api.ApiService.create(this@MainActivity)
                    val response = apiService.deviceLogout()
                    android.util.Log.d("MainActivity", "Logout API called successfully: ${response.success}, message: ${response.message}")
                } catch (e: Exception) {
                    android.util.Log.e("MainActivity", "Logout error: ${e.message}", e)
                    // Even if logout fails, we should still clear local data and redirect
                    // The device will be marked as inactive on the server side eventually
                } finally {
                    // Clear preferences and redirect only after API call completes (or fails)
                    prefs.clear()
                    
                    // Go back to login
                    val intent = Intent(this@MainActivity, LoginActivity::class.java)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                    finish()
                }
            }
        }
    }

    private fun checkPermissions() {
        when {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED -> {
                // Check for background location permission on Android 10+
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    if (ContextCompat.checkSelfPermission(
                            this,
                            Manifest.permission.ACCESS_BACKGROUND_LOCATION
                        ) == PackageManager.PERMISSION_GRANTED) {
                        startLocationService()
                    } else {
                        // Request background location permission
                        requestPermissionLauncher.launch(
                            arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                        )
                    }
                } else {
                    startLocationService()
                }
            }
            else -> {
                requestPermissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
            }
        }
    }

    private fun startLocationService() {
        val serviceIntent = Intent(this, LocationService::class.java)
        ContextCompat.startForegroundService(this, serviceIntent)
    }
}