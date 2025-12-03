package com.mostwanted.app.util

import android.content.Context
import android.content.SharedPreferences

class PreferencesHelper(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("most_wanted", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_TOKEN = "device_token"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_PAIR_ID = "pair_id"
        private const val KEY_PAIR_NUMBER = "pair_number"
        private const val KEY_PAIR_NAME = "pair_name"
        private const val KEY_LOGGED_IN = "logged_in"
        private const val KEY_VEHICLE_MODE = "vehicle_mode"
        private const val KEY_VEHICLE_START_TIME = "vehicle_start_time"
        private const val KEY_FCM_TOKEN = "fcm_token"
    }

    fun saveToken(token: String) {
        prefs.edit().putString(KEY_TOKEN, token).apply()
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    fun saveDeviceInfo(deviceId: String, pairId: Int, pairNumber: Int, pairName: String?) {
        prefs.edit()
            .putString(KEY_DEVICE_ID, deviceId)
            .putInt(KEY_PAIR_ID, pairId)
            .putInt(KEY_PAIR_NUMBER, pairNumber)
            .putString(KEY_PAIR_NAME, pairName)
            .putBoolean(KEY_LOGGED_IN, true)
            .apply()
    }

    fun getDeviceId(): String = prefs.getString(KEY_DEVICE_ID, "unknown") ?: "unknown"
    fun getPairId(): Int = prefs.getInt(KEY_PAIR_ID, 0)
    fun getPairNumber(): Int = prefs.getInt(KEY_PAIR_NUMBER, 0)
    fun getPairName(): String? = prefs.getString(KEY_PAIR_NAME, null)

    fun isLoggedIn(): Boolean = prefs.getBoolean(KEY_LOGGED_IN, false)

    fun setVehicleMode(active: Boolean, startTime: Long = 0) {
        prefs.edit()
            .putBoolean(KEY_VEHICLE_MODE, active)
            .putLong(KEY_VEHICLE_START_TIME, startTime)
            .apply()
    }

    fun isVehicleMode(): Boolean = prefs.getBoolean(KEY_VEHICLE_MODE, false)
    fun getVehicleStartTime(): Long = prefs.getLong(KEY_VEHICLE_START_TIME, 0)

    fun saveFcmToken(token: String) {
        prefs.edit().putString(KEY_FCM_TOKEN, token).apply()
    }

    fun getFcmToken(): String? = prefs.getString(KEY_FCM_TOKEN, null)

    fun clear() {
        prefs.edit().clear().apply()
    }
}

