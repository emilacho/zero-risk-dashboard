import type { Metadata } from "next"
import {
  Inter,
  JetBrains_Mono,
  Space_Grotesk,
  Permanent_Marker,
} from "next/font/google"
import "./globals.css"
import { RouteTransition } from "@/components/RouteTransition"
import { Sidebar } from "@/components/Sidebar"
// STEP 11 M4 · the floating Phase 3 CoworkChat drawer is DEPRECATED
// in favor of the inline CoworkPromptBar (embedded per-surface · home
// + dept/mkt modal + clients/workflows/agents detail pages). Keeping
// the file at components/CoworkChat.tsx for forensic value but no
// longer mounting it. /api/cowork/message route stays alive for any
// external (n8n) posters.
import { Toaster } from "@/components/ui/Toaster"

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
// Display font · Space Grotesk bold for section titles · tight letter-
// spacing, confident weight without leaving the sans family.
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
})
// Marker · single-weight Google handwriting · used sparingly for the
// brand mark + hero accent only · keeps body copy in Inter.
const marker = Permanent_Marker({
  subsets: ["latin"],
  variable: "--font-marker",
  weight: "400",
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
        className={`${inter.variable} ${mono.variable} ${display.variable} ${marker.variable} font-sans antialiased`}
      >
        {/* Lumen v3 · single subtle violet halo · no grid, no noise */}
        <div className="ambient-halo" aria-hidden />
        <Sidebar />
        <RouteTransition>
          <div className="pl-[64px]">{children}</div>
        </RouteTransition>
        <Toaster />
      </body>
    </html>
  )
}
