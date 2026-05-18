/**
 * Agent feed loader · STEP 10 · sits behind `LiveAgentFeed` for the
 * initial paint and the API polling-fallback. Pulls recent
 * `agent_invocations` rows from Supabase service role + resolves
 * client_id → display name + computes 24h counters.
 *
 * Browser-side subscription (Supabase Realtime) handles the live
 * append for incoming INSERT events · the shape returned here matches
 * what the client component renders so we don't have to reshape on
 * the wire.
 */
import { getServiceRoleClient } from "./supabase-server"
import { resolveSpendCategory } from "./spend-classifier"

export interface AgentFeedRow {
  id: string
  startedAt: string
  agentName: string
  clientLabel: string
  /** "ok" · "running" · "failed" · "queued" · "unknown" */
  status: string
  costUsd: number | null
  model: string | null
  durationMs: number | null
  inputPreview: string | null
  outputPreview: string | null
}

export interface AgentFeedPayload {
  rows: AgentFeedRow[]
  count24h: number
  totalCost24h: number
  generatedAt: string
}

function shorten(s: unknown, limit = 180): string | null {
  if (s == null) return null
  const str = typeof s === "string" ? s : JSON.stringify(s)
  if (!str) return null
  return str.length > limit ? str.slice(0, limit) + "…" : str
}

function statusLabel(raw: string | null | undefined): string {
  const s = String(raw ?? "").toLowerCase()
  if (s.includes("error") || s.includes("fail")) return "failed"
  if (s.includes("complet") || s === "ok" || s === "done") return "ok"
  if (s.includes("run") || s.includes("progress")) return "running"
  if (s.includes("queue")) return "queued"
  return s || "unknown"
}

export async function loadAgentFeed(limit = 8): Promise<AgentFeedPayload> {
  const svc = getServiceRoleClient()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [latestRes, dayRes, clientsRes] = await Promise.all([
    svc
      .from("agent_invocations")
      .select(
        "id, agent_name, model, started_at, duration_ms, cost_usd, status, client_id, metadata",
      )
      .order("started_at", { ascending: false })
      .limit(limit),
    svc
      .from("agent_invocations")
      .select("id, cost_usd, started_at", { count: "exact" })
      .gte("started_at", since24h),
    svc.from("clients").select("id, name").limit(500),
  ])

  const clientNameById = new Map<string, string>()
  for (const c of clientsRes.data ?? []) {
    if (typeof c.id === "string" && typeof c.name === "string") {
      clientNameById.set(c.id, c.name)
    }
  }

  const rows: AgentFeedRow[] = (latestRes.data ?? []).map((r) => {
    const meta = (r.metadata as Record<string, unknown>) ?? {}
    const tags = resolveSpendCategory(
      {
        client_id: (r.client_id as string) ?? null,
        agent_name: (r.agent_name as string) ?? null,
        model: (r.model as string) ?? null,
        cost_usd: Number(r.cost_usd ?? 0),
        status: (r.status as string) ?? null,
        metadata: meta,
        started_at: (r.started_at as string) ?? null,
      },
      clientNameById,
    )
    return {
      id: String(r.id),
      startedAt: String(r.started_at ?? ""),
      agentName: String(r.agent_name ?? "_unknown"),
      clientLabel: tags.clientLabel,
      status: statusLabel(r.status as string | null),
      costUsd: typeof r.cost_usd === "number" ? Number(r.cost_usd) : null,
      model: (r.model as string) ?? null,
      durationMs: (r.duration_ms as number) ?? null,
      inputPreview: shorten(meta.input ?? meta.prompt ?? meta.task ?? null, 140),
      outputPreview: shorten(meta.output ?? meta.response ?? meta.result ?? null, 200),
    }
  })

  const count24h = dayRes.count ?? (dayRes.data?.length ?? 0)
  const totalCost24h = (dayRes.data ?? []).reduce(
    (s, r) => s + Number(r.cost_usd ?? 0),
    0,
  )

  return {
    rows,
    count24h,
    totalCost24h,
    generatedAt: new Date().toISOString(),
  }
}
