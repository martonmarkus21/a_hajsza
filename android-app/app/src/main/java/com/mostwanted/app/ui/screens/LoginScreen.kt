package com.mostwanted.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.mostwanted.app.R
import com.mostwanted.app.ui.components.MessageTone
import com.mostwanted.app.ui.components.AppBackdrop
import com.mostwanted.app.ui.components.AppButton
import com.mostwanted.app.ui.components.AppGlassCard
import com.mostwanted.app.ui.components.AppInlineMessage
import com.mostwanted.app.ui.components.AppPairNumberField
import com.mostwanted.app.ui.components.AppSoftDivider
import com.mostwanted.app.ui.components.AppTextField
import com.mostwanted.app.ui.theme.MwTextMuted
import com.mostwanted.app.ui.theme.MwTextPrimary
import com.mostwanted.app.ui.theme.MwTextSecondary
import com.mostwanted.app.viewmodel.AuthUiState

@Composable
fun LoginScreen(
    uiState: AuthUiState,
    onPairNumberChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onLoginClick: () -> Unit,
    onChangeServerClick: () -> Unit,
) {
    AppBackdrop {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            AppGlassCard(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(24.dp),
            ) {
                Image(
                    painter = painterResource(id = R.drawable.mw_logo),
                    contentDescription = "Most Wanted logó",
                    modifier = Modifier
                        .height(104.dp)
                        .fillMaxWidth(),
                    contentScale = ContentScale.Fit,
                )
                Spacer(modifier = Modifier.height(14.dp))
                Text(
                    text = "Most Wanted",
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MwTextPrimary,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Hivatalos páros alkalmazás",
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelMedium,
                    color = MwTextSecondary,
                    letterSpacing = MaterialTheme.typography.labelMedium.letterSpacing,
                )

                Spacer(modifier = Modifier.height(18.dp))
                AppSoftDivider()
                Spacer(modifier = Modifier.height(18.dp))

                Text(
                    text = "Bejelentkezés",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MwTextPrimary,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Írd be a párszámod és a jelszavad — mindkettőt a szervezőktől kapjátok.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MwTextMuted,
                )

                Spacer(modifier = Modifier.height(20.dp))

                Text(
                    text = "Pár száma",
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MwTextMuted,
                )
                Spacer(modifier = Modifier.height(8.dp))
                AppPairNumberField(
                    value = uiState.pairNumber,
                    onValueChange = onPairNumberChange,
                )
                Spacer(modifier = Modifier.height(14.dp))
                AppTextField(
                    value = uiState.password,
                    onValueChange = onPasswordChange,
                    label = "Jelszó",
                    leadingIcon = Icons.Rounded.Lock,
                    visualTransformation = PasswordVisualTransformation(),
                )

                Spacer(modifier = Modifier.height(18.dp))

                when {
                    uiState.error != null -> {
                        AppInlineMessage(text = uiState.error, tone = MessageTone.Error)
                    }
                    uiState.isLoading && uiState.status.isNotBlank() -> {
                        AppInlineMessage(text = uiState.status, tone = MessageTone.Neutral)
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                AppButton(
                    label = if (uiState.isLoading) "Belépés folyamatban…" else "Bejelentkezés",
                    onClick = onLoginClick,
                    enabled = !uiState.isLoading,
                    trailingIcon = Icons.AutoMirrored.Rounded.ArrowForward,
                )

                Spacer(modifier = Modifier.height(12.dp))
                TextButton(
                    onClick = onChangeServerClick,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        text = "Szerver cím vagy kapcsolódási kód megváltoztatása",
                        style = MaterialTheme.typography.bodySmall,
                        color = MwTextMuted,
                    )
                }
            }
        }
    }
}
