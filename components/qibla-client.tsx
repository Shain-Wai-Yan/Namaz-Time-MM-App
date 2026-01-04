"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, CompassIcon } from "lucide-react"
import Link from "next/link"
import { Geolocation } from "@capacitor/geolocation"
import Compass from "@/lib/compass-plugin"
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics"
import { getQiblaDegrees, getDistanceToKaaba } from "@/lib/qibla-calculations" // Added imports for getQiblaDegrees and getDistanceToKaaba

export default function QiblaClient() {
  const [heading, setHeading] = useState(0)
  const [qiblaAngle, setQiblaAngle] = useState<number | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)
  const [needsCalibration, setNeedsCalibration] = useState(false)
  const [needsLevel, setNeedsLevel] = useState(false)
  const [wasAligned, setWasAligned] = useState(false)
  const [lastHapticTime, setLastHapticTime] = useState(0)
  const [isStabilizing, setIsStabilizing] = useState(false)
  const [hasMagneticInterference, setHasMagneticInterference] = useState(false)

  useEffect(() => {
    const startTracking = async () => {
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        })
        const angle = getQiblaDegrees(pos.coords.latitude, pos.coords.longitude)
        setQiblaAngle(angle)

        const dist = getDistanceToKaaba(pos.coords.latitude, pos.coords.longitude)
        setDistance(dist)

        await Compass.setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude || 0,
        })

        await Compass.startWatching()

        const handler = await Compass.addListener("headingChanged", (data) => {
          setHeading(data.heading)
          setNeedsLevel(data.needsLevelWarning || false)
          setIsStabilizing(data.isStabilizing || false)
          setHasMagneticInterference(data.hasMagneticInterference || false)
        })

        const accuracyHandler = await Compass.addListener("accuracyWarning", (data) => {
          if (data.needsCalibration) {
            Haptics.notification({ type: NotificationType.Warning }).catch(() => {})
            setNeedsCalibration(true)
            setTimeout(() => setNeedsCalibration(false), 5000)
          }
        })

        return () => {
          Compass.stopWatching()
          Compass.removeAllListeners()
        }
      } catch (err) {
        setError("Please enable Location and Compass access in your device settings")
        setIsSupported(false)
      }
    }

    startTracking()

    return () => {
      Compass.stopWatching()
      Compass.removeAllListeners()
    }
  }, [])

  const qiblaArrowRotation = qiblaAngle !== null ? qiblaAngle : 0
  const compassDiff = qiblaAngle !== null ? Math.abs(((qiblaAngle - heading + 540) % 360) - 180) : 180
  const isAligned = compassDiff < 5

  useEffect(() => {
    const now = Date.now()
    if (isAligned && !wasAligned && now - lastHapticTime > 1500) {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
      setLastHapticTime(now)
      setWasAligned(true)
    } else if (!isAligned && wasAligned) {
      setWasAligned(false)
    }
  }, [isAligned, wasAligned, lastHapticTime])

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col p-6 md:p-16 lg:p-24 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-[100px] -z-10" />

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
              {isSupported ? "Compass Active" : "Sensor Error"}
            </span>
          </div>
        </div>
        <CompassIcon size={40} className="text-primary/20" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-12 md:gap-20">
        {hasMagneticInterference && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-red-500/10 border border-red-500/20 backdrop-blur-md px-6 py-4 rounded-lg shadow-xl">
              <p className="text-xs text-red-700 dark:text-red-300 font-medium text-center">
                Magnetic interference detected. Move away from electronic devices or metal objects.
              </p>
            </div>
          </div>
        )}

        {isStabilizing && !hasMagneticInterference && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-orange-500/10 border border-orange-500/20 backdrop-blur-md px-6 py-4 rounded-lg shadow-xl">
              <p className="text-xs text-orange-700 dark:text-orange-300 font-medium text-center">
                Stabilizing... Hold your phone steady
              </p>
            </div>
          </div>
        )}

        {needsCalibration && !isStabilizing && !hasMagneticInterference && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-amber-500/10 border border-amber-500/20 backdrop-blur-md px-6 py-4 rounded-lg shadow-xl">
              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium text-center">
                Move your phone in a figure-8 motion to calibrate
              </p>
            </div>
          </div>
        )}

        {needsLevel && !needsCalibration && !isStabilizing && !hasMagneticInterference && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-blue-500/10 border border-blue-500/20 backdrop-blur-md px-6 py-4 rounded-lg shadow-xl">
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium text-center">
                Hold your phone flat for better accuracy
              </p>
            </div>
          </div>
        )}

        {/* ... existing code (error display and compass UI) ... */}
        {error ? (
          <div className="text-center p-12 border border-destructive/10 bg-destructive/[0.02] max-w-sm backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-[0.3em] text-destructive font-bold mb-4">Connection Error</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
          </div>
        ) : (
          <div className="relative group">
            <div
              className={`absolute inset-[-50px] rounded-full transition-all duration-1000 ${
                isAligned ? "bg-primary/15 blur-[80px] scale-110" : "bg-primary/[0.03] blur-[50px] scale-100"
              }`}
            />

            <div className="w-80 h-80 md:w-[480px] md:h-[480px] rounded-full border-2 border-primary/10 flex items-center justify-center relative bg-background shadow-[0_0_100px_rgba(0,0,0,0.06)] backdrop-blur-sm">
              <svg
                viewBox="0 0 400 400"
                className="absolute w-[95%] h-[95%] transition-transform duration-[66ms] ease-linear pointer-events-none"
                style={{ transform: `rotate(${-heading}deg)` }}
                role="img"
                aria-label="Compass directions"
              >
                <defs>
                  <radialGradient id="g" cx="50%" cy="50%">
                    <stop offset="0%" stopColor="rgba(0,0,0,0.02)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.00)" />
                  </radialGradient>
                </defs>

                <circle cx="200" cy="200" r="180" stroke="rgba(0,0,0,0.04)" strokeWidth="2.5" fill="url(#g)" />

                {Array.from({ length: 72 }).map((_, i) => {
                  const angle = i * 5
                  const long = i % 6 === 0
                  const len = long ? 16 : i % 2 === 0 ? 10 : 5
                  const stroke = long ? "var(--color-primary)" : "rgba(0,0,0,0.06)"
                  const x1 = 200
                  const y1 = 20
                  const x2 = 200
                  const y2 = 20 + len
                  return (
                    <g key={i} transform={`rotate(${angle} 200 200)`}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={stroke}
                        strokeWidth={long ? 2.5 : 1.5}
                        strokeLinecap="round"
                      />
                    </g>
                  )
                })}

                <text
                  x="200"
                  y="55"
                  fontFamily="serif"
                  fontSize="18"
                  fontWeight="700"
                  textAnchor="middle"
                  fill="var(--color-primary)"
                >
                  N
                </text>
                <text
                  x="200"
                  y="355"
                  fontFamily="serif"
                  fontSize="16"
                  fontWeight="600"
                  textAnchor="middle"
                  fill="var(--color-muted-foreground)"
                >
                  S
                </text>
                <text
                  x="355"
                  y="206"
                  fontFamily="serif"
                  fontSize="16"
                  fontWeight="600"
                  textAnchor="middle"
                  fill="var(--color-muted-foreground)"
                >
                  E
                </text>
                <text
                  x="45"
                  y="206"
                  fontFamily="serif"
                  fontSize="16"
                  fontWeight="600"
                  textAnchor="middle"
                  fill="var(--color-muted-foreground)"
                >
                  W
                </text>
              </svg>

              <svg
                viewBox="0 0 400 400"
                className="absolute w-[95%] h-[95%] transition-transform duration-[66ms] ease-linear pointer-events-none"
                style={{ transform: `rotate(${qiblaArrowRotation - heading}deg)` }}
                role="img"
                aria-label="Qibla direction arrow"
              >
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <g filter={isAligned ? "url(#glow)" : ""}>
                  <path
                    d="M200 40 L218 200 L200 188 L182 200 Z"
                    fill={isAligned ? "#22c55e" : "#166534"}
                    stroke={isAligned ? "#15803d" : "#0f4c25"}
                    strokeWidth="2"
                    className="transition-all duration-300"
                  />
                  <path d="M200 360 L188 210 L200 218 L212 210 Z" fill="rgba(0,0,0,0.06)" />
                </g>
                <circle
                  cx="200"
                  cy="200"
                  r="8"
                  fill={isAligned ? "#22c55e" : "#3f3f46"}
                  stroke="white"
                  strokeWidth="3"
                  className="transition-colors duration-300"
                />
              </svg>

              <div className="absolute w-4 h-4 rounded-full bg-primary/30 backdrop-blur-md border-2 border-primary/40 z-10 shadow-lg" />
            </div>
          </div>
        )}

        <div className="text-center space-y-8 max-w-sm px-4">
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground font-bold leading-relaxed">
              Align the Green arrow with the top of your device
            </p>
            <div className="h-[1px] w-12 bg-primary/20 mx-auto" />
          </div>

          <div className="flex flex-col items-center gap-3">
            <span className="text-[28px] font-serif italic tracking-tighter text-foreground tabular-nums">
              {Math.round(compassDiff)}°
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

          {distance !== null && (
            <div className="pt-6 border-t border-foreground/5">
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-medium">
                  Distance to Kaaba
                </span>
                <span className="text-2xl font-serif italic tracking-tighter text-foreground tabular-nums">
                  {distance.toFixed(0)} <span className="text-sm text-muted-foreground">km</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
