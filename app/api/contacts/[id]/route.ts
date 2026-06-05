/**
 * GET    /api/contacts/[id] · single contact + relationships + tags.
 * PATCH  /api/contacts/[id] · partial update of contact fields.
 * DELETE /api/contacts/[id] · cascade-deletes tags + relationships via FK
 *   semantics at the app layer (tags table has no FK to champions ·
 *   we wipe explicitly).
 *
 * Sprint 4 · CRM endpoints · 2026-05-20.
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RELATIONSHIP_STRENGTHS = ["weak", "medium", "strong", "very_strong"] as const
const INFLUENCE_LEVELS = ["low", "medium", "high", "executive"] as const

interface PatchBody {
  champion_name?: string
  champion_role?: string | null
  champion_email?: string | null
  champion_phone?: string | null
  relationship_strength?: string
  influence_level?: string
  last_contact_at?: string | null
  notes?: string | null
  metadata?: Record<string, unknown>
}

async function requireSession() {
  const session = await getSessionClient()
  const { data } = await session.auth.getUser()
  return data?.user ?? null
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })
  }
  const { id } = await ctx.params

  try {
    const supa = getServiceRoleClient()
    const { data: contact, error } = await supa
      .from("client_champions")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    if (!contact) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }

    const [{ data: tags }, { data: relsOut }, { data: relsIn }] = await Promise.all([
      supa.from("contact_tags").select("id, tag, tag_category, source").eq("contact_id", id),
      supa
        .from("contact_relationships")
        .select("*")
        .eq("from_contact_id", id),
      supa
        .from("contact_relationships")
        .select("*")
        .eq("to_contact_id", id),
    ])

    return NextResponse.json({
      ok: true,
      contact,
      tags: tags ?? [],
      relationships: {
        outbound: relsOut ?? [],
        inbound: relsIn ?? [],
      },
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    )
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })
  }
  const { id } = await ctx.params

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  if (
    body.relationship_strength &&
    !RELATIONSHIP_STRENGTHS.includes(body.relationship_strength as typeof RELATIONSHIP_STRENGTHS[number])
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_relationship_strength" },
      { status: 400 },
    )
  }
  if (
    body.influence_level &&
    !INFLUENCE_LEVELS.includes(body.influence_level as typeof INFLUENCE_LEVELS[number])
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_influence_level" },
      { status: 400 },
    )
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of [
    "champion_name",
    "champion_role",
    "champion_email",
    "champion_phone",
    "relationship_strength",
    "influence_level",
    "last_contact_at",
    "notes",
    "metadata",
  ] as const) {
    if (k in body) patch[k] = body[k]
  }

  try {
    const supa = getServiceRoleClient()
    const { data, error } = await supa
      .from("client_champions")
      .update(patch)
      .eq("id", id)
      .select()
      .single()
    if (error) {
      const status = error.code === "PGRST116" ? 404 : 500
      return NextResponse.json({ ok: false, error: error.message }, { status })
    }
    return NextResponse.json({ ok: true, contact: data })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })
  }
  const { id } = await ctx.params

  try {
    const supa = getServiceRoleClient()
    await supa.from("contact_tags").delete().eq("contact_id", id)
    await supa.from("contact_relationships").delete().eq("from_contact_id", id)
    await supa.from("contact_relationships").delete().eq("to_contact_id", id)
    const { error } = await supa.from("client_champions").delete().eq("id", id)
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
