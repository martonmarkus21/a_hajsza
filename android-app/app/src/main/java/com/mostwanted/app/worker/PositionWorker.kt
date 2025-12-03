package com.mostwanted.app.worker

import android.content.Context
import androidx.work.*
import com.mostwanted.app.repository.PositionRepository
import com.mostwanted.app.service.LocationService
import com.mostwanted.app.util.PreferencesHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class PositionWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return withContext(Dispatchers.IO) {
            try {
                val prefs = PreferencesHelper(applicationContext)
                
                // Check if logged in
                if (!prefs.isLoggedIn() || prefs.getToken() == null) {
                    return@withContext Result.success() // Don't retry if not logged in
                }

                // Sync offline positions first
                val repository = PositionRepository(applicationContext)
                repository.syncOfflinePositions()

                // Get current location and send to backend
                val locationService = LocationService()
                locationService.sendCurrentPosition()

                Result.success()
            } catch (e: Exception) {
                e.printStackTrace()
                // Retry with exponential backoff
                Result.retry()
            }
        }
    }

    companion object {
        private const val WORK_NAME = "PositionWorker"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresBatteryNotLow(true)
                .build()

            val workRequest = PeriodicWorkRequestBuilder<PositionWorker>(
                20, TimeUnit.MINUTES,
                5, TimeUnit.MINUTES // Flex interval
            )
                .setConstraints(constraints)
                .addTag(WORK_NAME)
                .build()

            WorkManager.getInstance(context).apply {
                // Cancel existing work and enqueue new one
                cancelUniqueWork(WORK_NAME)
                enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.UPDATE,
                    workRequest
                )
            }
        }
    }
}






