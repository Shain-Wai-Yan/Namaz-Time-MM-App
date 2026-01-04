import AdhanAlarm from "./adhan-alarm"
import { calculatePrayerTimes, type CalcMethod } from "./solar-calc"

const PRAYER_BASE_IDS = {
  fajr: 1000,
  dhuhr: 2000,
  asr: 3000,
  maghrib: 4000,
  isha: 5000,
} as const

export async function scheduleNativeAlarms(
  lat: number,
  lng: number,
  timezone: number,
  method: CalcMethod,
  asrSchool: 1 | 2,
  hijriOffset: number,
  enabledPrayers: Record<string, boolean> = {},
) {
  try {
    if (typeof lat !== "number" || typeof lng !== "number" || typeof timezone !== "number") {
      return {
        success: false,
        error: "INVALID_PARAMETERS",
        message: "Invalid location parameters",
      }
    }

    const permissionStatus = await AdhanAlarm.checkExactAlarmPermission()

    if (!permissionStatus.granted) {
      if (permissionStatus.canRequest) {
        await AdhanAlarm.requestExactAlarmPermission()
      }

      return {
        success: false,
        error: "PERMISSION_REQUIRED",
        message: "Please grant 'Alarms & reminders' permission in Device Settings → Apps → Adhan Time",
        needsManualGrant: true,
      }
    }

    // Cancel all existing alarms first
    await AdhanAlarm.cancelAllAlarms()

    const now = new Date()
    const scheduledAlarms: any[] = []

    const prayerMappings = [
      { name: "fajr", timeKey: "fajr", displayName: "Fajr" },
      { name: "dhuhr", timeKey: "dhuhr", displayName: "Dhuhr" },
      { name: "asr", timeKey: "asr", displayName: "Asr" },
      { name: "maghrib", timeKey: "maghrib", displayName: "Maghrib" },
      { name: "isha", timeKey: "isha", displayName: "Isha" },
    ] as const

    // Schedule alarms for the next 7 days
    for (let offset = 0; offset < 7; offset++) {
      const date = new Date()
      date.setDate(now.getDate() + offset)

      let times
      try {
        times = calculatePrayerTimes(
          lat,
          lng,
          timezone,
          date,
          method,
          asrSchool,
          undefined,
          {
            fajr: 0,
            sunrise: -2,
            dhuhr: 0,
            asr: 0,
            maghrib: 4,
            isha: 2,
          },
          hijriOffset,
        )

        if (!times || typeof times !== "object") {
          continue
        }
      } catch {
        continue
      }

      for (const prayer of prayerMappings) {
        if (enabledPrayers[prayer.name] === false) {
          continue
        }

        const timeStr = times[prayer.timeKey as keyof typeof times]
        if (!timeStr || typeof timeStr !== "string") {
          continue
        }

        const timeParts = timeStr.split(" ")
        if (timeParts.length !== 2) {
          continue
        }

        const [time, modifier] = timeParts
        const timeComponents = time.split(":")
        if (timeComponents.length !== 2) {
          continue
        }

        let [hours, minutes] = timeComponents.map(Number)

        if (isNaN(hours) || isNaN(minutes)) {
          continue
        }

        if (modifier === "PM" && hours < 12) hours += 12
        if (modifier === "AM" && hours === 12) hours = 0

        const scheduleDate = new Date(date)
        scheduleDate.setHours(hours, minutes, 0, 0)

        if (scheduleDate <= now) {
          continue
        }

        const dayIndex = (date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()) % 1000
        const prayerId = PRAYER_BASE_IDS[prayer.name] + dayIndex

        const result = await AdhanAlarm.scheduleAlarm({
          triggerTime: scheduleDate.getTime(),
          prayerName: prayer.displayName,
          soundUri: "adhan",
          prayerId: prayerId,
        })

        if (result.success) {
          scheduledAlarms.push({
            prayer: prayer.name,
            time: scheduleDate.toISOString(),
            prayerId,
          })
        } else if (result.needsPermission) {
          return {
            success: false,
            error: "PERMISSION_REVOKED",
            scheduled: scheduledAlarms.length,
          }
        }
      }
    }

    return {
      success: true,
      count: scheduledAlarms.length,
      alarms: scheduledAlarms,
    }
  } catch (error) {
    console.error("CRITICAL ALARM ERROR:", error)
    return {
      success: false,
      error: "SCHEDULING_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function cancelAllNativeAlarms() {
  try {
    await AdhanAlarm.cancelAllAlarms()
    return { success: true }
  } catch (error) {
    console.error("Alarm cancellation failed:", error)
    return { success: false, error }
  }
}

export async function stopCurrentAdhan() {
  try {
    await AdhanAlarm.stopAdhan()
    return { success: true }
  } catch (error) {
    console.error("Adhan stop failed:", error)
    return { success: false, error }
  }
}
