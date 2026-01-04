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

const AdhanAlarm = registerPlugin<AdhanAlarmPlugin>("AdhanAlarm", {
  web: () => {
    return {
      async scheduleAlarm() {
        return { success: false }
      },
      async cancelAlarm() {
        return { success: false }
      },
      async cancelAllAlarms() {
        return { success: false }
      },
      async checkExactAlarmPermission() {
        return { granted: false, canRequest: false }
      },
      async requestExactAlarmPermission() {
        return { success: false }
      },
      async stopAdhan() {
        return { success: false }
      },
    }
  },
})

export default AdhanAlarm
