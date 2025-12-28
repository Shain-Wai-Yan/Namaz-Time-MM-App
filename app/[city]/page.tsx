import { calculatePrayerTimes, getHijriDate, getIslamicEvent, CITIES, CalcMethod } from "@/lib/solar-calc"
import PrayerTimesClient from "@/components/prayer-times-client"
import type { Metadata } from "next"

// Revalidate every 1 hour (3600 seconds) for fresh prayer times
export const revalidate = 3600

type Params = { city: string }

// Generate static paths for all cities for SSG
export async function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }))
}

// Dynamic metadata for SEO
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { city } = params
  const cityData = CITIES.find((c) => c.slug === city)
  if (!cityData) return { title: "Prayer Times" }

  const title = `${cityData.name} Prayer Times Today (Fajr, Maghrib, Isha) | Azan MM`
  const description = `Accurate ${cityData.name} prayer times today. Fajr, Dhuhr, Asr, Maghrib, and Isha updated daily for Myanmar and the global community.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://azan.mm/${city}`,
      siteName: "Azan MM",
      type: "website",
    },
    twitter: {
      title,
      description,
      card: "summary_large_image",
    },
    alternates: {
      canonical: `https://azan.mm/${city}`,
      languages: {
        "en-US": `/en/${city}`,
        "my-MM": `/mm/${city}`,
      },
    },
  }
}

export default async function CityPage({ params }: { params: Params }) {
  const { city } = params
  const cityData = CITIES.find((c) => c.slug === city)
  if (!cityData) return <div>City not found</div>

  const date = new Date()
  const initialTimes = calculatePrayerTimes(
    cityData.lat,
    cityData.lng,
    cityData.timezone,
    date,
    CalcMethod.Karachi,
    2
  )

  const hijri = getHijriDate(date, 0)
  const event = getIslamicEvent(hijri.day, hijri.month)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${cityData.name} Prayer Times`,
    description: `Islamic prayer times for ${cityData.name}, Myanmar.`,
    spatialCoverage: {
      "@type": "Place",
      name: cityData.name,
      geo: { "@type": "GeoCoordinates", latitude: cityData.lat, longitude: cityData.lng },
    },
    variableMeasured: ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"],
    data: initialTimes, // Include actual times for Google indexing
  }

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Client Component for Interactivity */}
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
