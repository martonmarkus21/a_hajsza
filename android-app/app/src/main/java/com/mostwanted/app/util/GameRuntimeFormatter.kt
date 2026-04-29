package com.mostwanted.app.util

import com.mostwanted.app.api.GameCountdownResponse

object GameRuntimeFormatter {
    fun statusLine(r: GameCountdownResponse): String {
        val head = when {
            r.isPastLastScheduledGameEnd == true -> "Játék: vége (ütemezés lejárt)"
            r.isGameActive == true -> "Játék: AKTÍV"
            r.gameEnabled != true -> "Játékmotor: ki"
            else -> "Játék: szünet / nincs aktív időablak"
        }
        val interval = r.currentIntervalMinutes ?: r.locationUpdateIntervalMinutes
        val intPart = if (interval != null) " • Minta: $interval perc" else ""
        val cs = r.campaignStatus?.trim()?.takeIf { it.isNotEmpty() }?.let { " • motor: $it" } ?: ""
        val cd = r.countdown
        val cdPart =
            if (cd != null && r.isGameActive == true) {
                val sec = cd.seconds.coerceIn(0, 59)
                val min = cd.minutes.coerceAtLeast(0)
                " • Köv. minta: $min:${String.format("%02d", sec)}"
            } else {
                ""
            }
        return head + intPart + cs + cdPart
    }
}
