package com.mostwanted.app.api

import android.content.Context
import android.content.Intent
import com.mostwanted.app.util.PreferencesHelper
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import java.util.concurrent.TimeUnit

interface ApiService {
    @POST("api/position")
    suspend fun sendPosition(
        @Body request: PositionRequest
    ): PositionResponse

    @POST("api/devices/login")
    suspend fun deviceLogin(@Body request: DeviceLoginRequest): DeviceLoginResponse

    @POST("api/devices/logout")
    suspend fun deviceLogout(): LogoutResponse

    companion object {
        private const val BASE_URL = "http://10.0.2.2:3000/" // Android emulator
        // For real device, use your computer's IP: "http://192.168.x.x:3000/"

        fun create(context: Context? = null): ApiService {
            val loggingInterceptor = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val clientBuilder = OkHttpClient.Builder()
                .addInterceptor(loggingInterceptor)
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)

            if (context != null) {
                val prefs = PreferencesHelper(context)
                clientBuilder.addInterceptor(Interceptor { chain ->
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
                        val broadcast = Intent("com.mostwanted.app.FORCE_LOGOUT").apply {
                            setPackage(context.packageName)
                        }
                        context.sendBroadcast(broadcast)
                    }
                    response
                })
            }

            val retrofit = Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(clientBuilder.build())
                .addConverterFactory(GsonConverterFactory.create())
                .build()

            return retrofit.create(ApiService::class.java)
        }
    }
}

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
