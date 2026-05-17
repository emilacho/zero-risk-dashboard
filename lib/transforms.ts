/**
 * Endpoint → component prop transforms.
 *
 * The dashboard-components package defines its own minimal types
 * (KpiSnapshot, AgentSummary, ClientFolder, AgentInvocation,
 * MemoryGraphData, StatsBarSnapshot). The platform endpoints return
 * richer shapes. These transforms bridge the two without leaking
 * endpoint internals into the component layer.
 */

import type {
  AgentRow,
  AgentsResponse,
  ActivityResponse,
  ClientRow,
  ClientsResponse,
  ClientDetailResponse,
  MetricsResponse,
} from "./api"
import type {
  AgentInvocation,
  AgentSummary,
  ClientFolder,
  InvocationStatus,
  KpiSnapshot,
  MemoryGraphData,
  StatsBarSnapshot,
} from "./dashboard-components"

const ZERO_KPI = { value: 0, delta: 0, deltaLabel: "—" }

export function metricsToKpiSnapshot(m: MetricsResponse): KpiSnapshot {
  return {
    agentsActive: {
      value: m.totals.agents_active,
      delta: 0,
      deltaLabel: `${m.totals.agents_total} totales`,
    },
    clientsActive: {
      value: m.totals.clients_total,
      delta: 0,
      deltaLabel: `30d ventana`,
    },
    spendMonth: {
      value: Number(m.totals.spend_usd_30d.toFixed(2)),
      delta: 0,
      deltaLabel: `total $${m.totals.spend_usd_total.toFixed(2)}`,
    },
    workflowsActive: m.totals.workflows_n8n != null
      ? {
          value: m.totals.workflows_n8n,
          delta: 0,
          deltaLabel: "n8n live",
        }
      : { ...ZERO_KPI, deltaLabel: "n8n unavailable" },
  }
}

export function agentRowToSummary(a: AgentRow): AgentSummary {
  return {
    slug: a.name,
    costUsd: a.stats_30d.cost_usd ?? 0,
    invocations: a.stats_30d.sessions ?? 0,
    model: a.model,
    trend: "flat",
  }
}

const STATUS_MAP: Record<string, InvocationStatus> = {
  completed: "success",
  failed: "failure",
  timeout: "failure",
  escalated: "escalated",
  revision: "revision",
  running: "running",
}

export function invocationsToActivity(
  resp: ActivityResponse,
): AgentInvocation[] {
  return (resp.activity ?? []).map((row) => ({
    id: row.id,
    agent: row.agent_id,
    clientId: row.client_id,
    status: STATUS_MAP[row.status] ?? "running",
    durationMs: row.duration_ms ?? 0,
    costUsd: row.cost_usd ?? 0,
    at: row.started_at,
    task: row.agent_name ?? row.model ?? "",
  }))
}

function clientStatusOf(s: string): ClientFolder["status"] {
  if (s === "active" || s === "onboarding" || s === "paused" || s === "churned") {
    return s
  }
  return "active"
}

export function clientRowToFolder(c: ClientRow): ClientFolder {
  return {
    clientId: c.id,
    name: c.name,
    industry: c.industry ?? "—",
    status: clientStatusOf(c.status),
    spendMonth: Number(c.stats.total_spend_usd.toFixed(2)),
    invocations30d: c.stats.invocations,
    workflowsActive: 0,
    lastActivity: c.updated_at,
    cascadesShipped: 0,
    healthScore: Math.min(100, c.stats.invocations * 5),
  }
}

// ── v3 · StatsBar snapshot built from existing endpoint data ──────────

const KNOWN_TOOLS = [
  'supabase', 'anthropic', 'openai', 'vercel', 'railway',
  'ghl', 'n8n', 'sentry', 'posthog', 'apify',
  'github', 'figma', 'meta', 'google', 'tiktok',
  'linkedin', 'dataforseo', 'whisper', 'ffmpeg', 'higgsfield',
  'elevenlabs', 'hubspot', 'notion', 'slack', 'clickup',
] as const

/**
 * Build a StatsBarSnapshot from the metrics + agents + clients endpoint
 * responses. The values are derived (no backend change) so the shape
 * fits the existing API contract.
 *
 *   concepts        = agents + clients + tools + workflows
 *   relationships   = agents × clients (rough graph density proxy)
 *   sourcesIngested = static tool catalog count (live integrations)
 *   lastSync        = metrics.generated_at if present, else now
 *   memorySize      = rough estimate from concepts × 8 KB per row
 */
export function buildStatsBarSnapshot(args: {
  metrics: MetricsResponse | null
  agents: AgentsResponse | null
  clients: ClientsResponse | null
}): StatsBarSnapshot {
  const m = args.metrics
  const agentCount = args.agents?.agents.length ?? m?.totals.agents_total ?? 0
  const clientCount = args.clients?.clients.length ?? m?.totals.clients_total ?? 0
  const wfCount = m?.totals.workflows_n8n ?? 0
  const toolsCount = KNOWN_TOOLS.length
  const concepts = agentCount + clientCount + wfCount + toolsCount
  // Rough edge proxy · every client connects to ~3 agents on average,
  // plus agent→tool wiring (~1.5 tools per agent).
  const relationships = Math.round(clientCount * 3 + agentCount * 1.5 + wfCount * 2)
  return {
    concepts,
    relationships,
    sourcesIngested: toolsCount,
    lastSync: m?.timestamp ?? new Date().toISOString(),
    memorySize: concepts * 8192, // bytes · 8 KB per concept on average
  }
}

// ── v3 · Agency-rooted memory graph ───────────────────────────────────

/**
 * Build the home-hero memory graph with the agency-root node in the
 * center and orbits for clients/agents/tools/workflows/brand-voice/
 * playbooks/ICP/content/team/revenue.
 *
 * Seed nodes for brand-voice, playbooks, ICP segments, content assets,
 * team and revenue stats are static · they reflect the agency's own
 * memory and don't change per cliente. Live nodes (clients, agents,
 * workflows) come from the endpoints.
 */
export function buildAgencyMemoryGraph(args: {
  clients: ClientRow[]
  agents: AgentRow[]
  metrics: MetricsResponse | null
}): MemoryGraphData {
  const { clients, agents, metrics } = args
  const nodes: MemoryGraphData["nodes"] = []
  const edges: MemoryGraphData["edges"] = []

  // 1 · Agency root
  const ROOT_ID = "agency:root"
  nodes.push({
    id: ROOT_ID,
    kind: "agency-root",
    label: "Zero Risk Agency",
    meta: { tags: ["MEMORY GRAPH", "BUILD A 24/7 AI TEAM"] },
  })

  // 2 · Clients (top ~8 by activity)
  const topClients = [...clients]
    .sort((a, b) => (b.stats?.invocations ?? 0) - (a.stats?.invocations ?? 0))
    .slice(0, 8)
  for (const c of topClients) {
    const id = `client:${c.id}`
    nodes.push({
      id,
      kind: "client",
      label: c.name,
      meta: {
        industry: c.industry ?? undefined,
        healthScore: Math.min(100, (c.stats?.invocations ?? 0) * 5),
      },
    })
    edges.push({
      id: `e:root-${id}`,
      source: ROOT_ID,
      target: id,
      kind: "invokes",
      label: "serves",
    })
  }

  // 3 · Agents (top ~6 by spend)
  const topAgents = [...agents]
    .sort((a, b) => (b.stats_30d?.cost_usd ?? 0) - (a.stats_30d?.cost_usd ?? 0))
    .slice(0, 6)
  for (const a of topAgents) {
    const id = `agent:${a.name}`
    nodes.push({
      id,
      kind: "agent",
      label: a.display_name,
      meta: { model: a.model, role: a.role },
    })
    edges.push({
      id: `e:root-${id}`,
      source: ROOT_ID,
      target: id,
      kind: "invokes",
    })
  }

  // 4 · Workflows · 3 representative ones from project canon
  const WORKFLOWS = [
    { id: "wf:onboarding-e2e", label: "Onboarding E2E v2",        runs: 18 },
    { id: "wf:nexus-master",   label: "NEXUS Master Journey",     runs: 24 },
    { id: "wf:deep-scan",      label: "Competitive Deep Scan",    runs: 4 },
  ]
  for (const w of WORKFLOWS) {
    nodes.push({ id: w.id, kind: "workflow", label: w.label, meta: { runs24h: w.runs } })
    edges.push({ id: `e:root-${w.id}`, source: ROOT_ID, target: w.id, kind: "invokes" })
  }

  // 5 · Tools · the integration constellation
  const TOOLS = [
    { id: "tool:supabase",   label: "Supabase",   icon: "⚡" },
    { id: "tool:anthropic",  label: "Anthropic",  icon: "⌬" },
    { id: "tool:vercel",     label: "Vercel",     icon: "▲" },
    { id: "tool:railway",    label: "Railway",    icon: "◈" },
    { id: "tool:ghl",        label: "GoHighLevel", icon: "◉" },
    { id: "tool:n8n",        label: "n8n",        icon: "⬡" },
    { id: "tool:apify",      label: "Apify",      icon: "◼" },
    { id: "tool:openai",     label: "OpenAI",     icon: "✦" },
  ]
  for (const t of TOOLS) {
    nodes.push({
      id: t.id,
      kind: "tool",
      label: t.label,
      meta: { icon: t.icon },
    })
    edges.push({ id: `e:root-${t.id}`, source: ROOT_ID, target: t.id, kind: "uses" })
  }

  // 6 · Brand voices · the agency owns three canonical voices it serves clients with
  const VOICES = [
    { id: "voice:warm-direct",         label: "warm-direct",         vibe: "empático · técnico sin jerga" },
    { id: "voice:authoritative",       label: "authoritative-clinical", vibe: "evidencia primero · cero hype" },
    { id: "voice:playful-confident",   label: "playful-confident",   vibe: "high energy · friendly swagger" },
  ]
  for (const v of VOICES) {
    nodes.push({ id: v.id, kind: "brand-voice", label: v.label, meta: { vibe: v.vibe } })
    edges.push({ id: `e:root-${v.id}`, source: ROOT_ID, target: v.id, kind: "produces" })
  }

  // 7 · Playbooks · canon agency processes
  const PLAYBOOKS = [
    { id: "play:onboarding",      label: "Onboarding E2E",       category: "intake" },
    { id: "play:competitive",     label: "Competitive Intel",    category: "research" },
    { id: "play:cascade-website", label: "Cascade · website",    category: "delivery" },
    { id: "play:cascade-social",  label: "Cascade · social",     category: "delivery" },
  ]
  for (const p of PLAYBOOKS) {
    nodes.push({ id: p.id, kind: "playbook", label: p.label, meta: { category: p.category } })
    edges.push({ id: `e:root-${p.id}`, source: ROOT_ID, target: p.id, kind: "produces" })
  }

  // 8 · ICP segments · the agency's served ideal-customer profiles
  const SEGMENTS = [
    { id: "icp:food-delivery", label: "food-delivery LATAM", count: 38 },
    { id: "icp:industrial",    label: "industrial safety EC", count: 12 },
    { id: "icp:saas",          label: "SaaS B2B early-stage", count: 24 },
  ]
  for (const s of SEGMENTS) {
    nodes.push({ id: s.id, kind: "icp-segment", label: s.label, meta: { count: s.count } })
    edges.push({ id: `e:root-${s.id}`, source: ROOT_ID, target: s.id, kind: "targets" })
  }

  // 9 · Content assets · live library kinds
  const ASSETS = [
    { id: "asset:landing",  label: "landing pages",  surface: "web" },
    { id: "asset:carousel", label: "ig carousels",   surface: "social" },
    { id: "asset:email",    label: "email sequences", surface: "crm" },
  ]
  for (const a of ASSETS) {
    nodes.push({ id: a.id, kind: "content-asset", label: a.label, meta: { surface_kind: a.surface } })
    edges.push({ id: `e:root-${a.id}`, source: ROOT_ID, target: a.id, kind: "produces" })
  }

  // 10 · Team members · the humans
  // Canon correction 2026-05-17 · Xavier Pérez NO existe · figura
  // ficticia. Único founder/admin · Emilio Pérez.
  const TEAM = [
    { id: "team:emilio", label: "Emilio Pérez", role: "founder · admin" },
  ]
  for (const t of TEAM) {
    nodes.push({ id: t.id, kind: "team-member", label: t.label, meta: { role: t.role } })
    edges.push({ id: `e:root-${t.id}`, source: ROOT_ID, target: t.id, kind: "reports" })
  }

  // 11 · Revenue stats · current snapshot
  const spend = metrics?.totals.spend_usd_30d ?? 0
  const REVENUE = [
    { id: "rev:mrr",   label: "MRR",          value: "$ —" },
    { id: "rev:spend", label: "spend 30d",    value: `$${spend.toFixed(2)}` },
    { id: "rev:cases", label: "client cases", value: clients.length.toString() },
  ]
  for (const r of REVENUE) {
    nodes.push({ id: r.id, kind: "revenue-stat", label: r.label, meta: { value: r.value } })
    edges.push({ id: `e:root-${r.id}`, source: ROOT_ID, target: r.id, kind: "reports" })
  }

  // Cross-links · top agent → top client (cascade flow) · adds depth to the web
  if (topAgents[0] && topClients[0]) {
    edges.push({
      id: `e:${topAgents[0].name}-${topClients[0].id}`,
      source: `agent:${topAgents[0].name}`,
      target: `client:${topClients[0].id}`,
      kind: "cascade",
      label: "cascade",
    })
  }
  // agent → tool · representative
  if (topAgents[0]) {
    edges.push({
      id: `e:${topAgents[0].name}-tool-anthropic`,
      source: `agent:${topAgents[0].name}`,
      target: "tool:anthropic",
      kind: "uses",
    })
  }
  // workflow → agent · representative
  if (topAgents[1]) {
    edges.push({
      id: `e:wf-${topAgents[1].name}`,
      source: "wf:nexus-master",
      target: `agent:${topAgents[1].name}`,
      kind: "invokes",
    })
  }

  return { nodes, edges }
}

// Legacy helpers · kept for any callers still on the v2 graph shape
export function clientDetailToMemoryGraph(
  detail: ClientDetailResponse,
): MemoryGraphData {
  const clientNodeId = `client:${detail.client.id}`
  const nodes: MemoryGraphData["nodes"] = [
    {
      id: clientNodeId,
      kind: "client",
      label: detail.client.name,
      meta: { industry: detail.client.industry ?? undefined },
    },
  ]
  const edges: MemoryGraphData["edges"] = []
  for (const a of detail.agents_worked) {
    const agentNodeId = `agent:${a.agent_id}`
    nodes.push({
      id: agentNodeId,
      kind: "agent",
      label: a.agent_id,
      meta: { runs24h: a.sessions },
    })
    edges.push({
      id: `edge:${clientNodeId}:${agentNodeId}`,
      source: clientNodeId,
      target: agentNodeId,
      kind: "invokes",
    })
  }
  return { nodes, edges }
}

export function clientsToMemoryGraph(clients: ClientRow[]): MemoryGraphData {
  const nodes: MemoryGraphData["nodes"] = clients.map((c) => ({
    id: `client:${c.id}`,
    kind: "client",
    label: c.name,
    meta: {
      industry: c.industry ?? undefined,
      healthScore: Math.min(100, c.stats.invocations * 5),
    },
  }))
  return { nodes, edges: [] }
}
