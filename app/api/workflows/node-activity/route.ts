/**
 * GET /api/workflows/node-activity?workflowId=...&nodeName=...&nodeType=...&limit=20
 *
 * Returns recent activity for a single node within a workflow:
 *   - For n8n native nodes (httpRequest · function · slack · etc) ·
 *     queries n8n /api/v1/executions filtered by workflowId · returns
 *     execution rows + (when available) the node's own runData slice.
 *   - For AI agent nodes (runSdk · custom AI-call nodes) · ALSO queries
 *     Supabase `agent_invocations` table filtered by metadata payload
 *     OR by agent_name matching the node label.
 *
 * Admin-only. v1 returns the simpler shape · per-node runData drill
 * requires a second hit to `/api/v1/executions/{id}` which v1.1
 * follow-up can add (the `details` link on each row.)
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface NodeActivityRow {
  id: string
  source: "n8n" | "agent_invocations"
  status: string
  startedAt: string
  durationMs: number | null
  costUsd: number | null
  tokensIn: number | null
  tokensOut: number | null
  model: string | null
  agentName: string | null
  clientId: string | null
  inputPreview: string | null
  outputPreview: string | null
  errorMessage: string | null
  rawRef: string | null
}

function shorten(s: unknown, limit = 200): string | null {
  if (s == null) return null
  const str = typeof s === "string" ? s : JSON.stringify(s)
  if (!str) return null
  return str.length > limit ? str.slice(0, limit) + "…" : str
}

export async function GET(req: Request) {
  // Admin auth · same gate as other workflow endpoints
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

  const url = new URL(req.url)
  const workflowId = url.searchParams.get("workflowId")
  const nodeName = url.searchParams.get("nodeName")
  const nodeType = url.searchParams.get("nodeType") ?? ""
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50)

  if (!workflowId || !nodeName) {
    return NextResponse.json(
      { ok: false, error: "workflowId + nodeName required" },
      { status: 400 },
    )
  }

  const rows: NodeActivityRow[] = []

  // ── 1. AI agent invocations · matches when node looks like an agent call
  const isAgentNode =
    /sdk|claude|anthropic|agent|ai/i.test(nodeType) ||
    /agent|sdk|claude/i.test(nodeName)
  if (isAgentNode) {
    try {
      const svc = getServiceRoleClient()
      const { data } = await svc
        .from("agent_invocations")
        .select(
          "id, agent_id, agent_name, model, started_at, ended_at, duration_ms, cost_usd, tokens_input, tokens_output, status, client_id, metadata",
        )
        .ilike("agent_name", `%${nodeName.replace(/[%_]/g, "")}%`)
        .order("started_at", { ascending: false })
        .limit(limit)
      for (const r of data ?? []) {
        const meta = (r.metadata as Record<string, unknown>) ?? {}
        rows.push({
          id: r.id as string,
          source: "agent_invocations",
          status: (r.status as string) ?? "unknown",
          startedAt: (r.started_at as string) ?? "",
          durationMs: (r.duration_ms as number) ?? null,
          costUsd: (r.cost_usd as number) ?? null,
          tokensIn: (r.tokens_input as number) ?? null,
          tokensOut: (r.tokens_output as number) ?? null,
          model: (r.model as string) ?? null,
          agentName: (r.agent_name as string) ?? null,
          clientId: (r.client_id as string) ?? null,
          inputPreview: shorten(meta.input ?? meta.prompt ?? meta.task ?? null),
          outputPreview: shorten(meta.output ?? meta.response ?? meta.result ?? null),
          errorMessage: shorten(meta.error ?? null),
          rawRef: r.id as string,
        })
      }
    } catch (e) {
      console.error("agent_invocations query failed", e)
    }
  }

  // ── 2. n8n executions filtered by workflow · top recent · cover non-agent nodes too
  const base = process.env.N8N_BASE_URL
  const key = process.env.N8N_API_KEY
  if (base && key) {
    try {
      const res = await fetch(
        `${base.replace(/\/+$/, "")}/api/v1/executions?workflowId=${workflowId}&limit=${limit}`,
        {
          headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
          cache: "no-store",
        },
      )
      if (res.ok) {
        const json = (await res.json()) as {
          data?: Array<{
            id: string
            startedAt: string
            stoppedAt: string | null
            status?: string
            finished: boolean
          }>
        }
        for (const ex of json.data ?? []) {
          const duration =
            ex.startedAt && ex.stoppedAt
              ? new Date(ex.stoppedAt).getTime() - new Date(ex.startedAt).getTime()
              : null
          rows.push({
            id: ex.id,
            source: "n8n",
            status: ex.status ?? (ex.finished ? "success" : "running"),
            startedAt: ex.startedAt,
            durationMs: duration,
            costUsd: null,
            tokensIn: null,
            tokensOut: null,
            model: null,
            agentName: null,
            clientId: null,
            inputPreview: null,
            outputPreview: null,
            errorMessage: null,
            rawRef: `${base.replace(/\/+$/, "")}/workflow/${workflowId}/executions/${ex.id}`,
          })
        }
      }
    } catch (e) {
      console.error("n8n executions fetch failed", e)
    }
  }

  // Merge + dedupe by id · sort startedAt desc · cap to limit
  rows.sort(
    (a, b) =>
      new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime(),
  )
  return NextResponse.json({
    ok: true,
    count: rows.length,
    rows: rows.slice(0, limit),
    timestamp: new Date().toISOString(),
  })
}
