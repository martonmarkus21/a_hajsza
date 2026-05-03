package com.mostwanted.app.ui.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.mostwanted.app.ui.components.AppBackdrop
import com.mostwanted.app.ui.components.UnreadNavBadge
import com.mostwanted.app.ui.theme.MwOrangeSoft
import com.mostwanted.app.viewmodel.HomeUiState

private const val TAB_DASH = "dash"
private const val TAB_ALERTS = "alerts"

/** Ugyanaz az RGB mint a NavigationBar (0xB0141418), de fedő szín a rendszer gesztus-sáv alá húzásához */
private val MainNavigationBarSurface = Color(0xFF141418)

@Composable
fun MainScreen(
    pairNumber: Int,
    uiState: HomeUiState,
    clockTick: Int,
    onHelpClick: () -> Unit,
    onVehicleToggle: () -> Unit,
    onLogoutClick: () -> Unit,
    onMarkEventRead: (Long) -> Unit,
    onMarkAllRead: () -> Unit,
    onClearEvents: () -> Unit,
) {
    var tab by rememberSaveable { mutableStateOf(TAB_DASH) }

    AppBackdrop {
        Scaffold(
            containerColor = Color.Transparent,
            bottomBar = {
                NavigationBar(
                    modifier = Modifier.fillMaxWidth(),
                    containerColor = MainNavigationBarSurface,
                    tonalElevation = 6.dp,
                ) {
                    NavigationBarItem(
                        selected = tab == TAB_DASH,
                        onClick = { tab = TAB_DASH },
                        icon = {
                            Icon(Icons.Rounded.Home, contentDescription = "Kezdőlap")
                        },
                        label = { Text("Kezdőlap") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MwOrangeSoft,
                            selectedTextColor = MwOrangeSoft,
                            indicatorColor = Color(0x331F2937),
                        ),
                    )
                    NavigationBarItem(
                        selected = tab == TAB_ALERTS,
                        onClick = { tab = TAB_ALERTS },
                        icon = {
                            Box {
                                Icon(
                                    Icons.Rounded.Notifications,
                                    contentDescription = "Üzenetek",
                                    modifier = Modifier.size(26.dp),
                                )
                                val unread = uiState.unreadEventCount
                                if (unread > 0) {
                                    UnreadNavBadge(
                                        count = unread,
                                        modifier = Modifier.align(Alignment.TopEnd),
                                    )
                                }
                            }
                        },
                        label = { Text("Üzenetek") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MwOrangeSoft,
                            selectedTextColor = MwOrangeSoft,
                            indicatorColor = Color(0x331F2937),
                        ),
                    )
                }
            },
        ) { inset ->
            Box(
                Modifier
                    .fillMaxSize()
                    .padding(inset),
            ) {
                when (tab) {
                    TAB_DASH -> {
                        DashboardScreen(
                            pairNumber = pairNumber,
                            uiState = uiState,
                            clockTick = clockTick,
                            onHelpClick = onHelpClick,
                            onVehicleToggle = onVehicleToggle,
                            onLogoutClick = onLogoutClick,
                            onOpenNotifications = { tab = TAB_ALERTS },
                        )
                    }

                    TAB_ALERTS -> {
                        NotificationsScreen(
                            uiState = uiState,
                            onMarkEventRead = onMarkEventRead,
                            onMarkAllRead = onMarkAllRead,
                            onClearEvents = onClearEvents,
                        )
                    }
                }
            }
        }
    }
}
