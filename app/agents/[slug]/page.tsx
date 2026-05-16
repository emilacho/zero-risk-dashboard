import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/Header"

/**
 * Agent cubículo · /agents/[slug]
 *
 * Phase 0 · placeholder layout. Phase 1 wires:
 *  - identity_md from managed_agents_registry (canonical)
 *  - recent invocations + p50/p95 latency from agent_invocations
 *  - cost over time Tremor LineChart
 *  - skill assignments + linked clients
 *  - "Run agent" form (debug invocation)
 */
export default async function AgentCubiculoPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Agents
        </Link>
        <header className="mt-4 flex items-end justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Cubículo
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {slug}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Placeholder · Phase 1 carga identity_md canonical + invocaciones
              recientes + spend + skill assignments.
            </p>
          </div>
        </header>

        <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Placeholder title="Identity (canonical)" lines={4} />
          <Placeholder title="Recent invocations" lines={4} />
          <Placeholder title="Cost · 7d" lines={4} />
          <Placeholder title="p50 / p95 latency" lines={3} />
          <Placeholder title="Skills assigned" lines={3} />
          <Placeholder title="Linked clients" lines={3} />
        </section>
      </main>
    </>
  )
}

function Placeholder({ title, lines }: { title: string; lines: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-muted/60"
            style={{ width: `${65 + ((i * 17) % 35)}%` }}
          />
        ))}
      </div>
    </div>
  )
}
