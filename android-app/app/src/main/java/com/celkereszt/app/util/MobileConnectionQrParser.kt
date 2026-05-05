package com.celkereszt.app.util

import android.util.Base64
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName

private val gson = Gson()

/** QR / vágólap payload: CK1: + base64url(JSON). */
private const val QR_PREFIX = "CK1:"

data class MobileConnectionQrPayload(
    @SerializedName("u") val apiBaseUrl: String,
    @SerializedName("s") val enrollmentSecret: String? = null,
)

object MobileConnectionQrParser {
    fun encodeToQrString(apiBaseUrl: String, enrollmentSecret: String): String {
        val payload = MobileConnectionQrPayload(
            apiBaseUrl = ServerConnectionStore.normalizeApiBaseUrlStatic(apiBaseUrl).trimEnd('/'),
            enrollmentSecret = enrollmentSecret.ifBlank { null },
        )
        val json = gson.toJson(payload)
        val b64 = Base64.encodeToString(
            json.toByteArray(Charsets.UTF_8),
            Base64.NO_WRAP or Base64.URL_SAFE or Base64.NO_PADDING,
        )
        return QR_PREFIX + b64
    }

    fun parse(text: String): Result<MobileConnectionQrPayload> {
        val t = text.trim()
        if (!t.startsWith(QR_PREFIX)) {
            return Result.failure(IllegalArgumentException("Ismeretlen QR formátum."))
        }
        val encoded = t.removePrefix(QR_PREFIX).trim()
        return try {
            val bytes = Base64.decode(encoded, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
            val json = String(bytes, Charsets.UTF_8)
            val payload = gson.fromJson(json, MobileConnectionQrPayload::class.java)
            if (payload.apiBaseUrl.isBlank()) {
                return Result.failure(IllegalArgumentException("Hiányzó szerver URL a QR-ből."))
            }
            Result.success(payload)
        } catch (e: Exception) {
            Result.failure(IllegalArgumentException("A QR tartalma nem olvasható.", e))
        }
    }
}
