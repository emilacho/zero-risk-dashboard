/**
 * GET    /api/contact-relationships?contact_id= · all edges touching the contact.
 * POST   /api/contact-relationships · create a directional edge.
 * DELETE /api/contact-relationships?id= · remove an edge.
 *
 * Sprint 4 · CRM endpoints · 2026-05-20.
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RELATIONSHIP_TYPES = [
  "reports_to",
  "colleague",
  "referred_by",
  "referred",
  "partner_of",
  "vendor_of",
  "customer_of",
  "same_company",
  "spouse",
  "family",
  "other",
] as const

const STRENGTHS = ["weak", "medium", "strong"] as const

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
      .from("contact_relationships")
      .select("*")
      .order("established_at", { ascending: false })
      .limit(200)
    if (contactId) {
      q = q.or(`from_contact_id.eq.${contactId},to_contact_id.eq.${contactId}`)
    }
    const { data, error } = await q
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, relationships: data ?? [] })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    )
  }
}

interface CreateRelBody {
  from_contact_id?: string
  from_contact_type?: string
  to_contact_id?: string
  to_contact_type?: string
  relationship_type?: string
  strength?: string
  notes?: string | null
  established_at?: string | null
}

export async function POST(req: Request) {
  const user = await requireSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })
  }
  let body: CreateRelBody
  try {
    body = (await req.json()) as CreateRelBody
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  if (!body.from_contact_id || !body.to_contact_id || !body.relationship_type) {
    return NextResponse.json(
      { ok: false, error: "from_to_and_relationship_type_required" },
      { status: 400 },
    )
  }
  if (body.from_contact_id === body.to_contact_id) {
    return NextResponse.json({ ok: false, error: "self_relationship_not_allowed" }, { status: 400 })
  }
  if (!RELATIONSHIP_TYPES.includes(body.relationship_type as typeof RELATIONSHIP_TYPES[number])) {
    return NextResponse.json({ ok: false, error: "invalid_relationship_type" }, { status: 400 })
  }
  if (body.strength && !STRENGTHS.includes(body.strength as typeof STRENGTHS[number])) {
    return NextResponse.json({ ok: false, error: "invalid_strength" }, { status: 400 })
  }

  try {
    const supa = getServiceRoleClient()
    const { data, error } = await supa
      .from("contact_relationships")
      .insert({
        from_contact_id: body.from_contact_id,
        from_contact_type: body.from_contact_type ?? "champion",
        to_contact_id: body.to_contact_id,
        to_contact_type: body.to_contact_type ?? "champion",
        relationship_type: body.relationship_type,
        strength: body.strength ?? "medium",
        notes: body.notes ?? null,
        established_at: body.established_at ?? new Date().toISOString(),
      })
      .select()
      .single()
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, relationship: data }, { status: 201 })
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
  if (!id) {
    return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 })
  }
  try {
    const supa = getServiceRoleClient()
    const { error } = await supa.from("contact_relationships").delete().eq("id", id)
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    )
  }
}
