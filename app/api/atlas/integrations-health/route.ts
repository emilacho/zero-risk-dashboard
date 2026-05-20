/**
 * GET /api/atlas/integrations-health · Sprint 2 dashboard scaffold.
 *
 * Pings integrations · Supabase · n8n · Vercel deploy · Sentry · UptimeRobot.
 * Returns per-integration `{ name, status, detail, last_checked }`. Each
 * check has a 5s timeout · partial failures NEVER block the response.
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 120

export type HealthStatus = "ok" | "degraded" | "down" | "not_configured"

interface HealthRow {
  name: string
  status: HealthStatus
  detail: string
  last_checked: string
}

async function pingUrl(
  url: string,
  options: { headers?: Record<string, string>; method?: string } = {},
): Promise<{ ok: boolean; status: number; latencyMs: number; error?: string }> {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    })
    return { ok: res.ok, status: res.status, latencyMs: Date.now() - start }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "unknown",
    }
  }
}

export async function GET() {
  const now = new Date().toISOString()
  const rows: HealthRow[] = []

  // Supabase REST ping
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    rows.push({
      name: "Supabase",
      status: "not_configured",
      detail: "SUPABASE_URL or key missing",
      last_checked: now,
    })
  } else {
    const r = await pingUrl(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: supabaseKey },
    })
    rows.push({
      name: "Supabase",
      status: r.ok ? "ok" : r.status === 401 ? "degraded" : "down",
      detail: r.ok
        ? `OK · ${r.latencyMs}ms`
        : `HTTP ${r.status} · ${r.error ?? "no detail"}`,
      last_checked: now,
    })
  }

  // n8n API ping
  const n8nUrl = process.env.N8N_API_URL ?? "https://n8n.zero-risk.com"
  const n8nKey = process.env.N8N_API_KEY
  if (!n8nKey) {
    rows.push({
      name: "n8n Railway",
      status: "not_configured",
      detail: "N8N_API_KEY env var missing",
      last_checked: now,
    })
  } else {
    const r = await pingUrl(`${n8nUrl}/api/v1/workflows?limit=1`, {
      headers: { "X-N8N-API-KEY": n8nKey },
    })
    rows.push({
      name: "n8n Railway",
      status: r.ok ? "ok" : r.status === 401 ? "degraded" : "down",
      detail: r.ok
        ? `OK · ${r.latencyMs}ms`
        : `HTTP ${r.status} · ${r.error ?? "no detail"}`,
      last_checked: now,
    })
  }

  // Vercel deploy status (Vercel platform URL ping)
  const vercelHealthUrl =
    process.env.NEXT_PUBLIC_PLATFORM_API_URL ??
    "https://zero-risk-platform.vercel.app"
  const r = await pingUrl(`${vercelHealthUrl}/api/health`).catch(() => null)
  if (r) {
    rows.push({
      name: "Vercel Platform",
      status: r.ok ? "ok" : "degraded",
      detail: r.ok
        ? `OK · ${r.latencyMs}ms`
        : `HTTP ${r.status} · /api/health not found OR degraded`,
      last_checked: now,
    })
  }

  // Sentry · check via env var presence only (real API ping requires auth token + project ID)
  const sentryDsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
  rows.push({
    name: "Sentry",
    status: sentryDsn ? "ok" : "not_configured",
    detail: sentryDsn ? "DSN configured (live status requires API token)" : "SENTRY_DSN missing",
    last_checked: now,
  })

  // UptimeRobot · presence-only check
  const uptimeRobotKey = process.env.UPTIME_ROBOT_API_KEY
  rows.push({
    name: "UptimeRobot",
    status: uptimeRobotKey ? "ok" : "not_configured",
    detail: uptimeRobotKey ? "API key configured" : "UPTIME_ROBOT_API_KEY missing",
    last_checked: now,
  })

  // GoHighLevel · presence-only check
  const ghlKey = process.env.GHL_API_KEY ?? process.env.GOHIGHLEVEL_API_KEY
  rows.push({
    name: "GoHighLevel",
    status: ghlKey ? "ok" : "not_configured",
    detail: ghlKey ? "API key configured" : "GHL_API_KEY missing",
    last_checked: now,
  })

  return NextResponse.json({
    ok: true,
    rows,
    generated_at: now,
  })
}
