import type { Metadata } from "next"
import Link from "next/link"
import { FormsQueryProvider } from "./hooks/FormsQueryProvider"
import { FormsTable } from "./components/FormsTable"

export const metadata: Metadata = {
  title: "Forms · admin",
  description: "Forms catalog · Tally-backed · Stack V4 · Sprint 4",
}

export const dynamic = "force-dynamic"

export default function FormsPage() {
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
        <span className="text-foreground">Forms</span>
      </nav>
      <header className="mb-8 flex flex-col gap-2">
        <span className="eyebrow-chip self-start">
          <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
          Sprint 4 · forms admin · GHL-Out
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Forms</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Catalog de forms Tally-backed. Cada form lleva su contador de submissions y link al editor Tally.
        </p>
      </header>

      <FormsQueryProvider>
        <FormsTable />
      </FormsQueryProvider>
    </main>
  )
}
