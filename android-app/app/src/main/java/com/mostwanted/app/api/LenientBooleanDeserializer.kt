package com.mostwanted.app.api

import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import java.lang.reflect.Type

/**
 * Backend / Gson körökben előfordulhat 1/0 vagy „true” szöveg; a páros állapotképernyőn
 * a maradási kapcsoló ettől látszott mindig „kikapcsolva”.
 */
object LenientBooleanDeserializer : JsonDeserializer<Boolean> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?,
    ): Boolean {
        val j = json ?: return false
        if (!j.isJsonPrimitive) return false
        val p = j.asJsonPrimitive
        return when {
            p.isBoolean -> p.asBoolean
            p.isNumber -> p.asDouble != 0.0
            p.isString -> {
                val s = p.asString.trim().lowercase()
                s == "true" || s == "1" || s == "t" || s == "yes"
            }

            else -> false
        }
    }
}
