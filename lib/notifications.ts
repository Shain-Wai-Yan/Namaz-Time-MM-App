import { LocalNotifications } from "@capacitor/local-notifications"
import { calculatePrayerTimes, type CalcMethod } from "./solar-calc"

/**
 * Deterministic Notification Scheduler
 * - No random IDs
 * - No ghost alarms
 * - Safe re-scheduling
 */

export async function schedulePrayerNotifications(
  lat: number,
  lng: number,
  timezone: number,
  method: CalcMethod,
  asrSchool: 1 | 2,
  hijriOffset: number,
  userSoundSettings: Record<string, boolean> = {},
) {
  try {
    /* ===============================
       1. Permission
    =============================== */
    const status = await LocalNotifications.requestPermissions()
    if (status.display !== "granted") return

    /* ===============================
       2. Clear existing notifications
       (prevents ghost alarms)
    =============================== */
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }

    const notifications: any[] = []
    const now = new Date()

    /* ===============================
       Deterministic ID blocks
    =============================== */
    const prayerBaseIds: Record<string, number> = {
      fajr: 1000,
      dhuhr: 2000,
      asr: 3000,
      maghrib: 4000,
      isha: 5000,
    }

    const prayerNames = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const

    /* ===============================
       3. Schedule next 7 days
    =============================== */
    for (let offset = 0; offset < 7; offset++) {
      const date = new Date()
      date.setDate(now.getDate() + offset)

      // Stable day index (YYYYMMDD → last 3 digits)
      const dayIndex =
        (date.getFullYear() * 10000 +
          (date.getMonth() + 1) * 100 +
          date.getDate()) %
        1000

      const times = calculatePrayerTimes(
        lat,
        lng,
        timezone,
        date,
        method,
        asrSchool,
        undefined,
        undefined,
        hijriOffset,
      )

      for (const prayer of prayerNames) {
        const timeStr = times[prayer]
        if (!timeStr) continue

        const [time, modifier] = timeStr.split(" ")
        let [hours, minutes] = time.split(":").map(Number)

        if (modifier === "PM" && hours < 12) hours += 12
        if (modifier === "AM" && hours === 12) hours = 0

        const scheduleDate = new Date(date)
        scheduleDate.setHours(hours, minutes, 0, 0)

        if (scheduleDate <= now) continue

        const hasSound = userSoundSettings[prayer] === true

        // 🔒 DETERMINISTIC, COLLISION-SAFE ID
        // Example: Fajr (1000) + DayIndex (e.g. 742) → 1742
        const notificationId = prayerBaseIds[prayer] + dayIndex

        notifications.push({
          id: notificationId,
          title: `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} Prayer`,
          body: `It's time for ${prayer} prayer.`,
          schedule: { at: scheduleDate },
          sound: hasSound ? "adhan.mp3" : null,
          channelId: hasSound ? "adhan_channel" : "silent_channel",
          smallIcon: "ic_launcher_foreground",
        })
      }
    }

    /* ===============================
       4. Schedule
    =============================== */
    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications })
      console.log(`[Notifications] Synced ${notifications.length} prayers`)
    }
  } catch (error) {
    console.error("[Notifications] Scheduling error:", error)
  }
}

/* ===============================
   Channels
=============================== */

export async function createNotificationChannels() {
  try {
    await LocalNotifications.createChannel({
      id: "adhan_channel",
      name: "Adhan Alarms",
      description: "Prayers with full audio Adhan",
      importance: 5,
      sound: "adhan.mp3",
      visibility: 1,
      vibration: true,
    })

    await LocalNotifications.createChannel({
      id: "silent_channel",
      name: "Silent Alerts",
      description: "Prayers with text only",
      importance: 3,
      visibility: 1,
      vibration: false,
    })
  } catch (error) {
    console.error("[Notifications] Channel error:", error)
  }
}
