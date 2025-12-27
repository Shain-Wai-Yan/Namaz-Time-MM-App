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

const d2r = (d: number) => (d * Math.PI) / 180
const r2d = (r: number) => (r * 180) / Math.PI
const clamp = (v: number, a = -1, b = 1) => Math.max(a, Math.min(b, v))

const METHOD_ANGLES: Record<CalcMethod, { fajr: number; isha: number }> = {
  [CalcMethod.MWL]: { fajr: -18, isha: -17 },
  [CalcMethod.Karachi]: { fajr: -18, isha: -18 },
  [CalcMethod.Egypt]: { fajr: -19.5, isha: -17.5 },
  [CalcMethod.UmmAlQura]: { fajr: -18.5, isha: -90 }, // Isha handled separately
  [CalcMethod.Custom]: { fajr: -18, isha: -18 },
}

// --- Utility Functions ---

function declinationAndEoT(Nf: number) {
  const B = (360 / 365) * (Nf - 81)
  const Brad = d2r(B)
  const delta = 23.45 * Math.sin(d2r((360 / 365) * (Nf - 81)))
  const EoT = 9.87 * Math.sin(2 * Brad) - 7.53 * Math.cos(Brad) - 1.5 * Math.sin(Brad)
  return { delta, EoT }
}

function hourAngleDeg(latDeg: number, declDeg: number, alphaDeg: number) {
  const phi = d2r(latDeg)
  const d = d2r(declDeg)
  const cosH = clamp((Math.sin(d2r(alphaDeg)) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)))
  return r2d(Math.acos(cosH))
}

function asrAltitudeDeg(latDeg: number, declDeg: number, shadowFactor: number) {
  const phi = d2r(latDeg)
  const d = d2r(declDeg)
  return r2d(Math.atan(1 / (shadowFactor + Math.tan(Math.abs(phi - d)))))
}

function formatHM(hoursFloat: number) {
  hoursFloat = ((hoursFloat % 24) + 24) % 24
  let h = Math.floor(hoursFloat)
  let m = Math.round((hoursFloat - h) * 60)
  if (m === 60) {
    m = 0
    h = (h + 1) % 24
  }
  const period = h >= 12 ? "PM" : "AM"
  const displayH = h % 12 || 12
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`
}

function hoursToMins(hours: number) {
  return Math.round(hours * 60)
}
function minsToHours(mins: number) {
  return mins / 60
}

// --- Hijri Calendar and Islamic Event Calculation Logic ---

export function getHijriDate(date: Date, offset: number) {
  // 1. Create a copy and apply the manual offset (+1, 0, -1 days)
  const adjustedDate = new Date(date);
  adjustedDate.setDate(date.getDate() + offset);

  const day = adjustedDate.getDate();
  const month = adjustedDate.getMonth() + 1;
  const year = adjustedDate.getFullYear();

  // 2. Convert Gregorian to Julian Date
  let m = month;
  let y = year;
  if (m < 3) {
    y -= 1;
    m += 12;
  }

  const a = Math.floor(y / 100);
  let b = 2 - a + Math.floor(a / 4);
  if (y < 1583) b = 0;
  if (y === 1582) {
    if (m > 10) b = -10;
    if (m === 10) {
      if (day > 4) b = -10;
    }
  }

  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524;

  // 3. Convert Julian Date to Hijri
  const epochastro = 1948084;
  const l0 = jd - epochastro + 10632;
  const n = Math.floor((l0 - 1) / 10631);
  const l = l0 - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l + 2) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l + 2) / 15238);
  const l2 =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j + 2) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j + 2) / 43) +
    29;

  const hMonth = Math.floor((24 * l2 + 3) / 709);
  const hDay = l2 - Math.floor((709 * hMonth + 3) / 24);
  const hYear = 30 * n + j - 30;

  return { day: hDay, month: hMonth, year: hYear };
}

export function getIslamicEvent(day: number, month: number) {
  const events = [
    { m: 1, d: 1, key: "new_year" },
    { m: 1, d: 10, key: "ashura" },
    { m: 3, d: 12, key: "mawlid" },
    { m: 7, d: 27, key: "isra" },
    { m: 8, d: 15, key: "baraat" },
    { m: 9, d: 1, key: "ramadan_start" },
    { m: 9, d: 21, key: "qadr", range: 10 },
    { m: 10, d: 1, key: "fitr" },
    { m: 12, d: 8, key: "hajj", range: 6 },
    { m: 12, d: 9, key: "arafah" },
    { m: 12, d: 10, key: "adha" },
  ]

  return events.find((e) => {
    if (e.range) {
      return month === e.m && day >= e.d && day < e.d + e.range
    }
    return month === e.m && day === e.d
  })
}

// --- Ramadan Check ---
function isRamadan(date: Date, hijriOffset: number) {
  const hijriDate = getHijriDate(date, hijriOffset)
  return hijriDate.month === 9
}

// --- High Latitude Adjustments ---
function highLatitudeAdjustment(hours: number | null, fallback: number) {
  return hours !== null && !isNaN(hours) ? hours : fallback
}

// --- Main Function ---

export function calculatePrayerTimesAdvanced(
  lat: number,
  lng: number,
  timezone: number,
  date: Date = new Date(),
  method: CalcMethod = CalcMethod.Karachi,
  asrShadow: 1 | 2 = 2,
  customFajrAngle?: number,
  customIshaAngle?: number,
  hijriOffset = 0, // Added hijriOffset to parameter list
): PrayerTimes {
  const methodAngles = METHOD_ANGLES[method]
  const fajrAngle = method === CalcMethod.Custom && customFajrAngle !== undefined ? customFajrAngle : methodAngles.fajr

  const ishaAngle = method === CalcMethod.Custom && customIshaAngle !== undefined ? customIshaAngle : methodAngles.isha

  const dayStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  const dayIndex =
    Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - dayStart) / 86400000) + 1

  const getSolar = (localHour: number) => {
    const utcHour = localHour - timezone
    let Nf = dayIndex + utcHour / 24
    if (utcHour < 0) Nf = dayIndex - 1 + (utcHour + 24) / 24
    else if (utcHour >= 24) Nf = dayIndex + 1 + (utcHour - 24) / 24
    return declinationAndEoT(Nf)
  }

  const solvePrayer = (alphaDeg: number, beforeNoon: boolean) => {
    let t = 12 + timezone - lng / 15 // Start estimate
    for (let i = 0; i < 3; i++) {
      const { delta: d, EoT: e } = getSolar(t)
      const noon = 12 + timezone - lng / 15 - e / 60
      const H = hourAngleDeg(lat, d, alphaDeg)
      t = beforeNoon ? noon - H / 15 : noon + H / 15
    }
    return t
  }

  const { delta, EoT } = getSolar(12)
  const solarNoon = 12 + timezone - lng / 15 - EoT / 60

  // --- Prayer Calculations ---

  const fajrLocal = highLatitudeAdjustment(solvePrayer(fajrAngle, true), 5) + 1 / 60

  const sunriseLocal = highLatitudeAdjustment(solvePrayer(-1.1, true), 6)

  const zawalLocal = solarNoon

  const asrLocal = highLatitudeAdjustment(solvePrayer(asrAltitudeDeg(lat, delta, asrShadow), false), zawalLocal + 1)

  const maghribLocal = highLatitudeAdjustment(solvePrayer(-1.1, false), zawalLocal + 0.1) + 2.5 / 60

  let ishaLocal: number
  if (method === CalcMethod.UmmAlQura) {
    const isRamadanMonth = isRamadan(date, hijriOffset)
    const offset = isRamadanMonth ? 120 : 90
    ishaLocal = maghribLocal + minsToHours(offset)
  } else {
    ishaLocal = highLatitudeAdjustment(solvePrayer(ishaAngle, false), maghribLocal + 1.5) + 1.5 / 60
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

// 🔹 Backward compatibility alias
export const calculatePrayerTimes = calculatePrayerTimesAdvanced
