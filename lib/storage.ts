/**
 * User Settings Storage Manager
 * Handles persistent storage of prayer times calculation preferences
 * and triggers notification re-scheduling when settings change
 */

import { schedulePrayerNotifications } from "./notifications"

/* =======================
   Types
======================= */

export interface UserSettings {
  // Prayer calculation method (Karachi, MWL, Egypt, UmmAlQura)
  method: number

  // Asr shadow rule: 1 = Shafi, 2 = Hanafi
  asrShadow: 1 | 2

  // Hijri date offset
  hijriOffset: number

  // Language preference
  language: "en" | "my"

  // Prayer sound toggles
  prayerSoundSettings: {
    fajr: boolean
    dhuhr: boolean
    asr: boolean
    maghrib: boolean
    isha: boolean
  }

  // Timestamp
  lastUpdated: number
}

export type Coordinates = {
  lat: number
  lng: number
  tz: number
}

/* =======================
   Constants
======================= */

const STORAGE_KEY = "namaz_time_user_settings"

const DEFAULT_SETTINGS: UserSettings = {
  method: 0, // Karachi
  asrShadow: 2, // Hanafi (Myanmar default)
  hijriOffset: 0,
  language: "my",
  prayerSoundSettings: {
    fajr: true,
    dhuhr: true,
    asr: true,
    maghrib: true,
    isha: true,
  },
  lastUpdated: Date.now(),
}

/* =======================
   Core Helpers
======================= */

function isBrowser(): boolean {
  return typeof window !== "undefined"
}

/* =======================
   Load
======================= */

export function loadSettings(): UserSettings {
  if (!isBrowser()) return DEFAULT_SETTINGS

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS

    const parsed = JSON.parse(raw)
    const method =
      typeof parsed.method === "string"
        ? parsed.method === "MWL"
          ? 1
          : parsed.method === "Egypt"
            ? 2
            : parsed.method === "UmmAlQura"
              ? 3
              : 0
        : parsed.method || 0

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      method, // Override with normalized number value
      prayerSoundSettings: {
        ...DEFAULT_SETTINGS.prayerSoundSettings,
        ...parsed.prayerSoundSettings,
      },
    }
  } catch (err) {
    console.error("[storage] Failed to load settings:", err)
    return DEFAULT_SETTINGS
  }
}

/* =======================
   Save
======================= */

export function saveSettings(settings: UserSettings): boolean {
  if (!isBrowser()) return false

  try {
    const toSave: UserSettings = {
      ...settings,
      lastUpdated: Date.now(),
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    return true
  } catch (err) {
    console.error("[storage] Failed to save settings:", err)
    return false
  }
}

/* =======================
   Re-schedule Bridge
======================= */

function rescheduleIfPossible(settings: UserSettings, coords?: Coordinates) {
  if (!coords) return

  const methodMap: Record<number, any> = {
    0: "Karachi",
    1: "MWL",
    2: "Egypt",
    3: "UmmAlQura",
  }

  schedulePrayerNotifications(
    coords.lat,
    coords.lng,
    coords.tz,
    methodMap[settings.method] || "Karachi", // Convert to string enum
    settings.asrShadow,
    settings.hijriOffset,
    settings.prayerSoundSettings,
  )
}

/* =======================
   Update APIs
======================= */

export function updateSetting<K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K],
  coords?: Coordinates,
): UserSettings {
  const current = loadSettings()

  const updated: UserSettings = {
    ...current,
    [key]: value,
  }

  saveSettings(updated)
  rescheduleIfPossible(updated, coords)

  return updated
}

export function updatePrayerSound(
  prayer: keyof UserSettings["prayerSoundSettings"],
  enabled: boolean,
  coords?: Coordinates,
): UserSettings {
  const current = loadSettings()

  const updated: UserSettings = {
    ...current,
    prayerSoundSettings: {
      ...current.prayerSoundSettings,
      [prayer]: enabled,
    },
  }

  saveSettings(updated)
  rescheduleIfPossible(updated, coords)

  return updated
}

/* =======================
   Reset
======================= */

export function resetSettings(coords?: Coordinates): UserSettings {
  saveSettings(DEFAULT_SETTINGS)
  rescheduleIfPossible(DEFAULT_SETTINGS, coords)
  return DEFAULT_SETTINGS
}
