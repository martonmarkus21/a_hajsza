package com.mostwanted.app.util

import java.util.Locale

/** Angol / gépi szerverüzenetek magyar, játékos közönségnek érthető szövegre. */
object AuthMessageMapper {
    fun mapLoginError(raw: String?, httpCode: Int): String {
        val t = raw?.trim().orEmpty()
        val lower = t.lowercase(Locale.ROOT)
        if (t.isNotEmpty()) {
            when {
                lower.contains("invalid credentials") ||
                    lower.contains("invalid credential") ||
                    lower.contains("bad credentials") ||
                    (lower.contains("invalid") && lower.contains("credential")) ->
                    return "Hibás párszám vagy jelszó."
                lower.contains("unauthorized") ->
                    return "Nincs jogosultság a belépéshez. Ellenőrizd az adatokat."
                lower.contains("inactive") || lower.contains("inaktív") ->
                    return "Ez a fiók jelenleg nem használható."
                lower.contains("not found") || lower.contains("nem található") ->
                    return "A megadott párszám nem található."
                lower.contains("network") || lower.contains("timeout") || lower.contains("failed to connect") ->
                    return "Nem sikerült elérni a szervert. Ellenőrizd az internetet, majd próbáld újra."
                lower.contains("internal server error") || lower.contains("internal error") ->
                    return "A szerver átmenetileg hibázott. Próbáld újra később."
                lower.contains("service unavailable") || lower.contains("bad gateway") || lower.contains("gateway timeout") ->
                    return "A szerver átmenetileg nem elérhető. Próbáld újra később."
                lower.contains("too many requests") ->
                    return "Túl sok próbálkozás — várj egy kicsit, majd próbáld újra."
                Regex("[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]").containsMatchIn(t) -> return t
            }
        }
        return when (httpCode) {
            401 -> "Hibás párszám vagy jelszó."
            403 -> "A belépés jelenleg nem engedélyezett."
            404 -> "A belépési szolgáltatás nem található."
            409 -> t.ifEmpty { "Ez a párszám már egy másik készülékhez van kötve." }
            in 500..599 -> "A szerver átmenetileg nem válaszol. Próbáld újra később."
            else -> t.ifEmpty { "A belépés most nem sikerült. Próbáld újra." }
        }
    }
}
