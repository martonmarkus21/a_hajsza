package com.celkereszt.app.api

import android.content.Context
import android.content.Intent
import com.celkereszt.app.BuildConfig
import com.celkereszt.app.util.PreferencesHelper
import com.celkereszt.app.util.ServerConnectionStore
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import com.google.gson.annotations.SerializedName
import retrofit2.http.GET
import retrofit2.http.POST
import java.util.concurrent.TimeUnit

interface ApiService {
    @GET("api/game-settings/countdown")
    suspend fun getGameCountdown(): GameCountdownResponse

    @POST("api/devices/help-request")
    suspend fun postHelpRequest(): BasicSuccessResponse

    @POST("api/devices/vehicle-session-expired")
    suspend fun postVehicleSessionExpired(): VehicleSessionExpiredResponse

    @POST("api/position")
    suspend fun sendPosition(
        @Body request: PositionRequest
    ): PositionResponse

    @POST("api/devices/login")
    suspend fun deviceLogin(@Body request: DeviceLoginRequest): DeviceLoginResponse

    @POST("api/devices/logout")
    suspend fun deviceLogout(): LogoutResponse

    @POST("api/devices/fcm-token")
    suspend fun updateDeviceFcmToken(@Body request: UpdateDeviceFcmTokenRequest): BasicSuccessResponse

    companion object {
        /** Megegyezik a backend `MOBILE_ENROLLMENT_HEADER` értékével (kis-nagybetű a HTTP-ben mindegy). */
        const val ENROLLMENT_SECRET_HEADER = "X-Ck-Enrollment-Secret"

        fun create(context: Context): ApiService {
            val baseUrl = ServerConnectionStore(context).getApiBaseUrl()
                ?: throw IllegalStateException("Nincs beállítva API cím. Előbb add meg a szerver kapcsolatot.")

            val prefs = PreferencesHelper(context)
            val serverStore = ServerConnectionStore(context)

            val clientBuilder = OkHttpClient.Builder().apply {
                if (BuildConfig.DEBUG) {
                    addInterceptor(
                        HttpLoggingInterceptor().apply {
                            level = HttpLoggingInterceptor.Level.BODY
                        },
                    )
                }
            }
                .addInterceptor(Interceptor { chain ->
                    val secret = serverStore.getEnrollmentSecret()
                    val b = chain.request().newBuilder()
                    if (secret.isNotBlank()) {
                        b.addHeader(ENROLLMENT_SECRET_HEADER, secret)
                    }
                    chain.proceed(b.build())
                })
                .addInterceptor(Interceptor { chain ->
                    val token = prefs.getToken()
                    val request = if (token != null) {
                        chain.request().newBuilder()
                            .addHeader("Authorization", "Bearer $token")
                            .build()
                    } else {
                        chain.request()
                    }
                    val response = chain.proceed(request)
                    if (response.code == 401 && token != null && !prefs.isLoggingOut()) {
                        prefs.clear()
                        val broadcast = Intent("com.celkereszt.app.FORCE_LOGOUT").apply {
                            setPackage(context.packageName)
                        }
                        context.sendBroadcast(broadcast)
                    }
                    response
                })
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)

            val retrofit = Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(clientBuilder.build())
                .addConverterFactory(GsonConverterFactory.create(CkApiGson.gson))
                .build()

            return retrofit.create(ApiService::class.java)
        }
    }
}

data class CountdownValues(
    val minutes: Int = 0,
    val seconds: Int = 0,
)

data class GameDaySnippet(
    val date: String? = null,
    val startTime: String? = null,
    val endTime: String? = null,
    val isFinalDay: Boolean? = null,
)

data class ActiveRuleViolationDto(
    val violationType: String? = null,
    val description: String? = null,
)

data class VehicleSessionExpiredResponse(
    val success: Boolean? = null,
    val created: Boolean? = null,
)

/** Válasz a játékmotor / követési ciklus állapotához (páros kliens). */
data class GameCountdownResponse(
    val countdown: CountdownValues? = null,
    val gameEnabled: Boolean? = false,
    val isTimerRunning: Boolean? = false,
    val allowPositionUpdatesForMap: Boolean? = false,
    val locationUpdateIntervalMinutes: Int? = null,
    val currentIntervalMinutes: Int? = null,
    val campaignStatus: String? = null,
    val isGameActive: Boolean? = false,
    val isPastLastScheduledGameEnd: Boolean? = false,
    val activeGameDayId: Int? = null,
    val lastLocationUpdate: String? = null,
    val nextLocationUpdate: String? = null,
    /** Emberi magyar sorok a mai / következő játéknapról (backend). */
    val pairScheduleLines: List<String>? = null,
    val todayGameDay: GameDaySnippet? = null,
    val nextGameDay: GameDaySnippet? = null,
    val pairCaptured: Boolean? = null,
    val activeRuleViolations: List<ActiveRuleViolationDto>? = null,
    /** Játéknap lezárása utáni tartózkodás — explicit név Gson / broadcast körökben. */
    @SerializedName("stayRuleEnabled")
    val stayRuleEnabled: Boolean = false,
    @SerializedName("stayRadiusKm")
    val stayRadiusKm: Double? = null,
)

data class PositionRequest(
    val deviceId: String,
    val pairId: Int,
    val lat: Double,
    val lon: Double,
    val accuracy: Double?,
    val speed: Double?,
    val timestamp: String,
    val vehicleMode: Boolean?,
    val vehicleSessionRemaining: Int?
)

data class PositionResponse(
    val success: Boolean,
    val message: String,
    val violationDetected: Boolean?,
    val continuousMode: Boolean?
)

data class DeviceLoginRequest(
    val username: String,
    val password: String,
    val deviceId: String,
    val fcmToken: String?
)

data class DeviceLoginResponse(
    val success: Boolean,
    val token: String,
    val device: DeviceInfo
)

data class DeviceInfo(
    val id: Int,
    val pairId: Int,
    val pairNumber: Int,
    val pairName: String?
)

data class LogoutResponse(
    val success: Boolean,
    val message: String?
)

data class UpdateDeviceFcmTokenRequest(
    val fcmToken: String?,
)

data class BasicSuccessResponse(
    val success: Boolean,
    val message: String?,
)
