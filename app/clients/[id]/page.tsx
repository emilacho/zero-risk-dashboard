import Link from "next/link"
import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr"
import { api, type ClientDetailResponse } from "@/lib/api"
import {
  ActivityFeed,
  MemoryGraph,
  formatCurrency,
} from "@/lib/dashboard-components"
import type { MemoryGraphData } from "@/lib/dashboard-components"
import { ClientVault } from "@/components/clients/ClientVault"

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
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Clients
        </Link>

        {!data ? (
          <div className="mt-8 surface-card p-6 text-sm text-rose-300">
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
      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="eyebrow-chip self-start">
            Carpeta · {data.client.status} · {data.client.industry ?? "—"}
          </span>
          <h1 className="font-display text-[36px] font-semibold leading-[1.05] tracking-tight md:text-[44px]">
            <span className="text-gradient">{data.client.name}</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            slug · <code className="font-mono">{data.client.slug}</code>
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="text-right text-sm text-muted-foreground">
            <p className="tabular-nums">{totalSessions} invocaciones</p>
            <p className="tabular-nums">{formatCurrency(totalSpend)} spend</p>
          </div>
          {data.client.website_url ? (
            <a
              href={data.client.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shimmer-btn"
            >
              <span>Open site</span>
              <ArrowSquareOut className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </header>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        <div className="surface-card p-5" data-glow="violet">
          <div className="relative z-[2]">
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
                      className="font-mono hover:text-foreground hover:underline underline-offset-4"
                    >
                      {a.agent_id}
                    </Link>
                    <span className="text-muted-foreground tabular-nums">
                      {a.sessions} · {formatCurrency(a.cost_usd)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="surface-card p-5" data-glow="cyan">
          <div className="relative z-[2]">
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
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {data.client.brand_colors.map((c, i) => {
                      const hex =
                        typeof c === "object" &&
                        c &&
                        "hex" in (c as Record<string, unknown>)
                          ? String((c as { hex: string }).hex)
                          : String(c)
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-1.5 py-[2px] font-mono text-[10px]"
                        >
                          <span
                            aria-hidden
                            className="inline-block h-3 w-3 rounded-[3px] ring-1 ring-inset ring-foreground/15"
                            style={{ background: hex }}
                          />
                          {hex}
                        </span>
                      )
                    })}
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
        <MemoryGraph data={detailToGraph(data)} height={400} title={null} />
      </section>

      {data.files && data.files.length > 0 ? (
        <section className="surface-card mt-10 p-5" data-glow="cyan">
          <div className="relative z-[2]">
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
                    <span className="text-muted-foreground tabular-nums">
                      ({Math.round(bytes / 1024)} KB)
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      ) : null}

      {/* STEP 4.6 · Vault del cliente · 10 tabs · light metadata · admin only */}
      <div className="mt-10">
        <ClientVault clientId={data.client.id} clientSlug={data.client.slug} />
      </div>
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
