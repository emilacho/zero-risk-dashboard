import type { Metadata } from "next"
import Link from "next/link"
import { PipelineQueryProvider } from "./hooks/PipelineQueryProvider"
import { PipelineBoard } from "./components/PipelineBoard"

export const metadata: Metadata = {
  title: "Pipeline · Journeys",
  description: "Kanban canónico de journey_executions · Sprint 4",
}

export const dynamic = "force-dynamic"

export default function PipelinePage() {
  return (
    <main className="mx-auto max-w-[1600px] px-6 pb-16 pt-10">
      <nav
        aria-label="Breadcrumb"
        className="num mb-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]"
      >
        <Link href="/" className="hover:text-foreground">Dashboard</Link>
        <span aria-hidden>·</span>
        <span className="text-foreground">Pipeline</span>
      </nav>
      <header className="mb-8 flex flex-col gap-2">
        <span className="eyebrow-chip self-start">
          <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
          Sprint 4 · pipeline UI · GHL-Out
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Pipeline · journeys activos
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Drag entre columnas para mover stage. HITL gate visible · cards bloqueados se marcan en ámbar.
        </p>
      </header>

      <PipelineQueryProvider>
        <PipelineBoard />
      </PipelineQueryProvider>
    </main>
  )
}
