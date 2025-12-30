"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Compass } from "lucide-react"
import Link from "next/link"
import { Geolocation } from "@capacitor/geolocation"
import { Motion } from "@capacitor/motion"

/**
 * Keep this function exactly as you had it.
 */
function getQiblaDegrees(userLat: number, userLng: number) {
  const kaabaLat = (21.4225 * Math.PI) / 180
  const kaabaLng = (39.8262 * Math.PI) / 180
  const myLat = (userLat * Math.PI) / 180
  const myLng = (userLng * Math.PI) / 180

  const y = Math.sin(kaabaLng - myLng)
  const x = Math.cos(myLat) * Math.sin(kaabaLat) - Math.sin(myLat) * Math.cos(kaabaLat) * Math.cos(kaabaLng - myLng)

  const degree = (Math.atan2(y, x) * 180) / Math.PI
  return (degree + 360) % 360
}

export default function QiblaClient() {
  const [heading, setHeading] = useState(0)
  const [smoothedHeading, setSmoothedHeading] = useState(0)
  const [qiblaAngle, setQiblaAngle] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    let removeListener: (() => void) | null = null

    const startTracking = async () => {
      try {
        // 1. Get GPS for Qibla Angle
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        })
        const angle = getQiblaDegrees(pos.coords.latitude, pos.coords.longitude)
        setQiblaAngle(angle)

        // 2. Setup Motion Sensors
        // Check for permission (iOS 13+)
        if (
          typeof DeviceOrientationEvent !== "undefined" &&
          typeof (DeviceOrientationEvent as any).requestPermission === "function"
        ) {
          const permission = await (DeviceOrientationEvent as any).requestPermission()
          if (permission !== "granted") {
            setError("Sensor permission denied")
            return
          }
        }

        const listener = await Motion.addListener("orientation", (event) => {
          // event.alpha is the compass heading (0 = North)
          const alpha = (event as any).alpha
          if (typeof alpha === "number") {
            // Normalize to 0-360
            const normalized = (alpha + 360) % 360
            setHeading(normalized)
          }
        })

        removeListener = () => {
          console.log("[v0] Cleaning up Motion sensor...")
          listener.remove()
        }
      } catch (err) {
        console.error("[v0] Qibla Error:", err)
        setError("Please enable Location and Compass access")
        setIsSupported(false)
      }
    }

    startTracking()

    return () => {
      if (removeListener) removeListener()
    }
  }, [])

  useEffect(() => {
    const step = ((heading - smoothedHeading + 540) % 360) - 180
    if (Math.abs(step) > 0.1) {
      const timer = setTimeout(() => {
        setSmoothedHeading((prev) => (prev + step * 0.2 + 360) % 360)
      }, 16)
      return () => clearTimeout(timer)
    }
  }, [heading, smoothedHeading])

  // The arrow must point to (QiblaAngle - PhoneHeading)
  const finalRotation = qiblaAngle !== null ? (qiblaAngle - smoothedHeading + 360) % 360 : 0
  // Check if aligned within 3 degrees for the glow effect
  const diff = qiblaAngle !== null ? Math.abs(((finalRotation + 180) % 360) - 180) : 999
  const isAligned = qiblaAngle !== null && diff < 3

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col p-6 md:p-16 lg:p-24 relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/[0.02] rounded-full blur-[120px] -z-10" />

      <header className="mb-12 flex items-center justify-between border-b border-foreground/5 pb-12">
        <div className="flex flex-col gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft size={12} />
            Home
          </Link>
          <h1 className="font-serif italic text-4xl md:text-7xl leading-[1.1] tracking-tighter text-foreground">
            Qibla Finder
          </h1>
          <div className="flex items-center gap-3 text-muted-foreground">
            <div
              className={`w-1.5 h-1.5 rounded-full ${isSupported ? "bg-primary" : "bg-destructive"} animate-pulse`}
            />
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium">
              {isSupported ? "Sensors Active" : "Sensor Error"}
            </span>
          </div>
        </div>
        <Compass size={40} className="text-primary/20" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-12 md:gap-20">
        {error ? (
          <div className="text-center p-12 border border-destructive/10 bg-destructive/[0.02] max-w-sm backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-[0.3em] text-destructive font-bold mb-4">Connection Error</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
          </div>
        ) : (
          <div className="relative group">
            {/* Luxurious Outer Glow */}
            <div
              className={`absolute inset-[-40px] rounded-full transition-all duration-1000 ${
                isAligned ? "bg-primary/10 blur-[60px] scale-110" : "bg-primary/[0.02] blur-[40px] scale-100"
              }`}
            />

            {/* Compass Container (uses SVG for crisp UI and performance) */}
            <div className="w-72 h-72 md:w-[450px] md:h-[450px] rounded-full border border-primary/10 flex items-center justify-center relative bg-background shadow-[0_0_80px_rgba(0,0,0,0.05)] backdrop-blur-sm">
              <svg
                viewBox="0 0 360 360"
                className="w-[92%] h-[92%] transform transition-transform duration-150 ease-out pointer-events-none"
                role="img"
                aria-label="Qibla compass"
              >
                <defs>
                  <radialGradient id="g" cx="50%" cy="50%">
                    <stop offset="0%" stopColor="rgba(0,0,0,0.02)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.00)" />
                  </radialGradient>
                  <linearGradient id="needleGold" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D4AF37" />
                    <stop offset="50%" stopColor="#F9E29C" />
                    <stop offset="100%" stopColor="#C5A028" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* outer circle */}
                <circle cx="180" cy="180" r="160" stroke="rgba(0,0,0,0.05)" strokeWidth="2" fill="url(#g)" />

                {/* ticks - every 5 degrees */}
                {Array.from({ length: 72 }).map((_, i) => {
                  const angle = i * 5
                  const long = i % 6 === 0
                  const len = long ? 14 : i % 2 === 0 ? 8 : 4
                  const stroke = long ? "var(--color-primary)" : "rgba(0,0,0,0.06)"
                  const x1 = 180
                  const y1 = 20
                  const x2 = 180
                  const y2 = 20 + len
                  return (
                    <g key={i} transform={`rotate(${angle} 180 180)`}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={stroke}
                        strokeWidth={long ? 2 : 1}
                        strokeLinecap="round"
                      />
                    </g>
                  )
                })}

                {/* cardinal labels */}
                <text
                  x="180"
                  y="46"
                  fontFamily="serif"
                  fontSize="12"
                  textAnchor="middle"
                  fill="var(--color-muted-foreground)"
                >
                  N
                </text>
                <text
                  x="180"
                  y="324"
                  fontFamily="serif"
                  fontSize="12"
                  textAnchor="middle"
                  fill="var(--color-muted-foreground)"
                >
                  S
                </text>
                <text
                  x="324"
                  y="184"
                  fontFamily="serif"
                  fontSize="12"
                  textAnchor="middle"
                  fill="var(--color-muted-foreground)"
                >
                  E
                </text>
                <text
                  x="36"
                  y="184"
                  fontFamily="serif"
                  fontSize="12"
                  textAnchor="middle"
                  fill="var(--color-muted-foreground)"
                >
                  W
                </text>

                {/* degree numbers every 30 */}
                {Array.from({ length: 12 }).map((_, i) => {
                  const deg = i * 30
                  return (
                    <text
                      key={deg}
                      x="180"
                      y="28"
                      transform={`rotate(${deg} 180 180) translate(0, -6)`}
                      fontSize="10"
                      fontFamily="Helvetica"
                      textAnchor="middle"
                      fill="rgba(0,0,0,0.45)"
                    >
                      {deg}
                    </text>
                  )
                })}

               {/* rotating needle group (rotated by finalRotation) */}
<g transform={`rotate(${finalRotation} 180 180)`}>
  <g filter={isAligned ? "url(#glow)" : ""}>
    {/* The Green Triangle Arrow */}
    <path
      d="M180 40 L195 170 L180 160 L165 170 Z"
      fill={isAligned ? "#22c55e" : "#166534"} // Bright green when aligned, dark green when seeking
      stroke={isAligned ? "#15803d" : "transparent"}
      strokeWidth="1"
      className="transition-colors duration-300"
    />
    
    {/* The Tail (Subtle contrast) */}
    <path 
      d="M180 320 L175 190 L180 198 L185 190 Z" 
      fill="rgba(0,0,0,0.1)" 
    />
  </g>

  {/* Center Pivot Point */}
  <circle cx="180" cy="180" r="5" fill={isAligned ? "#22c55e" : "#3f3f46"} />
</g>
              </svg>

              {/* Center pivot - visible overlay */}
              <div className="absolute w-3 h-3 rounded-full bg-primary/20 backdrop-blur-md border border-primary/30 z-10" />
            </div>
          </div>
        )}

        <div className="text-center space-y-8 max-w-sm px-4">
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground font-bold leading-relaxed">
              Align the Green arrow indicator with the top of your device
            </p>
            <div className="h-[1px] w-12 bg-primary/20 mx-auto" />
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-[24px] font-serif italic tracking-tighter text-foreground tabular-nums">
              {Math.round(finalRotation)}°
            </span>
            {isAligned ? (
              <div className="text-primary text-[10px] font-bold uppercase tracking-[0.6em] animate-pulse">
                PERFECTLY ALIGNED
              </div>
            ) : (
              <div className="text-muted-foreground/30 text-[10px] font-bold uppercase tracking-[0.4em]">
                Seeking Direction
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
