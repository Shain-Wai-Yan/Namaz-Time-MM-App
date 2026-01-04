import { calculatePrayerTimes, getHijriDate, getIslamicEvent, CITIES, CalcMethod } from "@/lib/solar-calc"
import PrayerTimesClient from "@/components/prayer-times-client"
import type { Metadata } from "next"

type Params = Promise<{ city: string }>

/**
 * THIS IS THE KEY: It tells Next.js to pre-render all city pages 
 * into static HTML files during "npm run build".
 */
export async function generateStaticParams() {
  return CITIES.map((city) => ({
    city: city.slug,
  }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { city } = await params
  const cityData = CITIES.find((c) => c.slug === city)
  if (!cityData) return { title: "Prayer Times" }

  const title = `${cityData.name} Prayer Times Today (Fajr, Maghrib, Isha) | Azan MM`
  const description = `Accurate ${cityData.name} prayer times today. Fajr, Dhuhr, Asr, Maghrib, and Isha updated daily for Myanmar and the global community.`

  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default async function CityPage({ params }: { params: Params }) {
  // Await params for Next.js 15 compatibility
  const { city } = await params
  const cityData = CITIES.find((c) => c.slug === city)

  if (!cityData) {
    return (
      <div className="flex items-center justify-center h-screen bg-white text-emerald-900">
        <p className="text-xl font-medium">City not found</p>
      </div>
    )
  }

  const date = new Date()
  const initialTimes = calculatePrayerTimes(
    cityData.lat,
    cityData.lng,
    cityData.timezone,
    date,
    CalcMethod.Karachi,
    2,
    undefined,
    undefined,
    0,
  )

  const hijri = getHijriDate(date, 0)
  const event = getIslamicEvent(hijri.day, hijri.month)

  // JSON-LD Structured Data for SEO (Still useful if you host a web version)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${cityData.name} Prayer Times`,
    description: `Islamic prayer times for ${cityData.name}, Myanmar.`,
    spatialCoverage: {
      "@type": "Place",
      name: cityData.name,
      geo: { 
        "@type": "GeoCoordinates", 
        latitude: cityData.lat, 
        longitude: cityData.lng 
      },
    },
    variableMeasured: ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PrayerTimesClient
        initialTimes={initialTimes}
        initialCity={cityData}
        initialHijri={hijri}
        initialEvent={event}
        isRegional={true}
      />
    </>
  )
}
