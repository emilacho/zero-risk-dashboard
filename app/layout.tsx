import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

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
        className={`${inter.variable} ${mono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
