/**
 * GET /api/atlas/snapshot · Sprint 2 dashboard scaffold.
 *
 * Aggregator · fetches all 6 atlas endpoints in parallel + returns one
 * consolidated payload. CC#4 consumes via `useAtlasSnapshot()` for the
 * top-of-page hero strip + header tiles. Each sub-fetch is independent ·
 * a single failing source returns its own error flag but does NOT block
 * the others.
 *
 * Cache · 60s revalidate · refetch on demand.
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 60

function buildBaseUrl(reqUrl: string): string {
  const url = new URL(reqUrl)
  return `${url.protocol}//${url.host}`
}

async function fetchAtlas<T>(
  base: string,
  path: string,
): Promise<{ ok: boolean; data: T | null; error?: string }> {
  try {
    const res = await fetch(`${base}/api/atlas/${path}`, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    })
    if (!res.ok) {
      return { ok: false, data: null, error: `HTTP ${res.status}` }
    }
    const data = (await res.json()) as T
    return { ok: true, data }
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: err instanceof Error ? err.message : "unknown",
    }
  }
}

export async function GET(request: Request) {
  const base = buildBaseUrl(request.url)

  const [agents, workflows, clients, drift, git, integrations] =
    await Promise.all([
      fetchAtlas<unknown>(base, "agents"),
      fetchAtlas<unknown>(base, "workflows"),
      fetchAtlas<unknown>(base, "clients"),
      fetchAtlas<unknown>(base, "drift"),
      fetchAtlas<unknown>(base, "git"),
      fetchAtlas<unknown>(base, "integrations-health"),
    ])

  return NextResponse.json({
    ok: true,
    agents: agents.data,
    workflows: workflows.data,
    clients: clients.data,
    drift: drift.data,
    git: git.data,
    integrations: integrations.data,
    sources_status: {
      agents: agents.ok ? "ok" : "error",
      workflows: workflows.ok ? "ok" : "error",
      clients: clients.ok ? "ok" : "error",
      drift: drift.ok ? "ok" : "error",
      git: git.ok ? "ok" : "error",
      integrations: integrations.ok ? "ok" : "error",
    },
    sources_errors: {
      agents: agents.error ?? null,
      workflows: workflows.error ?? null,
      clients: clients.error ?? null,
      drift: drift.error ?? null,
      git: git.error ?? null,
      integrations: integrations.error ?? null,
    },
    last_validated_at: new Date().toISOString(),
  })
}
