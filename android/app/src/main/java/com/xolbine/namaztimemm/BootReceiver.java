package com.xolbine.namaztimemm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Receiver that triggers when device boots
 * Can be used to reschedule alarms after device restart
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.i(TAG, "Device booted - alarms need to be rescheduled from app");
            
            // Note: We don't automatically reschedule here because we need prayer time data
            // The app should reschedule alarms when it starts after boot
        }
    }
}
