/**
 * GET /api/workflows/executions?workflowId=...&status=running|success|error&limit=20
 *
 * Server-side proxy to n8n's `/api/v1/executions` so the dashboard
 * client never sees `N8N_API_KEY`. Caches at the edge with no-store
 * for live polling · the client decides cadence.
 *
 * Auth · admin session OR INTERNAL_API_KEY (for monitoring crons).
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface ExecutionRow {
  id: string
  workflowId: string
  startedAt: string
  stoppedAt: string | null
  status?: string
  finished: boolean
  mode?: string
}

export async function GET(req: Request) {
  // Auth · admin OR internal key
  const internalKey = req.headers.get("x-internal-api-key")
  const expectedKey = process.env.INTERNAL_API_KEY
  if (!internalKey || internalKey !== expectedKey) {
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
      return NextResponse.json(
        { ok: false, error: "forbidden · admin required" },
        { status: 403 },
      )
    }
  }

  const url = new URL(req.url)
  const workflowId = url.searchParams.get("workflowId")
  const status = url.searchParams.get("status") // running | success | error
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100)

  const base = process.env.N8N_BASE_URL
  const key = process.env.N8N_API_KEY
  if (!base || !key) {
    return NextResponse.json(
      { ok: false, error: "n8n envs missing" },
      { status: 500 },
    )
  }

  const params = new URLSearchParams()
  params.set("limit", String(limit))
  if (workflowId) params.set("workflowId", workflowId)
  if (status) params.set("status", status)

  try {
    const res = await fetch(
      `${base.replace(/\/+$/, "")}/api/v1/executions?${params.toString()}`,
      {
        headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
        cache: "no-store",
      },
    )
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `n8n ${res.status} ${res.statusText}` },
        { status: 502 },
      )
    }
    const json = (await res.json()) as { data?: ExecutionRow[] }
    return NextResponse.json({
      ok: true,
      count: json.data?.length ?? 0,
      executions: json.data ?? [],
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch_failed" },
      { status: 502 },
    )
  }
}
