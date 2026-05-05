package com.celkereszt.app.util

import com.celkereszt.app.api.GameCountdownResponse
import com.celkereszt.app.model.GameLiveStatusUi
import com.celkereszt.app.model.GameStatusRowUi
import com.celkereszt.app.model.LiveDashboardIcon
import java.util.Locale

/** Csak a párok számára értelmes, rövid mezők — gépies / adatbázis jellegű sorok nélkül. */
object GameLiveStatusMapper {

    /** Egy számjegyre kerekítve, magyar típusjel — `5 km` vs `5,5 km`. */
    private fun formatKmRadiusHu(km: Double?): String {
        val v = km ?: 5.0
        val scaled = kotlin.math.round(v * 10.0) / 10.0
        val s =
            String.format(Locale.forLanguageTag("hu-HU"), "%.1f", scaled)
                .trimEnd('0')
                .trimEnd(',')
        return if (s.isEmpty()) "5 km" else "$s km"
    }

    private fun sanitizedStayRadiusKm(raw: Double?): Double {
        val v = raw
        return if (v == null || v.isNaN() || !v.isFinite() || v <= 0) 5.0 else v
    }

    fun fromResponse(r: GameCountdownResponse): GameLiveStatusUi {
        val now = System.currentTimeMillis()

        val (headline, active) = when {
            r.isPastLastScheduledGameEnd == true ->
                "A teljes játékülés lezárult." to false
            r.isGameActive == true ->
                "Most tart a beütemezett játék." to true
            r.gameEnabled != true ->
                "A játékvezérlő ki van kapcsolva." to false
            else ->
                "Jelenleg szünet van — nincs élő kötelező követés." to false
        }

        val interval = r.currentIntervalMinutes ?: r.locationUpdateIntervalMinutes

        val headerIcon = pickHeaderIcon(r)

        val summaryFromServer =
            r.pairScheduleLines
                ?.map { it.trim() }
                ?.filter { it.isNotEmpty() }
                ?: emptyList()

        val rows = buildList {
            add(
                GameStatusRowUi(
                    label = "Játékvezérlő",
                    value = if (r.gameEnabled == true) "bekapcsolva" else "kikapcsolva",
                ),
            )
            add(
                GameStatusRowUi(
                    label = "Ütem szerinti játék",
                    value = when {
                        r.isPastLastScheduledGameEnd == true -> "lezárult"
                        r.isGameActive == true -> "fut"
                        r.gameEnabled != true -> "vár (vezérlő ki)"
                        else -> "nem aktív ablak"
                    },
                ),
            )
            run {
                val rad = formatKmRadiusHu(sanitizedStayRadiusKm(r.stayRadiusKm))
                val msg =
                    if (r.stayRuleEnabled) {
                        "aktív — $rad"
                    } else {
                        "kikapcsolva"
                    }
                add(GameStatusRowUi(label = "Maradási szabály", value = msg))
            }
            if (interval != null) {
                add(
                    GameStatusRowUi(
                        label = "Helyzetjelentés gyakorisága",
                        value = "kb. $interval percenként",
                    ),
                )
            }

            r.todayGameDay?.let { gd ->
                val d = gd.date?.trim().orEmpty()
                val st = gd.startTime?.trim().orEmpty()
                val en = gd.endTime?.trim().orEmpty()
                if (d.isNotEmpty() && st.isNotEmpty() && en.isNotEmpty()) {
                    add(
                        GameStatusRowUi(
                            label = "Mai beütemezett időszak",
                            value = formatHuDateShort(d) + " — $st–$en",
                        ),
                    )
                }
            }

            r.nextGameDay?.let { nd ->
                val d = nd.date?.trim().orEmpty()
                val st = nd.startTime?.trim().orEmpty()
                val en = nd.endTime?.trim().orEmpty()
                if (d.isNotEmpty() && st.isNotEmpty() && en.isNotEmpty()) {
                    add(
                        GameStatusRowUi(
                            label = "Következő beütemezett nap",
                            value = formatHuDateShort(d) + " — $st–$en",
                        ),
                    )
                }
            }

            val motor = r.campaignStatus?.trim()?.takeIf { it.isNotEmpty() }
            if (motor != null) {
                add(
                    GameStatusRowUi(
                        label = "Játék állapota",
                        value = humanizeCampaignStatus(motor),
                    ),
                )
            }
        }

        return GameLiveStatusUi(
            headline = headline,
            headlineIsActive = active,
            refreshedAtMillis = now,
            rows = rows,
            scheduleSummaryLines = summaryFromServer,
            headerIcon = headerIcon,
        )
    }

    private fun pickHeaderIcon(r: GameCountdownResponse): LiveDashboardIcon {
        val motor = sanitizeStatusSlug(r.campaignStatus?.trim() ?: "")
        return when {
            r.isPastLastScheduledGameEnd == true -> LiveDashboardIcon.Ended
            r.isGameActive == true && r.todayGameDay?.isFinalDay == true -> LiveDashboardIcon.FinalDay
            r.isGameActive == true -> LiveDashboardIcon.LivePlay
            r.gameEnabled != true -> LiveDashboardIcon.GameOff
            motor == "PAUSED_BETWEEN_DAYS" -> LiveDashboardIcon.BetweenDays
            motor == "IDLE" -> LiveDashboardIcon.IdleWait
            else -> LiveDashboardIcon.Paused
        }
    }

    private fun formatHuDateShort(isoYmd: String): String {
        val parts = isoYmd.split('-')
        if (parts.size != 3) return isoYmd
        return "${parts[1]}.${parts[2]}."
    }

    private fun humanizeCampaignStatus(raw: String): String {
        val slug = sanitizeStatusSlug(raw)

        return when {
            slug == "RUNNING" -> "Élő követés fut."
            slug == "IDLE" -> "Nincs éles követés — rendszer készenlétben."
            slug == "FINISHED" -> "A játék lezárult."
            slug == "PAUSED_BETWEEN_DAYS" -> "Játéknapok közötti pihenő."
            slug == "PAUSED" || slug.startsWith("PAUSED_") -> "Átmeneti szünet."
            slug == "STOPPED" || slug == "STOP" -> "Leállítva."
            slug == "ERROR" -> "Hiba történt — próbálj meg később frissíteni."
            slug == "PENDING" -> "Felkészülés / várakozás."
            slug == "COMPLETE" || slug == "COMPLETED" || slug == "DONE" -> "Befejezve."
            else -> friendlyFallback(slug)
        }
    }

    private fun sanitizeStatusSlug(raw: String): String {
        val lower = raw.trim().lowercase(Locale.ROOT)
        val smashed = lower.replace(" ", "").replace("-", "").replace("__", "_")
        if (
            smashed.contains("pausedbetweendays") ||
            smashed.contains("szünetel_between") ||
            smashed.contains("betweendays")
        ) {
            return "PAUSED_BETWEEN_DAYS"
        }
        var t = raw.trim().uppercase(Locale.ROOT).replace('-', '_').replace(Regex("\\s+"), "_")
        if (t.contains("PAUSED_BETWEEN_DAYS")) return "PAUSED_BETWEEN_DAYS"
        if (t.contains("BETWEEN_DAYS") && t.contains("PAUSED")) return "PAUSED_BETWEEN_DAYS"
        return t
    }

    private fun friendlyFallback(slug: String): String {
        val cleaned = slug
            .replace("_", " ")
            .lowercase(Locale.getDefault())
            .replaceFirstChar { ch ->
                if (ch.isLowerCase()) ch.titlecase(Locale.getDefault()) else ch.toString()
            }
        return if (cleaned.isBlank()) "Ismeretlen állapot." else cleaned
    }
}
