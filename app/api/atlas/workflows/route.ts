/**
 * GET /api/atlas/workflows · Sprint 2 dashboard scaffold.
 *
 * Returns n8n workflows summary · queries n8n Railway API directly.
 * If N8N_API_KEY is expired/missing OR n8n DB is down (frequent per
 * Brazo 3 audit · see [[2026-05-18-brazo3-path-c-pipeboard-mcp-approved]])
 * the route degrades gracefully · returns `n8n_status: 'error' | 'unauthorized'`
 * + partial data + clear flag so the dashboard renders without breaking.
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 60

interface N8nWorkflow {
  id: string
  name: string
  active: boolean
  triggerCount?: number
  nodes?: Array<{ type: string }>
  updatedAt?: string
}

interface SampleWorkflowRow {
  id: string
  name: string
  active: boolean
  trigger_type: string | null
  updated_at: string | null
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

  const apiUrl = process.env.N8N_API_URL ?? "https://n8n.zero-risk.com"
  const apiKey = process.env.N8N_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      n8n_status: "not_configured",
      warning: "N8N_API_KEY env var missing · returning empty snapshot",
      total: 0,
      active: 0,
      inactive: 0,
      by_trigger: {},
      sample_rows: [],
      generated_at: new Date().toISOString(),
    })
  }

  try {
    const res = await fetch(`${apiUrl}/api/v1/workflows?limit=200`, {
      headers: { "X-N8N-API-KEY": apiKey },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    })

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        ok: true,
        n8n_status: "unauthorized",
        warning: `n8n API returned ${res.status} · key expired or invalid`,
        total: 0,
        active: 0,
        inactive: 0,
        by_trigger: {},
        sample_rows: [],
        generated_at: new Date().toISOString(),
      })
    }

    if (!res.ok) {
      return NextResponse.json({
        ok: true,
        n8n_status: "error",
        warning: `n8n API returned ${res.status} · DB down or service unavailable`,
        total: 0,
        active: 0,
        inactive: 0,
        by_trigger: {},
        sample_rows: [],
        generated_at: new Date().toISOString(),
      })
    }

    const data = (await res.json()) as { data?: N8nWorkflow[] }
    const wfs = data.data ?? []
    const total = wfs.length
    const active = wfs.filter((w) => w.active).length
    const inactive = total - active

    const by_trigger: Record<string, number> = {}
    for (const w of wfs) {
      const triggerNode = w.nodes?.find((n) =>
        n.type?.toLowerCase().includes("trigger") ||
        n.type?.toLowerCase().includes("webhook") ||
        n.type?.toLowerCase().includes("schedule"),
      )
      const triggerKind = triggerNode?.type?.split(".").pop() ?? "unknown"
      by_trigger[triggerKind] = (by_trigger[triggerKind] ?? 0) + 1
    }

    const sample_rows: SampleWorkflowRow[] = wfs.slice(0, 10).map((w) => {
      const triggerNode = w.nodes?.find((n) =>
        n.type?.toLowerCase().includes("trigger") ||
        n.type?.toLowerCase().includes("webhook"),
      )
      return {
        id: w.id,
        name: w.name,
        active: w.active,
        trigger_type: triggerNode?.type?.split(".").pop() ?? null,
        updated_at: w.updatedAt ?? null,
      }
    })

    return NextResponse.json({
      ok: true,
      n8n_status: "live",
      total,
      active,
      inactive,
      by_trigger,
      sample_rows,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    return NextResponse.json({
      ok: true,
      n8n_status: "error",
      warning: msg,
      total: 0,
      active: 0,
      inactive: 0,
      by_trigger: {},
      sample_rows: [],
      generated_at: new Date().toISOString(),
    })
  }
}
