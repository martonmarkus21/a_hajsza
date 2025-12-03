package com.mostwanted.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import androidx.core.content.ContextCompat
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import com.mostwanted.app.MainActivity
import com.mostwanted.app.R
import com.mostwanted.app.database.PositionEntity
import com.mostwanted.app.repository.PositionRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import java.util.Timer
import java.util.TimerTask

class LocationService : Service() {
    private val CHANNEL_ID = "LocationServiceChannel"
    private lateinit var positionRepository: PositionRepository
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationRequest: LocationRequest
    private lateinit var locationCallback: LocationCallback
    private var positionSendTimer: Timer? = null
    private var lastSentLocation: Location? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        positionRepository = PositionRepository(applicationContext)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        setupLocationUpdates()
        startLocationUpdates()
        startPositionSendTimer() // Start timer to guarantee 1-second updates
        // PositionWorker removed - LocationService now handles continuous updates
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification()
        startForeground(1, notification)
        
        // Check if this is a location update request
        if (intent?.action == "UPDATE_LOCATION") {
            android.util.Log.d("LocationService", "Location update requested via FCM")
            sendCurrentPosition()
        }
        
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        positionSendTimer?.cancel()
        positionSendTimer = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Location Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Folyamatos lokációkövetés a Most Wanted alkalmazásban"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Most Wanted")
            .setContentText("Pozíció követés aktív")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(pendingIntent)
            .setOngoing(true) // Make notification persistent
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun setupLocationUpdates() {
        // Use very frequent updates for continuous tracking (for distance calculation)
        // Priority: High accuracy for better location tracking
        // Interval: 1 second for very frequent updates (even in background)
        // This is needed for accurate distance calculation, but positions won't be shown on map until game timer expires
        // CRITICAL: Use PRIORITY_HIGH_ACCURACY and setMaxUpdateDelayMillis to ensure updates work in background
        locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000) // 1 second
            .setWaitForAccurateLocation(false)
            .setMinUpdateIntervalMillis(1000) // 1 second minimum (fastest update interval)
            .setMaxUpdateDelayMillis(1000) // 1 second maximum delay (was 2000, too long)
            .setPriority(Priority.PRIORITY_HIGH_ACCURACY) // Explicitly set high priority
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                // Process all locations in the result (not just lastLocation)
                locationResult.locations.forEach { location ->
                    android.util.Log.d("LocationService", "Location update received via callback: lat=${location.latitude}, lon=${location.longitude}, accuracy=${location.accuracy}, time=${location.time}")
                    sendLocation(location)
                    lastSentLocation = location
                }
            }
        }
    }

    private fun startLocationUpdates() {
        try {
            // Check permission before requesting location updates
            if (ContextCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
            ) {
                // CRITICAL: Use getMainExecutor() or Looper.getMainLooper() for background service
                // This ensures location updates work even when app is in background
                fusedLocationClient.requestLocationUpdates(
                    locationRequest,
                    locationCallback,
                    mainLooper // Use mainLooper to ensure callbacks work in background
                )
                android.util.Log.d("LocationService", "Location updates started successfully")
            } else {
                android.util.Log.w("LocationService", "Location permission not granted, cannot start location updates")
            }
        } catch (e: SecurityException) {
            android.util.Log.e("LocationService", "SecurityException in startLocationUpdates: ${e.message}", e)
        } catch (e: Exception) {
            android.util.Log.e("LocationService", "Error starting location updates: ${e.message}", e)
        }
    }

    // CRITICAL: Start a timer that guarantees position is sent every second
    // This is a backup mechanism - the primary source is requestLocationUpdates callback
    // But if the callback doesn't fire (e.g., in background), the timer ensures we still send positions
    private fun startPositionSendTimer() {
        positionSendTimer?.cancel()
        positionSendTimer = Timer()
        positionSendTimer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() {
                try {
                    // Check permission before accessing location
                    if (ContextCompat.checkSelfPermission(
                            this@LocationService,
                            android.Manifest.permission.ACCESS_FINE_LOCATION
                        ) == PackageManager.PERMISSION_GRANTED ||
                        ContextCompat.checkSelfPermission(
                            this@LocationService,
                            android.Manifest.permission.ACCESS_COARSE_LOCATION
                        ) == PackageManager.PERMISSION_GRANTED
                    ) {
                        // Get the most recent location and send it as backup
                        // Only send if we haven't received a location update recently (within last 2 seconds)
                        val now = System.currentTimeMillis()
                        val lastLocationTime = lastSentLocation?.time ?: 0
                        val timeSinceLastLocation = now - lastLocationTime
                        
                        // Only use timer as backup if we haven't received location in last 2 seconds
                        if (timeSinceLastLocation > 2000) {
                            fusedLocationClient.lastLocation.addOnSuccessListener { location ->
                                if (location != null) {
                                    // Check if this location is newer than what we last sent
                                    if (lastSentLocation == null || location.time > lastSentLocation!!.time) {
                                        android.util.Log.d("LocationService", "Timer backup: Sending position (no recent callback update)")
                                        sendLocation(location)
                                        lastSentLocation = location
                                    }
                                }
                            }.addOnFailureListener { e ->
                                android.util.Log.e("LocationService", "Error getting last location in timer: ${e.message}", e)
                            }
                        }
                    } else {
                        android.util.Log.w("LocationService", "Location permission not granted, skipping timer update")
                    }
                } catch (e: SecurityException) {
                    android.util.Log.e("LocationService", "SecurityException in position send timer: ${e.message}", e)
                } catch (e: Exception) {
                    android.util.Log.e("LocationService", "Error in position send timer: ${e.message}", e)
                }
            }
        }, 2000, 1000) // Start after 2 seconds, then every 1 second (backup mechanism)
    }

    fun sendCurrentPosition() {
        try {
            // Check permission before accessing location
            if (ContextCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
            ) {
                fusedLocationClient.lastLocation.addOnSuccessListener { location ->
                    location?.let { sendLocation(it) }
                }.addOnFailureListener { e ->
                    android.util.Log.e("LocationService", "Error getting last location: ${e.message}", e)
                }
            } else {
                android.util.Log.w("LocationService", "Location permission not granted, cannot send current position")
            }
        } catch (e: SecurityException) {
            android.util.Log.e("LocationService", "SecurityException in sendCurrentPosition: ${e.message}", e)
        }
    }

    private fun sendLocation(location: Location) {
        val prefsHelper = com.mostwanted.app.util.PreferencesHelper(this)
        val deviceId = prefsHelper.getDeviceId()
        val pairId = prefsHelper.getPairId()
        
        android.util.Log.d("LocationService", "sendLocation called: deviceId=$deviceId, pairId=$pairId, lat=${location.latitude}, lon=${location.longitude}")
        
        if (pairId == 0) {
            android.util.Log.w("LocationService", "pairId is 0, not sending position")
            // Not logged in yet
            return
        }

        val vehicleMode = prefsHelper.isVehicleMode()
        val vehicleStartTime = prefsHelper.getVehicleStartTime()
        
        var vehicleSessionRemaining: Int? = null
        if (vehicleMode && vehicleStartTime > 0) {
            val elapsed = System.currentTimeMillis() - vehicleStartTime
            val remaining = (40 * 60 * 1000 - elapsed) / 1000 // 40 minutes in seconds
            vehicleSessionRemaining = if (remaining > 0) remaining.toInt() else 0
        }

        val position = PositionEntity(
            deviceId = deviceId,
            pairId = pairId,
            lat = location.latitude,
            lon = location.longitude,
            accuracy = location.accuracy.toDouble(),
            speed = location.speed.toDouble(),
            timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.format(Date()),
            vehicleMode = vehicleMode,
            vehicleSessionRemaining = vehicleSessionRemaining,
            synced = false
        )

        // CRITICAL: Use a separate coroutine scope for each position send
        // This ensures that each position is sent independently, without waiting for previous sends
        // This is essential for 1-second updates to work correctly
        // Each position send is non-blocking and independent
        CoroutineScope(Dispatchers.IO).launch {
            try {
                android.util.Log.d("LocationService", "Sending position to repository (async, non-blocking)")
                val success = positionRepository.sendPosition(position)
                android.util.Log.d("LocationService", "Position send result: $success")
            } catch (e: Exception) {
                android.util.Log.e("LocationService", "Error sending position: ${e.message}", e)
                // The positionRepository.sendPosition already handles saving to local database on error
            }
        }
    }
}

