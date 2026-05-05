package com.celkereszt.app.viewmodel

import android.content.Context
import android.provider.Settings
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.messaging.FirebaseMessaging
import com.celkereszt.app.api.ApiService
import com.celkereszt.app.api.DeviceLoginRequest
import com.celkereszt.app.util.AppErrorMessages
import com.celkereszt.app.util.AuthMessageMapper
import com.celkereszt.app.util.PreferencesHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONObject
import retrofit2.HttpException
import kotlin.coroutines.resume

data class AuthUiState(
    val pairNumber: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    /** Belépés közbeni rövid szöveg; üres, ha nincs mit kiírni. */
    val status: String = "",
    val error: String? = null,
)

class AuthViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState

    fun updatePairNumber(value: String) {
        val filtered = value.filter { it.isDigit() }.take(8)
        _uiState.update { it.copy(pairNumber = filtered, error = null) }
    }

    fun updatePassword(value: String) {
        _uiState.update { it.copy(password = value, error = null) }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun setError(message: String) {
        _uiState.update { it.copy(error = message, isLoading = false) }
    }

    /** Kilépés vagy kényszerített kilépés után: mezők és üzenetek teljes törlése. */
    fun resetCredentialsAndStatus() {
        _uiState.value = AuthUiState()
    }

    fun login(context: Context, onSuccess: () -> Unit) {
        val pairNumber = _uiState.value.pairNumber.trim()
        val password = _uiState.value.password.trim()
        if (pairNumber.isEmpty() || password.isEmpty()) {
            _uiState.update {
                it.copy(error = "Add meg a pár számát és a jelszót.")
            }
            return
        }

        _uiState.update {
            it.copy(isLoading = true, status = "Bejelentkezés folyamatban…", error = null)
        }
        viewModelScope.launch {
            val fcmToken = getFirebaseToken()
            val prefs = PreferencesHelper(context)
            val apiService = ApiService.create(context)
            try {
                val deviceId = Settings.Secure.getString(
                    context.contentResolver,
                    Settings.Secure.ANDROID_ID,
                ) ?: "device_${System.currentTimeMillis()}"

                val request = DeviceLoginRequest(
                    username = pairNumber,
                    password = password,
                    deviceId = deviceId,
                    fcmToken = fcmToken,
                )
                val response = apiService.deviceLogin(request)
                if (!response.success) {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = "Hibás belépési adatok.",
                            status = "Sikertelen belépés.",
                        )
                    }
                    return@launch
                }

                prefs.saveToken(response.token)
                prefs.saveDeviceInfo(
                    deviceId = deviceId,
                    pairId = response.device.pairId,
                    pairNumber = response.device.pairNumber,
                    pairName = response.device.pairName,
                )
                if (!fcmToken.isNullOrBlank()) {
                    prefs.saveFcmToken(fcmToken)
                }
                prefs.setLoggingOut(false)

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = null,
                        password = "",
                        status = "",
                    )
                }
                onSuccess()
            } catch (e: HttpException) {
                val serverMessage = try {
                    e.response()?.errorBody()?.string()?.let { body ->
                        JSONObject(body).optString("message", "").trim().takeIf { it.isNotEmpty() }
                    }
                } catch (_: Exception) {
                    null
                }
                val mappedMessage = when (e.code()) {
                    409 -> AuthMessageMapper.mapLoginError(serverMessage, 409)
                    else -> AuthMessageMapper.mapLoginError(serverMessage, e.code())
                }
                val errorText =
                    if (AppErrorMessages.isHungarianUserText(mappedMessage)) {
                        mappedMessage
                    } else {
                        AppErrorMessages.fromHttpException(
                            e,
                            defaultForUnknown = mappedMessage.ifBlank {
                                "A belépés most nem sikerült. Próbáld újra."
                            },
                        )
                    }
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = errorText,
                        status = "",
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = AppErrorMessages.fromThrowable(
                            e,
                            fallback = "Nem sikerült a belépés. Ellenőrizd az internetet, majd próbáld újra.",
                        ),
                        status = "",
                    )
                }
            }
        }
    }

    private suspend fun getFirebaseToken(): String? = suspendCancellableCoroutine { cont ->
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token -> cont.resume(token) }
            .addOnFailureListener { cont.resume(null) }
    }
}
