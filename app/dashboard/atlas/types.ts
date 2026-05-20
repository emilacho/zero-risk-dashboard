/**
 * Atlas dashboard types · Sprint 2 scaffold.
 *
 * Response shapes para los 7 `/api/atlas/*` endpoints. CC#4 importa
 * desde aquí · hooks TanStack Query typeados extremo a extremo.
 */

// ─── /api/atlas/agents ──────────────────────────────────────────────────

export interface AtlasAgentRow {
  name: string
  default_model: string | null
  identity_source: string | null
  identity_chars: number
  updated_at: string | null
  executions_30d: number
  last_run_at: string | null
}

export interface AtlasAgentsResponse {
  ok: boolean
  total: number
  with_canonical: number
  with_project_local: number
  by_model: Record<string, number>
  with_executions_30d: number
  dormant_count: number
  rows: AtlasAgentRow[]
  generated_at: string
  error?: string
}

// ─── /api/atlas/workflows ───────────────────────────────────────────────

export type AtlasN8nStatus = "live" | "unauthorized" | "error" | "not_configured"

export interface AtlasWorkflowSampleRow {
  id: string
  name: string
  active: boolean
  trigger_type: string | null
  updated_at: string | null
}

export interface AtlasWorkflowsResponse {
  ok: boolean
  n8n_status: AtlasN8nStatus
  total: number
  active: number
  inactive: number
  by_trigger: Record<string, number>
  sample_rows: AtlasWorkflowSampleRow[]
  warning?: string
  generated_at: string
}

// ─── /api/atlas/clients ─────────────────────────────────────────────────

export interface AtlasClientRow {
  id: string
  name: string
  vertical: string | null
  journey_status: string | null
  archived_at: string | null
  invocations_30d: number
  last_activity_at: string | null
}

export interface AtlasClientsResponse {
  ok: boolean
  total: number
  active_real: number
  smoke_with_data: number
  smoke_empty: number
  rows: AtlasClientRow[]
  generated_at: string
  error?: string
}

// ─── /api/atlas/drift ───────────────────────────────────────────────────

export type AtlasDriftSeverity = "critical" | "warning" | "info"

export interface AtlasDriftFinding {
  id: string
  severity: AtlasDriftSeverity
  what: string
  canon_says: string
  real_is: string
  evidence_path: string
}

export interface AtlasDriftResponse {
  ok: boolean
  findings_count: number
  findings: AtlasDriftFinding[]
  generated_at: string
  error?: string
}

// ─── /api/atlas/git ─────────────────────────────────────────────────────

export interface AtlasCommitRow {
  hash: string
  message: string
  date: string
  author: string | null
}

export interface AtlasGitResponse {
  ok: boolean
  source: "exec" | "env" | "none"
  head_commit: string | null
  head_message: string | null
  head_date: string | null
  branch: string | null
  last_10_commits: AtlasCommitRow[]
  warning?: string
  generated_at: string
}

// ─── /api/atlas/integrations-health ─────────────────────────────────────

export type AtlasHealthStatus = "ok" | "degraded" | "down" | "not_configured"

export interface AtlasHealthRow {
  name: string
  status: AtlasHealthStatus
  detail: string
  last_checked: string
}

export interface AtlasIntegrationsHealthResponse {
  ok: boolean
  rows: AtlasHealthRow[]
  generated_at: string
}

// ─── /api/atlas/snapshot (aggregator) ───────────────────────────────────

export type AtlasSourceKey =
  | "agents"
  | "workflows"
  | "clients"
  | "drift"
  | "git"
  | "integrations"

export interface AtlasSnapshotResponse {
  ok: boolean
  agents: AtlasAgentsResponse | null
  workflows: AtlasWorkflowsResponse | null
  clients: AtlasClientsResponse | null
  drift: AtlasDriftResponse | null
  git: AtlasGitResponse | null
  integrations: AtlasIntegrationsHealthResponse | null
  sources_status: Record<AtlasSourceKey, "ok" | "error">
  sources_errors: Record<AtlasSourceKey, string | null>
  last_validated_at: string
}
