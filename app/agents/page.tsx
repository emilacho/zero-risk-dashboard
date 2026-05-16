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
    <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {data.agents.map((a) => (
        <Link key={a.id} href={`/agents/${a.name}`} className="block">
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
            onOpen={() => {}}
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
      <main className="mx-auto max-w-7xl px-6 pb-16 pt-12">
        <section className="mb-10 flex flex-col gap-3">
          <span className="eyebrow-chip self-start">Cubículos · agentes</span>
          <h1 className="font-display text-[40px] font-semibold leading-[1.05] tracking-tight md:text-[52px]">
            <span className="text-gradient">Plantilla agéntica</span>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Cada agente activo en su cubículo · status · model tier · costo
            últimos 30 días. Click para abrir el detail.
          </p>
        </section>
        <Suspense fallback={<Skeleton kind="page" />}>
          <AgentsGrid />
        </Suspense>
      </main>
    </>
  )
}
