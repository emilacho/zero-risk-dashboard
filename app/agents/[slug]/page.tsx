import Link from "next/link"
import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr"
import { api } from "@/lib/api"
import {
  ActivityFeed,
  SparklineGrid,
  formatCurrency,
} from "@/lib/dashboard-components"
import { CoworkPromptBar } from "@/components/cowork/CoworkPromptBar"
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
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Agents
        </Link>

        {!data ? (
          <div className="mt-8 surface-card p-6 text-sm text-rose-300">
            Agent &quot;{slug}&quot; not found or platform endpoint unreachable.
          </div>
        ) : (
          <>
            <AgentDetailBody data={data} />
            <section className="mt-10">
              <CoworkPromptBar
                channel={`agent:${data.agent.name}`}
                eyebrow="Agente · cowork prompt"
                variant="full"
                maxThreadHeight={320}
                surfaceState={{
                  agent_name: data.agent.name,
                  display_name: data.agent.display_name,
                  role: data.agent.role,
                  model: data.agent.model,
                  total_invocations: data.invocations.length,
                  total_spend_usd: data.invocations.reduce(
                    (s, i) => s + (i.cost_usd ?? 0),
                    0,
                  ),
                  status: data.agent.status,
                }}
              />
            </section>
          </>
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
  const totalSessions = data.invocations.length
  const totalSpend = data.invocations.reduce(
    (sum, i) => sum + (i.cost_usd ?? 0),
    0,
  )

  return (
    <>
      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="eyebrow-chip self-start">
            Cubículo · {data.agent.role} · {data.agent.model}
          </span>
          <h1 className="font-display text-[36px] font-semibold leading-[1.05] tracking-tight md:text-[44px]">
            <span className="text-gradient">{data.agent.display_name}</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            slug · <code className="font-mono">{data.agent.name}</code>
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="text-right text-sm text-muted-foreground">
            <p className="tabular-nums">{totalSessions} sesiones · 30d</p>
            <p className="tabular-nums">{formatCurrency(totalSpend)} spend</p>
          </div>
          <button type="button" className="shimmer-btn">
            <span>Run agent</span>
            <ArrowSquareOut className="h-3.5 w-3.5" />
          </button>
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
        <section className="surface-card mt-10 p-5" data-glow="violet">
          <div className="relative z-[2]">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Files produced · Storage
            </p>
            <ul className="mt-3 space-y-1 text-xs text-foreground/80">
              {data.files_produced.map((f) => (
                <li key={f.path}>
                  <code className="font-mono">{f.path}</code>{" "}
                  <span className="text-muted-foreground tabular-nums">
                    ({Math.round(f.size_bytes / 1024)} KB)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  )
}
