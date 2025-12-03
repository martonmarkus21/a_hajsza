package com.mostwanted.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.mostwanted.app.MainActivity
import com.mostwanted.app.R
import com.mostwanted.app.util.PreferencesHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class FcmService : FirebaseMessagingService() {
    private val CHANNEL_ID = "FCMChannel"

    companion object {
        const val ACTION_MESSAGE_RECEIVED = "com.mostwanted.app.MESSAGE_RECEIVED"
        const val EXTRA_MESSAGE = "message"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        // Check for force logout or pair deletion
        val dataType = remoteMessage.data["type"]
        if (dataType == "force_logout" || dataType == "pair_deleted" || remoteMessage.data["action"] == "logout") {
            android.util.Log.d("FcmService", "Force logout or pair deletion received, logging out device")
            handleForceLogout()
            return
        }

        // Check for location update request
        if (dataType == "location_update_request" || remoteMessage.data["action"] == "update_location") {
            android.util.Log.d("FcmService", "Location update request received")
            handleLocationUpdateRequest()
            return
        }

        remoteMessage.notification?.let { notification ->
            val title = notification.title ?: "Most Wanted"
            val body = notification.body ?: ""

            showNotification(title, body)

            // Broadcast message to MainActivity
            val intent = Intent(ACTION_MESSAGE_RECEIVED).apply {
                putExtra(EXTRA_MESSAGE, body)
                setPackage(packageName)
            }
            sendBroadcast(intent)
        }

        // Handle data payload
        if (remoteMessage.data.isNotEmpty()) {
            val message = remoteMessage.data["message"] ?: remoteMessage.data["body"]
            if (message != null) {
                showNotification("Most Wanted", message)
                val intent = Intent(ACTION_MESSAGE_RECEIVED).apply {
                    putExtra(EXTRA_MESSAGE, message)
                    setPackage(packageName)
                }
                sendBroadcast(intent)
            }
        }
    }

    private fun handleForceLogout() {
        val prefs = PreferencesHelper(this)
        
        // Stop location service
        val serviceIntent = Intent(this, com.mostwanted.app.service.LocationService::class.java)
        stopService(serviceIntent)
        
        // Call logout API (before clearing preferences, so token is still available)
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
            try {
                val apiService = com.mostwanted.app.api.ApiService.create(this@FcmService)
                apiService.deviceLogout()
                android.util.Log.d("FcmService", "Force logout API called successfully")
            } catch (e: Exception) {
                android.util.Log.e("FcmService", "Force logout API error: ${e.message}", e)
            } finally {
                // Clear preferences
                prefs.clear()
                
                // Show notification
                showNotification("Kijelentkeztetés", "Az adminisztrátor kijelentkeztetett az eszközről.")
                
                // Broadcast logout event to MainActivity if it's running
                val intent = Intent("com.mostwanted.app.FORCE_LOGOUT").apply {
                    setPackage(packageName)
                }
                sendBroadcast(intent)
            }
        }
    }

    private fun handleLocationUpdateRequest() {
        android.util.Log.d("FcmService", "Handling location update request")
        val serviceIntent = Intent(this, com.mostwanted.app.service.LocationService::class.java)
        serviceIntent.action = "UPDATE_LOCATION"
        startService(serviceIntent)
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val prefs = PreferencesHelper(this)
        prefs.saveFcmToken(token)

        // Try to update token on backend if logged in
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // TODO: Send token update to backend if needed
                // For now, token will be sent on next login
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Most Wanted Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Értesítések a Most Wanted alkalmazásból"
                enableVibration(true)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun showNotification(title: String, body: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = android.app.PendingIntent.getActivity(
            this,
            0,
            intent,
            android.app.PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .build()

        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(System.currentTimeMillis().toInt(), notification)
    }
}