/**
 * POST /api/pipeline/journeys/[id]/move · transition a journey row's
 * column via the kanban UI.
 *
 * Sprint 5 D1 · refactored to write to `client_journey_state` (the L1
 * canonical table per decision doc 2026-05-21). Move semantic ·
 * 'discovery' / 'onboarding' columns update `journey=ONBOARD` + adjust
 * `current_stage`; other columns map to the matching `journey` value
 * ('content' → CONTENT, etc).
 *
 * Side effects ·
 *   - UPDATE `journey` + `current_stage` + `updated_at`
 *   - If target column maps to a terminal state ('completed' future),
 *     also set `completed_at = now()`
 *   - Insert into `journey_step_executions` for audit (best-effort)
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { KANBAN_COLUMNS, type KanbanColumn } from "../../route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface MoveBody {
  to_column?: string
  /** Backwards-compat alias from Sprint 4 · `to_state` is also accepted. */
  to_state?: string
  stage?: string | null
  notes?: string | null
}

const COLUMN_TO_JOURNEY: Record<KanbanColumn, string> = {
  discovery: "ONBOARD",
  onboarding: "ONBOARD",
  content: "CONTENT",
  optimizing: "OPTIMIZE",
  reporting: "REPORT",
  renewal: "RENEWAL",
}

const COLUMN_TO_DEFAULT_STAGE: Record<KanbanColumn, string | null> = {
  discovery: "discovery",
  onboarding: "send_intake_form",
  content: "content_brief",
  optimizing: "optimization_review",
  reporting: "report_compile",
  renewal: "renewal_negotiation",
}

async function requireSession() {
  const session = await getSessionClient()
  const { data } = await session.auth.getUser()
  return data?.user ?? null
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })
  }
  const { id } = await ctx.params

  let body: MoveBody
  try {
    body = (await req.json()) as MoveBody
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  const targetColumn = (body.to_column ?? body.to_state ?? "") as KanbanColumn
  if (!targetColumn) {
    return NextResponse.json(
      { ok: false, error: "to_column_required" },
      { status: 400 },
    )
  }
  if (!KANBAN_COLUMNS.includes(targetColumn)) {
    return NextResponse.json(
      { ok: false, error: `invalid_column · allowed ${KANBAN_COLUMNS.join(",")}` },
      { status: 400 },
    )
  }

  try {
    const supa = getServiceRoleClient()
    const { data: current, error: getErr } = await supa
      .from("client_journey_state")
      .select("id, client_id, journey, current_stage, status")
      .eq("id", id)
      .maybeSingle()
    if (getErr) {
      return NextResponse.json({ ok: false, error: getErr.message }, { status: 500 })
    }
    if (!current) {
      return NextResponse.json({ ok: false, error: "journey_not_found" }, { status: 404 })
    }

    const targetJourney = COLUMN_TO_JOURNEY[targetColumn]
    const targetStage = body.stage ?? COLUMN_TO_DEFAULT_STAGE[targetColumn]

    if (current.journey === targetJourney && current.current_stage === targetStage) {
      return NextResponse.json({
        ok: true,
        noop: true,
        journey: current,
        reason: "already_in_target_state",
      })
    }

    const nowIso = new Date().toISOString()
    const { data: updated, error: updErr } = await supa
      .from("client_journey_state")
      .update({
        journey: targetJourney,
        current_stage: targetStage,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select()
      .single()
    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })
    }

    // Best-effort audit · table may not exist, so we catch + continue.
    try {
      await supa.from("journey_step_executions").insert({
        journey_execution_id: id,
        from_state: `${current.journey}:${current.current_stage ?? ""}`,
        to_state: `${targetJourney}:${targetStage ?? ""}`,
        stage: targetStage,
        notes: body.notes ?? null,
        actor: user.email ?? user.id,
        created_at: nowIso,
      })
    } catch {
      // Audit table absent · transition still committed in client_journey_state.
    }

    return NextResponse.json({ ok: true, journey: updated })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    )
  }
}
