import type React from "react"
import type { Metadata, Viewport } from "next" // Added Viewport type
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

// 1. Separate Viewport Export (Fixed for Status Bar/Notch)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // This allows the app to handle the "Safe Area"
  themeColor: "#000000",
}

// 2. Cleaned Metadata (Removed deprecated viewport/themeColor from here)
export const metadata: Metadata = {
  title: "Namaz Time MM - Precise Prayer Times Myanmar & Global",
  description:
    "Fast and accurate prayer times based on solar calculations. Offline-ready, bilingual (Burmese/English), and privacy-focused Islamic prayer schedule.",
  generator: "Shain Wai Yan",
  manifest: "/manifest.json",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Azan",
  },
  alternates: {
    canonical: "https://azan.mm",
    languages: {
      "en-US": "/en",
      "my-MM": "/mm",
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body 
        className="font-sans antialiased bg-background selection:bg-primary/10 selection:text-primary"
        style={{ 
          paddingTop: "env(safe-area-inset-top)",    /* The Fix for the Top Notch */
          paddingBottom: "env(safe-area-inset-bottom)" /* The Fix for Bottom Gesture Bar */
        }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  )
}