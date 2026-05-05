package com.celkereszt.app.util

import com.celkereszt.app.api.GameCountdownResponse
import java.util.Locale

object GameRuntimeFormatter {
    /** Rövid sor a rendszer-értesítéshez (kevesebb technikai részlet). */
    fun foregroundStatus(r: GameCountdownResponse): String {
        return when {
            r.isPastLastScheduledGameEnd == true -> "A játék lezárult."
            r.isGameActive == true -> {
                val interval = r.currentIntervalMinutes ?: r.locationUpdateIntervalMinutes
                val minta = if (interval != null) " • Minta: ${interval} p" else ""
                val cd = r.countdown
                val kov =
                    if (cd != null) {
                        val sec = cd.seconds.coerceIn(0, 59)
                        val min = cd.minutes.coerceAtLeast(0)
                        " • Köv: $min:${String.format(Locale.US, "%02d", sec)}"
                    } else {
                        ""
                    }
                "Játék fut$minta$kov"
            }
            r.gameEnabled != true -> "Játékmotor ki."
            else -> when (r.campaignStatus?.trim()?.uppercase(Locale.ROOT)) {
                "PAUSED_BETWEEN_DAYS" -> "Pihenő — játéknapok között."
                "IDLE" -> "Játék: készenlét."
                else -> "Játék: nincs élő időablak."
            }
        }
    }

    fun statusLine(r: GameCountdownResponse): String {
        val head = when {
            r.isPastLastScheduledGameEnd == true -> "Játék: vége (ütemezés lejárt)"
            r.isGameActive == true -> "Játék: AKTÍV"
            r.gameEnabled != true -> "Játékmotor: ki"
            else -> "Játék: szünet / nincs aktív időablak"
        }
        val interval = r.currentIntervalMinutes ?: r.locationUpdateIntervalMinutes
        val intPart = if (interval != null) " • Minta: $interval perc" else ""
        val cd = r.countdown
        val cdPart =
            if (cd != null && r.isGameActive == true) {
                val sec = cd.seconds.coerceIn(0, 59)
                val min = cd.minutes.coerceAtLeast(0)
                " • Köv. minta: $min:${String.format(Locale.US, "%02d", sec)}"
            } else {
                ""
            }
        return head + intPart + cdPart
    }
}
