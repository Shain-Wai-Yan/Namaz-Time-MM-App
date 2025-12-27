"use client"

import { useState, useEffect } from "react"
import { calculatePrayerTimes, type PrayerTimes, CalcMethod } from "@/lib/solar-calc"
import { Languages } from "lucide-react"

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
    method: "Karachi Calculation Method",
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
    method: "Karachi တွက်ချက်မှုစနစ်",
    rule: "Asr Shadow Rule",
    requesting: "တည်နေရာရှာဖွေနေသည်...",
    about: "ဖန်တီးသူအကြောင်း",
    about_title: "ဖန်တီးသူအကြောင်း",
    about_desc:
      "ဤအက်ပ်အား ရိုးရှင်း၍ တိကျပြီး အဓိပ္ပာယ်ရှိသော နည်းပညာကို ယုံကြည်သည့် Developer နှင့် Digital Creator တစ်ဦးဖြစ်သော Shain Wai Yan (Muhamadd Xolbine) မှ ဖန်တီးထားခြင်းဖြစ်သည်။ တိကျမှုနှင့် အလွယ်တကူ အသုံးပြုနိုင်မှုကို အဓိကထား၍ အွန်လိုင်း API များအစား နက္ခတ္တဗေဒဆိုင်ရာ တွက်ချက်မှုများကို အသုံးပြုထားသောကြောင့် အော့ဖ်လိုင်းတွင်ပင် စိတ်ချရသော အာဇာန်အချိန်များကို ရရှိစေမည်ဖြစ်သည်။ ဤပရောဂျက်ကို ကမ္ဘာတစ်ဝှမ်း မည်သည့်နေရာတွင်မဆို အသုံးပြုနိုင်သော်လည်း မြန်မာအသုံးပြုသူများကို အဓိကထား၍ ဒီဇိုင်းထုတ်ထားခြင်းဖြစ်သည်။ ဤအက်ပ်သည် သဒ္ဓါတရား၊ သင်္ချာနှင့် နည်းပညာတို့ကို ပေါင်းစပ်ကာ နေ့စဉ်ဘဝအတွက် အသုံးဝင်စေရန် ကိုယ်တိုင်အားထုတ်ထားခြင်း ဖြစ်သည်။",
    close: "ပိတ်မည်",
    noti_title: "အရေးကြီးသတိပေးချက်",
    noti_message:
      "ဗလီနဲ့ဝေး၍ အာဇာန်သံမကြားရသောနေရာများ ၊ ဗလီမရှိသောအရပ်ဒေသများ၌ နမာဇ်ချိန်သိရရန်ရည်ရွယ်၍တွက်ချက်ထားပေးသည်ဖြစ်ရာလုံချုံစိတ်ချရမှုရှိစေရန် 5-10 မိနစ်ဝန်းကျင်ခြား၍သာ နမာဇ်ဖတ်ကြပါရန်သတိပေးအပ်ပါသည် !!!",
  },
}

export default function PrayerTimesPage() {
  const [lang, setLang] = useState<"my" | "en">("my")
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [times, setTimes] = useState<PrayerTimes | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [asrShadow, setAsrShadow] = useState<1 | 2>(2)
  const [showAbout, setShowAbout] = useState(false)
  const [showNoti, setShowNoti] = useState(false)

  useEffect(() => {
    setShowNoti(true)
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setLocation({ lat, lng })

          const timezone = -new Date().getTimezoneOffset() / 60
          const calculated = calculatePrayerTimes(lat, lng, timezone, new Date(), CalcMethod.Karachi, asrShadow)
          setTimes(calculated)
          setLoading(false)
        },
        () => {
          setLoading(false)
        },
      )
    }
  }, [asrShadow])

  const refreshLocation = () => {
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setLocation({ lat, lng })
        const timezone = -new Date().getTimezoneOffset() / 60
        setTimes(calculatePrayerTimes(lat, lng, timezone, new Date(), CalcMethod.Karachi, asrShadow))
        setLoading(false)
      },
      (error) => {
        console.error("[v0] Location error:", error)
        setLoading(false)
      },
    )
  }

  const t = translations[lang]

  const prayers = [
    { name: t.fajr, time: times?.fajr },
    { name: t.sunrise, time: times?.sunrise, secondary: true },
    { name: t.zawal, time: times?.zawal },
    { name: t.asr, time: times?.asr, isAsr: true },
    { name: t.maghrib, time: times?.maghrib },
    { name: t.isha, time: times?.isha },
  ]

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col p-6 md:p-20 max-w-5xl mx-auto font-sans selection:bg-primary selection:text-white relative">
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
          <div className="space-y-4">
            <h1
              className={`font-serif italic leading-[1.1] tracking-tighter text-foreground ${
                lang === "my" ? "text-3xl md:text-6xl" : "text-5xl md:text-8xl"
              }`}
            >
              {t.schedule}
            </h1>
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.3em] font-medium break-all md:break-normal">
                {location ? `${location.lat.toFixed(4)}° N, ${location.lng.toFixed(4)}° E` : t.requesting}
              </span>
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

        <div className="flex flex-col md:flex-row md:items-end justify-between w-full gap-4">
          <div className="space-y-1 md:text-left">
            <div className="text-4xl md:text-6xl font-serif tracking-tight tabular-nums">
              {currentTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}
            </div>
            <div className="text-[10px] md:text-xs uppercase tracking-[0.4em] text-primary font-bold">
              {currentTime.toLocaleDateString(lang === "en" ? "en-GB" : "my-MM", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          </div>
        </div>
      </header>

      {loading ? (
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
                <span className="text-3xl md:text-5xl font-serif tracking-tight text-foreground transition-transform duration-500 group-hover:translate-x-2">
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
        </div>
      )}

      <footer className="mt-auto pt-12 text-[10px] text-muted-foreground uppercase tracking-widest flex justify-between font-bold border-t border-foreground/5">
        <span>{t.method}</span>
        <span>{asrShadow === 2 ? "Hanafi Rule" : "Shafi Rule"}</span>
      </footer>
    </main>
  )
}
