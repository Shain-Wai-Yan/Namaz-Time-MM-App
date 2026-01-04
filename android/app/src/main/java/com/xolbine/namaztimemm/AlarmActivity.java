package com.xolbine.namaztimemm;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.util.Log;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.Button;
import android.view.View;

/**
 * AlarmActivity is launched by the BroadcastReceiver.
 * Its primary purpose is to show on top of the lock screen, which signals
 * to the Android system that the app is "Visible" and "Foreground",
 * allowing the AdhanPlayerService to successfully request Audio Focus.
 */
public class AlarmActivity extends Activity {
    private static final String TAG = "AlarmActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }

        setContentView(R.layout.activity_alarm);

        String prayerName = getIntent().getStringExtra("prayerName");
        TextView prayerText = findViewById(R.id.prayer_name_text);
        if (prayerText != null && prayerName != null) {
            prayerText.setText(prayerName + " Time");
        }

        Button stopButton = findViewById(R.id.stop_button);
        if (stopButton != null) {
            stopButton.setOnClickListener(v -> {
                Intent stopIntent = new Intent(this, AdhanPlayerService.class);
                stopIntent.setAction("STOP_ADHAN");
                startService(stopIntent);
                finish();
            });
        }

        Log.i(TAG, "AlarmActivity created and visible over lock screen");
    }
}
