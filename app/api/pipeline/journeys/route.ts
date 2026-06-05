/**
 * GET /api/pipeline/journeys · pipeline kanban data source.
 *
 * Sprint 5 D1 · 2026-05-21 · refactored to consume `client_journey_state`
 * (the table L1 Master Journey Orchestrator actually writes to per
 * `src/lib/journey-orchestrator/dispatch.ts`) instead of the empty
 * `journey_executions` table that no one writes. Decision doc ·
 * `pipeline-canonical-table-client-journey-state` 2026-05-21.
 *
 * Response shape · `{ ok, columns: Record<column, JourneyCard[]>, total }`
 *
 * Column strategy · since `client_journey_state` has fields
 * `journey` (ONBOARD · CONTENT · OPTIMIZE · REPORT · RENEWAL) + `status`
 * (active · paused · completed · failed) + `current_stage` (free-form
 * text), we map rows into 6 canonical kanban columns ·
 *   - discovery  · journey=ONBOARD AND (current_stage IS NULL OR LIKE 'discov%')
 *   - onboarding · journey=ONBOARD AND (other stages)
 *   - content    · journey=CONTENT
 *   - optimizing · journey=OPTIMIZE
 *   - reporting  · journey=REPORT
 *   - renewal    · journey=RENEWAL
 * Anything outside this set falls into `onboarding` as the catch-all
 * (debug pretty-printed in metadata.unmapped_journey).
 *
 * Status filters · default excludes `completed` + `failed` (kanban shows
 * IN-FLIGHT). `?include_completed=1` opts in.
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const KANBAN_COLUMNS = [
  "discovery",
  "onboarding",
  "content",
  "optimizing",
  "reporting",
  "renewal",
] as const

export type KanbanColumn = (typeof KANBAN_COLUMNS)[number]

interface ClientJourneyStateRow {
  id: string
  client_id: string
  journey: string
  current_stage: string | null
  status: string
  trigger_type: string | null
  trigger_source: string | null
  hitl_pending_count: number | null
  started_at: string
  updated_at: string
  completed_at: string | null
  metadata: Record<string, unknown> | null
}

export function mapToColumn(
  journey: string,
  currentStage: string | null,
): KanbanColumn {
  const j = (journey ?? "").toUpperCase()
  const stage = (currentStage ?? "").toLowerCase()
  if (j === "ONBOARD") {
    if (!stage || stage.startsWith("discov") || stage.startsWith("auto_discovery")) {
      return "discovery"
    }
    return "onboarding"
  }
  if (j === "CONTENT") return "content"
  if (j === "OPTIMIZE" || j === "OPTIMIZING") return "optimizing"
  if (j === "REPORT" || j === "REPORTING") return "reporting"
  if (j === "RENEWAL") return "renewal"
  return "onboarding"
}

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
  const includeCompleted = url.searchParams.get("include_completed") === "1"
  const clientId = url.searchParams.get("client_id")

  try {
    const supa = getServiceRoleClient()
    let q = supa
      .from("client_journey_state")
      .select(
        "id, client_id, journey, current_stage, status, trigger_type, trigger_source, hitl_pending_count, started_at, updated_at, completed_at, metadata",
      )
      .order("updated_at", { ascending: false })
      .limit(500)
    if (!includeCompleted) q = q.in("status", ["active", "paused"])
    if (clientId) q = q.eq("client_id", clientId)
    const { data: rows, error } = await q
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const clientIds = Array.from(
      new Set((rows ?? []).map((r) => (r as ClientJourneyStateRow).client_id)),
    )
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

    const columns: Record<KanbanColumn, Array<Record<string, unknown>>> = {
      discovery: [],
      onboarding: [],
      content: [],
      optimizing: [],
      reporting: [],
      renewal: [],
    }

    for (const raw of rows ?? []) {
      const r = raw as ClientJourneyStateRow
      const c = clientsById[r.client_id]
      const column = mapToColumn(r.journey, r.current_stage)
      columns[column].push({
        id: r.id,
        client_id: r.client_id,
        client_slug: c?.slug ?? null,
        client_name: c?.name ?? "—",
        journey: r.journey,
        current_stage: r.current_stage,
        status: r.status,
        trigger_type: r.trigger_type,
        trigger_source: r.trigger_source,
        pending_hitl: r.hitl_pending_count ?? 0,
        started_at: r.started_at,
        last_activity_at: r.updated_at,
        completed_at: r.completed_at,
        column,
      })
    }

    return NextResponse.json({
      ok: true,
      columns,
      total: (rows ?? []).length,
      states: KANBAN_COLUMNS,
      source_table: "client_journey_state",
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    )
  }
}
