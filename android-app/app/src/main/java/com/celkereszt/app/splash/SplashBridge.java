package com.celkereszt.app.splash;

import android.app.Activity;
import androidx.annotation.NonNull;
import androidx.core.splashscreen.SplashScreen;

/** Kotlin fordító nem látja a statikus API-t megbízhatóan; egy soros Java híd. */
public final class SplashBridge {
    private SplashBridge() {}

    public static void install(@NonNull Activity activity) {
        SplashScreen.installSplashScreen(activity);
    }
}
