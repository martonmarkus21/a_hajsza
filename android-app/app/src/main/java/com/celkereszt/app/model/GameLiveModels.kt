package com.celkereszt.app.model

/** Főképernyő „élő állapot” blokkhoz: szöveg + opcionális ütem-sorok + ikonválaszték. */
enum class LiveDashboardIcon {
    /** Élő játék, rendes nap. */
    LivePlay,
    /** Élő játék, utolsó játéknap. */
    FinalDay,
    /** Játéknapok közötti pihenő. */
    BetweenDays,
    /** Vezérlő ki — nincs éles ütem. */
    GameOff,
    /** Motor készenlét / ütemre vár. */
    IdleWait,
    /** Általános szünet (egyéb). */
    Paused,
    /** Lejárt / lezárva. */
    Ended,
}

data class GameLiveStatusUi(
    val headline: String,
    val headlineIsActive: Boolean,
    val refreshedAtMillis: Long,
    val rows: List<GameStatusRowUi>,
    val scheduleSummaryLines: List<String> = emptyList(),
    val headerIcon: LiveDashboardIcon = LiveDashboardIcon.Paused,
)

data class GameStatusRowUi(
    val label: String,
    val value: String,
)
