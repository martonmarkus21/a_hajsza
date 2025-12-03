package com.mostwanted.app.repository

import android.content.Context
import com.mostwanted.app.api.ApiService
import com.mostwanted.app.api.PositionRequest
import com.mostwanted.app.database.AppDatabase
import com.mostwanted.app.database.PositionEntity
import com.mostwanted.app.util.PreferencesHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class PositionRepository(context: Context) {
    private val apiService = ApiService.create(context)
    private val database = AppDatabase.getDatabase(context)
    private val prefs = PreferencesHelper(context)

    suspend fun sendPosition(position: PositionEntity): Boolean {
        android.util.Log.d("PositionRepository", "sendPosition called: deviceId=${position.deviceId}, pairId=${position.pairId}, lat=${position.lat}, lon=${position.lon}")
        
        val token = prefs.getToken()
        if (token == null) {
            android.util.Log.w("PositionRepository", "No token, saving to local database")
            // Not logged in, save to local database
            withContext(Dispatchers.IO) {
                database.positionDao().insert(position)
            }
            return false
        }

        android.util.Log.d("PositionRepository", "Token found, sending to API")
        return try {
            val request = PositionRequest(
                deviceId = position.deviceId,
                pairId = position.pairId,
                lat = position.lat,
                lon = position.lon,
                accuracy = position.accuracy,
                speed = position.speed,
                timestamp = position.timestamp,
                vehicleMode = position.vehicleMode,
                vehicleSessionRemaining = position.vehicleSessionRemaining
            )

            // Token is automatically added by the interceptor
            android.util.Log.d("PositionRepository", "Calling API sendPosition")
            val response = apiService.sendPosition(request)
            android.util.Log.d("PositionRepository", "API response: success=${response.success}, message=${response.message}")

            if (response.success) {
                // Mark as synced if it was saved locally
                if (position.id > 0) {
                    withContext(Dispatchers.IO) {
                        database.positionDao().markAsSynced(position.id)
                    }
                }
                true
            } else {
                // Save to local database for retry
                if (position.id == 0L) {
                    withContext(Dispatchers.IO) {
                        database.positionDao().insert(position)
                    }
                }
                false
            }
        } catch (e: Exception) {
            e.printStackTrace()
            // If offline or error, save to local database
            if (position.id == 0L) {
                withContext(Dispatchers.IO) {
                    database.positionDao().insert(position)
                }
            }
            false
        }
    }

    suspend fun syncOfflinePositions() {
        // Check if logged in (token is automatically added by interceptor)
        if (prefs.getToken() == null) return

        val offlinePositions = withContext(Dispatchers.IO) {
            database.positionDao().getUnsynced()
        }

        for (position in offlinePositions) {
            try {
                val request = PositionRequest(
                    deviceId = position.deviceId,
                    pairId = position.pairId,
                    lat = position.lat,
                    lon = position.lon,
                    accuracy = position.accuracy,
                    speed = position.speed,
                    timestamp = position.timestamp,
                    vehicleMode = position.vehicleMode,
                    vehicleSessionRemaining = position.vehicleSessionRemaining
                )

                // Token is automatically added by the interceptor
                val response = apiService.sendPosition(request)
                if (response.success) {
                    withContext(Dispatchers.IO) {
                        database.positionDao().markAsSynced(position.id)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                // Keep trying later
            }
        }
    }
}