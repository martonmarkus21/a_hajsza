package com.celkereszt.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.HelpOutline
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.ChatBubbleOutline
import androidx.compose.material.icons.rounded.DirectionsCar
import androidx.compose.material.icons.rounded.Flag
import androidx.compose.material.icons.rounded.NightsStay
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.PauseCircle
import androidx.compose.material.icons.rounded.PlayCircle
import androidx.compose.material.icons.rounded.PowerSettingsNew
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.TaskAlt
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.celkereszt.app.R
import com.celkereszt.app.model.LiveDashboardIcon
import com.celkereszt.app.ui.components.AppButton
import com.celkereszt.app.ui.components.AppDangerOutlinedButton
import com.celkereszt.app.ui.components.AppGlassCard
import com.celkereszt.app.ui.components.AppOutlinedActionButton
import com.celkereszt.app.ui.components.AppPairNumberBadge
import com.celkereszt.app.ui.components.UnreadCountPill
import com.celkereszt.app.ui.theme.CkOrange
import com.celkereszt.app.ui.theme.CkTextMuted
import com.celkereszt.app.ui.theme.CkTextPrimary
import com.celkereszt.app.ui.theme.CkTextSecondary
import com.celkereszt.app.util.LiveCountdownFormatter
import com.celkereszt.app.viewmodel.HomeUiState
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun DashboardScreen(
    pairNumber: Int,
    uiState: HomeUiState,
    clockTick: Int,
    onHelpClick: () -> Unit,
    onVehicleToggle: () -> Unit,
    onLogoutClick: () -> Unit,
    onOpenNotifications: () -> Unit,
) {
    val timeFmt = remember {
        SimpleDateFormat("HH:mm:ss", Locale.forLanguageTag("hu-HU"))
    }
    val live = uiState.liveGameStatus

    val countdownText = remember(
        uiState.countdownAnchorMillis,
        uiState.countdownTotalSeconds,
        uiState.countdownGameActive,
        clockTick,
    ) {
        LiveCountdownFormatter.remainingMmSs(
            uiState.countdownAnchorMillis,
            uiState.countdownTotalSeconds,
            uiState.countdownGameActive,
        )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Image(
                    painter = painterResource(id = R.drawable.celkereszt_logomark),
                    contentDescription = null,
                    modifier = Modifier
                        .height(40.dp)
                        .width(44.dp),
                    contentScale = ContentScale.Fit,
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Célkereszt",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = CkTextPrimary,
                    )
                    Text(
                        text = "Állapot és üzenetek",
                        style = MaterialTheme.typography.bodySmall,
                        color = CkTextSecondary,
                    )
                }
                if (pairNumber > 0) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "pár",
                            style = MaterialTheme.typography.labelSmall,
                            color = CkTextMuted,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        AppPairNumberBadge(
                            numberText = pairNumber.toString(),
                            size = 54.dp,
                            captured = uiState.pairCaptured,
                            showRuleViolationBadge = uiState.hasActiveRuleViolation && !uiState.pairCaptured,
                        )
                    }
                }
            }
        }

        item {
            AppGlassCard(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(18.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    val (statusIcon, statusTint) = statusIconFor(live?.headerIcon, live?.headlineIsActive == true)
                    Icon(
                        imageVector = statusIcon,
                        contentDescription = null,
                        tint = statusTint,
                        modifier = Modifier.size(30.dp),
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Élő pályaállapot",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = CkTextPrimary,
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = live?.headline ?: uiState.liveGameStatusFallbackLine,
                            style = MaterialTheme.typography.bodyLarge,
                            color = if (live?.headlineIsActive == true) CkTextPrimary else CkTextSecondary,
                            fontWeight = FontWeight.Medium,
                        )
                        live?.let { s ->
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.CalendarMonth,
                                    contentDescription = null,
                                    tint = CkTextMuted,
                                    modifier = Modifier.size(14.dp),
                                )
                                Text(
                                    text = "Utolsó frissítés: ${timeFmt.format(Date(s.refreshedAtMillis))}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = CkTextMuted,
                                )
                            }
                        }
                    }
                }

                if (live != null && live.scheduleSummaryLines.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider(color = Color(0x14FFFFFF), thickness = 1.dp)
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Ütemezés",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = CkTextMuted,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    live.scheduleSummaryLines.forEach { line ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.Top,
                        ) {
                            Text(
                                text = "•",
                                style = MaterialTheme.typography.bodyMedium,
                                color = CkOrange.copy(alpha = 0.75f),
                            )
                            Text(
                                text = line,
                                style = MaterialTheme.typography.bodyMedium,
                                color = CkTextSecondary,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }

                if (countdownText != null && !uiState.pairCaptured) {
                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider(color = Color(0x14FFFFFF), thickness = 1.dp)
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Következő helyzetjelzésig",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.SemiBold,
                            color = CkTextMuted,
                        )
                        Text(
                            text = countdownText,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = CkOrange,
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                if (live != null && live.rows.isNotEmpty()) {
                    live.rows.forEachIndexed { idx, row ->
                        if (idx > 0) {
                            HorizontalDivider(
                                modifier = Modifier.padding(vertical = 10.dp),
                                color = Color(0x12FFFFFF),
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                text = row.label,
                                modifier = Modifier.weight(0.48f),
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.SemiBold,
                                color = CkTextMuted,
                            )
                            Text(
                                text = row.value,
                                modifier = Modifier.weight(0.5f),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = CkTextPrimary,
                            )
                        }
                    }
                } else if (live == null) {
                    Text(
                        text = "A szerver válaszára várunk — ez néhány másodpercig eltarthat.",
                        style = MaterialTheme.typography.bodySmall,
                        color = CkTextMuted,
                    )
                }
            }
        }

        item {
            AppGlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(18.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.ChatBubbleOutline,
                        contentDescription = null,
                        tint = CkOrange.copy(alpha = 0.85f),
                        modifier = Modifier.size(22.dp),
                    )
                    Text(
                        text = "Üzenetek",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = CkTextPrimary,
                    )
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = if (uiState.message.isBlank()) {
                        "Nincs új üzenet."
                    } else {
                        uiState.message
                    },
                    style = MaterialTheme.typography.bodyLarge,
                    color = if (uiState.message.isBlank()) CkTextMuted else CkTextPrimary,
                )
            }
        }

        item {
            AppGlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(18.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Bolt,
                        contentDescription = null,
                        tint = CkOrange.copy(alpha = 0.85f),
                        modifier = Modifier.size(22.dp),
                    )
                    Text(
                        text = "Gyors parancsok",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = CkTextPrimary,
                    )
                }
                Spacer(modifier = Modifier.height(14.dp))
                AppButton(
                    label = "Segítségkérés küldése",
                    onClick = onHelpClick,
                    leadingIcon = Icons.AutoMirrored.Rounded.HelpOutline,
                )
                Spacer(modifier = Modifier.height(10.dp))
                AppOutlinedActionButton(
                    label = if (uiState.vehicleMode) {
                        "Jármű üzemód leállítása"
                    } else {
                        "Jármű üzemód indítása"
                    },
                    onClick = onVehicleToggle,
                    icon = Icons.Rounded.DirectionsCar,
                )
                Spacer(modifier = Modifier.height(12.dp))
                AppDangerOutlinedButton(
                    label = "Kijelentkezés",
                    onClick = onLogoutClick,
                    leadingIcon = Icons.AutoMirrored.Rounded.Logout,
                )
            }
        }

        if (uiState.unreadEventCount > 0) {
            item {
                AppGlassCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onOpenNotifications),
                    contentPadding = PaddingValues(18.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.NotificationsActive,
                                contentDescription = null,
                                tint = CkOrange,
                                modifier = Modifier.size(24.dp),
                            )
                            Text(
                                text = "Olvasatlan üzenetek",
                                style = MaterialTheme.typography.titleSmall,
                                color = CkTextPrimary,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        UnreadCountPill(count = uiState.unreadEventCount)
                    }
                }
            }
        }
    }
}

private fun statusIconFor(
    kind: LiveDashboardIcon?,
    headlineActive: Boolean,
): Pair<ImageVector, Color> {
    return when (kind) {
        LiveDashboardIcon.FinalDay ->
            Icons.Rounded.Flag to CkOrange
        LiveDashboardIcon.LivePlay ->
            Icons.Rounded.PlayCircle to CkOrange
        LiveDashboardIcon.Ended ->
            Icons.Rounded.TaskAlt to CkTextSecondary
        LiveDashboardIcon.BetweenDays ->
            Icons.Rounded.NightsStay to CkTextSecondary
        LiveDashboardIcon.GameOff ->
            Icons.Rounded.PowerSettingsNew to CkTextMuted
        LiveDashboardIcon.IdleWait ->
            Icons.Rounded.Schedule to CkTextSecondary
        LiveDashboardIcon.Paused ->
            Icons.Rounded.PauseCircle to CkTextSecondary
        null ->
            if (headlineActive) Icons.Rounded.PlayCircle to CkOrange
            else Icons.Rounded.PauseCircle to CkTextSecondary
    }
}
