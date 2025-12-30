"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  calculatePrayerTimes,
  getHijriDate,
  getIslamicEvent,
  type PrayerTimes,
  CalcMethod,
  CITIES,
} from "@/lib/solar-calc"
import { Languages, ChevronDown, MapPin, ArrowLeft, Compass } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Geolocation } from "@capacitor/geolocation"
import { schedulePrayerNotifications, createNotificationChannels } from "@/lib/notifications"

const translations = {
  en: {
    schedule: "Schedule",
    fajr: "Fajr",
    sunrise: "Sunrise",
    zawal: "Zawal",
    asr: "Asr",
    maghrib: "Maghrib",
    isha: "Isha",
    prayer: "Prayer",
    time: "Time (Local)",
    refresh: "Refresh Location",
    method: "Calculation Method",
    method_names: {
      [CalcMethod.Karachi]: "Karachi (Hanafi)",
      [CalcMethod.MWL]: "Muslim World League",
      [CalcMethod.Egypt]: "Egyptian General Authority",
      [CalcMethod.UmmAlQura]: "Umm al-Qura (KSA)",
    },
    hijri_adj: "Hijri Adj",
    events: "Notable Events",
    months: [
      "Muharram",
      "Safar",
      "Rabi' al-Awwal",
      "Rabi' al-Thani",
      "Jumada al-Ula",
      "Jumada al-Akhirah",
      "Rajab",
      "Sha'ban",
      "Ramadan",
      "Shawwal",
      "Dhu al-Qi'dah",
      "Dhu al-Hijjah",
    ],
    event_names: {
      new_year: "Islamic New Year",
      ashura: "Day of Ashura",
      mawlid: "Mawlid al-Nabi",
      isra: "Isra' and Mi'raj",
      baraat: "Laylat al-Bara'at",
      ramadan_start: "Ramadan Start",
      qadr: "Laylat al-Qadr (Last 10 Nights)",
      fitr: "Eid al-Fitr",
      hajj: "Hajj Season",
      arafah: "Day of Arafah",
      adha: "Eid al-Adha",
    },
    rule: "Asr Shadow Rule",
    requesting: "Requesting Location...",
    about: "About the Creator",
    about_title: "About the Creator",
    about_desc:
      "This app was created by Shain Wai Yan (Muhamadd Xolbine), a developer and digital creator who believes technology should be simple, accurate, and meaningful. Built with a focus on precision and accessibility, this prayer time app uses astronomical calculations instead of online APIs, ensuring reliable Azan times that work even offline. The project was designed with Myanmar users in mind, while remaining usable anywhere in the world. This app is a personal effort to combine faith, mathematics, and thoughtful engineering into something practical for everyday life.",
    close: "Close",
    noti_title: "Important Notice",
    noti_message:
      "This app is calculated for areas far from mosques where the Adhan cannot be heard, or areas without mosques. To ensure safety and reliability, it is recommended to wait 5-10 minutes after the calculated time before starting your prayer.",
    select_city: "Select City",
    home: "Home",
  },
  my: {
    schedule: "နမာဇ်အချိန်ဇယား",
    fajr: "ဖဂျရ်",
    sunrise: "နေထွက်ချိန်",
    zawal: "ဇဝါလ်",
    asr: "အဆွရ်",
    maghrib: "မဂ်ရိဗ်",
    isha: "အေရှာ",
    prayer: "ဝတ်ပြုချိန်",
    time: "အချိန်",
    refresh: "တည်နေရာအသစ်ရယူရန်",
    method: "တွက်ချက်မှုစနစ်",
    method_names: {
      [CalcMethod.Karachi]: "Karachi တွက်ချက်မှုစနစ်",
      [CalcMethod.MWL]: "Muslim World League",
      [CalcMethod.Egypt]: "Egyptian Authority",
      [CalcMethod.UmmAlQura]: "Umm al-Qura",
    },
    hijri_adj: "ရက်စွဲညှိရန်",
    events: "ထူးခြားသောနေ့ရက်များ",
    months: [
      "မူဟရ်ရမ်",
      "ဆွဖရ်",
      "ရဗီအွလ်အောင်ဝလ်",
      "ရဗီအွစ်ဆာနီ",
      "ဂျုမာဒိလ်အောင်ဝလ်",
      "ဂျုမာဒိလ်အာခိရ်",
      "ရဂျပ်",
      "ရှအ်ဘာန်",
      "ရမ်ဇာန်",
      "ရှောင်ဝါလ်",
      "ဇူလ်ကအ်ဒဟ်",
      "ဇူလ်ဟဂျဟ်",
    ],
    event_names: {
      new_year: "အစ္စလာမ့်နှစ်သစ်ကူး",
      ashura: "အာရှူရာနေ့",
      mawlid: "မောင်လစ်ဒ်နေ့",
      isra: "အစ်ရာနှင့်မအ်ရာဂ်ျ",
      baraat: "ရှဗေဗရာသ်ည",
      ramadan_start: "ရမ်ဇာန်စတင်ခြင်း",
      qadr: "လိုင်လသွလ်ကဒရ် (နောက်ဆုံး ၁၀ ည)",
      fitr: "အီးဒွလ်ဖိသရ်",
      hajj: "ဟဂျ်ရာသီ",
      arafah: "အရဖဟ်နေ့",
      adha: "အီးဒွလ်အဿွဟာ",
    },
    rule: "Asr Shadow Rule",
    requesting: "တည်နေရာရှာဖွေနေသည်...",
    about: "ဖန်တီးသူအကြောင်း",
    about_title: "ဖန်တီးသူအကြောင်း",
    about_desc:
      "ဤအက်ပ်ကို နည်းပညာသည် ရိုးရှင်း၊ တိကျပြီး အဓိပ္ပာယ်ရှိရမည်ဟု ယုံကြည်မှုလက်ကိုင်ထားသည့် Developer နှင့် Digital Creator တစ်ဦးဖြစ်သူ ရှိန်းဝေယံ (Muhamadd Xolbine) မှ ဖန်တီးထားခြင်း ဖြစ်ပါသည်။တိကျမှုရှိ‌‌စေရန်နှင့် လူတိုင်းအလွယ်တကူ အသုံးပြုနိုင်မှုကို အဓိကထား၍ တည်ဆောက်ထားသည့် Prayer Time app သည် အွန်လိုင်း API များအပေါ် မှီခိုခြင်းမပြုဘဲ နက္ခတ္တဗေဒဆိုင်ရာ တွက်ချက်မှုစနစ် (Astronomical Calculations) ကို အသုံးပြုထားသောကြောင့် အော့ဖ်လိုင်းဖြစ်နေချိန်တွင်ပင် အာဇန် (Azan) အချိန်များကို စိတ်ချယုံကြည်စွာ ကြည့်ရှုနိုင်မည် ဖြစ်ပါသည်။ဤပရောဂျက်ကို အဓိကအားဖြင့် မြန်မာနိုင်ငံရှိ အသုံးပြုသူများအတွက် ရည်ရွယ်ကာ ပုံဖော်ထားခြင်းဖြစ်သော်လည်း ကမ္ဘာ့မည်သည့်နေရာတွင်မဆို အသုံးပြုနိုင်ပါသည်။ ဤ app ကို သက်ဝင်ယုံကြည်မှု၊ သင်္ချာပညာနှင့် စဉ်းစားတွေးခေါ်မှုရှိသော အင်ဂျင်နီယာအတတ်ပညာတို့ကို ပေါင်းစပ်ပြီး နေ့စဉ်ဘဝအတွက် လက်တွေ့ကျသည့် အရာတစ်ခုဖြစ်လာစေရန် ကိုယ်တိုင်ကြိုးပမ်းအားထုတ်ထားခြင်းလည်း ဖြစ်ပါသည်။",
    close: "ပိတ်မည်",
    noti_title: "အရေးကြီးသတိပေးချက်",
    noti_message:
      "ဗလီနဲ့ဝေး၍ အာဇာန်သံမကြားရသောနေရာများ ၊ ဗလီမရှိသောအရပ်ဒေသများ၌ နမာဇ်ချိန်သိရရန်ရည်ရွယ်၍တွက်ချက်ထားပေးသည်ဖြစ်ရာလုံခြုံစိတ်ချရမှုရှိစေရန် 5-10 မိနစ်ဝန်းကျင်ခြား၍သာ နမာဇ်ဖတ်ကြပါရန်သတိပေးအပ်ပါသည် !!!",
    select_city: "မြို့ကိုရွေးချယ်ပါ",
    home: "ပင်မစာမျက်နှာ",
  },
}

export default function PrayerTimesClient({ initialTimes, initialCity, initialHijri, initialEvent, isRegional }: any) {
  const router = useRouter()

  const [lang, setLang] = useState<"my" | "en">("my")
  const [location, setLocation] = useState<{
    lat: number
    lng: number
    timezone: number
  } | null>(
    initialCity
      ? {
          lat: initialCity.lat,
          lng: initialCity.lng,
          timezone: initialCity.timezone,
        }
      : null,
  )
  const [times, setTimes] = useState<PrayerTimes | null>(initialTimes || null)
  const [loading, setLoading] = useState(!initialTimes)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  const [currentTime, setCurrentTime] = useState(new Date())
  const [asrShadow, setAsrShadow] = useState<1 | 2>(2)
  const [showAbout, setShowAbout] = useState(false)
  const [showNoti, setShowNoti] = useState(false)
  const [hijriOffset, setHijriOffset] = useState(0)
  const [showCityMenu, setShowCityMenu] = useState(false)
  const [showMethodMenu, setShowMethodMenu] = useState(false)
  const [method, setMethod] = useState<CalcMethod>(CalcMethod.Karachi)

  const hasRequestedGPS = useRef(false) // 🔹 Track first install GPS

  /* --------------------------------------------------
     1. BOOTSTRAP (URL CITY → CACHE → FORCE GPS)
     -------------------------------------------------- */
  useEffect(() => {
    let resolved = false

    // 1️⃣ URL city has highest priority
    if (initialCity) {
      resolved = true
      setLocation({
        lat: initialCity.lat,
        lng: initialCity.lng,
        timezone: initialCity.timezone,
      })
    }

    // 2️⃣ Cached GPS (only if no URL city)
    if (!resolved) {
      const cached = localStorage.getItem("last_location")
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
            setLocation(parsed)
            resolved = true
          }
        } catch {
          localStorage.removeItem("last_location")
        }
      }
    }

    // 3️⃣ FRESH START: No cache, No URL? Force GPS prompt immediately
    if (!resolved && !isRegional && !hasRequestedGPS.current) {
      hasRequestedGPS.current = true
      refreshLocation() // 🔹 triggers permission dialog
    } else {
      setLoading(false)
    }

    // Show notification once per session
    if (!sessionStorage.getItem("v0_prayer_noti_seen")) {
      setShowNoti(true)
      sessionStorage.setItem("v0_prayer_noti_seen", "true")
    }

    // Update current time every second
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    createNotificationChannels() // 🔹 Create notification channel on boot
    return () => clearInterval(timer)
  }, [initialCity, isRegional])

  /* --------------------------------------------------
     2. SAFE GPS REFRESH (PERMISSION + CACHE)
     -------------------------------------------------- */
  const refreshLocation = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    setGpsError(null)
    setLoading(true)

    try {
      // Force getCurrentPosition, let native layer handle permissions
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      })

      const loc = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timezone: -new Date().getTimezoneOffset() / 60,
      }

      setLocation(loc)
      localStorage.setItem("last_location", JSON.stringify(loc))
    } catch (err) {
      console.error("GPS Error:", err)
      setGpsError("Unable to acquire location")
    } finally {
      setIsRefreshing(false)
      setLoading(false)
    }
  }, [isRefreshing])

  /* --------------------------------------------------
     3. PRAYER CALCULATION (SYSTEM TZ AWARE)
     -------------------------------------------------- */
  useEffect(() => {
    if (!location) {
      setLoading(true)
      return
    }

    const liveTimezone = -new Date().getTimezoneOffset() / 60

    try {
      const calculated = calculatePrayerTimes(
        location.lat,
        location.lng,
        liveTimezone,
        new Date(),
        method,
        asrShadow,
        undefined,
        undefined,
        hijriOffset,
      )

      setTimes(calculated)

      // 🔹 Schedule notifications whenever times are calculated/location changes
      schedulePrayerNotifications(location.lat, location.lng, liveTimezone, method, asrShadow, hijriOffset)
    } catch (error) {
      console.error("Calculation Error:", error)
    } finally {
      setLoading(false)
    }
  }, [location, method, asrShadow, hijriOffset])

  /* --------------------------------------------------
     4. DERIVED VALUES
     -------------------------------------------------- */
  const t = translations[lang]
  const hijri = getHijriDate(currentTime, hijriOffset)
  const event = hijri ? getIslamicEvent(hijri.day, hijri.month) : null

  const prayers = [
    { name: t.fajr, time: times?.fajr },
    { name: t.sunrise, time: times?.sunrise, secondary: true },
    { name: t.zawal, time: times?.zawal },
    { name: t.asr, time: times?.asr, isAsr: true },
    { name: t.maghrib, time: times?.maghrib },
    { name: t.isha, time: times?.isha },
  ]

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary selection:text-white relative">
      {/* 🔹 Added Qibla floating action button */}
      <Link
        href="/qibla"
        className="fixed bottom-12 right-6 z-50 w-14 h-14 bg-background border border-primary/20 flex items-center justify-center shadow-xl hover:bg-primary hover:text-white transition-all group active:scale-95"
      >
        <Compass size={24} className="group-hover:rotate-12 transition-transform" />
      </Link>

      <div className="w-full max-w-5xl mx-auto p-6 md:p-16 lg:p-24 flex flex-col flex-1">
        {showNoti && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
            <div className="bg-background border border-primary/20 p-8 md:p-12 max-w-lg shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <h2 className="font-serif italic text-2xl md:text-3xl mb-6 text-foreground">{t.noti_title}</h2>
              <p className="text-xs md:text-sm leading-relaxed text-muted-foreground tracking-wide mb-8">
                {t.noti_message}
              </p>
              <button
                onClick={() => setShowNoti(false)}
                className="w-full py-4 border border-primary/20 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-primary hover:text-white transition-all duration-500"
              >
                {t.close}
              </button>
            </div>
          </div>
        )}

        {showAbout && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
            <div className="bg-background border border-primary/20 p-8 md:p-12 max-w-2xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
              <h2 className="font-serif italic text-3xl md:text-4xl mb-8 text-foreground">{t.about_title}</h2>
              <div className="space-y-6 text-xs md:text-sm leading-relaxed text-muted-foreground tracking-wide">
                <p>{t.about_desc}</p>
              </div>
              <button
                onClick={() => setShowAbout(false)}
                className="mt-12 w-full py-4 border border-primary/20 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-primary hover:text-white transition-all duration-500"
              >
                {t.close}
              </button>
            </div>
          </div>
        )}

        <header className="mb-12 md:mb-24 flex flex-col gap-6 md:gap-12 border-b border-foreground/5 pb-12">
          <div className="flex justify-between items-start w-full">
            <div className="flex flex-col gap-4">
              {isRegional && (
                <Link
                  href="/"
                  className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground hover:text-primary transition-colors mb-2"
                >
                  <ArrowLeft size={12} />
                  {t.home}
                </Link>
              )}
              <h1
                className={`font-serif italic leading-[1.1] tracking-tighter text-foreground ${
                  lang === "my" ? "text-2xl md:text-5xl" : "text-4xl md:text-7xl"
                }`}
              >
                {isRegional ? initialCity.name : t.schedule}
              </h1>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] uppercase tracking-[0.3em] font-medium">
                    {location ? `${location.lat.toFixed(4)}° N, ${location.lng.toFixed(4)}° E` : t.requesting}
                  </span>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowCityMenu(!showCityMenu)}
                    className="flex items-center gap-2 px-4 py-2 border border-primary/10 text-[9px] font-bold uppercase tracking-[0.2em] hover:border-primary/30 transition-all bg-background"
                  >
                    <MapPin size={12} className="text-primary" />
                    {t.select_city}
                    <ChevronDown
                      size={10}
                      className={`transition-transform duration-500 ${showCityMenu ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showCityMenu && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-background border border-foreground/5 shadow-2xl z-50 max-h-80 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-1 divide-y divide-foreground/5">
                        {CITIES.map((city) => (
                          <button
                            key={city.slug}
                            onClick={() => {
                              setShowCityMenu(false)
                              router.push(`/${city.slug}`)
                            }}
                            className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-all w-full flex justify-between items-center group"
                          >
                            {city.name}
                            <span className="opacity-0 group-hover:opacity-50 text-[8px] tracking-normal transition-opacity">
                              {city.lat.toFixed(1)}°, {city.lng.toFixed(1)}°
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setLang(lang === "en" ? "my" : "en")}
              className="group flex items-center gap-2 md:gap-3 px-3 md:px-6 py-2 border border-foreground/10 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-foreground hover:text-background transition-all duration-500 bg-background"
            >
              <Languages size={12} className="group-hover:rotate-180 transition-transform duration-700" />
              <span className="hidden xs:inline">{lang === "en" ? "Burmese" : "English"}</span>
              <span className="xs:hidden">{lang === "en" ? "MY" : "EN"}</span>
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between w-full gap-8">
            <div className="space-y-1 md:text-left">
              <div className="text-4xl md:text-6xl font-serif tracking-tight tabular-nums">
                {currentTime.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-[10px] md:text-xs uppercase tracking-[0.4em] text-muted-foreground font-bold">
                  {currentTime.toLocaleDateString(lang === "en" ? "en-GB" : "my-MM", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </div>
                {hijri && (
                  <div className="flex items-center gap-4">
                    <div className="text-[10px] md:text-xs uppercase tracking-[0.4em] text-primary font-bold">
                      {hijri.day} {t.months[hijri.month - 1]} {hijri.year} AH
                    </div>
                    {event && (
                      <div className="text-[8px] md:text-[9px] bg-primary/10 text-primary px-3 py-1 border border-primary/20 tracking-[0.2em] font-bold animate-pulse">
                        {t.event_names[event.key as keyof typeof t.event_names]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {hijri && (
              <div className="flex items-center gap-2">
                <span className="text-[8px] uppercase tracking-[0.3em] text-muted-foreground font-bold mr-2">
                  {t.hijri_adj}
                </span>
                {[-1, 0, 1].map((offset) => (
                  <button
                    key={offset}
                    onClick={() => setHijriOffset(offset)}
                    className={`px-3 py-1 border text-[9px] font-bold transition-all ${
                      hijriOffset === offset
                        ? "bg-primary text-white border-primary"
                        : "border-foreground/10 text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {offset > 0 ? `+${offset}` : offset}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {loading && !initialTimes ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-12 h-12 border border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-2 py-6 text-[9px] uppercase tracking-[0.4em] text-muted-foreground font-bold border-b border-foreground/5">
              <span>{t.prayer}</span>
              <span className="text-right">{t.time}</span>
            </div>

            {prayers.map((prayer) => (
              <div
                key={prayer.name}
                className={`grid grid-cols-2 py-10 items-baseline border-b border-foreground/5 group hover:bg-primary/[0.02] transition-all duration-700 relative overflow-hidden ${
                  prayer.secondary ? "opacity-30 grayscale" : ""
                }`}
              >
                <div className="flex items-baseline gap-4">
                  <span className="text-2xl md:text-4xl font-serif tracking-tight text-foreground transition-transform duration-500 group-hover:translate-x-2">
                    {prayer.name}
                  </span>
                  {prayer.isAsr && (
                    <button
                      onClick={() => setAsrShadow(asrShadow === 2 ? 1 : 2)}
                      className="ml-4 px-3 py-1 border border-primary/30 text-[9px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-colors"
                    >
                      {asrShadow === 2 ? "Hanafi" : "Shafi"}
                    </button>
                  )}
                </div>
                <span className="text-right text-3xl md:text-5xl font-light tabular-nums text-primary/80 group-hover:text-primary transition-colors duration-500">
                  {prayer.time || "--:--"}
                </span>
              </div>
            ))}

            {!isRegional && (
              <div className="mt-16 flex flex-col items-center gap-6">
                <button
                  onClick={refreshLocation}
                  className="px-10 py-4 border border-foreground/10 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-primary hover:text-white hover:border-primary transition-all duration-500 bg-transparent w-full md:w-auto"
                >
                  {t.refresh}
                </button>

                <button
                  onClick={() => setShowAbout(true)}
                  className="text-[9px] font-bold uppercase tracking-[0.4em] text-muted-foreground hover:text-primary transition-colors py-2"
                >
                  {t.about}
                </button>
              </div>
            )}
          </div>
        )}

        <footer className="mt-auto pt-12 text-[10px] text-muted-foreground uppercase tracking-widest flex flex-col md:flex-row justify-between gap-6 font-bold border-t border-foreground/5 relative">
          <div className="flex flex-col gap-2">
            <span className="text-[8px] text-muted-foreground opacity-50">{t.method}</span>
            <div className="relative">
              <button
                onClick={() => setShowMethodMenu(!showMethodMenu)}
                className="flex items-center gap-2 hover:text-primary transition-colors py-1 group"
              >
                <span className="border-b border-primary/20 group-hover:border-primary pb-0.5">
                  {t.method_names[method]}
                </span>
                <ChevronDown
                  size={10}
                  className={`transition-transform duration-500 ${showMethodMenu ? "rotate-180" : ""}`}
                />
              </button>

              {showMethodMenu && (
                <div className="absolute bottom-full left-0 mb-4 w-64 bg-background border border-foreground/5 shadow-2xl z-50">
                  <div className="flex flex-col divide-y divide-foreground/5">
                    {[CalcMethod.Karachi, CalcMethod.MWL, CalcMethod.Egypt, CalcMethod.UmmAlQura].map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setMethod(m)
                          setShowMethodMenu(false)
                        }}
                        className={`px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex justify-between items-center ${
                          method === m ? "text-primary bg-primary/5" : "hover:bg-primary hover:text-white"
                        }`}
                      >
                        {t.method_names[m]}
                        {method === m && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <span className="text-[8px] text-muted-foreground opacity-50">{t.rule}</span>
            <span className="py-1">{asrShadow === 2 ? "Hanafi Rule" : "Shafi Rule"}</span>
          </div>
        </footer>
      </div>
    </main>
  )
}
