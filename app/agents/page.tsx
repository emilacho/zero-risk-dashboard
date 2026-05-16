import { Suspense } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import { CubiculoCard } from "@/lib/dashboard-components"
import { Header } from "@/components/Header"
import { Skeleton } from "@/components/Skeleton"

export const dynamic = "force-dynamic"

async function AgentsGrid() {
  const data = await api.agents(100).catch(() => null)
  if (!data) {
    return (
      <p className="text-sm text-destructive-foreground">
        Could not load agents · platform endpoint unreachable.
      </p>
    )
  }
  return (
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.agents.map((a) => (
        <Link key={a.id} href={`/agents/${a.name}`}>
          <CubiculoCard
            slug={a.name}
            displayName={a.display_name}
            role={a.role}
            model={a.model}
            status={
              a.status === "active"
                ? "active"
                : a.status === "paused"
                ? "paused"
                : "deprecated"
            }
            metrics={{
              invocations30d: a.stats_30d.sessions ?? 0,
              costUsd30d: a.stats_30d.cost_usd ?? 0,
              avgDurationMs: 0,
              successRate: 100,
            }}
          />
        </Link>
      ))}
    </div>
  )
}

export default function AgentsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Cubículos · agentes
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Plantilla · 30-day window
          </h1>
        </div>
        <Suspense fallback={<Skeleton lines={6} />}>
          <AgentsGrid />
        </Suspense>
      </main>
    </>
  )
}
