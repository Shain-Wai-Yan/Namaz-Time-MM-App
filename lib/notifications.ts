import { LocalNotifications } from "@capacitor/local-notifications"
import { calculatePrayerTimes, type CalcMethod } from "./solar-calc"

export async function schedulePrayerNotifications(
  lat: number,
  lng: number,
  timezone: number,
  method: CalcMethod,
  asrSchool: 1 | 2,
  hijriOffset: number,
) {
  try {
    // 1. Request permissions
    const status = await LocalNotifications.requestPermissions()
    if (status.display !== "granted") return

    // 2. Clear existing notifications to avoid duplicates
    await LocalNotifications.cancel({
      notifications: (await LocalNotifications.getPending()).notifications,
    })

    const notifications = []
    const now = new Date()

    // 3. Schedule for next 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date()
      date.setDate(now.getDate() + i)

      const times = calculatePrayerTimes(lat, lng, timezone, date, method, asrSchool, undefined, undefined, hijriOffset)

      const prayerNames = ["fajr", "asr", "maghrib", "isha"] as const

      for (const prayer of prayerNames) {
        const timeStr = times[prayer]
        const [time, modifier] = timeStr.split(" ")
        let [hours, minutes] = time.split(":").map(Number)

        if (modifier === "PM" && hours < 12) hours += 12
        if (modifier === "AM" && hours === 12) hours = 0

        const scheduleDate = new Date(date)
        scheduleDate.setHours(hours, minutes, 0, 0)

        // Only schedule if the time is in the future
        if (scheduleDate > now) {
          notifications.push({
            title: `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} Prayer`,
            body: `It's time for ${prayer} prayer.`,
            id: Math.floor(Math.random() * 1000000),
            schedule: { at: scheduleDate },
            sound: "azan.wav", // Users can configure this in system settings via channels if needed
            smallIcon: "ic_launcher_foreground",
            channelId: "prayer_times",
          })
        }
      }
    }

    if (notifications.length > 0) {
      // Split into chunks if there are many (Capacitor limit is usually high but good practice)
      await LocalNotifications.schedule({ notifications })
      console.log(`[v0] Scheduled ${notifications.length} notifications`)
    }
  } catch (error) {
    console.error("[v0] Error scheduling notifications:", error)
  }
}

// Create the notification channel for Android (Huawei/Samsung support)
export async function createNotificationChannels() {
  try {
    await LocalNotifications.createChannel({
      id: "prayer_times",
      name: "Prayer Notifications",
      description: "Notifications for daily prayer times",
      importance: 5,
      visibility: 1,
      vibration: true,
    })
  } catch (error) {
    console.error("[v0] Error creating notification channel:", error)
  }
}
