#!/bin/bash

echo "🧹 Step 1: Cleaning old builds..."
cd android
./gradlew clean

echo ""
echo "🔄 Step 2: Syncing Capacitor..."
cd ..
npx cap sync android

echo ""
echo "🔨 Step 3: Building fresh APK..."
cd android
./gradlew assembleDebug -x test

echo ""
echo "📱 Step 4: Uninstalling old app from device..."
adb uninstall com.xolbine.namaztimemm

echo ""
echo "📲 Step 5: Installing new APK..."
./gradlew installDebug

echo ""
echo "✅ Done! Now run: adb logcat | grep -E '(AdhanAlarm|v0)'"
echo "You should see: '🕌 AdhanAlarmPlugin LOADED SUCCESSFULLY' when app starts"
