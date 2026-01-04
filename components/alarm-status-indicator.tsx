"use client"

import { useEffect, useState } from "react"
import { getScheduledAlarms, getAlarmConfig, type StoredAlarm } from "@/lib/alarm-storage"
import { Bell, BellOff, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function AlarmStatusIndicator() {
  const [alarms, setAlarms] = useState<StoredAlarm[]>([])
  const [nextAlarm, setNextAlarm] = useState<StoredAlarm | null>(null)
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    loadAlarmStatus()
    const interval = setInterval(loadAlarmStatus, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  async function loadAlarmStatus() {
    const scheduledAlarms = await getScheduledAlarms()
    const alarmConfig = await getAlarmConfig()

    setConfig(alarmConfig)

    // Filter out past alarms
    const now = Date.now()
    const futureAlarms = scheduledAlarms.filter((a) => a.triggerTime > now)

    setAlarms(futureAlarms)

    // Find next upcoming alarm
    if (futureAlarms.length > 0) {
      const next = futureAlarms.reduce((prev, curr) => (curr.triggerTime < prev.triggerTime ? curr : prev))
      setNextAlarm(next)
    } else {
      setNextAlarm(null)
    }
  }

  if (alarms.length === 0) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="flex items-center gap-3 p-4">
          <BellOff className="h-5 w-5 text-orange-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-900">No alarms scheduled</p>
            <p className="text-xs text-orange-700">Prayer alarms will appear after location is set</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const timeUntilNext = nextAlarm ? nextAlarm.triggerTime - Date.now() : 0
  const hoursUntil = Math.floor(timeUntilNext / (1000 * 60 * 60))
  const minutesUntil = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60))

  return (
    <Card className="border-green-200 bg-green-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Bell className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-green-900">Alarms Active</p>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {alarms.length} scheduled
              </Badge>
            </div>

            {nextAlarm && (
              <div className="flex items-center gap-2 text-xs text-green-700">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Next: <span className="font-medium">{nextAlarm.prayerName}</span> in{" "}
                  {hoursUntil > 0 && `${hoursUntil}h `}
                  {minutesUntil}m
                </span>
              </div>
            )}

            {config && (
              <p className="text-xs text-green-600">
                Last updated: {new Date(config.lastScheduled).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
