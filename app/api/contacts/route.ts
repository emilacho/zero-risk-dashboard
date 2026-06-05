/**
 * GET /api/contacts · list paginated contacts (client_champions table).
 * POST /api/contacts · create a new contact.
 *
 * Auth · authenticated session required (admin role enforced via RLS on
 * client_champions · service-role bypass is intentional · this route
 * does the auth gate at the app layer).
 *
 * Sprint 4 · CRM endpoints · 2026-05-20 · single-tenant canon.
 * `client_champions` IS the canonical contacts table per Stack V4
 * (CRM replaces GHL Contacts).
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RELATIONSHIP_STRENGTHS = ["weak", "medium", "strong", "very_strong"] as const
const INFLUENCE_LEVELS = ["low", "medium", "high", "executive"] as const

interface CreateContactBody {
  client_id?: string
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

export async function GET(req: Request) {
  const user = await requireSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })
  }

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200)
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0)
  const clientId = url.searchParams.get("client_id")
  const search = url.searchParams.get("search")?.trim()
  const tagFilter = url.searchParams.get("tag")?.trim()

  try {
    const supa = getServiceRoleClient()
    let query = supa
      .from("client_champions")
      .select(
        "id, client_id, champion_name, champion_role, champion_email, champion_phone, relationship_strength, influence_level, last_contact_at, notes, metadata, created_at, updated_at",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (clientId) query = query.eq("client_id", clientId)
    if (search) {
      query = query.or(
        `champion_name.ilike.%${search}%,champion_email.ilike.%${search}%,champion_role.ilike.%${search}%`,
      )
    }

    const { data: rows, error, count } = await query
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    // Best-effort enrich with tags · single query bulk fetch
    const ids = (rows ?? []).map((r) => r.id)
    let tagsByContact: Record<string, Array<{ id: string; tag: string; tag_category: string | null }>> = {}
    if (ids.length > 0) {
      const { data: tags } = await supa
        .from("contact_tags")
        .select("id, contact_id, tag, tag_category")
        .in("contact_id", ids)
      tagsByContact = (tags ?? []).reduce(
        (acc, t) => {
          const arr = acc[t.contact_id] ?? []
          arr.push({ id: t.id, tag: t.tag, tag_category: t.tag_category })
          acc[t.contact_id] = arr
          return acc
        },
        {} as typeof tagsByContact,
      )
    }

    let enriched = (rows ?? []).map((r) => ({
      ...r,
      tags: tagsByContact[r.id] ?? [],
    }))

    if (tagFilter) {
      enriched = enriched.filter((c) => c.tags.some((t) => t.tag === tagFilter))
    }

    return NextResponse.json({
      ok: true,
      rows: enriched,
      total: count ?? enriched.length,
      limit,
      offset,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  const user = await requireSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })
  }

  let body: CreateContactBody
  try {
    body = (await req.json()) as CreateContactBody
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  if (!body.client_id || !body.champion_name) {
    return NextResponse.json(
      { ok: false, error: "client_id_and_champion_name_required" },
      { status: 400 },
    )
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

  try {
    const supa = getServiceRoleClient()
    const { data, error } = await supa
      .from("client_champions")
      .insert({
        client_id: body.client_id,
        champion_name: body.champion_name,
        champion_role: body.champion_role ?? null,
        champion_email: body.champion_email ?? null,
        champion_phone: body.champion_phone ?? null,
        relationship_strength: body.relationship_strength ?? "medium",
        influence_level: body.influence_level ?? "medium",
        last_contact_at: body.last_contact_at ?? null,
        notes: body.notes ?? null,
        metadata: body.metadata ?? {},
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, contact: data }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    )
  }
}
