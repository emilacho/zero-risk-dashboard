/**
 * POST /api/pipeline/journeys/[id]/move · transition a journey to a new state.
 *
 * Body · { to_state: JourneyState, stage?: string, notes?: string }
 * Validation · DB check constraint enforces journey_state ∈ enum · we
 * pre-validate before update for friendlier errors.
 *
 * Side effects · updates `last_activity_at` to NOW · appends a row to
 * `journey_step_executions` if the table exists (best-effort · this
 * table may or may not be present depending on PR #56 scope).
 *
 * Sprint 4 · Pipeline kanban API · 2026-05-20.
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { JOURNEY_STATES } from "../../route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface MoveBody {
  to_state?: string
  stage?: string | null
  notes?: string | null
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
  if (!body.to_state) {
    return NextResponse.json({ ok: false, error: "to_state_required" }, { status: 400 })
  }
  if (!JOURNEY_STATES.includes(body.to_state as (typeof JOURNEY_STATES)[number])) {
    return NextResponse.json(
      { ok: false, error: `invalid_state · allowed ${JOURNEY_STATES.join(",")}` },
      { status: 400 },
    )
  }

  try {
    const supa = getServiceRoleClient()
    const { data: current, error: getErr } = await supa
      .from("journey_executions")
      .select("id, client_id, journey_state, current_step, total_steps")
      .eq("id", id)
      .maybeSingle()
    if (getErr) {
      return NextResponse.json({ ok: false, error: getErr.message }, { status: 500 })
    }
    if (!current) {
      return NextResponse.json({ ok: false, error: "journey_not_found" }, { status: 404 })
    }
    if (current.journey_state === body.to_state) {
      return NextResponse.json({
        ok: true,
        noop: true,
        journey: current,
        reason: "already_in_state",
      })
    }

    const nowIso = new Date().toISOString()
    const patch: Record<string, unknown> = {
      journey_state: body.to_state,
      last_activity_at: nowIso,
    }
    if (body.stage !== undefined) patch.stage = body.stage
    if (body.to_state === "churned") patch.completed_at = nowIso

    const { data: updated, error: updErr } = await supa
      .from("journey_executions")
      .update(patch)
      .eq("id", id)
      .select()
      .single()
    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })
    }

    // Best-effort transition log · table may not exist · ignore.
    try {
      await supa.from("journey_step_executions").insert({
        journey_execution_id: id,
        from_state: current.journey_state,
        to_state: body.to_state,
        stage: body.stage ?? null,
        notes: body.notes ?? null,
        actor: user.email ?? user.id,
        created_at: nowIso,
      })
    } catch {
      // Audit table absent · transition still committed in journey_executions.
    }

    return NextResponse.json({ ok: true, journey: updated })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    )
  }
}
