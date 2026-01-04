import { registerPlugin } from "@capacitor/core"

export interface AdhanAlarmPlugin {
  scheduleAlarm(options: {
    triggerTime: number
    prayerName: string
    soundUri?: string
    prayerId: number
  }): Promise<{ success: boolean; scheduledTime?: number; needsPermission?: boolean }>

  cancelAlarm(options: { prayerId: number }): Promise<{ success: boolean }>

  cancelAllAlarms(): Promise<{ success: boolean }>

  checkExactAlarmPermission(): Promise<{ granted: boolean; canRequest: boolean }>

  requestExactAlarmPermission(): Promise<{ success: boolean; message?: string }>

  stopAdhan(): Promise<{ success: boolean }>
}

console.log("[v0] Registering AdhanAlarm plugin...")

const AdhanAlarm = registerPlugin<AdhanAlarmPlugin>("AdhanAlarm", {
  web: () => {
    console.log("[v0] AdhanAlarm: Using web fallback implementation")
    return {
      async scheduleAlarm() {
        console.warn("[v0] [AdhanAlarm Web] Not available on web platform")
        return { success: false }
      },
      async cancelAlarm() {
        console.warn("[v0] [AdhanAlarm Web] Not available on web platform")
        return { success: false }
      },
      async cancelAllAlarms() {
        console.warn("[v0] [AdhanAlarm Web] Not available on web platform")
        return { success: false }
      },
      async checkExactAlarmPermission() {
        console.warn("[v0] [AdhanAlarm Web] Not available on web platform")
        return { granted: false, canRequest: false }
      },
      async requestExactAlarmPermission() {
        console.warn("[v0] [AdhanAlarm Web] Not available on web platform")
        return { success: false }
      },
      async stopAdhan() {
        console.warn("[v0] [AdhanAlarm Web] Not available on web platform")
        return { success: false }
      },
    }
  },
})

console.log("[v0] AdhanAlarm plugin registered:", AdhanAlarm)

export default AdhanAlarm
