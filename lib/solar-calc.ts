// lib/solar-calc.ts

export type PrayerTimes = {
  fajr: string
  sunrise: string
  zawal: string
  asr: string
  maghrib: string
  isha: string
  _mins?: {
    fajr: number
    sunrise: number
    zawal: number
    asr: number
    maghrib: number
    isha: number
  }
}

export enum CalcMethod {
  MWL = "MWL",
  Karachi = "Karachi",
  Egypt = "Egypt",
  UmmAlQura = "UmmAlQura",
  Custom = "Custom",
}

// Added for clarity in your UI logic
export enum AsrMethod {
  Shafi = 1,
  Hanafi = 2
}

const d2r = (d: number) => (d * Math.PI) / 180
const r2d = (r: number) => (r * 180) / Math.PI
const clamp = (v: number, a = -1, b = 1) => Math.max(a, Math.min(b, v))

const METHOD_ANGLES: Record<CalcMethod, { fajr: number; isha: number }> = {
  [CalcMethod.MWL]: { fajr: -18, isha: -17 },
  [CalcMethod.Karachi]: { fajr: -18, isha: -18 },
  [CalcMethod.Egypt]: { fajr: -19.5, isha: -17.5 },
  [CalcMethod.UmmAlQura]: { fajr: -18.5, isha: -90 }, 
  [CalcMethod.Custom]: { fajr: -18, isha: -18 },
}

// --- Utility Functions ---

function declinationAndEoT(Nf: number) {
  const B = (360 / 365) * (Nf - 81)
  const Brad = d2r(B)
  const delta = 23.45 * Math.sin(d2r((360 / 365) * (Nf - 81)))
  const EoT =
    9.87 * Math.sin(2 * Brad) -
    7.53 * Math.cos(Brad) -
    1.5 * Math.sin(Brad)
  return { delta, EoT }
}

function hourAngleDeg(latDeg: number, declDeg: number, alphaDeg: number) {
  const phi = d2r(latDeg)
  const d = d2r(declDeg)
  const cosH = clamp(
    (Math.sin(d2r(alphaDeg)) - Math.sin(phi) * Math.sin(d)) /
    (Math.cos(phi) * Math.cos(d))
  )
  return r2d(Math.acos(cosH))
}

function asrAltitudeDeg(latDeg: number, declDeg: number, shadowFactor: number) {
  const phi = d2r(latDeg)
  const d = d2r(declDeg)
  return r2d(Math.atan(1 / (shadowFactor + Math.tan(Math.abs(phi - d)))))
}

function formatHM(hoursFloat: number) {
  hoursFloat = (hoursFloat % 24 + 24) % 24
  let h = Math.floor(hoursFloat)
  let m = Math.round((hoursFloat - h) * 60)
  if (m === 60) { m = 0; h = (h + 1) % 24 }
  const period = h >= 12 ? "PM" : "AM"
  const displayH = h % 12 || 12
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`
}

function hoursToMins(hours: number) { return Math.round(hours * 60) }
function minsToHours(mins: number) { return mins / 60 }

function isRamadan(date: Date) {
  // 2025 Ramadan is roughly March. Adjusted placeholder to reflect real calendar.
  const month = date.getUTCMonth() + 1
  return month === 3 
}

function highLatitudeAdjustment(hours: number | null, fallback: number) {
  return hours !== null && !isNaN(hours) ? hours : fallback
}

// --- Main Function ---

export function calculatePrayerTimesAdvanced(
  lat: number,
  lng: number,
  timezone: number,
  date: Date = new Date(),
  method: CalcMethod = CalcMethod.Karachi, // Setting Karachi as default for Myanmar
  asrShadow: 1 | 2 = 2, // Setting Hanafi as default to match your local tables
  customFajrAngle?: number,
  customIshaAngle?: number,
): PrayerTimes {

  const methodAngles = METHOD_ANGLES[method]
  const fajrAngle = customFajrAngle ?? methodAngles.fajr
  const ishaAngle = customIshaAngle ?? methodAngles.isha

  /**
   * BURMA GEOGRAPHY ADJUSTMENT:
   * Standard astronomical sunrise is -0.833°. 
   * Local tables in Myanmar reflect elevation (Shan Hills/Central Plains).
   * Using -1.1° provides a much better match for Myanmar's visual sunrise.
   */
  const sunriseAngle = -1.1; 

  const dayStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  const dayIndex =
    Math.floor(
      (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
        dayStart) / 86400000
    ) + 1

  const getSolar = (localHour: number) => {
    let utcHour = localHour - timezone
    let Nf = dayIndex + utcHour / 24
    return declinationAndEoT(Nf)
  }

  // Pre-calculate Noon values
  const { delta: dNoon, EoT: eNoon } = getSolar(12)
  let solarNoon = 12 + timezone - lng / 15 - eNoon / 60

  const solvePrayer = (alphaDeg: number, beforeNoon: boolean) => {
    let t = beforeNoon ? solarNoon - 5 : solarNoon + 5
    for (let i = 0; i < 3; i++) {
      const { delta, EoT } = getSolar(t)
      const currentNoon = 12 + timezone - lng / 15 - EoT / 60
      const H = hourAngleDeg(lat, delta, alphaDeg)
      t = beforeNoon ? currentNoon - H / 15 : currentNoon + H / 15
    }
    return t
  }

  // --- Prayer Calculations with Myanmar Ihtiyat (Safety Buffers) ---

  // FAJR: Added 1-minute buffer to match local "Subh" start
  const fajrLocal = solvePrayer(fajrAngle, true) + (1 / 60);

  // SUNRISE: Uses elevation-adjusted angle
  const sunriseLocal = solvePrayer(sunriseAngle, true);

  const zawalLocal = solarNoon;

  // ASR: Based on the chosen shadow factor (Hanafi by default for Myanmar)
  const asrLocal = solvePrayer(asrAltitudeDeg(lat, dNoon, asrShadow), false);

  // MAGHRIB: Sunset angle + 3-minute Myanmar Safety Buffer
  // This ensures the sun is completely hidden behind terrain.
  let maghribLocal = solvePrayer(sunriseAngle, false) + (3 / 60);

  // ISHA: Isha angle + 2-minute Myanmar Safety Buffer
  let ishaLocal: number
  if (method === CalcMethod.UmmAlQura) {
    let offset = isRamadan(date) ? 120 : 90
    ishaLocal = maghribLocal + minsToHours(offset)
  } else {
    ishaLocal = solvePrayer(ishaAngle, false) + (2 / 60);
  }

  const resultMins = {
    fajr: hoursToMins(fajrLocal),
    sunrise: hoursToMins(sunriseLocal),
    zawal: hoursToMins(zawalLocal),
    asr: hoursToMins(asrLocal),
    maghrib: hoursToMins(maghribLocal),
    isha: hoursToMins(ishaLocal),
  }

  return {
    fajr: formatHM(fajrLocal),
    sunrise: formatHM(sunriseLocal),
    zawal: formatHM(zawalLocal),
    asr: formatHM(asrLocal),
    maghrib: formatHM(maghribLocal),
    isha: formatHM(ishaLocal),
    _mins: resultMins,
  }
}

export const calculatePrayerTimes = calculatePrayerTimesAdvanced