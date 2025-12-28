import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Azan - Precise Prayer Times Myanmar & Global",
  description:
    "Fast and accurate prayer times based on solar calculations. Offline-ready, bilingual (Burmese/English), and privacy-focused Islamic prayer schedule.",
  generator: "v0.app",
  manifest: "/manifest.json",
  themeColor: "#000000",
  viewport: "width=device-width, initial-scale=1",
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
    canonical: "https://azan.mm", // Replace with your actual domain
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
      <body className={`font-sans antialiased bg-background selection:bg-primary/10 selection:text-primary`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
