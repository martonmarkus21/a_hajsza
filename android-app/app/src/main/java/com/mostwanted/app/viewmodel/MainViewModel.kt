package com.mostwanted.app.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mostwanted.app.api.ApiService
import com.mostwanted.app.api.GameCountdownResponse
import com.mostwanted.app.model.GameLiveStatusUi
import com.mostwanted.app.repository.EventRepository
import com.mostwanted.app.util.GameLiveStatusMapper
import com.mostwanted.app.util.GameRuntimeFormatter
import com.mostwanted.app.util.PreferencesHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class HomeUiState(
    val message: String = "",
    val liveGameStatus: GameLiveStatusUi? = null,
    val liveGameStatusFallbackLine: String = "Állapot betöltése…",
    val pairCaptured: Boolean = false,
    val hasActiveRuleViolation: Boolean = false,
    val vehicleMode: Boolean = false,
    val unreadEventCount: Int = 0,
    val events: List<TimelineEventUi> = emptyList(),
    /** Visszaszámláló: pillanat, amikor a szervertől kaptuk a pillanatképet (epoch ms). */
    val countdownAnchorMillis: Long = 0L,
    /** Összes másodperc a pillanatképnél (játék aktív + van countdown). */
    val countdownTotalSeconds: Int? = null,
    val countdownGameActive: Boolean = false,
)

data class TimelineEventUi(
    val id: Long,
    val title: String,
    val body: String,
    val type: String,
    val priority: String,
    val timeLabel: String,
    val isRead: Boolean,
)

class MainViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState

    /** Másodpercenként növekvő számláló — a UI ebből számolja a hátralévő időt. */
    private val _clockTick = MutableStateFlow(0)
    val clockTick: StateFlow<Int> = _clockTick

    private val VEHICLE_TIME_LIMIT_MS = 40 * 60 * 1000L
    private var vehicleTimer: android.os.Handler? = null
    private var eventsInitialized = false
    private var clockJob: Job? = null

    fun loadVehicleState(context: Context) {
        val prefs = PreferencesHelper(context)
        val storedVehicleMode = prefs.isVehicleMode()
        _uiState.update { current ->
            current.copy(vehicleMode = storedVehicleMode)
        }
    }

    fun initialize(context: Context) {
        if (!eventsInitialized) {
            eventsInitialized = true
            val repository = EventRepository(context.applicationContext)
            viewModelScope.launch {
                repository.observeLatestEvents().collectLatest { events ->
                    val mappedEvents = events.map { entity ->
                        val captureEn =
                            entity.type.equals("capture_confirmed", ignoreCase = true) ||
                                entity.title.contains("capture confirmed", ignoreCase = true) ||
                                entity.body.contains("capture confirmed", ignoreCase = true)
                        val displayTitle =
                            if (captureEn && entity.title.contains("capture confirmed", ignoreCase = true)) {
                                "Elfogás megerősítve"
                            } else {
                                entity.title
                            }
                        val displayBody =
                            if (captureEn &&
                                (entity.body.isBlank() || entity.body.contains("capture confirmed", ignoreCase = true))
                            ) {
                                "Elfogtak titeket. Kövesd a szervezők utasításait."
                            } else {
                                entity.body
                            }
                        TimelineEventUi(
                            id = entity.id,
                            title = displayTitle,
                            body = displayBody,
                            type = entity.type,
                            priority = entity.priority,
                            timeLabel = formatTimeRelative(entity.receivedAtMillis),
                            isRead = entity.isRead,
                        )
                    }
                    _uiState.update { current ->
                        current.copy(
                            events = mappedEvents,
                            unreadEventCount = mappedEvents.count { !it.isRead },
                        )
                    }
                }
            }
        }
    }

    fun prepareSessionUi() {
        _uiState.update {
            it.copy(
                message = "Itt jelennek meg a fontos értesítések.",
            )
        }
    }

    fun startLiveClock() {
        clockJob?.cancel()
        clockJob = viewModelScope.launch {
            while (isActive) {
                _clockTick.update { it + 1 }
                delay(1000L)
            }
        }
    }

    fun stopLiveClock() {
        clockJob?.cancel()
        clockJob = null
    }

    fun resetAllSessionUi(context: Context) {
        stopLiveClock()
        _uiState.value = HomeUiState()
        loadVehicleState(context)
    }

    fun updateLiveStatusFromResponse(response: GameCountdownResponse) {
        val structured = GameLiveStatusMapper.fromResponse(response)
        val line = GameRuntimeFormatter.statusLine(response)
        val cd = response.countdown
        val totalSec =
            if (response.isGameActive == true && cd != null) {
                cd.minutes.coerceAtLeast(0) * 60 + cd.seconds.coerceIn(0, 59)
            } else {
                null
            }
        val anchor =
            if (totalSec != null && totalSec > 0) {
                System.currentTimeMillis()
            } else {
                0L
            }
        val ruleViol = !(response.activeRuleViolations.isNullOrEmpty())
        _uiState.update {
            it.copy(
                liveGameStatus = structured,
                liveGameStatusFallbackLine = line,
                pairCaptured = response.pairCaptured == true,
                hasActiveRuleViolation = ruleViol,
                countdownAnchorMillis = anchor,
                countdownTotalSeconds = totalSec,
                countdownGameActive = response.isGameActive == true,
            )
        }
    }

    fun updateRuntimeSummaryLineFallback(line: String) {
        _uiState.update { it.copy(liveGameStatusFallbackLine = line) }
    }

    fun startVehicle(context: Context) {
        val prefs = PreferencesHelper(context)
        val startTime = System.currentTimeMillis()

        _uiState.update { current ->
            current.copy(vehicleMode = true)
        }
        prefs.setVehicleMode(true, startTime)

        vehicleTimer?.removeCallbacksAndMessages(null)

        vehicleTimer = android.os.Handler(android.os.Looper.getMainLooper()).apply {
            postDelayed({
                if (!_uiState.value.vehicleMode) return@postDelayed
                val appCtx = context.applicationContext
                viewModelScope.launch(Dispatchers.IO) {
                    try {
                        ApiService.create(appCtx).postVehicleSessionExpired()
                    } catch (_: Exception) {
                    }
                    withContext(Dispatchers.Main) {
                        if (_uiState.value.vehicleMode) {
                            updateMessage("A jármű üzemmód ideje letelt — visszaálltunk gyalogos követésre.")
                            stopVehicle(context)
                        }
                    }
                }
            }, VEHICLE_TIME_LIMIT_MS)
        }

        updateMessage("Jármű üzemmód bekapcsolva — legfeljebb 40 percig tart.")
    }

    fun stopVehicle(context: Context) {
        _uiState.update { current ->
            current.copy(vehicleMode = false)
        }
        val prefs = PreferencesHelper(context)
        prefs.setVehicleMode(false, 0)

        vehicleTimer?.removeCallbacksAndMessages(null)
        vehicleTimer = null

        updateMessage("Gyalogos követés: jármű jelzés kikapcsolva.")
    }

    fun updateMessage(newMessage: String) {
        _uiState.update { current ->
            current.copy(message = newMessage)
        }
    }

    fun pushSystemEvent(
        context: Context,
        title: String,
        body: String,
        type: String = "system",
        priority: String = "normal",
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            EventRepository(context.applicationContext).addEvent(
                title = title,
                body = body,
                type = type,
                priority = priority,
            )
        }
    }

    fun markEventRead(context: Context, eventId: Long) {
        viewModelScope.launch(Dispatchers.IO) {
            EventRepository(context.applicationContext).markRead(eventId)
        }
    }

    fun markAllEventsRead(context: Context) {
        viewModelScope.launch(Dispatchers.IO) {
            EventRepository(context.applicationContext).markAllRead()
        }
    }

    fun clearEvents(context: Context) {
        viewModelScope.launch(Dispatchers.IO) {
            EventRepository(context.applicationContext).clearAll()
        }
    }

    override fun onCleared() {
        super.onCleared()
        vehicleTimer?.removeCallbacksAndMessages(null)
        stopLiveClock()
    }

    private fun formatTimeRelative(timestamp: Long): String {
        val dayFmt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val today = dayFmt.format(Date())
        val eventDay = dayFmt.format(Date(timestamp))
        val clock = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(timestamp))
        return if (eventDay == today) {
            "Ma, $clock"
        } else {
            "$eventDay $clock"
        }
    }
}
