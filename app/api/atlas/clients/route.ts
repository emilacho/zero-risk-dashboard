/**
 * GET /api/atlas/clients · Sprint 2 dashboard scaffold.
 *
 * Returns clients summary from Supabase · joins client_journey_state
 * + counts agent_invocations per client. Three buckets:
 *   - active_real · has executions in last 30d
 *   - smoke_with_data · onboarding row exists but no recent activity
 *   - smoke_empty · stub rows without any data populated
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 60

interface ClientRow {
  id: string
  name: string
  vertical: string | null
  journey_status: string | null
  archived_at: string | null
  invocations_30d: number
  last_activity_at: string | null
}

interface ClientDbRow {
  id: string
  name: string
  vertical?: string | null
  industry?: string | null
  archived_at?: string | null
}

interface JourneyStateRow {
  client_id: string
  status: string
}

interface InvocationRow {
  client_id: string
  created_at: string
}

export async function GET() {
  try {
    const supa = getServiceRoleClient()

    const { data: clients, error: clientsErr } = await supa
      .from("clients")
      .select("id, name, vertical, industry, archived_at")
      .is("archived_at", null)
      .order("name")

    if (clientsErr) {
      return NextResponse.json(
        { ok: false, error: clientsErr.message },
        { status: 500 },
      )
    }

    const ids = ((clients as ClientDbRow[]) || []).map((c) => c.id)
    const journeyMap = new Map<string, string>()
    if (ids.length > 0) {
      const { data: journeys } = await supa
        .from("client_journey_state")
        .select("client_id, status")
        .in("client_id", ids)
      for (const j of (journeys as JourneyStateRow[] | null) || []) {
        journeyMap.set(j.client_id, j.status)
      }
    }

    const sinceIso = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const invMap = new Map<string, { count: number; last: string | null }>()
    if (ids.length > 0) {
      const { data: invs } = await supa
        .from("agent_invocations")
        .select("client_id, created_at")
        .in("client_id", ids)
        .gte("created_at", sinceIso)
      for (const inv of (invs as InvocationRow[] | null) || []) {
        if (!inv.client_id) continue
        const prev = invMap.get(inv.client_id) ?? { count: 0, last: null }
        prev.count += 1
        if (!prev.last || inv.created_at > prev.last) prev.last = inv.created_at
        invMap.set(inv.client_id, prev)
      }
    }

    const rows: ClientRow[] = ((clients as ClientDbRow[]) || []).map((c) => {
      const stats = invMap.get(c.id) ?? { count: 0, last: null }
      return {
        id: c.id,
        name: c.name,
        vertical: c.vertical ?? c.industry ?? null,
        journey_status: journeyMap.get(c.id) ?? null,
        archived_at: c.archived_at ?? null,
        invocations_30d: stats.count,
        last_activity_at: stats.last,
      }
    })

    const active_real = rows.filter((r) => r.invocations_30d > 0).length
    const smoke_with_data = rows.filter(
      (r) => r.invocations_30d === 0 && r.journey_status !== null,
    ).length
    const smoke_empty = rows.filter(
      (r) => r.invocations_30d === 0 && r.journey_status === null,
    ).length

    return NextResponse.json({
      ok: true,
      total: rows.length,
      active_real,
      smoke_with_data,
      smoke_empty,
      rows,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
