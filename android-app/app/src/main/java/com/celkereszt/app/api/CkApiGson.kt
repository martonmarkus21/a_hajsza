package com.celkereszt.app.api

import com.google.gson.GsonBuilder

/**
 * Ugyanaz a Gson a Retrofit és a [LocationService] → [AppActivity] broadcast JSON körén,
 * hogy a mezők (pl. maradási szabály) ne vesszenek el deszerializáláskor.
 */
object CkApiGson {
    val gson =
        GsonBuilder()
            .serializeNulls()
            .registerTypeAdapter(java.lang.Boolean.TYPE, LenientBooleanDeserializer)
            .registerTypeAdapter(Boolean::class.javaObjectType, LenientBooleanDeserializer)
            .create()
}
