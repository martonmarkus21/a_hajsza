package com.celkereszt.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.celkereszt.app.AppActivity
import com.celkereszt.app.R
import com.celkereszt.app.repository.EventRepository
import com.celkereszt.app.util.PreferencesHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class FcmService : FirebaseMessagingService() {
    private val CHANNEL_ID = "FCMChannel"

    companion object {
        const val ACTION_MESSAGE_RECEIVED = "com.celkereszt.app.MESSAGE_RECEIVED"
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
        if (dataType == "pair_deleted") {
            android.util.Log.d("FcmService", "Pair deleted: logging out device")
            handleForceLogout(SessionEndReason.PairDeleted)
            return
        }
        if (dataType == "force_logout" || remoteMessage.data["action"] == "logout") {
            android.util.Log.d("FcmService", "Force logout received, logging out device")
            handleForceLogout(SessionEndReason.ForceLogout)
            return
        }

        // Check for location update request
        if (dataType == "location_update_request" || remoteMessage.data["action"] == "update_location") {
            android.util.Log.d("FcmService", "Location update request received")
            saveEvent(
                title = "Azonnali pozíció",
                body = "A szerver friss pozíció küldését kéri.",
                type = "tracking",
                priority = "warning",
            )
            handleLocationUpdateRequest()
            return
        }

        val notificationTitle = remoteMessage.notification?.title
        val notificationBody = remoteMessage.notification?.body
        val dataTitle = remoteMessage.data["title"]
        val dataBody = remoteMessage.data["message"] ?: remoteMessage.data["body"]
        var finalTitle = notificationTitle ?: dataTitle ?: "Célkereszt"
        var finalBody = notificationBody ?: dataBody ?: ""

        // Angol sablon / notification-only üzenetek magyarra
        if (dataType == "capture_confirmed" || finalTitle.contains("capture confirmed", ignoreCase = true)) {
            finalTitle = "Elfogás megerősítve"
            if (finalBody.isBlank() || finalBody.contains("capture confirmed", ignoreCase = true)) {
                finalBody = "Elfogtak titeket. Kövesd a szervezők utasításait."
            }
        }

        if (finalBody.isBlank()) {
            return
        }

        showNotification(finalTitle, finalBody)
        saveEvent(
            title = finalTitle,
            body = finalBody,
            type = dataType ?: "message",
            priority = remoteMessage.data["priority"] ?: "normal",
        )

        val intent = Intent(ACTION_MESSAGE_RECEIVED).apply {
            putExtra(EXTRA_MESSAGE, finalBody)
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }

    private enum class SessionEndReason {
        ForceLogout,
        PairDeleted,
    }

    private fun handleForceLogout(reason: SessionEndReason) {
        val prefs = PreferencesHelper(this)
        prefs.setLoggingOut(true)

        // Stop location service
        val serviceIntent = Intent(this, com.celkereszt.app.service.LocationService::class.java)
        stopService(serviceIntent)
        
        // Call logout API (before clearing preferences, so token is still available)
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
            try {
                val apiService = com.celkereszt.app.api.ApiService.create(this@FcmService)
                apiService.deviceLogout()
                android.util.Log.d("FcmService", "Force logout API called successfully")
            } catch (e: Exception) {
                android.util.Log.e("FcmService", "Force logout API error: ${e.message}", e)
            } finally {
                // Clear preferences
                prefs.clear()
                
                when (reason) {
                    SessionEndReason.PairDeleted -> {
                        showNotification(
                            "Pár törölve",
                            "A párt törölték. Lépj be egy érvényes számmal.",
                        )
                        saveEvent(
                            title = "Pár törölve",
                            body = "A szervertől érkező jel szerint ez a páros regisztráció megszűnt.",
                            type = "security",
                            priority = "high",
                        )
                    }

                    SessionEndReason.ForceLogout -> {
                        showNotification(
                            "Kijelentkeztetés",
                            "Az adminisztrátor kijelentkeztetett az eszközről.",
                        )
                        saveEvent(
                            title = "Admin kijelentkeztetés",
                            body = "A munkamenetet az adminisztrátor zárta le távolról.",
                            type = "security",
                            priority = "high",
                        )
                    }
                }
                
                // Broadcast logout event to the compose host activity if it's running
                val intent = Intent("com.celkereszt.app.FORCE_LOGOUT").apply {
                    setPackage(packageName)
                }
                sendBroadcast(intent)
            }
        }
    }

    private fun handleLocationUpdateRequest() {
        android.util.Log.d("FcmService", "Handling location update request")
        val serviceIntent = Intent(this, com.celkereszt.app.service.LocationService::class.java)
        serviceIntent.action = "UPDATE_LOCATION"
        ContextCompat.startForegroundService(this, serviceIntent)
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val prefs = PreferencesHelper(this)
        prefs.saveFcmToken(token)

        // Sync token to backend immediately when session is active.
        CoroutineScope(Dispatchers.IO).launch {
            try {
                if (prefs.isLoggedIn() && prefs.getToken() != null) {
                    val apiService = com.celkereszt.app.api.ApiService.create(this@FcmService)
                    apiService.updateDeviceFcmToken(
                        com.celkereszt.app.api.UpdateDeviceFcmTokenRequest(token),
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Célkereszt Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Értesítések a Célkereszt alkalmazásból"
                enableVibration(true)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun showNotification(title: String, body: String) {
        val intent = Intent(this, AppActivity::class.java).apply {
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
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .build()

        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    private fun saveEvent(title: String, body: String, type: String, priority: String) {
        CoroutineScope(Dispatchers.IO).launch {
            EventRepository(applicationContext).addEvent(
                title = title,
                body = body,
                type = type,
                priority = priority,
            )
        }
    }
}