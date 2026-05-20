/**
 * GET /api/form-submissions · list submissions with optional ?form_id filter.
 *
 * Auth · authenticated session required.
 * Sprint 4 · forms admin UI · 2026-05-20.
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
  const formId = url.searchParams.get("form_id")
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500)
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0)

  try {
    const supa = getServiceRoleClient()
    let query = supa
      .from("form_submissions")
      .select(
        "id, form_id, contact_id, payload, source, source_event_id, signature_verified, processed_at, processing_error, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (formId) query = query.eq("form_id", formId)

    const { data: rows, error, count } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, rows: rows ?? [], total: count ?? 0 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
