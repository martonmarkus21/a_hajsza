package com.mostwanted.app.util

/** A szerver által küldött visszaszámláló pillanatkép alapján másodpercenként frissíthető szöveg. */
object LiveCountdownFormatter {
    fun remainingMmSs(anchorMillis: Long, totalSeconds: Int?, gameActive: Boolean): String? {
        if (!gameActive || totalSeconds == null || totalSeconds <= 0 || anchorMillis <= 0L) {
            return null
        }
        val elapsed = ((System.currentTimeMillis() - anchorMillis) / 1000L).toInt().coerceAtLeast(0)
        val remaining = (totalSeconds - elapsed).coerceAtLeast(0)
        val m = remaining / 60
        val s = remaining % 60
        return String.format("%d:%02d", m, s)
    }
}
