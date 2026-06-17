/**
 * GET /api/landings · list landings.
 * Sprint 4 · landings admin UI · 2026-05-20.
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
  if (!user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })

  const url = new URL(req.url)
  const isActiveParam = url.searchParams.get("is_active")
  const vertical = url.searchParams.get("vertical")

  try {
    const supa = getServiceRoleClient()
    let query = supa
      .from("landings")
      .select(
        "id, slug, client_id, title, hero_headline, hero_subhead, hero_image_url, cta_text, cta_url, sections, meta_description, meta_og_image_url, is_active, vertical, created_at, updated_at",
      )
      .order("created_at", { ascending: false })

    if (isActiveParam === "true") query = query.eq("is_active", true)
    if (isActiveParam === "false") query = query.eq("is_active", false)
    if (vertical) query = query.eq("vertical", vertical)

    const { data: rows, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, rows: rows ?? [], total: (rows ?? []).length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
