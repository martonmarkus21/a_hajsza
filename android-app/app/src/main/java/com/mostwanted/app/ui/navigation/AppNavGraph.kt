package com.mostwanted.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.mostwanted.app.ui.screens.LoginScreen
import com.mostwanted.app.ui.screens.MainScreen
import com.mostwanted.app.ui.screens.ServerSetupScreen
import com.mostwanted.app.viewmodel.AuthUiState
import com.mostwanted.app.viewmodel.HomeUiState

object Routes {
    const val Login = "login"
    const val Home = "home"
    const val SERVER_SETUP_PATTERN = "server_setup/{fromLogin}"
    fun serverSetup(fromLogin: Boolean): String =
        "server_setup/${if (fromLogin) 1 else 0}"
}

@Composable
fun AppNavGraph(
    navController: NavHostController,
    startDestination: String,
    authUiState: AuthUiState,
    homeUiState: HomeUiState,
    clockTick: Int,
    pairNumber: Int,
    onPairNumberChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onLoginClick: () -> Unit,
    onNavigateToServerSetup: () -> Unit,
    onServerSetupComplete: () -> Unit,
    onHelpClick: () -> Unit,
    onVehicleToggle: () -> Unit,
    onLogoutClick: () -> Unit,
    onMarkEventRead: (Long) -> Unit,
    onMarkAllRead: () -> Unit,
    onClearEvents: () -> Unit,
) {
    NavHost(
        navController = navController,
        startDestination = startDestination,
    ) {
        composable(Routes.Login) {
            LoginScreen(
                uiState = authUiState,
                onPairNumberChange = onPairNumberChange,
                onPasswordChange = onPasswordChange,
                onLoginClick = onLoginClick,
                onChangeServerClick = onNavigateToServerSetup,
            )
        }
        composable(Routes.Home) {
            MainScreen(
                pairNumber = pairNumber,
                uiState = homeUiState,
                clockTick = clockTick,
                onHelpClick = onHelpClick,
                onVehicleToggle = onVehicleToggle,
                onLogoutClick = onLogoutClick,
                onMarkEventRead = onMarkEventRead,
                onMarkAllRead = onMarkAllRead,
                onClearEvents = onClearEvents,
            )
        }
        composable(
            route = Routes.SERVER_SETUP_PATTERN,
            arguments = listOf(
                navArgument("fromLogin") {
                    type = NavType.IntType
                    defaultValue = 0
                },
            ),
        ) { entry ->
            val fromLogin = (entry.arguments?.getInt("fromLogin") ?: 0) == 1
            ServerSetupScreen(
                fromLogin = fromLogin,
                onFinished = onServerSetupComplete,
                onBackFromLoginFlow = { navController.popBackStack() },
            )
        }
    }
}
