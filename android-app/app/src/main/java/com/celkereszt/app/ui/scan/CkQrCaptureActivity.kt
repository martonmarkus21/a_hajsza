package com.celkereszt.app.ui.scan

import android.graphics.Color
import android.os.Bundle
import android.widget.FrameLayout
import android.widget.LinearLayout
import androidx.appcompat.widget.Toolbar
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import com.journeyapps.barcodescanner.CaptureActivity
import com.celkereszt.app.R

/**
 * ZXing [CaptureActivity] egy felső sávval: cím + vissza (a könyvtár alapfelülete fullscreen, nincs toolbar).
 */
class CkQrCaptureActivity : CaptureActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val content = findViewById<FrameLayout>(android.R.id.content)
        content?.post {
            if (content.childCount == 0) return@post
            val scannerRoot = content.getChildAt(0)
            content.removeView(scannerRoot)
            scannerRoot.layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f,
            )

            val toolbar = Toolbar(this).apply {
                title = "QR beolvasás"
                setTitleTextColor(Color.WHITE)
                setBackgroundColor(0xDD0A0A0A.toInt())
                elevation = 4f
                navigationIcon = ContextCompat.getDrawable(this@CkQrCaptureActivity, R.drawable.ck_ic_arrow_back)
                setNavigationContentDescription("Vissza")
                setNavigationOnClickListener { finish() }
                ViewCompat.setOnApplyWindowInsetsListener(this) { v, insets ->
                    val bars = insets.getInsets(WindowInsetsCompat.Type.statusBars())
                    v.updatePadding(top = bars.top)
                    insets
                }
            }

            val vertical = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                addView(
                    toolbar,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    ),
                )
                addView(scannerRoot)
            }
            content.addView(
                vertical,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                ),
            )
        }
    }
}
