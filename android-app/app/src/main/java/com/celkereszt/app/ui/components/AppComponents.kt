package com.celkereszt.app.ui.components

/**
 * Központi, márka-független Compose építőelemek ([App]*) — egy későbbi arculatváltáshoz nem kell név szerint ragozni a logót.
 */

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.DoneAll
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.celkereszt.app.ui.theme.CkError
import com.celkereszt.app.ui.theme.CkOrange
import com.celkereszt.app.ui.theme.CkOrangeEnd
import com.celkereszt.app.ui.theme.CkOrangeStart
import com.celkereszt.app.ui.theme.CkSuccess
import com.celkereszt.app.ui.theme.CkSurfaceCard
import com.celkereszt.app.ui.theme.CkOrangeSoft
import com.celkereszt.app.ui.theme.CkTextMuted
import com.celkereszt.app.ui.theme.CkTextPrimary
import com.celkereszt.app.ui.theme.CkTextSecondary

@Composable
fun AppBackdrop(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                brush = Brush.linearGradient(
                    colors = listOf(
                        Color(0xFF121015),
                        Color(0xFF0A0A0C),
                        Color(0xFF050508),
                    ),
                    start = Offset.Zero,
                    end = Offset(880f, 1680f),
                ),
            ),
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .offset((-148).dp, (-200).dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(420.dp)
                        .blur(100.dp)
                        .background(
                            brush = Brush.radialGradient(
                                colors = listOf(
                                    Color(0x55F97316),
                                    Color(0x33EA580C),
                                    Color(0x18FB923C),
                                    Color.Transparent,
                                ),
                            ),
                            shape = CircleShape,
                        ),
                )
            }
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(40.dp, (-60).dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(340.dp)
                        .blur(104.dp)
                        .background(
                            brush = Brush.radialGradient(
                                colors = listOf(
                                    Color(0x44EA580C),
                                    Color(0x22C2410C),
                                    Color(0x12F97316),
                                    Color.Transparent,
                                ),
                            ),
                            shape = CircleShape,
                        ),
                )
            }
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .offset(40.dp, 260.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(460.dp)
                        .blur(110.dp)
                        .background(
                            brush = Brush.radialGradient(
                                colors = listOf(
                                    Color(0x38F97316),
                                    Color(0x1AEA580C),
                                    Color(0x10FB923C),
                                    Color.Transparent,
                                ),
                            ),
                            shape = CircleShape,
                        ),
                )
            }
        }
        Box(
            modifier = Modifier
                .fillMaxSize()
                // Csak felül (státusz + jegyzet: alsó insetet a képernyők kezelik, pl. nav sáv / login)
                .windowInsetsPadding(WindowInsets.statusBars),
        ) {
            content()
        }
    }
}

@Composable
fun AppGlassCard(
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(22.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(28.dp)
    val rim = Brush.linearGradient(
        colors = listOf(
            Color.White.copy(alpha = 0.22f),
            Color.White.copy(alpha = 0.08f),
            Color.White.copy(alpha = 0.03f),
        ),
        start = Offset(0f, 0f),
        end = Offset(480f, 720f),
    )
    Box(
        modifier = modifier
            .clip(shape)
            .border(BorderStroke(1.dp, rim), shape)
            .background(Color(0x75201814), shape),
    ) {
        Box(
            Modifier
                .matchParentSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0x100A0908),
                            Color(0x08FFFFFF),
                            Color(0x55000000),
                        ),
                    ),
                ),
        )
        Column(modifier = Modifier.padding(contentPadding)) {
            content()
        }
    }
}

@Composable
fun AppCard(
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(20.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(22.dp)
    val rim = Brush.linearGradient(
        colors = listOf(
            Color.White.copy(alpha = 0.14f),
            Color.White.copy(alpha = 0.05f),
        ),
        start = Offset(0f, 0f),
        end = Offset(400f, 400f),
    )
    Box(
        modifier = modifier
            .clip(shape)
            .border(BorderStroke(1.dp, rim), shape)
            .background(CkSurfaceCard, shape),
    ) {
        Column(modifier = Modifier.padding(contentPadding)) {
            content()
        }
    }
}

@Composable
fun AppSectionTitle(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    icon: ImageVector? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (icon != null) {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = Color(0x18F97316),
                border = BorderStroke(1.dp, CkOrange.copy(alpha = 0.35f)),
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = CkOrangeSoft,
                    modifier = Modifier.padding(10.dp),
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                color = CkTextPrimary,
            )
            if (!subtitle.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = CkTextSecondary,
                )
            }
        }
    }
}

enum class AppButtonVariant {
    /** Elsődleges, kitöltött gomb (prominens CTA). */
    Primary,
    /** Másodlagos, semleges kitöltés (pl. mellékművelet). */
    Secondary,
}

@Composable
fun AppButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: ImageVector? = null,
    trailingIcon: ImageVector? = null,
    variant: AppButtonVariant = AppButtonVariant.Primary,
) {
    val fillBrush = when (variant) {
        AppButtonVariant.Primary -> Brush.horizontalGradient(
            colors = listOf(CkOrangeStart, CkOrangeEnd),
        )
        AppButtonVariant.Secondary -> Brush.horizontalGradient(
            colors = listOf(Color(0xFF57534E), Color(0xFF3F3F46)),
        )
    }
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(fillBrush),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.Transparent,
            disabledContainerColor = Color(0xFF2A2A2A),
            contentColor = CkTextPrimary,
        ),
        shape = RoundedCornerShape(14.dp),
    ) {
        if (leadingIcon != null) {
            Icon(
                imageVector = leadingIcon,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
            Spacer(modifier = Modifier.width(8.dp))
        }
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
        )
        if (trailingIcon != null) {
            Spacer(modifier = Modifier.width(8.dp))
            Icon(
                imageVector = trailingIcon,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

@Composable
fun AppOutlinedActionButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, CkOrange.copy(alpha = 0.55f)),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = CkTextPrimary,
            containerColor = Color(0x14000000),
        ),
    ) {
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = CkOrangeSoft,
            )
            Spacer(modifier = Modifier.width(10.dp))
        }
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
fun AppDangerOutlinedButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: ImageVector? = null,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, CkError.copy(alpha = 0.55f)),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = CkError,
            containerColor = Color(0x12EF4444),
        ),
    ) {
        if (leadingIcon != null) {
            Icon(
                imageVector = leadingIcon,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
            Spacer(modifier = Modifier.width(8.dp))
        }
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
fun AppGhostButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TextButton(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        colors = ButtonDefaults.textButtonColors(contentColor = CkOrangeSoft),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
fun AppTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    leadingIcon: ImageVector? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.fillMaxWidth(),
        label = { Text(label) },
        leadingIcon = if (leadingIcon != null) {
            {
                Icon(
                    imageVector = leadingIcon,
                    contentDescription = null,
                    tint = CkTextMuted,
                )
            }
        } else {
            null
        },
        shape = RoundedCornerShape(14.dp),
        visualTransformation = visualTransformation,
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = Color(0x40000000),
            unfocusedContainerColor = Color(0x33000000),
            focusedBorderColor = CkOrange.copy(alpha = 0.65f),
            unfocusedBorderColor = Color(0x1AFFFFFF),
            focusedLeadingIconColor = CkOrangeSoft,
            unfocusedLeadingIconColor = CkTextMuted,
            focusedLabelColor = CkTextSecondary,
            unfocusedLabelColor = CkTextMuted,
            cursorColor = CkOrange,
            focusedTextColor = CkTextPrimary,
            unfocusedTextColor = CkTextPrimary,
        ),
    )
}

@Composable
fun AppPairNumberBadge(
    numberText: String,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 52.dp,
    emphasize: Boolean = true,
    captured: Boolean = false,
    showRuleViolationBadge: Boolean = false,
) {
    val digits = numberText.trim().filter { it.isDigit() }
    val display = digits.ifEmpty { "–" }
    val fontSize = when (digits.length) {
        in 0..2 -> 22.sp
        3 -> 18.sp
        else -> 15.sp
    }
    val capturedRed = Color(0xFFE53935)
    val ring = when {
        emphasize -> BorderStroke(4.dp, CkOrange.copy(alpha = 0.92f))
        else -> BorderStroke(1.5.dp, Color.White.copy(alpha = 0.22f))
    }
    val fill = if (captured) capturedRed else Color.Black
    Box(modifier = modifier.size(size), contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .then(if (!captured) Modifier.border(ring, CircleShape) else Modifier)
                .background(fill, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = display,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                fontSize = fontSize,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Clip,
            )
        }
        if (showRuleViolationBadge && !captured) {
            // Szabályszegés: bal felső, piros korong + belül vékony fehér kör a „!” körül (web / csatolt kép)
            val badgeDp = (size.value * 0.38f).coerceIn(16f, 22f).dp
            val ringIn = badgeDp * 0.62f
            val exSp = (badgeDp.value * 0.42f).sp
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .offset(x = (-badgeDp.value * 0.14f).dp, y = (-badgeDp.value * 0.14f).dp)
                    .size(badgeDp)
                    .clip(CircleShape)
                    .background(Color(0xFFE53935)),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier
                        .size(ringIn)
                        .border(BorderStroke(1.dp, Color.White), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "!",
                        color = Color.White,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = exSp,
                        lineHeight = exSp,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

@Composable
fun UnreadCountPill(
    count: Int,
    modifier: Modifier = Modifier,
) {
    val label = if (count > 99) "99+" else count.toString()
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(22.dp),
        color = Color(0x33F97316),
        border = BorderStroke(1.dp, CkOrange.copy(alpha = 0.55f)),
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = CkTextPrimary,
        )
    }
}

/** Kompakt olvasatlan-számláló a navigációs sávhoz (nem a pár pecséthez hasonlít). */
@Composable
fun UnreadNavBadge(
    count: Int,
    modifier: Modifier = Modifier,
) {
    val label = if (count > 99) "99+" else count.toString()
    Surface(
        modifier = modifier
            .offset(x = 8.dp, y = (-4).dp),
        shape = CircleShape,
        color = Color(0xCCFDBA74),
        border = BorderStroke(1.dp, CkOrange.copy(alpha = 0.65f)),
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF1A1208),
        )
    }
}

@Composable
fun AppPairNumberField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val outerBorder = if (focused) {
        BorderStroke(2.dp, CkOrange.copy(alpha = 0.85f))
    } else {
        BorderStroke(1.dp, Color.White.copy(alpha = 0.14f))
    }
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = Color(0x4D050505),
        border = outerBorder,
        tonalElevation = 0.dp,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AppPairNumberBadge(numberText = value, size = 48.dp, emphasize = true)
            Box(
                modifier = Modifier
                    .width(1.dp)
                    .height(40.dp)
                    .background(Color.White.copy(alpha = 0.12f)),
            )
            OutlinedTextField(
                value = value,
                onValueChange = onValueChange,
                modifier = Modifier.weight(1f),
                interactionSource = interactionSource,
                placeholder = {
                    Text(
                        text = "Írd ide a párszámot",
                        style = MaterialTheme.typography.bodyMedium,
                        color = CkTextMuted,
                    )
                },
                shape = RoundedCornerShape(8.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color.Transparent,
                    unfocusedBorderColor = Color.Transparent,
                    disabledBorderColor = Color.Transparent,
                    errorBorderColor = Color.Transparent,
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    cursorColor = CkOrange,
                    focusedTextColor = CkTextPrimary,
                    unfocusedTextColor = CkTextPrimary,
                    focusedPlaceholderColor = CkTextMuted,
                    unfocusedPlaceholderColor = CkTextMuted,
                ),
            )
        }
    }
}

enum class MessageTone { Error, Success, Neutral }

@Composable
fun AppInlineMessage(
    text: String,
    tone: MessageTone,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
) {
    val bg: Color
    val fg: Color
    val border: Color
    val defaultIcon: ImageVector?
    when (tone) {
        MessageTone.Error -> {
            bg = Color(0x28352828)
            fg = Color(0xFFF5D4D4)
            border = Color(0x35E08080)
            defaultIcon = Icons.Rounded.ErrorOutline
        }
        MessageTone.Success -> {
            bg = Color(0x1A243124)
            fg = Color(0xFFC8E6C9)
            border = Color(0x2A6AA84F)
            defaultIcon = Icons.Rounded.CheckCircle
        }
        MessageTone.Neutral -> {
            bg = Color(0x142A2A2A)
            fg = Color(0xFFE2E8F0)
            border = Color(0x22334155)
            defaultIcon = Icons.Rounded.Info
        }
    }
    val icon = leadingIcon ?: defaultIcon
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = bg,
        border = BorderStroke(1.dp, border),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = fg.copy(alpha = 0.85f),
                modifier = Modifier.size(20.dp),
            )
            Text(
                text = text,
                style = MaterialTheme.typography.bodySmall,
                color = fg,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
fun AppSoftDivider(modifier: Modifier = Modifier) {
    HorizontalDivider(
        modifier = modifier.padding(vertical = 4.dp),
        color = Color(0x14FFFFFF),
        thickness = 1.dp,
    )
}

@Composable
fun DashboardMiniStat(
    icon: ImageVector,
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = Color(0x10FFFFFF),
            border = BorderStroke(1.dp, Color(0x18FFFFFF)),
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = CkOrangeSoft,
                modifier = Modifier
                    .padding(10.dp)
                    .size(22.dp),
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label.uppercase(),
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold,
                color = CkTextMuted,
                letterSpacing = MaterialTheme.typography.labelMedium.letterSpacing,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.bodyLarge,
                color = CkTextPrimary,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
fun AppTextIconRow(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    iconTint: Color = CkTextSecondary,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = iconTint,
            modifier = Modifier.size(22.dp),
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            color = CkOrangeSoft,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
fun QuickAdminActionsBlock(
    onMarkAllRead: () -> Unit,
    onClearEvents: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        AppTextIconRow(
            label = "Mind olvasottnak jelölése",
            icon = Icons.Rounded.DoneAll,
            onClick = onMarkAllRead,
        )
        AppTextIconRow(
            label = "Összes esemény törlése",
            icon = Icons.Rounded.DeleteOutline,
            onClick = onClearEvents,
            iconTint = CkError.copy(alpha = 0.85f),
        )
    }
}

@Composable
fun StatusBadge(label: String, tone: BadgeTone, modifier: Modifier = Modifier) {
    val (background, textColor) = when (tone) {
        BadgeTone.Success -> Color(0x1A22C55E) to Color(0xFF22C55E)
        BadgeTone.Warning -> Color(0x1AF97316) to Color(0xFFF97316)
        BadgeTone.Error -> Color(0x1AEF4444) to Color(0xFFEF4444)
        BadgeTone.Info -> Color(0x1A3B82F6) to Color(0xFF3B82F6)
        BadgeTone.Neutral -> Color(0x1A9CA3AF) to Color(0xFF9CA3AF)
    }

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(10.dp),
        color = background,
        border = BorderStroke(1.dp, textColor.copy(alpha = 0.45f)),
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            style = MaterialTheme.typography.labelMedium,
            color = textColor,
        )
    }
}

@Composable
fun StatLine(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = label.uppercase(),
            style = MaterialTheme.typography.labelMedium,
            color = CkTextMuted,
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.bodyLarge,
            color = CkTextPrimary,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

enum class BadgeTone {
    Success,
    Warning,
    Error,
    Info,
    Neutral,
}
