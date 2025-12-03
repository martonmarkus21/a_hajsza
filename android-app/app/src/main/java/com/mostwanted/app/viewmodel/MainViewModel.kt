package com.mostwanted.app.viewmodel

import android.content.Context
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import com.mostwanted.app.util.PreferencesHelper

class MainViewModel : ViewModel() {
    private val _message = MutableLiveData<String>("Most Wanted - A hajsza")
    val message: LiveData<String> = _message

    private val _vehicleMode = MutableLiveData<Boolean>(false)
    val vehicleMode: LiveData<Boolean> = _vehicleMode

    private val VEHICLE_TIME_LIMIT_MS = 40 * 60 * 1000L // 40 minutes
    private var vehicleTimer: android.os.Handler? = null

    init {
        // Load vehicle mode state
        _vehicleMode.value = false // Will be loaded from prefs in startVehicle if needed
    }

    fun startVehicle(context: Context) {
        val prefs = PreferencesHelper(context)
        val startTime = System.currentTimeMillis()
        
        _vehicleMode.value = true
        prefs.setVehicleMode(true, startTime)

        // Cancel previous timer if exists
        vehicleTimer?.removeCallbacksAndMessages(null)

        // Start countdown timer
        vehicleTimer = android.os.Handler(android.os.Looper.getMainLooper()).apply {
            postDelayed({
                if (_vehicleMode.value == true) {
                    updateMessage("⚠️ Figyelem! A 40 perces járműhasználati idő lejárt!")
                    // Auto-stop vehicle mode
                    stopVehicle(context)
                }
            }, VEHICLE_TIME_LIMIT_MS)
        }

        updateMessage("Járműhasználat elindítva. 40 perc áll rendelkezésre.")
    }

    fun stopVehicle(context: Context) {
        _vehicleMode.value = false
        val prefs = PreferencesHelper(context)
        prefs.setVehicleMode(false, 0)

        // Cancel timer
        vehicleTimer?.removeCallbacksAndMessages(null)
        vehicleTimer = null

        updateMessage("Járműhasználat leállítva.")
    }

    fun updateMessage(newMessage: String) {
        _message.value = newMessage
    }

    override fun onCleared() {
        super.onCleared()
        vehicleTimer?.removeCallbacksAndMessages(null)
    }
}

