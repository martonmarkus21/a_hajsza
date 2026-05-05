package com.celkereszt.app.util

import org.json.JSONObject
import retrofit2.HttpException
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.Locale
import javax.net.ssl.SSLException

/**
 * Hálózati és szerverhibák egységes, érthető magyar szövege — ne a nyers [e.message] jelenjen meg a felületen.
 */
object AppErrorMessages {
    private val hungarianHint = Regex("[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]")

    /** Felületi szöveg: ha van magyar ékezet, valószínűleg már lokalizált / szerver magyar üzenet. */
    fun isHungarianUserText(text: String): Boolean = hungarianHint.containsMatchIn(text.trim())

    private fun jsonMessage(body: String?): String {
        if (body.isNullOrBlank()) return ""
        return try {
            JSONObject(body).optString("message", "").trim()
        } catch (_: Exception) {
            ""
        }
    }

    private fun mapEnglishServerSnippet(lower: String): String? = when {
        lower.contains("invalid") && lower.contains("credential") -> "Hibás belépési adatok."
        lower.contains("unauthorized") -> "A szerver nem engedélyezte a műveletet."
        lower.contains("forbidden") -> "Nincs jogosultság ehhez a művelethez."
        lower.contains("enrollment") || lower.contains("secret") || lower.contains("celkereszt-enrollment") ->
            "Érvénytelen vagy hiányzó kapcsolódási titok."
        lower.contains("not found") -> "A kért szolgáltatás nem található."
        lower.contains("timeout") || lower.contains("timed out") -> "Időtúllépés — a szerver nem válaszolt időben."
        lower.contains("network") || lower.contains("connection refused") ->
            "Nem sikerült kapcsolódni a szerverhez."
        else -> null
    }

    fun fromHttpException(e: HttpException, defaultForUnknown: String): String {
        val code = e.code()
        val rawBody = try {
            e.response()?.errorBody()?.string()
        } catch (_: Exception) {
            null
        }
        val msg = jsonMessage(rawBody)
        if (msg.isNotEmpty() && isHungarianUserText(msg)) return msg

        val lower = msg.lowercase(Locale.ROOT)
        mapEnglishServerSnippet(lower)?.let { return it }

        return when (code) {
            400 -> if (msg.isNotEmpty()) "A szerver nem fogadta el a kérést." else defaultForUnknown
            401 -> "A szerver nem fogadta el a kapcsolatot (hibás titok vagy nincs jogosultság)."
            403 -> "A művelet jelenleg nem engedélyezett."
            404 -> "Nem található a megadott cím a szerveren. Ellenőrizd az API alap URL-t."
            in 500..599 -> "A szerver átmenetileg nem elérhető. Próbáld újra később."
            else ->
                if (msg.isNotEmpty() && isHungarianUserText(msg) && msg.length < 160) msg
                else defaultForUnknown
        }
    }

    fun fromThrowable(e: Throwable, fallback: String = "Váratlan hiba történt. Próbáld újra."): String {
        e.message?.trim()?.takeIf { it.isNotEmpty() && isHungarianUserText(it) }?.let { return it }

        when (e) {
            is HttpException -> return fromHttpException(
                e,
                defaultForUnknown = "A szerver nem válaszolt várt módon (hiba ${e.code()}).",
            )
            is UnknownHostException ->
                return "Nem található a szerver címe. Ellenőrizd az internetet és a megadott URL-t."
            is ConnectException ->
                return "Nem sikerült kapcsolódni. Lehet, hogy a szerver nem fut, vagy blokkolt a hálózat."
            is SocketTimeoutException ->
                return "A szerver túl sokáig nem válaszolt. Próbáld újra, vagy ellenőrizd a hálózatot."
            is SSLException ->
                return "Biztonságos (HTTPS) kapcsolat nem jött létre. Ellenőrizd a címet és a rendszeridőt."
            is IOException -> {
                val m = e.message?.lowercase(Locale.ROOT).orEmpty()
                if (m.contains("canceled") || m.contains("cancelled")) {
                    return "A kérés megszakadt."
                }
                return "Hálózati hiba történt. Ellenőrizd az internetet, majd próbáld újra."
            }
        }

        e.cause?.let { cause ->
            if (cause !== e) {
                val nested = fromThrowable(cause, fallback = "")
                if (nested.isNotBlank() && nested != fallback) return nested
            }
        }

        return fallback
    }
}
