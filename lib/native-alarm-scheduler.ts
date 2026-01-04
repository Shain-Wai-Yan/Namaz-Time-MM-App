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
  console.log("[v0] ===== scheduleNativeAlarms CALLED =====")
  console.log("[v0] Parameters:", { lat, lng, timezone, method, asrSchool, hijriOffset, enabledPrayers })

  try {
    if (typeof lat !== "number" || typeof lng !== "number" || typeof timezone !== "number") {
      console.error("[v0] [Native Alarms] Invalid parameters - lat, lng, or timezone is not a number:", {
        lat,
        lng,
        timezone,
      })
      return {
        success: false,
        error: "INVALID_PARAMETERS",
        message: "Invalid location parameters",
      }
    }

    console.log("[v0] [Native Alarms] Starting alarm scheduling...")
    console.log("[v0] [Native Alarms] Parameters:", { lat, lng, timezone, method, asrSchool, hijriOffset })

    console.log("[v0] [Native Alarms] Checking exact alarm permission...")
    const permissionStatus = await AdhanAlarm.checkExactAlarmPermission()
    console.log("[v0] [Native Alarms] Permission status:", permissionStatus)

    if (!permissionStatus.granted) {
      console.warn("[v0] [Native Alarms] ❌ Exact alarm permission NOT granted")

      if (permissionStatus.canRequest) {
        console.log("[v0] [Native Alarms] 🔔 Requesting exact alarm permission...")
        await AdhanAlarm.requestExactAlarmPermission()
        console.log(
          "[v0] [Native Alarms] ⚠️ User was prompted. They must grant permission in settings before alarms work.",
        )
      }

      return {
        success: false,
        error: "PERMISSION_REQUIRED",
        message: "Please grant 'Alarms & reminders' permission in Device Settings → Apps → Adhan Time",
        needsManualGrant: true,
      }
    }

    console.log("[v0] [Native Alarms] ✅ Permission granted - proceeding with scheduling")

    // Cancel all existing alarms first
    console.log("[v0] [Native Alarms] Canceling existing alarms...")
    await AdhanAlarm.cancelAllAlarms()

    const now = new Date()
    const scheduledAlarms: any[] = []

    // We schedule alarms for: fajr, dhuhr (zawal + 5 mins), asr, maghrib, isha
    const prayerMappings = [
      { name: "fajr", timeKey: "fajr", displayName: "Fajr" },
      { name: "dhuhr", timeKey: "dhuhr", displayName: "Dhuhr" },
      { name: "asr", timeKey: "asr", displayName: "Asr" },
      { name: "maghrib", timeKey: "maghrib", displayName: "Maghrib" },
      { name: "isha", timeKey: "isha", displayName: "Isha" },
    ] as const

    console.log("[v0] [Native Alarms] Current time:", now.toISOString())
    console.log("[v0] [Native Alarms] Enabled prayers:", enabledPrayers)

    // Schedule alarms for the next 7 days
    for (let offset = 0; offset < 7; offset++) {
      const date = new Date()
      date.setDate(now.getDate() + offset)

      let times
      try {
        // Function signature: (lat, lng, timezone, date, method, asrSchool, highLatRule, offsets, hijriOffset)
        times = calculatePrayerTimes(
          lat,
          lng,
          timezone,
          date,
          method,
          asrSchool,
          undefined, // highLatRule - uses default HighLatRule.MiddleOfNight
          {
            fajr: 0,
            sunrise: -2,
            dhuhr: 0,
            asr: 0,
            maghrib: 4,
            isha: 2,
          }, // offsets - MUST pass object, not undefined
          hijriOffset, // Now correctly positioned as 9th argument
        )

        if (!times || typeof times !== "object") {
          console.error(`[v0] [Native Alarms] calculatePrayerTimes returned invalid value for day ${offset}:`, times)
          continue
        }

        console.log(`[v0] [Native Alarms] Day ${offset} (${date.toDateString()}):`, times)
      } catch (calcError) {
        console.error(`[v0] [Native Alarms] Error calculating prayer times for day ${offset}:`, calcError)
        continue
      }

      for (const prayer of prayerMappings) {
        // Skip if prayer is disabled (but only if explicitly set to false, default to enabled)
        if (enabledPrayers[prayer.name] === false) {
          console.log(`[v0] [Native Alarms] Skipping ${prayer.name} - disabled by user`)
          continue
        }

        const timeStr = times[prayer.timeKey as keyof typeof times]
        if (!timeStr || typeof timeStr !== "string") {
          console.log(`[v0] [Native Alarms] No time for ${prayer.name} (looking for ${prayer.timeKey}), got:`, timeStr)
          continue
        }

        const timeParts = timeStr.split(" ")
        if (timeParts.length !== 2) {
          console.error(`[v0] [Native Alarms] Invalid time format for ${prayer.name}: ${timeStr}`)
          continue
        }

        const [time, modifier] = timeParts
        const timeComponents = time.split(":")
        if (timeComponents.length !== 2) {
          console.error(`[v0] [Native Alarms] Invalid time components for ${prayer.name}: ${time}`)
          continue
        }

        let [hours, minutes] = timeComponents.map(Number)

        if (isNaN(hours) || isNaN(minutes)) {
          console.error(`[v0] [Native Alarms] Invalid hours/minutes for ${prayer.name}: ${hours}:${minutes}`)
          continue
        }

        if (modifier === "PM" && hours < 12) hours += 12
        if (modifier === "AM" && hours === 12) hours = 0

        const scheduleDate = new Date(date)
        scheduleDate.setHours(hours, minutes, 0, 0)

        if (scheduleDate <= now) {
          console.log(`[v0] [Native Alarms] Skipping ${prayer.name} at ${scheduleDate.toISOString()} - in the past`)
          continue
        }

        const dayIndex = (date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()) % 1000
        const prayerId = PRAYER_BASE_IDS[prayer.name] + dayIndex

        console.log(`[v0] [Native Alarms] Scheduling ${prayer.name}:`, {
          prayerId,
          time: scheduleDate.toISOString(),
          triggerTime: scheduleDate.getTime(),
        })

        const result = await AdhanAlarm.scheduleAlarm({
          triggerTime: scheduleDate.getTime(),
          prayerName: prayer.displayName,
          soundUri: "adhan",
          prayerId: prayerId,
        })

        if (result.success) {
          console.log(`[v0] [Native Alarms] ✅ ${prayer.name} scheduled successfully`)
          scheduledAlarms.push({
            prayer: prayer.name,
            time: scheduleDate.toISOString(),
            prayerId,
          })
        } else if (result.needsPermission) {
          console.error("[v0] [Native Alarms] ❌ Permission was revoked during scheduling - aborting remaining alarms")
          return {
            success: false,
            error: "PERMISSION_REVOKED",
            scheduled: scheduledAlarms.length,
          }
        } else {
          console.error(`[v0] [Native Alarms] ❌ Failed to schedule ${prayer.name}`, result)
        }
      }
    }

    console.log(`[v0] [Native Alarms] ✅ Successfully scheduled ${scheduledAlarms.length} alarms`)
    console.log("[v0] [Native Alarms] Scheduled alarms:", scheduledAlarms)

    return {
      success: true,
      count: scheduledAlarms.length,
      alarms: scheduledAlarms,
    }
  } catch (error) {
    console.error("[v0] [Native Alarms] ❌ Error scheduling:", error)
    return {
      success: false,
      error: "SCHEDULING_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function cancelAllNativeAlarms() {
  try {
    console.log("[v0] [Native Alarms] Canceling all alarms...")
    await AdhanAlarm.cancelAllAlarms()
    console.log("[v0] [Native Alarms] All alarms canceled")
    return { success: true }
  } catch (error) {
    console.error("[v0] [Native Alarms] Error canceling:", error)
    return { success: false, error }
  }
}

export async function stopCurrentAdhan() {
  try {
    console.log("[v0] [Native Alarms] Stopping current adhan...")
    await AdhanAlarm.stopAdhan()
    console.log("[v0] [Native Alarms] Adhan stopped")
    return { success: true }
  } catch (error) {
    console.error("[v0] [Native Alarms] Error stopping adhan:", error)
    return { success: false, error }
  }
}
