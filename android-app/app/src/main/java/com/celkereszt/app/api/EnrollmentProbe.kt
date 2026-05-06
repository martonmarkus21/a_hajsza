package com.celkereszt.app.api

import com.celkereszt.app.BuildConfig
import com.celkereszt.app.util.ServerConnectionStore
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import java.util.concurrent.TimeUnit

private interface EnrollmentVerifyApi {
    @GET("api/mobile/verify")
    suspend fun verify(): MobileEnrollmentVerifyResponse
}

/** Első beállításkor ellenőrzi a megadott URL + titok párost a szerverrel (még mentés előtt). */
object EnrollmentProbe {
    suspend fun verify(apiBaseUrl: String, enrollmentSecret: String): MobileEnrollmentVerifyResponse {
        val normalized = ServerConnectionStore.normalizeApiBaseUrlStatic(apiBaseUrl)
        val client = OkHttpClient.Builder().apply {
            if (BuildConfig.DEBUG) {
                addInterceptor(
                    HttpLoggingInterceptor().apply {
                        level = HttpLoggingInterceptor.Level.BASIC
                    },
                )
            }
        }
            .addInterceptor { chain ->
                val b = chain.request().newBuilder()
                if (enrollmentSecret.isNotBlank()) {
                    b.addHeader("X-Ck-Enrollment-Secret", enrollmentSecret.trim())
                }
                chain.proceed(b.build())
            }
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
        val retrofit = Retrofit.Builder()
            .baseUrl(normalized)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        return retrofit.create(EnrollmentVerifyApi::class.java).verify()
    }
}

data class MobileEnrollmentVerifyResponse(
    val ok: Boolean? = null,
    val enrollmentRequired: Boolean? = null,
)
