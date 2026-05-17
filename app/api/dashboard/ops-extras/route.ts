/**
 * GET /api/dashboard/ops-extras
 *
 * Aggregates operational metrics that the platform `/api/dashboard/metrics`
 * does NOT expose · used by the Phase 3 8-card KPI grid.
 *
 * Returns:
 *   invocations_24h          · count from agent_invocations
 *   cascade_success_rate     · % of invocations with status='completed' in 30d
 *   pending_hitl             · count from hitl_approvals if table exists, else null
 *   tokens_24h               · sum(tokens_input + tokens_output) past 24h
 *   tokens_30d               · same · 30d window
 *   spend_by_provider_30d    · { anthropic: $, openai: $, other: $ } · estimated
 *
 * Best-effort · each block fails independently so a missing table never
 * breaks the whole response. Returns null for missing values.
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface ExtrasResponse {
  ok: boolean
  invocations_24h: number | null
  invocations_30d: number | null
  cascade_success_rate: number | null
  pending_hitl: number | null
  active_clients: number | null
  tokens_24h: number | null
  tokens_30d: number | null
  spend_by_provider_30d: {
    anthropic: number | null
    openai: number | null
    other: number | null
  }
  timestamp: string
}

export async function GET() {
  const supa = getServiceRoleClient()
  const now = new Date()
  const t24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const t30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const out: ExtrasResponse = {
    ok: true,
    invocations_24h: null,
    invocations_30d: null,
    cascade_success_rate: null,
    pending_hitl: null,
    active_clients: null,
    tokens_24h: null,
    tokens_30d: null,
    spend_by_provider_30d: { anthropic: null, openai: null, other: null },
    timestamp: now.toISOString(),
  }

  // Active clients · archived_at IS NULL · Sprint 6 cleanup
  try {
    const { count: ac } = await supa
      .from("clients")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
    out.active_clients = ac ?? null
  } catch {
    out.active_clients = null
  }

  // Invocations 24h count
  const { count: c24, error: e1 } = await supa
    .from("agent_invocations")
    .select("id", { count: "exact", head: true })
    .gte("started_at", t24h)
  if (!e1) out.invocations_24h = c24 ?? 0

  // Invocations 30d count + status breakdown for cascade success rate
  const { data: rows30, error: e2 } = await supa
    .from("agent_invocations")
    .select("status, tokens_input, tokens_output, cost_usd, model, started_at")
    .gte("started_at", t30d)
  if (!e2 && rows30) {
    out.invocations_30d = rows30.length
    const total = rows30.length
    const completed = rows30.filter((r) => r.status === "completed").length
    out.cascade_success_rate = total > 0 ? +(completed / total * 100).toFixed(1) : null

    let t30dSum = 0
    let t24hSum = 0
    let anthropicSpend = 0
    let openaiSpend = 0
    let otherSpend = 0
    for (const r of rows30) {
      const ti = (r.tokens_input as number) ?? 0
      const to = (r.tokens_output as number) ?? 0
      const tt = ti + to
      t30dSum += tt
      if (r.started_at && new Date(r.started_at as string).getTime() >= now.getTime() - 24 * 60 * 60 * 1000) {
        t24hSum += tt
      }
      const cost = (r.cost_usd as number) ?? 0
      const model = ((r.model as string) ?? "").toLowerCase()
      if (model.startsWith("claude") || model.includes("anthropic")) anthropicSpend += cost
      else if (model.startsWith("gpt") || model.includes("openai")) openaiSpend += cost
      else otherSpend += cost
    }
    out.tokens_24h = t24hSum
    out.tokens_30d = t30dSum
    out.spend_by_provider_30d = {
      anthropic: +anthropicSpend.toFixed(3),
      openai: +openaiSpend.toFixed(3),
      other: +otherSpend.toFixed(3),
    }
  }

  // HITL approvals · table may or may not exist · soft-fail
  try {
    const { count: hitl } = await supa
      .from("hitl_approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
    out.pending_hitl = hitl ?? 0
  } catch {
    out.pending_hitl = null
  }

  return NextResponse.json(out)
}
