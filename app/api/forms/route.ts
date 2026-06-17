/**
 * GET /api/forms · list forms catalog with submissions_count per row.
 *
 * Auth · authenticated session required (admin enforced via RLS).
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
  const isActiveParam = url.searchParams.get("is_active")

  try {
    const supa = getServiceRoleClient()
    let query = supa
      .from("forms")
      .select("id, name, vertical, tally_form_id, description, schema_fields, is_active, created_at, updated_at")
      .order("created_at", { ascending: false })

    if (isActiveParam === "true") query = query.eq("is_active", true)
    if (isActiveParam === "false") query = query.eq("is_active", false)

    const { data: rows, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const ids = (rows ?? []).map((r) => r.id as string)
    const countsByForm: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: subs } = await supa
        .from("form_submissions")
        .select("form_id")
        .in("form_id", ids)
      for (const s of subs ?? []) {
        const fid = s.form_id as string
        countsByForm[fid] = (countsByForm[fid] ?? 0) + 1
      }
    }

    const enriched = (rows ?? []).map((r) => ({
      ...r,
      submissions_count: countsByForm[r.id as string] ?? 0,
    }))

    return NextResponse.json({ ok: true, rows: enriched, total: enriched.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
