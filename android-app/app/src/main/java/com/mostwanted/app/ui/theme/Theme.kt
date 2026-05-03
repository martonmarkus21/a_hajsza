package com.mostwanted.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val MostWantedDarkColorScheme: ColorScheme = darkColorScheme(
    primary = MwOrange,
    onPrimary = MwTextPrimary,
    secondary = MwOrangeSoft,
    onSecondary = MwTextPrimary,
    background = MwBgPrimary,
    onBackground = MwTextPrimary,
    surface = MwBgSecondary,
    onSurface = MwTextPrimary,
    surfaceVariant = MwSurfaceElevated,
    onSurfaceVariant = MwTextSecondary,
    outline = MwBorderStrong,
    error = MwError,
)

@Composable
fun MostWantedTheme(
    useDarkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (useDarkTheme) {
        MostWantedDarkColorScheme
    } else {
        MostWantedDarkColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = MostWantedTypography,
        content = content,
    )
}
