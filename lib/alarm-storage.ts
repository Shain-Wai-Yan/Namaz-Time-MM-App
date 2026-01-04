export interface StoredAlarm {
  prayerId: number
  prayerName: string
  triggerTime: number
  soundUri: string
  scheduled: boolean
}

export interface AlarmScheduleData {
  lat: number
  lng: number
  timezone: number
  method: string
  asrSchool: number
  hijriOffset: number
  enabledPrayers: Record<string, boolean>
  lastScheduled: number
}

/**
 * Save alarm schedule configuration for native rescheduling
 */
export async function saveAlarmConfig(config: AlarmScheduleData): Promise<void> {
  try {
    const configString = JSON.stringify(config)
    localStorage.setItem("alarm_config", configString)
    console.log("[v0] [Alarm Storage] Config saved to localStorage")
  } catch (error) {
    console.error("[v0] [Alarm Storage] Error saving config:", error)
  }
}

/**
 * Get stored alarm configuration
 */
export async function getAlarmConfig(): Promise<AlarmScheduleData | null> {
  try {
    const configString = localStorage.getItem("alarm_config")
    if (configString) {
      return JSON.parse(configString)
    }
    return null
  } catch (error) {
    console.error("[v0] [Alarm Storage] Error getting config:", error)
    return null
  }
}

/**
 * Save list of scheduled alarms
 */
export async function saveScheduledAlarms(alarms: StoredAlarm[]): Promise<void> {
  try {
    const alarmsString = JSON.stringify(alarms)
    localStorage.setItem("scheduled_alarms", alarmsString)
    console.log(`[v0] [Alarm Storage] Saved ${alarms.length} scheduled alarms`)
  } catch (error) {
    console.error("[v0] [Alarm Storage] Error saving alarms:", error)
  }
}

/**
 * Get list of scheduled alarms
 */
export async function getScheduledAlarms(): Promise<StoredAlarm[]> {
  try {
    const alarmsString = localStorage.getItem("scheduled_alarms")
    if (alarmsString) {
      return JSON.parse(alarmsString)
    }
    return []
  } catch (error) {
    console.error("[v0] [Alarm Storage] Error getting alarms:", error)
    return []
  }
}
