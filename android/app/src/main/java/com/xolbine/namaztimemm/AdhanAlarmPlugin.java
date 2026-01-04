package com.xolbine.namaztimemm;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONException;
import java.util.Calendar;
import java.util.Date;

import android.app.AlarmManager.AlarmClockInfo;

@CapacitorPlugin(
    name = "AdhanAlarm",
    permissions = {
        @Permission(strings = { Manifest.permission.WAKE_LOCK }, alias = "wakeLock"),
        @Permission(strings = { Manifest.permission.VIBRATE }, alias = "vibrate"),
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class AdhanAlarmPlugin extends Plugin {
    private static final String TAG = "AdhanAlarmPlugin";

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "╔════════════════════════════════════════════════════════╗");
        Log.i(TAG, "║  🕌 AdhanAlarmPlugin LOADED SUCCESSFULLY             ║");
        Log.i(TAG, "║  If you see this, the native plugin is working!      ║");
        Log.i(TAG, "╚════════════════════════════════════════════════════════╝");
    }

    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        long triggerTime = call.getLong("triggerTime", 0L);
        String prayerName = call.getString("prayerName", "");
        String soundUri = call.getString("soundUri", "");
        int prayerId = call.getInt("prayerId", 0);

        Log.i(TAG, "==========================================");
        Log.i(TAG, "🔔 scheduleAlarm called");
        Log.i(TAG, "Prayer: " + prayerName);
        Log.i(TAG, "Prayer ID: " + prayerId);
        Log.i(TAG, "Trigger Time: " + triggerTime + " (" + new Date(triggerTime) + ")");
        Log.i(TAG, "Sound URI: " + soundUri);
        Log.i(TAG, "Current Time: " + System.currentTimeMillis() + " (" + new Date() + ")");
        Log.i(TAG, "Time until alarm: " + ((triggerTime - System.currentTimeMillis()) / 1000) + " seconds");

        if (triggerTime == 0 || prayerName.isEmpty()) {
            Log.e(TAG, "Invalid parameters - triggerTime or prayerName missing");
            call.reject("Invalid parameters");
            return;
        }

        try {
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                Log.e(TAG, "AlarmManager not available");
                call.reject("AlarmManager not available");
                return;
            }

            Intent intent = new Intent(getContext(), AdhanAlarmReceiver.class);
            intent.putExtra("prayerName", prayerName);
            intent.putExtra("soundUri", soundUri);
            intent.putExtra("prayerId", prayerId);
            intent.setAction("com.xolbine.namaztimemm.ADHAN_ALARM");

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                getContext(),
                prayerId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // This treats the prayer time as a real system alarm, waking the device and bypassing Doze
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AlarmClockInfo alarmClockInfo = new AlarmClockInfo(triggerTime, pendingIntent);
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent);
                Log.i(TAG, "✅ Alarm scheduled using setAlarmClock (Highest Priority)");
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerTime,
                    pendingIntent
                );
                Log.i(TAG, "✅ Alarm scheduled using setExactAndAllowWhileIdle");
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    triggerTime,
                    pendingIntent
                );
                Log.i(TAG, "✅ Alarm scheduled using setExact");
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("scheduledTime", triggerTime);
            Log.i(TAG, "Alarm successfully scheduled for " + prayerName);
            Log.i(TAG, "==========================================");
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "❌ Error scheduling alarm: " + e.getMessage());
            e.printStackTrace();
            call.reject("Error scheduling alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        int prayerId = call.getInt("prayerId", 0);
        Log.i(TAG, "Canceling alarm with ID: " + prayerId);

        try {
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                call.reject("AlarmManager not available");
                return;
            }

            Intent intent = new Intent(getContext(), AdhanAlarmReceiver.class);
            intent.setAction("com.xolbine.namaztimemm.ADHAN_ALARM_" + prayerId);

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                getContext(),
                prayerId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            alarmManager.cancel(pendingIntent);
            pendingIntent.cancel();

            JSObject ret = new JSObject();
            ret.put("success", true);
            Log.i(TAG, "Alarm canceled: " + prayerId);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Error canceling alarm: " + e.getMessage());
            call.reject("Error canceling alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAllAlarms(PluginCall call) {
        Log.i(TAG, "==========================================");
        Log.i(TAG, "Canceling all alarms...");
        
        try {
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                call.reject("AlarmManager not available");
                return;
            }

            int[] prayerIds = {1000, 2000, 3000, 4000, 5000};
            int cancelCount = 0;
            
            // Calculate day indices for the next 7 days (matching scheduling logic)
            Calendar calendar = Calendar.getInstance();
            for (int day = 0; day < 7; day++) {
                int year = calendar.get(Calendar.YEAR);
                int month = calendar.get(Calendar.MONTH) + 1; // Calendar.MONTH is 0-based
                int dayOfMonth = calendar.get(Calendar.DAY_OF_MONTH);
                
                int dayIndex = (year * 10000 + month * 100 + dayOfMonth) % 1000;
                
                Log.d(TAG, "Day " + day + ": dayIndex = " + dayIndex);
                
                for (int baseId : prayerIds) {
                    int prayerId = baseId + dayIndex;
                    
                    Intent intent = new Intent(getContext(), AdhanAlarmReceiver.class);
                    intent.setAction("com.xolbine.namaztimemm.ADHAN_ALARM");

                    PendingIntent pendingIntent = PendingIntent.getBroadcast(
                        getContext(),
                        prayerId,
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                    );

                    alarmManager.cancel(pendingIntent);
                    pendingIntent.cancel();
                    cancelCount++;
                }
                
                // Move to next day
                calendar.add(Calendar.DAY_OF_MONTH, 1);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            Log.i(TAG, "✅ All alarms canceled (count: " + cancelCount + ")");
            Log.i(TAG, "==========================================");
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "❌ Error canceling alarms: " + e.getMessage());
            e.printStackTrace();
            call.reject("Error canceling alarms: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkExactAlarmPermission(PluginCall call) {
        JSObject ret = new JSObject();
        
        Log.i(TAG, "Checking exact alarm permission...");
        
        ret.put("granted", true);
        ret.put("canRequest", false);
        Log.i(TAG, "USE_EXACT_ALARM permission - automatically granted");
        
        call.resolve(ret);
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        Log.i(TAG, "requestExactAlarmPermission called - not needed with USE_EXACT_ALARM");
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("message", "USE_EXACT_ALARM is automatically granted");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopAdhan(PluginCall call) {
        Log.i(TAG, "Stopping adhan...");
        try {
            Intent stopIntent = new Intent(getContext(), AdhanPlayerService.class);
            stopIntent.setAction("STOP_ADHAN");
            getContext().startService(stopIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error stopping adhan: " + e.getMessage());
            call.reject("Error stopping adhan: " + e.getMessage());
        }
    }
}
