"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import AdhanAlarm from "@/lib/adhan-alarm"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react"

export default function TestAlarmPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null)
  const [showMIUIGuide, setShowMIUIGuide] = useState(false)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    console.log(`[v0] [Test Alarm] ${timestamp}: ${message}`)
    setLogs((prev) => [`${timestamp}: ${message}`, ...prev].slice(0, 100))
  }

  useEffect(() => {
    addLog("Test Alarm page loaded")
    checkPermission()
  }, [])

  const checkPermission = async () => {
    addLog("Checking exact alarm permission...")
    try {
      const result = await AdhanAlarm.checkExactAlarmPermission()
      addLog(`Permission check result: ${JSON.stringify(result)}`)
      setPermissionGranted(result.granted)

      if (result.granted) {
        addLog("✅ Permission IS granted - you can schedule alarms!")
      } else {
        addLog("❌ Permission NOT granted - click 'Request Permission' below")
      }
    } catch (error) {
      addLog(`❌ Error checking permission: ${error}`)
      console.error("[v0] Permission check error:", error)
    }
  }

  const requestPermission = async () => {
    addLog("Opening Android settings to grant permission...")
    addLog("👉 Enable 'Alarms & reminders' for this app")
    try {
      const result = await AdhanAlarm.requestExactAlarmPermission()
      addLog(`Settings opened: ${JSON.stringify(result)}`)
      addLog("⚠️ After granting permission, come back and click 'Check Permission' again")
    } catch (error) {
      addLog(`❌ Error opening settings: ${error}`)
      console.error("[v0] Permission request error:", error)
    }
  }

  const scheduleTestAlarm = async (secondsFromNow: number) => {
    addLog(`Scheduling test alarm ${secondsFromNow} seconds from now...`)

    const triggerTime = Date.now() + secondsFromNow * 1000
    const triggerDate = new Date(triggerTime)

    addLog(`Current time: ${new Date().toLocaleTimeString()}`)
    addLog(`Trigger time: ${triggerDate.toLocaleTimeString()}`)

    try {
      const result = await AdhanAlarm.scheduleAlarm({
        triggerTime,
        prayerName: "Test Alarm",
        soundUri: "adhan",
        prayerId: 9999,
      })

      addLog(`Schedule result: ${JSON.stringify(result)}`)

      if (result.success) {
        addLog("✅ Alarm scheduled successfully!")
        addLog(`⏰ Wait ${secondsFromNow} seconds for the alarm to trigger...`)
        addLog("🔒 Lock your phone to test if it works in the background")
      } else if (result.needsPermission) {
        addLog("❌ Need permission! Click 'Request Permission' button above.")
        setPermissionGranted(false)
      } else {
        addLog("❌ Failed to schedule alarm")
      }
    } catch (error) {
      addLog(`❌ Error scheduling alarm: ${error}`)
      console.error("[v0] Schedule error:", error)
    }
  }

  const cancelAllAlarms = async () => {
    addLog("Canceling all alarms...")
    try {
      const result = await AdhanAlarm.cancelAllAlarms()
      addLog(`Cancel result: ${JSON.stringify(result)}`)
    } catch (error) {
      addLog(`Error canceling alarms: ${error}`)
    }
  }

  const stopAdhan = async () => {
    addLog("Stopping adhan playback...")
    try {
      const result = await AdhanAlarm.stopAdhan()
      addLog(`Stop result: ${JSON.stringify(result)}`)
    } catch (error) {
      addLog(`Error stopping adhan: ${error}`)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-4">
      <Alert className="bg-orange-50 border-orange-200">
        <AlertCircle className="h-4 w-4 text-orange-600" />
        <AlertTitle className="text-orange-900">Xiaomi/MIUI Device?</AlertTitle>
        <AlertDescription className="text-orange-800">
          If you're on Xiaomi/MIUI, you MUST enable Autostart and Battery settings or alarms won't work!
          <Button onClick={() => setShowMIUIGuide(!showMIUIGuide)} variant="link" className="px-2 text-orange-600">
            {showMIUIGuide ? "Hide Guide" : "Show MIUI Setup Guide"}
          </Button>
        </AlertDescription>
      </Alert>

      {showMIUIGuide && (
        <Card className="bg-orange-50 border-orange-200">
          <CardHeader>
            <CardTitle className="text-orange-900">MIUI Battery Optimization Setup</CardTitle>
            <CardDescription className="text-orange-700">
              Critical settings for Xiaomi devices - alarms will NOT work without these
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold text-orange-900">1. Autostart Permission (MOST IMPORTANT)</h4>
              <ul className="list-disc list-inside space-y-1 text-orange-800">
                <li>Open Security app</li>
                <li>Tap Permissions → Autostart</li>
                <li>Find "NamazTime MM" and toggle ON</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-orange-900">2. Battery Saver</h4>
              <ul className="list-disc list-inside space-y-1 text-orange-800">
                <li>Settings → Battery & performance</li>
                <li>App battery saver → Find this app</li>
                <li>Select "No restrictions"</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-orange-900">3. Lock App in Recent Apps</h4>
              <ul className="list-disc list-inside space-y-1 text-orange-800">
                <li>Open Recent apps (square button)</li>
                <li>Find this app and swipe down to lock it</li>
                <li>You'll see a lock icon on the app card</li>
              </ul>
            </div>

            <div className="bg-orange-100 p-3 rounded-md">
              <p className="font-semibold text-orange-900">After setup:</p>
              <p className="text-orange-800">
                Restart your device to apply all settings, then test with "Test in 10 sec"
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Adhan Alarm Test</CardTitle>
          <CardDescription>Test the native Android alarm system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Step 1: Check Permission</h3>
            <Button onClick={checkPermission} className="w-full bg-green-700 hover:bg-green-800">
              Check Exact Alarm Permission
            </Button>
            {permissionGranted !== null && (
              <Alert className={permissionGranted ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                {permissionGranted ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertTitle className={permissionGranted ? "text-green-900" : "text-red-900"}>
                  {permissionGranted ? "Permission Granted" : "Permission Required"}
                </AlertTitle>
                <AlertDescription className={permissionGranted ? "text-green-800" : "text-red-800"}>
                  {permissionGranted ? "Ready to test alarms!" : "Request permission below to continue"}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {permissionGranted === false && (
            <div className="space-y-2 border-2 border-red-300 p-4 rounded-lg bg-red-50">
              <h3 className="font-semibold text-lg text-red-900">Step 2: Request Permission (REQUIRED)</h3>
              <p className="text-sm text-red-700">
                This will open Android Settings. Enable "Alarms & reminders" for this app, then come back and check
                permission again.
              </p>
              <Button onClick={requestPermission} variant="destructive" className="w-full">
                Open Android Settings
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Step 3: Test Alarms</h3>
            {permissionGranted === false && (
              <p className="text-sm text-red-600 mb-2">⚠️ Request permission first before testing</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => scheduleTestAlarm(10)} variant="outline" disabled={permissionGranted === false}>
                Test in 10 sec
              </Button>
              <Button onClick={() => scheduleTestAlarm(30)} variant="outline" disabled={permissionGranted === false}>
                Test in 30 sec
              </Button>
              <Button onClick={() => scheduleTestAlarm(60)} variant="outline" disabled={permissionGranted === false}>
                Test in 1 min
              </Button>
              <Button onClick={() => scheduleTestAlarm(120)} variant="outline" disabled={permissionGranted === false}>
                Test in 2 min
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Controls</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={cancelAllAlarms} variant="destructive">
                Cancel All Alarms
              </Button>
              <Button onClick={stopAdhan} variant="secondary">
                Stop Adhan
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Logs</h3>
            <div className="bg-black text-green-400 p-4 rounded-md max-h-96 overflow-y-auto font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-gray-500">No logs yet...</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
            <Button onClick={() => setLogs([])} variant="ghost" size="sm" className="w-full">
              Clear Logs
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
