/**
 * GET /api/pipeline/journeys · all active journey_executions grouped by
 * journey_state with client + last-activity enrichment.
 *
 * Sprint 4 · Pipeline kanban API · 2026-05-20.
 *
 * `journey_executions` carries the canonical state machine · only one
 * active row per client (partial unique on completed_at IS NULL). Each
 * row joined with `clients.slug/name` for card display + the most
 * recent `agent_invocations` row for "last activity" recency. We also
 * pull pending `hitl_approvals` count to surface blocked cards visually.
 *
 * Response shape · `{ ok, columns: Record<state, JourneyCard[]>, total }`
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const JOURNEY_STATES = [
  "discovery",
  "onboarding",
  "content",
  "optimizing",
  "reporting",
  "renewal",
  "churned",
] as const

type JourneyState = (typeof JOURNEY_STATES)[number]

async function requireSession() {
  const session = await getSessionClient()
  const { data } = await session.auth.getUser()
  return data?.user ?? null
}

export async function GET(req: Request) {
  const user = await requireSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })
  }

  const url = new URL(req.url)
  const includeChurned = url.searchParams.get("include_churned") === "1"
  const clientId = url.searchParams.get("client_id")

  try {
    const supa = getServiceRoleClient()
    let q = supa
      .from("journey_executions")
      .select(
        "id, client_id, journey_state, stage, started_at, last_activity_at, current_step, total_steps, agent_outputs, metadata",
      )
      .order("last_activity_at", { ascending: false })
      .limit(500)
    if (!includeChurned) q = q.neq("journey_state", "churned")
    if (clientId) q = q.eq("client_id", clientId)
    const { data: journeys, error } = await q
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const clientIds = Array.from(new Set((journeys ?? []).map((j) => j.client_id)))
    let clientsById: Record<string, { id: string; slug: string; name: string }> = {}
    if (clientIds.length > 0) {
      const { data: clients } = await supa
        .from("clients")
        .select("id, slug, name")
        .in("id", clientIds)
      clientsById = (clients ?? []).reduce(
        (acc, c) => {
          acc[c.id] = c
          return acc
        },
        {} as typeof clientsById,
      )
    }

    let hitlByClient: Record<string, number> = {}
    if (clientIds.length > 0) {
      const { data: hitls } = await supa
        .from("hitl_approvals")
        .select("client_id, status")
        .in("client_id", clientIds)
        .eq("status", "pending")
      hitlByClient = (hitls ?? []).reduce(
        (acc, h) => {
          acc[h.client_id] = (acc[h.client_id] ?? 0) + 1
          return acc
        },
        {} as typeof hitlByClient,
      )
    }

    const columns: Record<JourneyState, Array<Record<string, unknown>>> = {
      discovery: [],
      onboarding: [],
      content: [],
      optimizing: [],
      reporting: [],
      renewal: [],
      churned: [],
    }

    for (const j of journeys ?? []) {
      const c = clientsById[j.client_id]
      const card = {
        id: j.id,
        client_id: j.client_id,
        client_slug: c?.slug ?? null,
        client_name: c?.name ?? "—",
        journey_state: j.journey_state,
        stage: j.stage,
        started_at: j.started_at,
        last_activity_at: j.last_activity_at,
        current_step: j.current_step,
        total_steps: j.total_steps,
        pending_hitl: hitlByClient[j.client_id] ?? 0,
        metadata: j.metadata,
      }
      const state = j.journey_state as JourneyState
      if (columns[state]) {
        columns[state].push(card)
      }
    }

    return NextResponse.json({
      ok: true,
      columns,
      total: (journeys ?? []).length,
      states: includeChurned ? JOURNEY_STATES : JOURNEY_STATES.filter((s) => s !== "churned"),
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    )
  }
}
