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

/**
 * Shape of `/api/dashboard/agents/[slug]`:
 *   - `agent` carries ONLY identity fields (no nested `stats_30d` · the
 *     list endpoint includes it · the detail endpoint exposes derived
 *     stats via `invocations` + `timeline_30d`).
 *   - `invocations[]` is the recent activity list · field is NOT
 *     `recent_invocations`.
 *   - `timeline_30d[]` is daily rollup (date · sessions · cost_usd).
 */
export interface AgentDetailResponse {
  ok: boolean
  agent: {
    id: string
    name: string
    display_name: string
    role: string
    model: string
    status: string
    identity_chars: number
    identity_source: string
    created_at: string
    updated_at: string
  }
  invocations: Array<{
    id: string
    session_id: string | null
    agent_id: string
    agent_name: string
    client_id: string | null
    model: string
    started_at: string
    ended_at: string | null
    duration_ms: number | null
    cost_usd: number | null
    tokens_input: number | null
    tokens_output: number | null
    status: string
  }>
  files_produced?: Array<{ path: string; size_bytes: number }>
  timeline_30d?: Array<{ date: string; sessions: number; cost_usd: number }>
  window_days: number
  timestamp: string
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
  /**
   * Sprint 6 cleanup · NULL means the cliente is operational (visible in
   * production views). Non-null timestamp = soft-archived. Dashboard
   * data layer filters `archived_at IS NULL` so smoke + dupe rows never
   * surface. Migration · 202605170100_archive_smoke_clients.sql.
   */
  archived_at?: string | null
  archived_reason?: string | null
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

/**
 * Shape of `/api/dashboard/clients/[id]`:
 *   - `client` carries the full clients row + nested `brand_voice` /
 *     `config` jsonb (NOT a summarized `stats` block · use endpoint
 *     `agents_worked` rollup for derived counts).
 *   - `agents_worked[]` uses `sessions` + `cost_usd` + `last_at` (NOT
 *     `invocations` + `total_spend_usd` + `last_invocation_at`).
 *   - `invocations_recent[]` is the timeline (NOT `timeline`).
 */
export interface ClientDetailResponse {
  ok: boolean
  client: {
    id: string
    name: string
    slug: string
    website_url: string | null
    domain: string | null
    industry: string | null
    market: string | null
    status: string
    preferred_language: string | null
    country: string | null
    language: string | null
    logo_url: string | null
    brand_colors: unknown[] | null
    brand_fonts: string[] | null
    brand_voice: Record<string, unknown> | null
    config: Record<string, unknown> | null
    created_at: string
    updated_at: string
  }
  agents_worked: Array<{
    agent_id: string
    sessions: number
    cost_usd: number
    last_at: string | null
  }>
  invocations_recent: Array<{
    id: string
    agent_id: string
    agent_name: string
    model: string
    cost_usd: number | null
    tokens_input: number | null
    tokens_output: number | null
    started_at: string
    ended_at: string | null
    status: string
  }>
  invocations_count?: number
  journeys?: Array<Record<string, unknown>>
  /** Storage list · wrapper is `files` (NOT `storage_files`). */
  files?: Array<{ path: string; size_bytes?: number; size?: number }>
  files_bucket?: string
  files_prefix?: string
}

/**
 * Shape of `/api/dashboard/activity`:
 *   - List wrapper key is `activity` (NOT `invocations`). Each row carries
 *     `agent_name` and `session_id` on top of the base activity fields.
 */
export interface ActivityResponse {
  ok: boolean
  count: number
  activity: Array<{
    id: string
    session_id: string | null
    agent_id: string
    agent_name: string
    client_id: string | null
    started_at: string
    ended_at: string | null
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
  /**
   * Returns ONLY operational clients (archived_at IS NULL).
   * Platform endpoint still ships archived rows for now; we filter
   * client-side until the platform endpoint adds the default filter.
   * Pass `includeArchived: true` to see archived rows too (e.g. admin
   * audit views).
   */
  clients: async (limit = 100, includeArchived = false) => {
    const data = await fetchJSON<ClientsResponse>(
      `/api/dashboard/clients?limit=${limit}`,
    )
    if (includeArchived) return data
    const filtered = data.clients.filter((c) => c.archived_at == null)
    return { ...data, count: filtered.length, clients: filtered }
  },
  client: (id: string) =>
    fetchJSON<ClientDetailResponse>(`/api/dashboard/clients/${id}`),
  /**
   * BUG02 fix · 2026-05-18 · resolves a client detail by EITHER UUID
   * OR slug. The platform endpoint `/api/dashboard/clients/{id}` only
   * accepts a UUID-shaped value (Postgres throws `invalid input
   * syntax for type uuid: "<slug>"`). The dashboard wires slug-based
   * urls so without this resolver every non-UUID URL gives 500 + a
   * "not found" card. Long-term · fix the platform endpoint to
   * accept either. Doc · zr-vault/raw/qa/2026-05-18-bug02-naufrago-slug-fix.md.
   */
  clientByIdOrSlug: async (
    idOrSlug: string,
  ): Promise<ClientDetailResponse | null> => {
    const trimmed = idOrSlug.trim()
    if (!trimmed) return null
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (UUID_RE.test(trimmed)) {
      try {
        return await api.client(trimmed)
      } catch {
        return null
      }
    }
    try {
      const list = await api.clients(200, true)
      const slugLc = trimmed.toLowerCase()
      const match = list.clients.find(
        (c) => (c.slug ?? "").toLowerCase() === slugLc,
      )
      if (!match) return null
      return await api.client(match.id)
    } catch {
      return null
    }
  },
  activity: (limit = 25) =>
    fetchJSON<ActivityResponse>(`/api/dashboard/activity?limit=${limit}`),
  realtimeConfig: () =>
    fetchJSON<RealtimeConfigResponse>("/api/dashboard/realtime"),
}
