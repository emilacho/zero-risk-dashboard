import type { Metadata } from "next"
// CC6 · 03-nov (encargo de Lenovo): las letras viven DENTRO del proyecto (`app/letras/`, los mismos archivos que servía Google, parte latina).
// `next/font/google` las bajaba en cada compilación y hoy falló 3 veces en GitHub y en Vercel, frenando publicaciones de todos.
import localFont from "next/font/local"
import "./globals.css"
import { MarcoDeLaApp } from "@/components/MarcoDeLaApp"
import { ActualizarSolo } from "@/components/ActualizarSolo"
// STEP 11 M4 · the floating Phase 3 CoworkChat drawer is DEPRECATED
// in favor of the inline CoworkPromptBar (embedded per-surface · home
// + dept/mkt modal + clients/workflows/agents detail pages). Keeping
// the file at components/CoworkChat.tsx for forensic value but no
// longer mounting it. /api/cowork/message route stays alive for any
// external (n8n) posters.
import { Toaster } from "@/components/ui/Toaster"

const inter = localFont({
  src: [{ path: "./letras/inter-latin-var.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
})
const mono = localFont({
  src: [{ path: "./letras/jetbrains-mono-latin-var.woff2", weight: "100 800", style: "normal" }],
  variable: "--font-mono",
  display: "swap",
})
// Display font · Space Grotesk bold for section titles · tight letter-
// spacing, confident weight without leaving the sans family.
const display = localFont({
  src: [{ path: "./letras/space-grotesk-latin-var.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-display",
  display: "swap",
})
// Marker · single-weight Google handwriting · used sparingly for the
// brand mark + hero accent only · keeps body copy in Inter.
const marker = localFont({
  src: [{ path: "./letras/permanent-marker-latin-400.woff2", weight: "400", style: "normal" }],
  variable: "--font-marker",
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
        {/* CC6 · 03-nov: el marco viejo (barra lateral, halo violeta) solo en el dashboard viejo; las pantallas nuevas salen limpias desde la primera pintura */}
        <MarcoDeLaApp>{children}</MarcoDeLaApp>
        <Toaster />
        <ActualizarSolo />
      </body>
    </html>
  )
}
