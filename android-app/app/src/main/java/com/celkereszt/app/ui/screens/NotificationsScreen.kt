package com.celkereszt.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.celkereszt.app.ui.components.BadgeTone
import com.celkereszt.app.ui.theme.CkOrange
import com.celkereszt.app.ui.theme.CkTextPrimary
import com.celkereszt.app.ui.theme.CkTextSecondary
import com.celkereszt.app.ui.components.AppGhostButton
import com.celkereszt.app.ui.components.AppGlassCard
import com.celkereszt.app.ui.components.QuickAdminActionsBlock
import com.celkereszt.app.ui.components.StatusBadge
import com.celkereszt.app.viewmodel.HomeUiState
import com.celkereszt.app.viewmodel.TimelineEventUi
import java.util.Locale

@Composable
fun NotificationsScreen(
    uiState: HomeUiState,
    onMarkEventRead: (Long) -> Unit,
    onMarkAllRead: () -> Unit,
    onClearEvents: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            AppGlassCard(modifier = Modifier.fillMaxWidth()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.NotificationsActive,
                        contentDescription = null,
                        tint = CkOrange.copy(alpha = 0.82f),
                    )
                    Text(
                        text = "Üzenetek",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = CkTextPrimary,
                    )
                }
                Spacer(modifier = Modifier.height(12.dp))
                QuickAdminActionsBlock(
                    onMarkAllRead = onMarkAllRead,
                    onClearEvents = onClearEvents,
                )
            }
        }

        if (uiState.events.isEmpty()) {
            item {
                AppGlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Nincs üzenet",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = CkTextPrimary,
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Ha érkezik fontos értesítés, itt fog megjelenni.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = CkTextSecondary,
                    )
                }
            }
        }

        items(
            items = uiState.events,
            key = { it.id },
        ) { event ->
            TimelineEventCard(
                event = event,
                onMarkRead = { onMarkEventRead(event.id) },
            )
        }
    }
}

private fun eventTypeLabel(type: String): String {
    return when (type.lowercase(Locale.ROOT)) {
        "session" -> "Munkamenet"
        "system" -> "Rendszer"
        "help_request" -> "Segítségkérés"
        "capture" -> "Elfogás"
        "capture_confirmed" -> "Elfogás megerősítve"
        "capture_reverted" -> "Elfogás visszavonva"
        "rule_violation" -> "Szabályszegés"
        "vehicle_time_exceeded" -> "Járműhasználat — idő túllépés"
        "game_area_exit" -> "Játékterület elhagyása"
        "tracking" -> "Követés"
        "security" -> "Biztonság"
        "message" -> "Üzenet"
        "game_day_ended" -> "Játéknap vége"
        "stay_rule_exit_warning" -> "Maradási szabály — figyelmeztetés"
        "stay_rule_exit_violation" -> "Maradási szabály — súlyosítás"
        "game_day_started" -> "Játéknap indulás"
        "scheduled_change_prelude" -> "Ütemezett változás előzetes"
        "scheduled_change_applied" -> "Ütemezett változás életbelépés"
        else -> type.replace('_', ' ')
            .split(' ')
            .joinToString(" ") { word ->
                word.replaceFirstChar { ch ->
                    if (ch.isLowerCase()) ch.titlecase(Locale.getDefault()) else ch.toString()
                }
            }
            .ifBlank { "Egyéb" }
    }
}

@Composable
private fun TimelineEventCard(
    event: TimelineEventUi,
    onMarkRead: () -> Unit,
) {
    AppGlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(18.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            StatusBadge(
                label = eventTypeLabel(event.type),
                tone = when (event.priority.lowercase(Locale.ROOT)) {
                    "high" -> BadgeTone.Error
                    "warning" -> BadgeTone.Warning
                    else -> BadgeTone.Info
                },
            )
            Text(
                text = event.timeLabel,
                style = MaterialTheme.typography.labelMedium,
                color = CkTextSecondary,
            )
        }
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = event.title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = CkTextPrimary,
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = event.body,
            style = MaterialTheme.typography.bodyMedium,
            color = CkTextSecondary,
            fontWeight = FontWeight.Normal,
        )
        if (!event.isRead) {
            Spacer(modifier = Modifier.height(10.dp))
            AppGhostButton(label = "Olvasottnak jelölés", onClick = onMarkRead)
        }
    }
}
