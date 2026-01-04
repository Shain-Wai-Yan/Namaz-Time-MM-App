# Quick Start - Testing Native Alarms

## Step 1: Add Adhan Sound File
```bash
mkdir -p android/app/src/main/res/raw
cp /path/to/your/adhan.mp3 android/app/src/main/res/raw/adhan.mp3
```

## Step 2: Build & Install
```bash
npx cap sync android
cd android
./gradlew assembleDebug
./gradlew installDebug
```

## Step 3: Grant Permission (Android 12+)
1. Open the app
2. Tap the Test Alarm tab
3. Click "Check Exact Alarm Permission"
4. If not granted, click "Request Permission" and allow it

## Step 4: Test the Alarm
1. In the Test Alarm tab, click "Test in 10 sec"
2. Lock your phone
3. Wait 10 seconds
4. The adhan should play with a full-screen notification

---

## Debugging

### Check plugin loaded:
```bash
adb logcat | grep "AdhanAlarmPlugin"
```

Expected output:
```
AdhanAlarmPlugin: AdhanAlarmPlugin LOADED SUCCESSFULLY
```

### Check if alarm scheduled:
```bash
adb logcat | grep -E "(v0|AdhanAlarm)"
```

Expected output:
```
[v0] About to check permission...
AdhanAlarmPlugin: scheduleAlarm called
AdhanAlarmPlugin: Prayer: Test Alarm
AdhanAlarmPlugin: Alarm scheduled using setExactAndAllowWhileIdle
```

### Verify alarms in system:
```bash
adb shell dumpsys alarm | grep namaztimemm
```

---

## Troubleshooting

### "Plugin is not implemented" error:
The Java wasn't compiled. Fix:
```bash
cd android
rm -rf app/build
./gradlew clean assembleDebug
./gradlew installDebug
```

### Alarm doesn't trigger:
1. Check battery optimization: Settings → Apps → Your App → Battery → Unrestricted
2. Check Do Not Disturb mode is off
3. Check notification permissions are enabled
4. Verify alarm was scheduled: `adb shell dumpsys alarm | grep namaztimemm`

### No sound plays:
1. Verify `android/app/src/main/res/raw/adhan.mp3` exists
2. Check volume is not muted
3. Check logcat for "AdhanPlayerService" errors

---

## Android Version Requirements

- Android 12+: Must grant "Alarms & reminders" permission
- Android 6-11: Works automatically (no permission needed)
- Android 5 and below: Not tested
