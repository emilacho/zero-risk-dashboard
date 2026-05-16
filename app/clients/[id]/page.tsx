import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { api, type ClientDetailResponse } from "@/lib/api"
import {
  ActivityFeed,
  MemoryGraph,
  formatCurrency,
} from "@/lib/dashboard-components"
import { Header } from "@/components/Header"
import type { MemoryGraphData } from "@/lib/dashboard-components"

export const dynamic = "force-dynamic"

function detailToGraph(detail: ClientDetailResponse): MemoryGraphData {
  const clientNodeId = `client:${detail.client.id}`
  const nodes: MemoryGraphData["nodes"] = [
    {
      id: clientNodeId,
      kind: "client",
      label: detail.client.name,
      meta: { industry: detail.client.industry ?? undefined },
    },
  ]
  const edges: MemoryGraphData["edges"] = []
  for (const a of detail.agents_worked) {
    const agentNodeId = `agent:${a.agent_id}`
    nodes.push({
      id: agentNodeId,
      kind: "agent",
      label: a.agent_id,
      meta: { runs24h: a.sessions },
    })
    edges.push({
      id: `edge:${clientNodeId}:${agentNodeId}`,
      source: clientNodeId,
      target: agentNodeId,
    })
  }
  return { nodes, edges }
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await api.client(id).catch(() => null)

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Clients
        </Link>

        {!data ? (
          <div className="mt-8 rounded-xl border border-border bg-card p-6 text-sm text-destructive-foreground">
            Client &quot;{id}&quot; not found or platform endpoint unreachable.
          </div>
        ) : (
          <ClientDetailBody data={data} />
        )}
      </main>
    </>
  )
}

function ClientDetailBody({ data }: { data: ClientDetailResponse }) {
  // Sum agents_worked for total invocations + spend (the detail endpoint
  // doesn't ship a single `stats` rollup · we compute from the per-agent
  // rollup it does ship).
  const totalSessions = data.agents_worked.reduce(
    (sum, a) => sum + a.sessions,
    0,
  )
  const totalSpend = data.agents_worked.reduce(
    (sum, a) => sum + a.cost_usd,
    0,
  )

  return (
    <>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Carpeta cliente · {data.client.status} ·{" "}
            {data.client.industry ?? "—"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {data.client.name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            slug · <code className="font-mono">{data.client.slug}</code>
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>{totalSessions} invocaciones</p>
          <p>{formatCurrency(totalSpend)} spend</p>
        </div>
      </header>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Agents que trabajaron
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {data.agents_worked.length === 0 ? (
              <li className="text-muted-foreground">
                Sin invocaciones registradas todavía.
              </li>
            ) : (
              data.agents_worked.map((a) => (
                <li key={a.agent_id} className="flex justify-between">
                  <Link
                    href={`/agents/${a.agent_id}`}
                    className="font-mono hover:text-foreground hover:underline"
                  >
                    {a.agent_id}
                  </Link>
                  <span className="text-muted-foreground">
                    {a.sessions} · {formatCurrency(a.cost_usd)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Brand assets
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <p>
              Logo:{" "}
              {data.client.logo_url ? (
                <a
                  href={data.client.logo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  ver
                </a>
              ) : (
                <span className="text-muted-foreground">(none)</span>
              )}
            </p>
            <p>
              Colors:{" "}
              {Array.isArray(data.client.brand_colors) &&
              data.client.brand_colors.length > 0 ? (
                <span className="font-mono text-xs">
                  {data.client.brand_colors
                    .map((c) =>
                      typeof c === "object" &&
                      c &&
                      "hex" in (c as Record<string, unknown>)
                        ? String((c as { hex: string }).hex)
                        : String(c),
                    )
                    .join(" · ")}
                </span>
              ) : (
                <span className="text-muted-foreground">(none)</span>
              )}
            </p>
            <p>
              Website:{" "}
              {data.client.website_url ? (
                <a
                  href={data.client.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {safeHostname(data.client.website_url)}
                </a>
              ) : (
                <span className="text-muted-foreground">(none)</span>
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <ActivityFeed
          title="Timeline · agent invocations"
          invocations={data.invocations_recent.map((t) => ({
            id: t.id,
            agent: t.agent_id,
            clientId: data.client.id,
            status:
              t.status === "completed"
                ? "success"
                : t.status === "failed"
                ? "failure"
                : "running",
            durationMs: 0,
            costUsd: t.cost_usd ?? 0,
            at: t.started_at,
            task: t.agent_name,
          }))}
          limit={20}
        />
      </section>

      <section className="mt-10">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Memory · {data.client.name}
        </p>
        <div className="rounded-xl border border-border bg-card">
          <MemoryGraph data={detailToGraph(data)} height={400} title={null} />
        </div>
      </section>

      {data.files && data.files.length > 0 ? (
        <section className="mt-10 rounded-xl border border-border bg-card p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Storage files{" "}
            {data.files_bucket ? (
              <span className="ml-2 normal-case tracking-normal text-muted-foreground/70">
                · {data.files_bucket}/{data.files_prefix ?? ""}
              </span>
            ) : null}
          </p>
          <ul className="mt-3 space-y-1 text-xs text-foreground/80">
            {data.files.map((f) => {
              const bytes = f.size_bytes ?? f.size ?? 0
              return (
                <li key={f.path}>
                  <code className="font-mono">{f.path}</code>{" "}
                  <span className="text-muted-foreground">
                    ({Math.round(bytes / 1024)} KB)
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </>
  )
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
