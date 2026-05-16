/**
 * Dashboard API client · server-side fetches to the zero-risk-platform
 * dashboard endpoints (PR #31 · merged 2026-05-16T11:41Z).
 *
 * Base URL is `NEXT_PUBLIC_PLATFORM_API_URL` · falls back to the canonical
 * Vercel prod for the platform repo so local dev still works without env
 * setup. All endpoints are public read · no auth headers needed.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_PLATFORM_API_URL ??
  "https://zero-risk-platform.vercel.app"

// ── Endpoint response shapes (mirror PR #31 contracts) ─────────────────

export interface MetricsResponse {
  ok: boolean
  totals: {
    agents_total: number
    agents_active: number
    clients_total: number
    invocations_total: number
    invocations_30d: number
    images_generated_30d: number
    spend_usd_total: number
    spend_usd_30d: number
    image_spend_usd_30d: number
    workflows_n8n: number | null
  }
  sources: Record<string, string>
  window_days: number
  timestamp: string
}

export interface AgentRow {
  id: string
  name: string
  display_name: string
  role: string
  model: string
  status: string
  identity_chars: number
  identity_source: string
  stats_30d: {
    sessions: number
    tokens_input: number
    tokens_output: number
    cost_usd: number
    last_activity: string | null
  }
}

export interface AgentsResponse {
  ok: boolean
  count: number
  window_days: number
  agents: AgentRow[]
}

export interface AgentDetailResponse {
  ok: boolean
  agent: AgentRow
  recent_invocations: Array<{
    id: string
    client_id: string | null
    started_at: string
    duration_ms: number | null
    cost_usd: number | null
    status: string
    error_message: string | null
    tokens_input: number | null
    tokens_output: number | null
    model: string
  }>
  files_produced?: Array<{ path: string; size_bytes: number }>
}

export interface ClientRow {
  id: string
  name: string
  slug: string
  website_url: string | null
  domain: string | null
  industry: string | null
  market: string | null
  country: string | null
  language: string | null
  status: string
  logo_url: string | null
  brand_colors: unknown[] | null
  created_at: string
  updated_at: string
  stats: {
    invocations: number
    agents_touched: number
    total_spend_usd: number
  }
}

export interface ClientsResponse {
  ok: boolean
  count: number
  clients: ClientRow[]
}

export interface ClientDetailResponse {
  ok: boolean
  client: ClientRow
  agents_worked: Array<{
    agent_id: string
    invocations: number
    total_spend_usd: number
    last_invocation_at: string | null
  }>
  timeline: Array<{
    id: string
    agent_id: string
    started_at: string
    cost_usd: number | null
    status: string
    duration_ms: number | null
  }>
  storage_files?: Array<{ path: string; size_bytes: number }>
}

export interface ActivityResponse {
  ok: boolean
  count: number
  invocations: Array<{
    id: string
    agent_id: string
    client_id: string | null
    started_at: string
    duration_ms: number | null
    cost_usd: number | null
    status: string
    model: string
  }>
}

export interface RealtimeConfigResponse {
  ok: boolean
  supabase_url: string
  supabase_anon_key: string
  channels: string[]
}

// ── fetchJSON · normalized error handling ───────────────────────────────

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`api ${path} · ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

// ── Public · 7 endpoints (6 GET + 1 realtime config) ───────────────────

export const api = {
  metrics: () => fetchJSON<MetricsResponse>("/api/dashboard/metrics"),
  agents: (limit = 100) =>
    fetchJSON<AgentsResponse>(`/api/dashboard/agents?limit=${limit}`),
  agent: (slug: string) =>
    fetchJSON<AgentDetailResponse>(`/api/dashboard/agents/${slug}`),
  clients: (limit = 100) =>
    fetchJSON<ClientsResponse>(`/api/dashboard/clients?limit=${limit}`),
  client: (id: string) =>
    fetchJSON<ClientDetailResponse>(`/api/dashboard/clients/${id}`),
  activity: (limit = 25) =>
    fetchJSON<ActivityResponse>(`/api/dashboard/activity?limit=${limit}`),
  realtimeConfig: () =>
    fetchJSON<RealtimeConfigResponse>("/api/dashboard/realtime"),
}
