/**
 * GET    /api/landings/[slug] · landing detail
 * PATCH  /api/landings/[slug] · update (sections jsonb + flat fields)
 * DELETE /api/landings/[slug] · soft delete (is_active=false)
 *
 * Sprint 4 · landings admin UI · 2026-05-20.
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/

async function requireSession() {
  const session = await getSessionClient()
  const { data } = await session.auth.getUser()
  return data?.user ?? null
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const user = await requireSession()
  if (!user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })

  const slug = params.slug.toLowerCase()
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 })
  }

  try {
    const supa = getServiceRoleClient()
    const { data, error } = await supa.from("landings").select("*").eq("slug", slug).maybeSingle()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    return NextResponse.json({ ok: true, landing: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const user = await requireSession()
  if (!user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })

  const slug = params.slug.toLowerCase()
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === "string") update.title = body.title.trim()
  if (typeof body.hero_headline === "string") update.hero_headline = body.hero_headline.trim()
  if (typeof body.hero_subhead === "string" || body.hero_subhead === null) update.hero_subhead = body.hero_subhead
  if (typeof body.cta_text === "string") update.cta_text = body.cta_text
  if (typeof body.cta_url === "string") update.cta_url = body.cta_url
  if (Array.isArray(body.sections)) update.sections = body.sections
  if (typeof body.meta_description === "string" || body.meta_description === null) update.meta_description = body.meta_description
  if (typeof body.vertical === "string" || body.vertical === null) update.vertical = body.vertical
  if (typeof body.is_active === "boolean") update.is_active = body.is_active

  try {
    const supa = getServiceRoleClient()
    const { data, error } = await supa
      .from("landings")
      .update(update)
      .eq("slug", slug)
      .select()
      .maybeSingle()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    return NextResponse.json({ ok: true, landing: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { slug: string } }) {
  const user = await requireSession()
  if (!user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })

  const slug = params.slug.toLowerCase()
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 })
  }

  try {
    const supa = getServiceRoleClient()
    const { data, error } = await supa
      .from("landings")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("slug", slug)
      .select()
      .maybeSingle()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    return NextResponse.json({ ok: true, deactivated: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
