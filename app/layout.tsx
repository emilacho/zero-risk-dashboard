import type { Metadata } from "next"
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google"
import "./globals.css"
import { RouteTransition } from "@/components/RouteTransition"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})
// Display font · used for the hero headlines and section titles to give
// the dashboard a Lumen-Studio-style hierarchy (tight letter-spacing,
// confident weight) without leaving the Inter family for body copy.
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Zero Risk · Dashboard",
    template: "%s · Zero Risk",
  },
  description:
    "Control surface for the Zero Risk agentic agency · agents, clients, cascades.",
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${mono.variable} ${display.variable} font-sans antialiased bg-noise`}
      >
        {/* Static decorative layer · pure CSS · no client JS */}
        <div className="ambient-grid" aria-hidden />
        <div className="ambient-beam-1" aria-hidden />
        <div className="ambient-beam-2" aria-hidden />
        <RouteTransition>{children}</RouteTransition>
      </body>
    </html>
  )
}
