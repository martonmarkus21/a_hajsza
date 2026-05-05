package com.celkereszt.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val CelkeresztDarkColorScheme: ColorScheme = darkColorScheme(
    primary = CkOrange,
    onPrimary = CkTextPrimary,
    secondary = CkOrangeSoft,
    onSecondary = CkTextPrimary,
    background = CkBgPrimary,
    onBackground = CkTextPrimary,
    surface = CkBgSecondary,
    onSurface = CkTextPrimary,
    surfaceVariant = CkSurfaceElevated,
    onSurfaceVariant = CkTextSecondary,
    outline = CkBorderStrong,
    error = CkError,
)

@Composable
fun CelkeresztTheme(
    useDarkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (useDarkTheme) {
        CelkeresztDarkColorScheme
    } else {
        CelkeresztDarkColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = CelkeresztTypography,
        content = content,
    )
}
