package com.xolbine.namaztimemm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.app.PendingIntent;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.NotificationChannel;
import androidx.core.app.NotificationCompat;
import android.os.Build;
import android.util.Log;
import android.view.WindowManager;

/**
 * BroadcastReceiver that handles alarm triggers
 * Starts the AdhanPlayerService to play the adhan sound
 */
public class AdhanAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "AdhanAlarmReceiver";
    private static final String CHANNEL_ID = "adhan_alarm_channel";

    @Override
    public void onReceive(Context context, Intent intent) {
        String prayerName = intent.getStringExtra("prayerName");
        String soundUri = intent.getStringExtra("soundUri");
        int prayerId = intent.getIntExtra("prayerId", 0);

        Log.i(TAG, "🕌 Adhan receiver triggered for: " + prayerName);

        WakeLockHelper.acquire(context);

        Intent serviceIntent = new Intent(context, AdhanPlayerService.class);
        serviceIntent.setAction("PLAY_ADHAN");
        serviceIntent.putExtra("prayerName", prayerName);
        serviceIntent.putExtra("soundUri", soundUri);
        serviceIntent.putExtra("prayerId", prayerId);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting service: " + e.getMessage());
            WakeLockHelper.release();
        }
    }

}
