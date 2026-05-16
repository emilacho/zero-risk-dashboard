/**
 * Shared types · public contracts the dashboard host fills with real data.
 *
 * Every component in this package accepts props shaped per these types.
 * The fixtures in `src/fixtures/` are concrete examples; backend wiring
 * just swaps the source.
 */

// ── KPI cards ──────────────────────────────────────────────────────────
export interface KpiMetric {
  /** Current absolute value. */
  value: number
  /** Delta vs previous period · positive = improvement (depends on metric). */
  delta: number
  /** Human-friendly label for the delta (e.g., "+2 vs last week"). */
  deltaLabel: string
  /** Optional inline sparkline series. */
  sparkline?: SparklinePoint[]
}

export interface KpiSnapshot {
  agentsActive: KpiMetric
  clientsActive: KpiMetric
  spendMonth: KpiMetric
  workflowsActive: KpiMetric
}

// ── Agent summary (BarListTopAgents · SparklineGrid) ───────────────────
export type AgentTrend = 'up' | 'down' | 'flat'
export interface AgentSummary {
  slug: string
  costUsd: number
  invocations: number
  model: string
  trend: AgentTrend
}

// ── Sparkline point ────────────────────────────────────────────────────
export interface SparklinePoint {
  x: number
  y: number
}

// ── Agent invocation (ActivityFeed) ────────────────────────────────────
export type InvocationStatus = 'success' | 'failure' | 'escalated' | 'revision' | 'running'
export interface AgentInvocation {
  id: string
  agent: string
  clientId: string | null
  status: InvocationStatus
  durationMs: number
  costUsd: number
  /** ISO timestamp. */
  at: string
  task: string
}

// ── Client folder (ClienteCarpetaCard) ─────────────────────────────────
export type ClientStatus = 'active' | 'onboarding' | 'paused' | 'churned'
export interface ClientFolder {
  clientId: string
  name: string
  industry: string
  status: ClientStatus
  spendMonth: number
  invocations30d: number
  workflowsActive: number
  /** ISO timestamp · most recent agent_invocation OR workflow_run. */
  lastActivity: string
  cascadesShipped: number
  /** 0-100 · derived from successRate · spend velocity · review escalations. */
  healthScore: number
  /** Optional pills · tools / contract / segment that surface on the card. */
  pills?: string[]
}

// ── Workflow summary (CubiculoCard cross-reference) ────────────────────
export type WorkflowStatus = 'active' | 'inactive' | 'errored'
export interface WorkflowSummary {
  id: string
  name: string
  clientId: string | null
  status: WorkflowStatus
  lastRun: string
  successRate24h: number
}

// ── Memory graph (ReactFlow) ───────────────────────────────────────────
/**
 * v3 expansion · the memory graph is the home-page hero. Node kinds:
 * agency-root, client, agent, workflow, tool, brand-voice, playbook,
 * icp-segment, content-asset, team-member, revenue-stat.
 */
export type MemoryNodeKind =
  | 'agency-root'
  | 'client'
  | 'agent'
  | 'workflow'
  | 'tool'
  | 'brand-voice'
  | 'playbook'
  | 'icp-segment'
  | 'content-asset'
  | 'team-member'
  | 'revenue-stat'

export interface MemoryNodeMeta {
  industry?: string
  healthScore?: number
  model?: string
  role?: string
  surface?: string
  runs24h?: number
  /** For tool nodes · brand-mark icon glyph (single emoji / short text). */
  icon?: string
  /** For brand-voice nodes · "warm-direct", "authoritative-clinical", ... */
  vibe?: string
  /** For playbook nodes · "competitive-intel", "onboarding", ... */
  category?: string
  /** For icp-segment nodes · approximate count of accounts. */
  count?: number
  /** For revenue-stat nodes · a single number formatted by the renderer. */
  value?: number | string
  /** For content-asset nodes · type (article/video/carousel/landing). */
  surface_kind?: string
  /** Optional generic tag list rendered as mini-pills inside the node. */
  tags?: string[]
}

export type MemoryNodeData = {
  id: string
  kind: MemoryNodeKind
  label: string
  meta?: MemoryNodeMeta
} & Record<string, unknown>

/** v3 · edges carry a `kind` so renderer can color + animate per category. */
export type MemoryEdgeKind =
  | 'invokes'
  | 'uses'
  | 'review'
  | 'cascade'
  | 'reads'
  | 'produces'
  | 'targets'
  | 'reports'

export interface MemoryEdgeData {
  id: string
  source: string
  target: string
  label?: string
  /** v3 · edge category drives stroke color + animation. */
  kind?: MemoryEdgeKind
}

export interface MemoryGraphData {
  nodes: MemoryNodeData[]
  edges: MemoryEdgeData[]
}

// ── Stats bar (home hero monitoring strip) ─────────────────────────────
export interface StatsBarSnapshot {
  concepts: number
  relationships: number
  sourcesIngested: number
  /** ISO timestamp · the renderer turns it into a relative time string. */
  lastSync: string
  /** Bytes · the renderer formats compactly (KB/MB). */
  memorySize: number
}
