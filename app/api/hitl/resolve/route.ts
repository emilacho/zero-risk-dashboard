/**
 * Mission Control · HITL resolve endpoint.
 *
 * POST /api/hitl/resolve · canon canon-canon-thin HTTP wrapper sobre
 * `lib/hitl-resolve.ts`. Lo expone como API interna del dashboard ·
 * canon canon-canon-NO autenticado por sesión Supabase (dashboard ya
 * está detrás del proxy interno) · canon-canon-acepta `x-internal-key`
 * opcional si está set en el env (defense-in-depth).
 *
 * Body shape · `{ hitl_id, decision, reviewer_id, rejection_reason? }`.
 * Response · `HitlResolveResult` (mode + ok + diagnostics).
 *
 * Spec · CHECKLIST-Phase-1-naufrago-real-mechanical.md §PASO 2.A.
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"
import {
  resolveHitlApproval,
  type HitlDecision,
  type HitlResolveInput,
} from "@/lib/hitl-resolve"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function checkInternalKey(req: Request): { ok: true } | { ok: false; reason: string } {
  const expected = process.env.INTERNAL_API_KEY
  if (!expected) return { ok: true } // canon · canon canon-no key configured = open (canon-canon-dashboard is internal-only by network)
  const got = req.headers.get("x-internal-key")
  if (got && got === expected) return { ok: true }
  return { ok: false, reason: "missing_or_invalid_x_internal_key" }
}

export async function POST(req: Request) {
  const auth = checkInternalKey(req)
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, mode: "refused", refused_reason: auth.reason },
      { status: 401 },
    )
  }

  let raw: Record<string, unknown>
  try {
    raw = (await req.json().catch(() => ({}))) as Record<string, unknown>
  } catch {
    raw = {}
  }

  const decisionStr = typeof raw.decision === "string" ? raw.decision : ""
  if (decisionStr !== "approve" && decisionStr !== "reject") {
    return NextResponse.json(
      {
        ok: false,
        mode: "refused",
        refused_reason: "validation · decision must be approve|reject",
      },
      { status: 400 },
    )
  }

  const input: HitlResolveInput = {
    hitl_id: typeof raw.hitl_id === "string" ? raw.hitl_id : "",
    decision: decisionStr as HitlDecision,
    reviewer_id:
      typeof raw.reviewer_id === "string" && raw.reviewer_id
        ? raw.reviewer_id
        : "mc-ui",
    rejection_reason:
      typeof raw.rejection_reason === "string"
        ? raw.rejection_reason
        : undefined,
  }

  let supabase
  try {
    supabase = getServiceRoleClient()
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        mode: "refused",
        refused_reason: `supabase_unavailable · ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 503 },
    )
  }

  try {
    const result = await resolveHitlApproval(input, { supabase })
    const status = result.mode === "refused" ? 400 : result.ok ? 200 : 502
    return NextResponse.json(result, { status })
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        mode: "refused",
        refused_reason: `resolve_error · ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 },
    )
  }
}

/** GET · canon canon-canonical health probe · canon-canon-no DB hit. */
export function GET() {
  return NextResponse.json({
    ok: true,
    canon: "mc-hitl-resolve",
    flags: {
      MC_HITL_RESOLVE_WIRE_ENABLED:
        process.env.MC_HITL_RESOLVE_WIRE_ENABLED ?? "unset",
      N8N_BASE_URL: process.env.N8N_BASE_URL ? "set" : "unset",
      INTERNAL_API_KEY: process.env.INTERNAL_API_KEY ? "set" : "unset",
      NEXT_PUBLIC_PLATFORM_BASE_URL:
        process.env.NEXT_PUBLIC_PLATFORM_BASE_URL ? "set" : "unset",
    },
  })
}
