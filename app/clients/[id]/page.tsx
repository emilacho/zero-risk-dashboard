import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { api } from "@/lib/api"
import {
  ActivityFeed,
  MemoryGraph,
  formatCurrency,
} from "@/lib/dashboard-components"
import { clientDetailToMemoryGraph } from "@/lib/transforms"
import { Header } from "@/components/Header"

export const dynamic = "force-dynamic"

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
          <>
            <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Carpeta cliente · {data.client.status} · {data.client.industry ?? "—"}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  {data.client.name}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  slug · <code className="font-mono">{data.client.slug}</code>
                </p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>{data.client.stats.invocations} invocaciones</p>
                <p>{formatCurrency(data.client.stats.total_spend_usd)} spend</p>
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
                          {a.invocations} · {formatCurrency(a.total_spend_usd)}
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
                        {new URL(data.client.website_url).hostname}
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
                invocations={data.timeline.map((t) => ({
                  id: t.id,
                  agent: t.agent_id,
                  clientId: data.client.id,
                  status:
                    t.status === "completed"
                      ? "success"
                      : t.status === "failed"
                      ? "failure"
                      : "running",
                  durationMs: t.duration_ms ?? 0,
                  costUsd: t.cost_usd ?? 0,
                  at: t.started_at,
                  task: t.agent_id,
                }))}
                limit={20}
              />
            </section>

            <section className="mt-10">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Memory · {data.client.name}
              </p>
              <div className="rounded-xl border border-border bg-card">
                <MemoryGraph
                  data={clientDetailToMemoryGraph(data)}
                  height={400}
                  title={null}
                />
              </div>
            </section>

            {data.storage_files && data.storage_files.length > 0 ? (
              <section className="mt-10 rounded-xl border border-border bg-card p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Storage files
                </p>
                <ul className="mt-3 space-y-1 text-xs text-foreground/80">
                  {data.storage_files.map((f) => (
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
        )}
      </main>
    </>
  )
}
