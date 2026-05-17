/**
 * GET /api/workflows/running
 *
 * Aggregator · returns the set of workflows that have at least one
 * `status=running` execution right now, with names + last activity.
 * Used by the home page "Workflows ejecutándose ahora" KPI + modal.
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RunningRow {
  workflowId: string
  workflowName: string
  executionId: string
  startedAt: string
}

export async function GET(req: Request) {
  // Admin auth
  const supa = await getSessionClient()
  const { data: userRes } = await supa.auth.getUser()
  if (!userRes?.user) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    )
  }
  const { data: roleRow } = await supa
    .from("app_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .maybeSingle()
  if (roleRow?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
  }
  void req

  const base = process.env.N8N_BASE_URL
  const key = process.env.N8N_API_KEY
  if (!base || !key) {
    return NextResponse.json(
      { ok: true, count: 0, running: [] as RunningRow[], note: "n8n envs missing" },
    )
  }

  try {
    const [execRes, wfRes] = await Promise.all([
      fetch(`${base.replace(/\/+$/, "")}/api/v1/executions?status=running&limit=50`, {
        headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
        cache: "no-store",
      }),
      fetch(`${base.replace(/\/+$/, "")}/api/v1/workflows?limit=250`, {
        headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
        cache: "no-store",
      }),
    ])
    if (!execRes.ok || !wfRes.ok) {
      return NextResponse.json(
        { ok: false, error: "n8n proxy failed" },
        { status: 502 },
      )
    }
    const execJson = (await execRes.json()) as {
      data?: Array<{ id: string; workflowId: string; startedAt: string }>
    }
    const wfJson = (await wfRes.json()) as {
      data?: Array<{ id: string; name: string }>
    }
    const wfNameById = new Map(
      (wfJson.data ?? []).map((w) => [w.id, w.name ?? ""]),
    )
    const rows: RunningRow[] = (execJson.data ?? []).map((e) => ({
      workflowId: e.workflowId,
      workflowName: wfNameById.get(e.workflowId) ?? "(unknown)",
      executionId: e.id,
      startedAt: e.startedAt,
    }))
    return NextResponse.json({
      ok: true,
      count: rows.length,
      running: rows,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch_failed" },
      { status: 502 },
    )
  }
}
