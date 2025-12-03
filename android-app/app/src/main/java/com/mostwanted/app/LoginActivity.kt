package com.mostwanted.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.tasks.OnCompleteListener
import com.google.firebase.messaging.FirebaseMessaging
import com.mostwanted.app.api.ApiService
import com.mostwanted.app.util.PreferencesHelper
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {
    private lateinit var pairNumberEditText: EditText
    private lateinit var passwordEditText: EditText
    private lateinit var loginButton: Button
    private lateinit var statusTextView: TextView
    private lateinit var apiService: ApiService
    private lateinit var prefs: PreferencesHelper

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.all { it.value }
        if (allGranted) {
            proceedWithLogin()
        } else {
            showError("A helymeghatározás engedélye szükséges!")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        prefs = PreferencesHelper(this)
        apiService = ApiService.create(this)

        // If already logged in, go to main activity
        if (prefs.isLoggedIn() && prefs.getToken() != null) {
            startMainActivity()
            return
        }

        pairNumberEditText = findViewById(R.id.pairNumberEditText)
        passwordEditText = findViewById(R.id.passwordEditText)
        loginButton = findViewById(R.id.loginButton)
        statusTextView = findViewById(R.id.statusTextView)

        loginButton.setOnClickListener {
            checkPermissionsAndLogin()
        }
    }

    private fun checkPermissionsAndLogin() {
        val permissions = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.POST_NOTIFICATIONS
        )

        val missingPermissions = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missingPermissions.isEmpty()) {
            proceedWithLogin()
        } else {
            requestPermissionLauncher.launch(permissions)
        }
    }

    private fun proceedWithLogin() {
        val pairNumber = pairNumberEditText.text.toString().trim()
        val password = passwordEditText.text.toString().trim()

        if (pairNumber.isEmpty() || password.isEmpty()) {
            showError("Add meg a pár számát és jelszót!")
            return
        }

        loginButton.isEnabled = false
        statusTextView.text = "Bejelentkezés..."

        // Get FCM token
        FirebaseMessaging.getInstance().token.addOnCompleteListener(OnCompleteListener { task ->
            if (!task.isSuccessful) {
                login(pairNumber, password, null)
                return@OnCompleteListener
            }

            val fcmToken = task.result
            login(pairNumber, password, fcmToken)
        })
    }

    private fun login(pairNumber: String, password: String, fcmToken: String?) {
        lifecycleScope.launch {
            try {
                val deviceId = android.provider.Settings.Secure.getString(
                    contentResolver,
                    android.provider.Settings.Secure.ANDROID_ID
                ) ?: "device_${System.currentTimeMillis()}"

                val request = com.mostwanted.app.api.DeviceLoginRequest(
                    username = pairNumber,
                    password = password,
                    deviceId = deviceId,
                    fcmToken = fcmToken
                )

                val response = apiService.deviceLogin(request)

                if (response.success) {
                    // Save credentials
                    prefs.saveToken(response.token)
                    prefs.saveDeviceInfo(
                        deviceId = deviceId,
                        pairId = response.device.pairId,
                        pairNumber = response.device.pairNumber,
                        pairName = response.device.pairName
                    )
                    if (fcmToken != null) {
                        prefs.saveFcmToken(fcmToken)
                    }

                    showSuccess("Sikeres bejelentkezés!")
                    startMainActivity()
                } else {
                    showError("Hibás bejelentkezési adatok!")
                    loginButton.isEnabled = true
                }
            } catch (e: Exception) {
                e.printStackTrace()
                showError("Hiba történt: ${e.message}")
                loginButton.isEnabled = true
            }
        }
    }

    private fun startMainActivity() {
        val intent = Intent(this, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }

    private fun showError(message: String) {
        statusTextView.text = message
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private fun showSuccess(message: String) {
        statusTextView.text = message
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
}

