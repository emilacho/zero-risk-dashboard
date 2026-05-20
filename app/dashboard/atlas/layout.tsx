import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Atlas · ZeroRiskBible",
  description: "Ground truth dashboard · Sprint 2 scaffold",
}

export default function AtlasLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-7xl px-6 pb-16 pt-10">
      <nav
        aria-label="Breadcrumb"
        className="num mb-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]"
      >
        <Link href="/" className="hover:text-foreground">
          Dashboard
        </Link>
        <span aria-hidden>·</span>
        <span className="text-foreground">Atlas</span>
      </nav>
      <header className="mb-8 flex flex-col gap-2">
        <span className="eyebrow-chip self-start">
          <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
          Sprint 2 · ground truth dashboard
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          ZeroRiskBible · ground truth dashboard
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Tier 1 reality view · Supabase + n8n + git + integrations health · CC#4
          construye los componentes v2 sobrio encima del scaffold.
        </p>
      </header>
      {children}
    </main>
  )
}
