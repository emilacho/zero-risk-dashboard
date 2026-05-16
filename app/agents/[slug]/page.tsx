import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { api } from "@/lib/api"
import {
  ActivityFeed,
  SparklineGrid,
  formatCurrency,
} from "@/lib/dashboard-components"
import { Header } from "@/components/Header"

export const dynamic = "force-dynamic"

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await api.agent(slug).catch(() => null)

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

        {!data ? (
          <div className="mt-8 rounded-xl border border-border bg-card p-6 text-sm text-destructive-foreground">
            Agent &quot;{slug}&quot; not found or platform endpoint unreachable.
          </div>
        ) : (
          <AgentDetailBody data={data} />
        )}
      </main>
    </>
  )
}

function AgentDetailBody({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof api.agent>>>
}) {
  // Derive stats from invocations[] · the detail endpoint exposes the
  // recent activity directly · agent.stats_30d only exists on the list
  // endpoint shape.
  const totalSessions = data.invocations.length
  const totalSpend = data.invocations.reduce(
    (sum, i) => sum + (i.cost_usd ?? 0),
    0,
  )

  return (
    <>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Cubículo · {data.agent.role} · {data.agent.model}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {data.agent.display_name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            slug · <code className="font-mono">{data.agent.name}</code>
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>{totalSessions} sesiones · 30d</p>
          <p>{formatCurrency(totalSpend)} spend</p>
        </div>
      </header>

      <section className="mt-10">
        <SparklineGrid
          agents={[
            {
              slug: data.agent.name,
              label: data.agent.display_name,
              metric: "cost · 30d",
              current: totalSpend,
              delta: 0,
              series: (data.timeline_30d ?? []).map((d, idx) => ({
                x: idx,
                y: d.cost_usd,
              })),
            },
          ]}
        />
      </section>

      <section className="mt-10">
        {data.invocations.length > 0 ? (
          <ActivityFeed
            title={`Recent invocations · ${data.agent.name}`}
            invocations={data.invocations.map((row) => ({
              id: row.id,
              agent: data.agent.name,
              clientId: row.client_id,
              status:
                row.status === "completed"
                  ? "success"
                  : row.status === "failed"
                  ? "failure"
                  : "running",
              durationMs: row.duration_ms ?? 0,
              costUsd: row.cost_usd ?? 0,
              at: row.started_at,
              task: row.model,
            }))}
            limit={12}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No recent invocations en ventana 30d.
          </p>
        )}
      </section>

      {data.files_produced && data.files_produced.length > 0 ? (
        <section className="mt-10 rounded-xl border border-border bg-card p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Files produced · Storage
          </p>
          <ul className="mt-3 space-y-1 text-xs text-foreground/80">
            {data.files_produced.map((f) => (
              <li key={f.path}>
                <code className="font-mono">{f.path}</code>{" "}
                <span className="text-muted-foreground">
                  ({Math.round(f.size_bytes / 1024)} KB)
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
