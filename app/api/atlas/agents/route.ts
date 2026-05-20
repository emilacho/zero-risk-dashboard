/**
 * GET /api/atlas/agents · Sprint 2 dashboard scaffold.
 *
 * Returns agent registry summary · Tier 1 ground truth from Supabase
 * `agents` table joined with `agent_invocations` for 30d activity. CC#4
 * consumes via `useAtlasAgents()` hook to render the agent grid section
 * of the ZeroRiskBible v2 dashboard.
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 60

interface AgentRow {
  name: string
  default_model: string | null
  identity_source: string | null
  identity_chars: number
  updated_at: string | null
  executions_30d: number
  last_run_at: string | null
}

interface AgentInvocationRow {
  agent_name: string
  created_at: string
}

export async function GET() {
  const session = await getSessionClient()
  const { data: userRes } = await session.auth.getUser()
  if (!userRes?.user) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    )
  }

  try {
    const supa = getServiceRoleClient()

    const { data: agents, error: agentsErr } = await supa
      .from("agents")
      .select("name, default_model, identity_source, identity_content, updated_at")
      .order("name")

    if (agentsErr) {
      return NextResponse.json(
        { ok: false, error: agentsErr.message },
        { status: 500 },
      )
    }

    const sinceIso = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const { data: invocations } = await supa
      .from("agent_invocations")
      .select("agent_name, created_at")
      .gte("created_at", sinceIso)

    const execMap = new Map<string, { count: number; last: string | null }>()
    for (const inv of (invocations as AgentInvocationRow[] | null) || []) {
      const prev = execMap.get(inv.agent_name) ?? { count: 0, last: null }
      prev.count += 1
      if (!prev.last || inv.created_at > prev.last) prev.last = inv.created_at
      execMap.set(inv.agent_name, prev)
    }

    const rows: AgentRow[] = (agents || []).map((a) => {
      const stats = execMap.get(a.name) ?? { count: 0, last: null }
      return {
        name: a.name,
        default_model: a.default_model ?? null,
        identity_source: a.identity_source ?? null,
        identity_chars: a.identity_content?.length ?? 0,
        updated_at: a.updated_at ?? null,
        executions_30d: stats.count,
        last_run_at: stats.last,
      }
    })

    const total = rows.length
    const with_canonical = rows.filter((r) =>
      r.identity_source?.includes("canonical"),
    ).length
    const with_project_local = rows.filter((r) =>
      r.identity_source?.includes("project-local"),
    ).length
    const with_executions_30d = rows.filter((r) => r.executions_30d > 0).length
    const dormant_count = total - with_executions_30d

    const by_model: Record<string, number> = {}
    for (const r of rows) {
      const key = r.default_model ?? "unknown"
      by_model[key] = (by_model[key] ?? 0) + 1
    }

    return NextResponse.json({
      ok: true,
      total,
      with_canonical,
      with_project_local,
      by_model,
      with_executions_30d,
      dormant_count,
      rows,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
