package com.celkereszt.app.util

import android.util.Log
import com.celkereszt.app.BuildConfig

/**
 * Csak **`BuildConfig.DEBUG`** alatti Logcat írás — release APK-ban nem jelennek meg zajos / érzékeny naplók (GPS, állapot gépek).
 * Komoly hibákhoz közvetlenül **`Log.e`** / **`Log.w`** marad meg a híváshelyeken.
 */
object CkLog {
    fun d(tag: String, message: String) {
        if (BuildConfig.DEBUG) {
            Log.d(tag, message)
        }
    }
}
