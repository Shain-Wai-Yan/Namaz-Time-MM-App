// lib/solar-calc.ts
export type PrayerTimes = {
  fajr: string
  sunrise: string
  dhuhr: string
  asr: string
  maghrib: string
  isha: string
  _mins?: { fajr:number; sunrise:number; dhuhr:number; asr:number; maghrib:number; isha:number }
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
const clamp = (v:number, a=-1, b=1) => Math.max(a, Math.min(b, v))

const METHOD_ANGLES: Record<CalcMethod, { fajr: number; isha: number }> = {
  [CalcMethod.MWL]: { fajr: -18, isha: -17 },
  [CalcMethod.Karachi]: { fajr: -18, isha: -18 },
  [CalcMethod.Egypt]: { fajr: -19.5, isha: -17.5 },
  [CalcMethod.UmmAlQura]: { fajr: -18.5, isha: -90 },
  [CalcMethod.Custom]: { fajr: -18, isha: -18 },
}

function declinationAndEoT(Nf: number) {
  const B = (360 / 365) * (Nf - 81)
  const Brad = d2r(B)
  const delta = 23.45 * Math.sin(d2r((360 / 365) * (Nf - 81)))
  const EoT = 9.87 * Math.sin(2*Brad) - 7.53 * Math.cos(Brad) - 1.5 * Math.sin(Brad)
  return { delta, EoT }
}

function hourAngleDeg(latDeg:number, declDeg:number, alphaDeg:number) {
  const phi = d2r(latDeg)
  const d = d2r(declDeg)
  const cosH = clamp((Math.sin(d2r(alphaDeg)) - Math.sin(phi)*Math.sin(d)) / (Math.cos(phi)*Math.cos(d)))
  return r2d(Math.acos(cosH))
}

function asrAltitudeDeg(latDeg:number, declDeg:number, shadowFactor:number) {
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
  return `${displayH}:${m.toString().padStart(2,"0")} ${period}`
}

function hoursToMins(hours:number){ return Math.round(hours*60) }
function minsToHours(mins:number){ return mins/60 }

export function calculatePrayerTimesAdvanced(
  lat: number,
  lng: number,
  timezone: number,
  date: Date = new Date(),
  method: CalcMethod = CalcMethod.MWL,
  asrShadow: 1 | 2 = 1,
  customFajrAngle?: number,
  customIshaAngle?: number,
): PrayerTimes {
  const methodAngles = METHOD_ANGLES[method]
  const fajrAngle = (method===CalcMethod.Custom && customFajrAngle!==undefined)? customFajrAngle: methodAngles.fajr
  const ishaAngle = (method===CalcMethod.Custom && customIshaAngle!==undefined)? customIshaAngle: methodAngles.isha

  const dayStart = Date.UTC(date.getUTCFullYear(),0,1)
  const dayIndex = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - dayStart)/86400000)+1

  const getSolar = (localHour:number) => {
    let utcHour = localHour - timezone
    let Nf = dayIndex + utcHour/24
    if (utcHour<0) Nf = dayIndex-1 + (utcHour+24)/24
    else if (utcHour>=24) Nf = dayIndex+1 + (utcHour-24)/24
    return declinationAndEoT(Nf)
  }

  let { delta, EoT } = getSolar(12)
  let solarNoon = 12 + timezone - lng/15 - EoT/60

  const solvePrayer = (alphaDeg:number, beforeNoon:boolean) => {
    let H = hourAngleDeg(lat, delta, alphaDeg)
    let t = beforeNoon ? solarNoon - H/15 : solarNoon + H/15
    for (let i=0;i<3;i++){
      ({delta,EoT} = getSolar(t))
      solarNoon = 12 + timezone - lng/15 - EoT/60
      H = hourAngleDeg(lat, delta, alphaDeg)
      t = beforeNoon ? solarNoon - H/15 : solarNoon + H/15
    }
    return t
  }

  const fajrLocal = solvePrayer(fajrAngle,true)
  const sunriseLocal = solvePrayer(-0.833,true)
  let dhuhrLocal = solarNoon + 0.03
  const asrLocal = solvePrayer(asrAltitudeDeg(lat, delta, asrShadow),false)
  const maghribLocal = solvePrayer(-0.833,false)
  const ishaLocal = (method===CalcMethod.UmmAlQura && ishaAngle<=-90)? maghribLocal + minsToHours(90) : solvePrayer(ishaAngle,false)

  const resultMins = {
    fajr: hoursToMins(fajrLocal),
    sunrise: hoursToMins(sunriseLocal),
    dhuhr: hoursToMins(dhuhrLocal),
    asr: hoursToMins(asrLocal),
    maghrib: hoursToMins(maghribLocal),
    isha: hoursToMins(ishaLocal),
  }

  return {
    fajr: formatHM(fajrLocal),
    sunrise: formatHM(sunriseLocal),
    dhuhr: formatHM(dhuhrLocal),
    asr: formatHM(asrLocal),
    maghrib: formatHM(maghribLocal),
    isha: formatHM(ishaLocal),
    _mins: resultMins
  }
}

// 🔹 Fix for Vercel build: alias export for backward compatibility
export const calculatePrayerTimes = calculatePrayerTimesAdvanced
