/* ============================================================
   OFFLINE ISLAMIC PRAYER TIME ENGINE
   Reference-grade, fiqh-aware, deterministic, drift-free
   ============================================================ */

/* -------------------- Types -------------------- */

export type PrayerTimes = {
  fajr: string
  sunrise: string
  zawal: string
  asr: string
  maghrib: string
  isha: string
  _mins: {
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

export enum HighLatRule {
  None = "None",
  MiddleOfNight = "MiddleOfNight",
  OneSeventh = "OneSeventh",
  AngleBased = "AngleBased",
}

/* -------------------- Constants -------------------- */

const METHOD_ANGLES: Record<CalcMethod, { fajr: number; isha: number }> = {
  MWL: { fajr: -18, isha: -17 },
  Karachi: { fajr: -18, isha: -18 },
  Egypt: { fajr: -19.5, isha: -17.5 },
  UmmAlQura: { fajr: -18.5, isha: 0 }, // Isha by minutes
  Custom: { fajr: -18, isha: -18 },
}

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

const sin = (d: number) => Math.sin(d * DEG2RAD)
const cos = (d: number) => Math.cos(d * DEG2RAD)
const tan = (d: number) => Math.tan(d * DEG2RAD)
const asin = (x: number) => RAD2DEG * Math.asin(x)
const acos = (x: number) => RAD2DEG * Math.acos(Math.min(1, Math.max(-1, x)))
const atan = (x: number) => RAD2DEG * Math.atan(x)

/* -------------------- Julian Date -------------------- */

function julianDate(date: Date) {
  let y = date.getUTCFullYear()
  let m = date.getUTCMonth() + 1
  const d =
    date.getUTCDate() +
    (date.getUTCHours() +
      date.getUTCMinutes() / 60 +
      date.getUTCSeconds() / 3600) /
      24

  if (m <= 2) {
    y--
    m += 12
  }

  const A = Math.floor(y / 100)
  const B = 2 - A + Math.floor(A / 4)

  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    d +
    B -
    1524.5
  )
}

/* -------------------- High-Precision Solar Position -------------------- */

function solarPosition(jd: number) {
  const T = (jd - 2451545.0) / 36525

  const L0 =
    280.46646 +
    36000.76983 * T +
    0.0003032 * T * T

  const M =
    357.52911 +
    35999.05029 * T -
    0.0001537 * T * T

  const e =
    0.016708634 -
    0.000042037 * T -
    0.0000001267 * T * T

  const C =
    (1.914602 - 0.004817 * T) * sin(M) +
    (0.019993 - 0.000101 * T) * sin(2 * M) +
    0.000289 * sin(3 * M)

  const lambda = L0 + C
  const epsilon = 23.439291 - 0.0130042 * T

  const decl = asin(sin(epsilon) * sin(lambda))

  const y = Math.pow(tan(epsilon / 2), 2)

  const EoT =
    4 *
    RAD2DEG *
    (y * sin(2 * L0) -
      2 * e * sin(M) +
      4 * e * y * sin(M) * cos(2 * L0) -
      0.5 * y * y * sin(4 * L0) -
      1.25 * e * e * sin(2 * M))

  return { decl, EoT }
}

/* -------------------- Core Solar Math -------------------- */

function hourAngle(lat: number, decl: number, angle: number) {
  const num = sin(angle) - sin(lat) * sin(decl)
  const den = cos(lat) * cos(decl)
  return acos(num / den)
}

function asrAltitude(lat: number, decl: number, factor: 1 | 2) {
  return atan(1 / (factor + tan(Math.abs(lat - decl))))
}

/* -------------------- Iterative Solver (3-pass) -------------------- */

function solveTime(
  lat: number,
  lng: number,
  tz: number,
  jd: number,
  angle: number,
  beforeNoon: boolean,
) {
  let t = 12

  for (let i = 0; i < 3; i++) {
    const { decl, EoT } = solarPosition(jd + t / 24)
    const noon = 12 + tz - lng / 15 - EoT / 60
    const H = hourAngle(lat, decl, angle) / 15
    t = beforeNoon ? noon - H : noon + H
  }

  return t
}

/* -------------------- Time Helpers -------------------- */

const norm = (h: number) => ((h % 24) + 24) % 24

function formatHM(h: number) {
  h = norm(h)
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  const ap = hh >= 12 ? "PM" : "AM"
  const h12 = hh % 12 || 12
  return `${h12}:${mm.toString().padStart(2, "0")} ${ap}`
}

const hoursToMins = (h: number) => Math.round(norm(h) * 60)

/* -------------------- Hijri (Civil, Offline) -------------------- */

export function getHijriDate(date: Date, offset = 0) {
  const d = new Date(date)
  d.setDate(d.getDate() + offset)

  const day = d.getDate()
  let month = d.getMonth() + 1
  let year = d.getFullYear()

  if (month < 3) {
    year--
    month += 12
  }

  const a = Math.floor(year / 100)
  const b = 2 - a + Math.floor(a / 4)

  const jd =
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    day +
    b -
    1524

  const epoch = 1948440
  const l0 = jd - epoch + 10632
  const n = Math.floor((l0 - 1) / 10631)
  const l = l0 - 10631 * n + 354

  const j =
    Math.floor((10985 - l) / 5316) *
      Math.floor((50 * l + 2) / 17719) +
    Math.floor(l / 5670) *
      Math.floor((43 * l + 2) / 15238)

  const l2 =
    l -
    Math.floor((30 - j) / 15) *
      Math.floor((17719 * j + 2) / 50) -
    Math.floor(j / 16) *
      Math.floor((15238 * j + 2) / 43) +
    29

  const monthH = Math.floor((24 * l2 + 3) / 709)
  const dayH = l2 - Math.floor((709 * monthH + 3) / 24)
  const yearH = 30 * n + j - 30

  return { day: dayH, month: monthH, year: yearH }
}

/* -------------------- Islamic Events -------------------- */

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

  return events.find((e) =>
    e.range
      ? month === e.m && day >= e.d && day < e.d + e.range
      : month === e.m && day === e.d,
  )
}

/* -------------------- High Latitude -------------------- */

function nightPortion(rule: HighLatRule, angle: number) {
  if (rule === HighLatRule.AngleBased) return angle / 60
  if (rule === HighLatRule.OneSeventh) return 1 / 7
  if (rule === HighLatRule.MiddleOfNight) return 1 / 2
  return 0
}

/* -------------------- Main Calculator -------------------- */

export function calculatePrayerTimesAdvanced(
  lat: number,
  lng: number,
  timezone: number,
  date = new Date(),
  method: CalcMethod = CalcMethod.Karachi,
  asrSchool: 1 | 2 = 2,
  highLatRule: HighLatRule = HighLatRule.MiddleOfNight,
  offsets = {
    fajr: 2,//added 2 minutes for safety 
    sunrise: 0,
    zawal: 0,
    asr: 0,
    maghrib: 4, //added 4 minutes for safety 
    isha: 2,//added 2 minutes for safety
  },
  hijriOffset = 0,
): PrayerTimes {
  const jd = julianDate(date)
  const angles = METHOD_ANGLES[method]

  const sunrise = solveTime(lat, lng, timezone, jd, -0.833, true)
  const sunset = solveTime(lat, lng, timezone, jd, -0.833, false)

  const night = sunrise + 24 - sunset
  const portion = nightPortion(highLatRule, Math.abs(angles.fajr))

  let fajr = solveTime(lat, lng, timezone, jd, angles.fajr, true)
  if (isNaN(fajr)) fajr = sunrise - night * portion

  let isha: number
  if (method === CalcMethod.UmmAlQura) {
    const hijri = getHijriDate(date, hijriOffset)
    isha = sunset + (hijri.month === 9 ? 2 : 1.5)
  } else {
    isha = solveTime(lat, lng, timezone, jd, angles.isha, false)
    if (isNaN(isha)) isha = sunset + night * portion
  }

  const { decl } = solarPosition(jd)
  const asr = solveTime(
    lat,
    lng,
    timezone,
    jd,
    asrAltitude(lat, decl, asrSchool),
    false,
  )

  const zawal = (sunrise + sunset) / 2

  const times = {
    fajr: fajr + offsets.fajr / 60,
    sunrise: sunrise + offsets.sunrise / 60,
    zawal: zawal + offsets.zawal / 60,
    asr: asr + offsets.asr / 60,
    maghrib: sunset + offsets.maghrib / 60,
    isha: isha + offsets.isha / 60,
  }

  return {
    fajr: formatHM(times.fajr),
    sunrise: formatHM(times.sunrise),
    zawal: formatHM(times.zawal),
    asr: formatHM(times.asr),
    maghrib: formatHM(times.maghrib),
    isha: formatHM(times.isha),
    _mins: {
      fajr: hoursToMins(times.fajr),
      sunrise: hoursToMins(times.sunrise),
      zawal: hoursToMins(times.zawal),
      asr: hoursToMins(times.asr),
      maghrib: hoursToMins(times.maghrib),
      isha: hoursToMins(times.isha),
    },
  }
}

/* -------------------- Backward Compatibility -------------------- */

export const calculatePrayerTimes = calculatePrayerTimesAdvanced


export const CITIES = [
  { name: "Yangon", slug: "yangon", lat: 16.8661, lng: 96.1951, timezone: 6.5 },
  { name: "Mandalay", slug: "mandalay", lat: 21.9588, lng: 96.0891, timezone: 6.5 },
  { name: "Naypyidaw", slug: "naypyidaw", lat: 19.7633, lng: 96.0785, timezone: 6.5 },
  { name: "Taunggyi", slug: "taunggyi", lat: 20.7888, lng: 97.0333, timezone: 6.5 },
  { name: "Mawlamyine", slug: "mawlamyine", lat: 16.4833, lng: 97.6333, timezone: 6.5 },
  { name: "Bago", slug: "bago", lat: 17.3333, lng: 96.4833, timezone: 6.5 },
  { name: "Pathein", slug: "pathein", lat: 16.7833, lng: 94.7333, timezone: 6.5 },
  { name: "Pyay", slug: "pyay", lat: 18.8167, lng: 95.2167, timezone: 6.5 },
  { name: "Monywa", slug: "monywa", lat: 22.1167, lng: 95.1333, timezone: 6.5 },
  { name: "Sittwe", slug: "sittwe", lat: 20.15, lng: 92.9, timezone: 6.5 },
  { name: "Lashio", slug: "lashio", lat: 22.95, lng: 97.75, timezone: 6.5 },
  { name: "Meiktila", slug: "meiktila", lat: 20.8833, lng: 95.85, timezone: 6.5 },
  { name: "Magway", slug: "magway", lat: 20.15, lng: 94.9167, timezone: 6.5 },
  { name: "Myitkyina", slug: "myitkyina", lat: 25.3833, lng: 97.4, timezone: 6.5 },
  { name: "Dawei", slug: "dawei", lat: 14.0833, lng: 98.2, timezone: 6.5 },
  { name: "Hpa-An", slug: "hpa-an", lat: 16.8833, lng: 97.6333, timezone: 6.5 },
  { name: "Loikaw", slug: "loikaw", lat: 19.6667, lng: 97.2, timezone: 6.5 },
  { name: "Hakha", slug: "hakha", lat: 22.65, lng: 93.6, timezone: 6.5 },
  { name: "Kalay", slug: "kalay", lat: 23.2, lng: 94.0167, timezone: 6.5 },
  { name: "Pakokku", slug: "pakokku", lat: 21.3333, lng: 95.0833, timezone: 6.5 },
  { name: "Thaton", slug: "thaton", lat: 16.9167, lng: 97.3667, timezone: 6.5 },
  { name: "Pyin Oo Lwin", slug: "pyin-oo-lwin", lat: 22.0315, lng: 96.471, timezone: 6.5 },
]
