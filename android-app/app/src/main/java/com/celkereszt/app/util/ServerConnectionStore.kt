package com.celkereszt.app.util

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * API alap URL és mobil kapcsolódási titok — titkosított tárolóban,
 * a bejelentkezési munkamenettől függetlenül megmarad kijelentkezés után is.
 */
class ServerConnectionStore(context: Context) {
    private val appContext = context.applicationContext
    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            appContext,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun isConfigured(): Boolean {
        val url = prefs.getString(KEY_API_BASE_URL, null)?.trim().orEmpty()
        return url.isNotEmpty()
    }

    fun getApiBaseUrl(): String? = prefs.getString(KEY_API_BASE_URL, null)?.trim()?.takeIf { it.isNotEmpty() }

    fun getEnrollmentSecret(): String = prefs.getString(KEY_ENROLLMENT_SECRET, "")?.trim() ?: ""

    fun save(apiBaseUrl: String, enrollmentSecret: String) {
        prefs.edit()
            .putString(KEY_API_BASE_URL, normalizeApiBaseUrl(apiBaseUrl))
            .putString(KEY_ENROLLMENT_SECRET, enrollmentSecret.trim())
            .apply()
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    private fun normalizeApiBaseUrl(raw: String): String {
        val t = raw.trim().trimEnd('/')
        return "$t/"
    }

    companion object {
        private const val PREFS_NAME = "ck_server_connection"
        private const val KEY_API_BASE_URL = "api_base_url"
        private const val KEY_ENROLLMENT_SECRET = "enrollment_secret"

        fun isConfigured(context: Context): Boolean =
            ServerConnectionStore(context).isConfigured()

        fun normalizeApiBaseUrlStatic(raw: String): String {
            val t = raw.trim().trimEnd('/')
            return "$t/"
        }
    }
}
