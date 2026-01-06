"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { translations } from "@/lib/translations"
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
import { scheduleNativeAlarms } from "@/lib/native-alarm-scheduler"
import { createNotificationChannels } from "@/lib/notifications"
import { loadSettings, saveSettings, type UserSettings } from "@/lib/storage"
import { useAndroidBack } from "@/lib/use-android-back"
import { useToast } from "@/hooks/use-toast"

export default function PrayerTimesClient({ initialTimes, initialCity, initialHijri, initialEvent, isRegional }: any) {
  const router = useRouter()
  const { toast } = useToast()

  const [settings, setSettings] = useState<UserSettings>(() => {
    if (typeof window === "undefined") {
      return {
        method: 0,
        asrShadow: 2,
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
    }
    return loadSettings()
  })

  const [location, setLocation] = useState<{
    lat: number
    lng: number
    timezone: number
  } | null>(null)

  const [times, setTimes] = useState<PrayerTimes | null>(initialTimes || null)
  const [loading, setLoading] = useState(!initialTimes)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  const [currentTime, setCurrentTime] = useState(new Date())
  const [showAbout, setShowAbout] = useState(false)
  const [showNoti, setShowNoti] = useState(false)
  const [showCityMenu, setShowCityMenu] = useState(false)
  const [showMethodMenu, setShowMethodMenu] = useState(false)
  const [showSettingsSaved, setShowSettingsSaved] = useState(false)

  const hasRequestedGPS = useRef(false)
  const gpsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const notificationDebounceTimer = useRef<NodeJS.Timeout | null>(null)

  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings((prev) => {
      return { ...prev, ...updates }
    })
  }, [])

  useEffect(() => {
    saveSettings(settings)

    const timer = setTimeout(() => {
      setShowSettingsSaved(true)
      setTimeout(() => setShowSettingsSaved(false), 2000)
    }, 300)

    return () => clearTimeout(timer)
  }, [settings])

  useEffect(() => {
    let resolved = false

    // Priority 1: Use initialCity from URL (regional pages)
    if (initialCity) {
      setLocation({
        lat: initialCity.lat,
        lng: initialCity.lng,
        timezone: initialCity.timezone,
      })
      resolved = true
    }

    // Priority 2: Try to load cached location from localStorage
    if (!resolved && typeof window !== "undefined") {
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

    // Priority 3: Request fresh GPS location only for non-regional pages
    if (!resolved && !isRegional && !hasRequestedGPS.current) {
      hasRequestedGPS.current = true
      refreshLocation()
    } else {
      if (resolved) {
        setLoading(false)
      }
    }

    // Show notification modal on first visit
    if (typeof window !== "undefined" && !sessionStorage.getItem("v0_prayer_noti_seen")) {
      setShowNoti(true)
      sessionStorage.setItem("v0_prayer_noti_seen", "true")
    }

    // Clock tick and notification channels
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    createNotificationChannels()
    return () => clearInterval(timer)
  }, [initialCity, isRegional])

  const scheduleNotificationsDebounced = useCallback((loc: typeof location, sett: UserSettings) => {
    if (notificationDebounceTimer.current) {
      clearTimeout(notificationDebounceTimer.current)
    }

    notificationDebounceTimer.current = setTimeout(() => {
      if (loc) {
        const liveTimezone = -new Date().getTimezoneOffset() / 60

        const methodMap: Record<number, CalcMethod> = {
          0: CalcMethod.Karachi,
          1: CalcMethod.MWL,
          2: CalcMethod.Egypt,
          3: CalcMethod.UmmAlQura,
        }

        let calcMethod: CalcMethod
        if (typeof sett.method === "number") {
          calcMethod = methodMap[sett.method] || CalcMethod.Karachi
        } else {
          calcMethod = sett.method as CalcMethod
        }

        scheduleNativeAlarms(
          loc.lat,
          loc.lng,
          liveTimezone,
          calcMethod,
          sett.asrShadow as 1 | 2,
          sett.hijriOffset,
          sett.prayerSoundSettings,
        ).catch((error) => {
          console.error("Native Alarm Sync Error:", error)
        })
      }
    }, 2000)
  }, [])

  useEffect(() => {
    if (!location) {
      setLoading(true)
      return
    }

    const liveTimezone = -new Date().getTimezoneOffset() / 60

    try {
      const methodMap: Record<number, CalcMethod> = {
        0: CalcMethod.Karachi,
        1: CalcMethod.MWL,
        2: CalcMethod.Egypt,
        3: CalcMethod.UmmAlQura,
      }

      let calcMethod: CalcMethod
      if (typeof settings.method === "number") {
        calcMethod = methodMap[settings.method] || CalcMethod.Karachi
      } else {
        calcMethod = settings.method as CalcMethod
      }

      const calculated = calculatePrayerTimes(
        location.lat,
        location.lng,
        liveTimezone,
        new Date(),
        calcMethod,
        settings.asrShadow,
        undefined,
        undefined,
        settings.hijriOffset,
      )

      if (calculated && typeof calculated === "object" && "fajr" in calculated && "sunrise" in calculated) {
        setTimes(calculated)
        setLoading(false)
        scheduleNotificationsDebounced(location, settings)
      } else {
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }, [location, settings])

  useEffect(() => {
    if (location && times) {
      scheduleNotificationsDebounced(location, settings)
    }
  }, [times, settings, location, scheduleNotificationsDebounced])

  const refreshLocation = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    setGpsError(null)
    setLoading(true)

    const gpsTimeout = setTimeout(() => {
      setIsRefreshing(false)
      setLoading(false)
      setGpsError("GPS timeout. Waiting for location...")
    }, 30000)

    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 25000,
      })

      clearTimeout(gpsTimeout)

      const loc = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timezone: -new Date().getTimezoneOffset() / 60,
      }

      setLocation(loc)

      if (typeof window !== "undefined") {
        localStorage.setItem("last_location", JSON.stringify(loc))
      }

      setGpsError(null)
      setIsRefreshing(false)
      setLoading(false)
    } catch (err: any) {
      clearTimeout(gpsTimeout)
      setGpsError("GPS error: " + (err?.message || "Unable to get location"))
      setIsRefreshing(false)
      setLoading(false)
    }
  }, [isRefreshing])

  const t = translations[settings.language]
  const hijri = getHijriDate(currentTime, settings.hijriOffset)
  const event = hijri ? getIslamicEvent(hijri.day, hijri.month) : null

  const prayers = [
    { name: t.fajr, time: times?.fajr || "--:--", secondary: false },
    { name: t.sunrise, time: times?.sunrise || "--:--", secondary: true },
    { name: t.zawal, time: times?.zawal || "--:--", secondary: false },
    { name: t.asr, time: times?.asr || "--:--", isAsr: true },
    { name: t.maghrib, time: times?.maghrib || "--:--", secondary: false },
    { name: t.isha, time: times?.isha || "--:--", secondary: false },
  ]

  useAndroidBack({
    isHomePage: !isRegional,
    onBackPress: () => {
      toast({
        description: t.exit_prompt,
        duration: 2000,
      })
    },
  })

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary selection:text-white relative">
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
              <div className="mb-8 space-y-4 border-t border-primary/10 pt-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Prayer Sounds</p>
                <div className="space-y-3">
                  {["fajr", "dhuhr", "asr", "maghrib", "isha"].map((prayer) => (
                    <div key={prayer} className="flex items-center justify-between">
                      <label className="text-xs capitalize font-medium text-foreground">{prayer}</label>
                      <button
                        onClick={() => {
                          const newSounds = {
                            ...settings.prayerSoundSettings,
                            [prayer]:
                              !settings.prayerSoundSettings[prayer as keyof typeof settings.prayerSoundSettings],
                          }
                          updateSettings({ prayerSoundSettings: newSounds })
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                          settings.prayerSoundSettings[prayer as keyof typeof settings.prayerSoundSettings]
                            ? "bg-[#1B3C26]"
                            : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            settings.prayerSoundSettings[prayer as keyof typeof settings.prayerSoundSettings]
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setShowNoti(false)}
                className="w-full py-4 border border-primary/20 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-primary hover:text-white transition-all duration-500"
              >
                {t.close}
              </button>
              <button
                onClick={() => window.open("https://namaz-time-mm-privacy-policy.shainwaiyan.com/", "_blank")}
                className="w-full mt-4 text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-primary underline underline-offset-4 transition-colors duration-300"
              >
                {t.privacy_policy}
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
                  settings.language === "my" ? "text-2xl md:text-5xl" : "text-4xl md:text-7xl"
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
              onClick={() => updateSettings({ language: settings.language === "en" ? "my" : "en" })}
              className="group flex items-center gap-2 md:gap-3 px-3 md:px-6 py-2 border border-foreground/10 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-foreground hover:text-background transition-all duration-500 bg-background"
            >
              <Languages size={12} className="group-hover:rotate-180 transition-transform duration-700" />
              <span className="hidden xs:inline">{settings.language === "en" ? "Burmese" : "English"}</span>
              <span className="xs:hidden">{settings.language === "en" ? "MY" : "EN"}</span>
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
                  {currentTime.toLocaleDateString(settings.language === "en" ? "en-GB" : "my-MM", {
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
                    onClick={() => updateSettings({ hijriOffset: offset })}
                    className={`px-3 py-1 border text-[9px] font-bold transition-all ${
                      settings.hijriOffset === offset
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

        {!times && loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border border-primary/20 border-t-primary rounded-full animate-spin mb-6" />
            <span className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground animate-pulse">
              {gpsError ? gpsError : t.requesting}
            </span>
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
                      onClick={() => updateSettings({ asrShadow: settings.asrShadow === 2 ? 1 : 2 })}
                      className="ml-4 px-3 py-1 border border-primary/30 text-[9px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-colors"
                    >
                      {settings.asrShadow === 2 ? "Hanafi" : "Shafi"}
                    </button>
                  )}
                </div>
                <span className="text-right text-3xl md:text-5xl font-light tabular-nums text-primary/80 group-hover:text-primary transition-colors duration-500">
                  {prayer.time}
                </span>
              </div>
            ))}

            {!isRegional && (
              <div className="mt-16 flex flex-col items-center gap-6">
                <button
                  onClick={refreshLocation}
                  disabled={isRefreshing}
                  className="px-10 py-4 border border-foreground/10 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-primary hover:text-white hover:border-primary transition-all duration-500 bg-transparent w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRefreshing ? "Refreshing..." : t.refresh}
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
                  {
                    t.method_names[
                      typeof settings.method === "number"
                        ? { 0: CalcMethod.Karachi, 1: CalcMethod.MWL, 2: CalcMethod.Egypt, 3: CalcMethod.UmmAlQura }[
                            settings.method
                          ] || CalcMethod.Karachi
                        : (settings.method as CalcMethod)
                    ]
                  }
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
                          const methodToNumber = {
                            [CalcMethod.Karachi]: 0,
                            [CalcMethod.MWL]: 1,
                            [CalcMethod.Egypt]: 2,
                            [CalcMethod.UmmAlQura]: 3,
                          }
                          updateSettings({ method: methodToNumber[m] })
                          setShowMethodMenu(false)
                        }}
                        className={`px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex justify-between items-center ${
                          (
                            typeof settings.method === "number"
                              ? {
                                  0: CalcMethod.Karachi,
                                  1: CalcMethod.MWL,
                                  2: CalcMethod.Egypt,
                                  3: CalcMethod.UmmAlQura,
                                }[settings.method] || CalcMethod.Karachi
                              : settings.method
                          ) === m
                            ? "text-primary bg-primary/5"
                            : "hover:bg-primary hover:text-white"
                        }`}
                      >
                        {t.method_names[m]}
                        {(typeof settings.method === "number"
                          ? { 0: CalcMethod.Karachi, 1: CalcMethod.MWL, 2: CalcMethod.Egypt, 3: CalcMethod.UmmAlQura }[
                              settings.method
                            ] || CalcMethod.Karachi
                          : settings.method) === m && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <span className="text-[8px] text-muted-foreground opacity-50">{t.rule}</span>
            <span className="py-1">{settings.asrShadow === 2 ? "Hanafi Rule" : "Shafi Rule"}</span>
          </div>
        </footer>
      </div>
    </main>
  )
}
