package com.xolbine.namaztimemm;

import android.content.Context;
import android.os.PowerManager;
import android.util.Log;

/**
 * Helper class to manage wake locks
 * Ensures the device stays awake while playing Adhan
 */
public class WakeLockHelper {
    private static final String TAG = "WakeLockHelper";
    private static PowerManager.WakeLock wakeLock = null;
    private static final long WAKE_LOCK_TIMEOUT = 6 * 60 * 1000 + 500; // 6 minutes + buffer

    public static synchronized void acquire(Context context) {
        if (wakeLock != null && wakeLock.isHeld()) {
            Log.w(TAG, "WakeLock already held");
            return;
        }

        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK | 
                PowerManager.ACQUIRE_CAUSES_WAKEUP | 
                PowerManager.ON_AFTER_RELEASE,
                "NamazTimeMM:AdhanWakeLock"
            );
            wakeLock.acquire(WAKE_LOCK_TIMEOUT);
            Log.i(TAG, "WakeLock acquired with wakeup flags");
        }
    }

    public static synchronized void release() {
        if (wakeLock != null) {
            if (wakeLock.isHeld()) {
                wakeLock.release();
                Log.i(TAG, "WakeLock released");
            } else {
                Log.i(TAG, "WakeLock already released");
            }
            wakeLock = null;
        }
    }
}
