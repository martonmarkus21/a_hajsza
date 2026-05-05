package com.celkereszt.app.ui.screens

import android.app.Activity
import android.Manifest
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Link
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.celkereszt.app.ui.scan.CkQrCaptureActivity
import com.celkereszt.app.api.EnrollmentProbe
import com.celkereszt.app.ui.components.MessageTone
import com.celkereszt.app.ui.components.AppBackdrop
import com.celkereszt.app.ui.components.AppButton
import com.celkereszt.app.ui.components.AppButtonVariant
import com.celkereszt.app.ui.components.AppGlassCard
import com.celkereszt.app.ui.components.AppInlineMessage
import com.celkereszt.app.ui.components.AppSoftDivider
import com.celkereszt.app.ui.components.AppTextField
import com.celkereszt.app.ui.theme.CkBgPrimary
import com.celkereszt.app.ui.theme.CkTextMuted
import com.celkereszt.app.ui.theme.CkTextPrimary
import com.celkereszt.app.ui.theme.CkTextSecondary
import com.celkereszt.app.util.AppErrorMessages
import com.celkereszt.app.util.MobileConnectionQrParser
import com.celkereszt.app.util.ServerConnectionStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import retrofit2.HttpException

@Composable
fun ServerSetupScreen(
    fromLogin: Boolean,
    onFinished: () -> Unit,
    onBackFromLoginFlow: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var apiUrl by remember { mutableStateOf("") }
    var secret by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var status by remember { mutableStateOf<String?>(null) }
    var showQrPanel by remember { mutableStateOf(false) }

    val scanOptions = remember {
        ScanOptions().apply {
            setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            setPrompt("Olvasd be a Célkereszt Android QR-kódot")
            setBeepEnabled(false)
            setCaptureActivity(CkQrCaptureActivity::class.java)
        }
    }

    val scanLauncher = rememberLauncherForActivityResult(ScanContract()) { result ->
        val raw = result?.contents?.trim().orEmpty()
        if (raw.isEmpty()) return@rememberLauncherForActivityResult
        MobileConnectionQrParser.parse(raw).fold(
            onSuccess = { payload ->
                apiUrl = payload.apiBaseUrl
                secret = payload.enrollmentSecret.orEmpty()
                error = null
                status = "QR beolvasva. Ellenőrizd az adatokat, majd koppints a csatlakozásra."
                showQrPanel = false
            },
            onFailure = { e ->
                showQrPanel = false
                error = e.message ?: "Érvénytelen QR-kód."
            },
        )
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            scanLauncher.launch(scanOptions)
        } else {
            showQrPanel = false
            error = "A QR beolvasásához kameraengedély kell."
        }
    }

    fun launchScan() {
        when (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)) {
            android.content.pm.PackageManager.PERMISSION_GRANTED ->
                scanLauncher.launch(scanOptions)
            else -> cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    BackHandler(enabled = true) {
        when {
            showQrPanel -> showQrPanel = false
            fromLogin -> onBackFromLoginFlow()
            else -> (context as? Activity)?.finish()
        }
    }

    AppBackdrop {
        /** Általános blokk távolság (cím, leírás, gombok között). */
        val sectionGap = 14.dp
        /** Mező-oszlop: elválasztó ↔ első mező ↔ második mező — egyforma, keskenyebb, hogy ne „nyomjon” többnek a floating label miatt. */
        val fieldGap = 8.dp
        Box(
            modifier = Modifier
                .fillMaxSize()
                .navigationBarsPadding(),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
            AppGlassCard(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(24.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Link,
                        contentDescription = null,
                        modifier = Modifier.size(26.dp),
                        tint = CkTextPrimary,
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "Szerver kapcsolat",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = CkTextPrimary,
                        textAlign = TextAlign.Center,
                    )
                }
                Spacer(modifier = Modifier.height(sectionGap))
                Text(
                    text = "Add meg az API címet és a kapcsolódási titkot (admin web → Eszközök → Android kapcsolat), vagy olvasd be a QR-kódot.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = CkTextSecondary,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                )
                Spacer(modifier = Modifier.height(sectionGap))
                AppSoftDivider()
                Spacer(modifier = Modifier.height(fieldGap))

                AppTextField(
                    value = apiUrl,
                    onValueChange = { apiUrl = it; error = null },
                    label = "API alap URL (https://…)",
                )
                Spacer(modifier = Modifier.height(fieldGap))
                AppTextField(
                    value = secret,
                    onValueChange = { secret = it; error = null },
                    label = "Kapcsolódási titok (ha kell)",
                )

                Spacer(modifier = Modifier.height(sectionGap))
                AppButton(
                    label = "QR-kód beolvasása",
                    onClick = { error = null; showQrPanel = true },
                    enabled = !busy,
                    leadingIcon = Icons.Rounded.QrCodeScanner,
                    variant = AppButtonVariant.Secondary,
                )

                Spacer(modifier = Modifier.height(sectionGap))
                when {
                    error != null -> AppInlineMessage(text = error!!, tone = MessageTone.Error)
                    status != null -> AppInlineMessage(text = status!!, tone = MessageTone.Neutral)
                }
                if (error != null || status != null) {
                    Spacer(modifier = Modifier.height(sectionGap))
                }

                AppButton(
                    label = if (busy) "Ellenőrzés…" else "Csatlakozás és mentés",
                    onClick = {
                        val url = apiUrl.trim()
                        if (url.isEmpty()) {
                            error = "Add meg az API címet."
                            return@AppButton
                        }
                        busy = true
                        error = null
                        status = "Kapcsolat ellenőrzése…"
                        scope.launch {
                            try {
                                val resp = withContext(Dispatchers.IO) {
                                    EnrollmentProbe.verify(url, secret.trim())
                                }
                                if (resp.ok != true) {
                                    error = "A szerver nem igazolta a kapcsolatot."
                                    busy = false
                                    status = null
                                    return@launch
                                }
                                val required = resp.enrollmentRequired == true
                                if (required && secret.isBlank()) {
                                    error = "Ehhez a szerverhez kötelező a kapcsolódási titok."
                                    busy = false
                                    status = null
                                    return@launch
                                }
                                ServerConnectionStore(context).save(url, secret.trim())
                                status = null
                                busy = false
                                onFinished()
                            } catch (e: HttpException) {
                                busy = false
                                status = null
                                error = AppErrorMessages.fromHttpException(
                                    e,
                                    defaultForUnknown = "A szerver nem igazolta a kapcsolatot.",
                                )
                            } catch (e: Exception) {
                                busy = false
                                status = null
                                error = AppErrorMessages.fromThrowable(
                                    e,
                                    fallback = "Nem sikerült elérni a szervert. Ellenőrizd az URL-t és a hálózatot.",
                                )
                            }
                        }
                    },
                    enabled = !busy,
                    trailingIcon = Icons.AutoMirrored.Rounded.ArrowForward,
                )

                if (fromLogin) {
                    Spacer(modifier = Modifier.height(sectionGap))
                    TextButton(onClick = onBackFromLoginFlow, modifier = Modifier.fillMaxWidth()) {
                        Text("Vissza a bejelentkezéshez", color = CkTextMuted)
                    }
                }
            }
            }
        }
    }

    if (showQrPanel) {
        Dialog(
            onDismissRequest = { showQrPanel = false },
            properties = DialogProperties(
                usePlatformDefaultWidth = false,
                decorFitsSystemWindows = false,
            ),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(CkBgPrimary)
                    .statusBarsPadding()
                    .navigationBarsPadding(),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 20.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        IconButton(onClick = { showQrPanel = false }) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                                contentDescription = "Vissza",
                                tint = CkTextPrimary,
                            )
                        }
                        Text(
                            text = "QR-kód beolvasása",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = CkTextPrimary,
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "A szervező admin oldalán generált Célkereszt QR-t olvasd be. A kamera megnyitása után a rendszer kameraalkalmazásában a vissza gombbal is kiléphetsz.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = CkTextSecondary,
                    )
                    Spacer(modifier = Modifier.height(28.dp))
                    AppButton(
                        label = "Kamera megnyitása",
                        onClick = { launchScan() },
                        leadingIcon = Icons.Rounded.QrCodeScanner,
                        variant = AppButtonVariant.Secondary,
                    )
                }
            }
        }
    }
}
