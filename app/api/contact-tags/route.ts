/**
 * GET    /api/contact-tags?contact_id= · list tags for a contact (or all
 *   if no filter · capped 500).
 * POST   /api/contact-tags · assign a tag to a contact ·
 *   body { contact_id, contact_type?, tag, tag_category?, source? }.
 * DELETE /api/contact-tags?id= · unassign · or
 *        /api/contact-tags?contact_id=&tag= · alternate idempotent path.
 *
 * Sprint 4 · CRM endpoints · 2026-05-20.
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CONTACT_TYPES = ["lead", "client", "champion", "partner", "vendor", "other"] as const

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
  const contactId = url.searchParams.get("contact_id")

  try {
    const supa = getServiceRoleClient()
    let q = supa
      .from("contact_tags")
      .select("id, contact_id, contact_type, tag, tag_category, source, created_by_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(500)
    if (contactId) q = q.eq("contact_id", contactId)
    const { data, error } = await q
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, tags: data ?? [] })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    )
  }
}

interface AssignBody {
  contact_id?: string
  contact_type?: string
  tag?: string
  tag_category?: string | null
  source?: string | null
}

export async function POST(req: Request) {
  const user = await requireSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })
  }
  let body: AssignBody
  try {
    body = (await req.json()) as AssignBody
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  if (!body.contact_id || !body.tag) {
    return NextResponse.json(
      { ok: false, error: "contact_id_and_tag_required" },
      { status: 400 },
    )
  }
  if (body.contact_type && !CONTACT_TYPES.includes(body.contact_type as typeof CONTACT_TYPES[number])) {
    return NextResponse.json({ ok: false, error: "invalid_contact_type" }, { status: 400 })
  }
  try {
    const supa = getServiceRoleClient()
    const { data, error } = await supa
      .from("contact_tags")
      .upsert(
        {
          contact_id: body.contact_id,
          contact_type: body.contact_type ?? "champion",
          tag: body.tag,
          tag_category: body.tag_category ?? null,
          source: body.source ?? "dashboard",
        },
        { onConflict: "contact_id,tag", ignoreDuplicates: false },
      )
      .select()
      .single()
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, tag: data }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    )
  }
}

export async function DELETE(req: Request) {
  const user = await requireSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })
  }
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  const contactId = url.searchParams.get("contact_id")
  const tag = url.searchParams.get("tag")

  if (!id && !(contactId && tag)) {
    return NextResponse.json(
      { ok: false, error: "id_or_contact_id_plus_tag_required" },
      { status: 400 },
    )
  }

  try {
    const supa = getServiceRoleClient()
    let q = supa.from("contact_tags").delete()
    if (id) q = q.eq("id", id)
    else q = q.eq("contact_id", contactId as string).eq("tag", tag as string)
    const { error, count } = await q
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, deleted: count ?? 0 })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    )
  }
}
