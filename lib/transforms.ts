/**
 * Endpoint → component prop transforms.
 *
 * The dashboard-components package defines its own minimal types
 * (KpiSnapshot, AgentSummary, ClientFolder, AgentInvocation,
 * MemoryGraphData). The platform endpoints return richer shapes. These
 * transforms bridge the two without leaking endpoint internals into
 * the component layer.
 */

import type {
  AgentRow,
  ActivityResponse,
  ClientRow,
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

// No 7d-vs-prior signal in the agents endpoint payload yet · default flat.
// When the endpoint adds a delta_30d_vs_60d field this can wire a real trend.
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
  return resp.invocations.map((row) => ({
    id: row.id,
    agent: row.agent_id,
    clientId: row.client_id,
    status: STATUS_MAP[row.status] ?? "running",
    durationMs: row.duration_ms ?? 0,
    costUsd: row.cost_usd ?? 0,
    at: row.started_at,
    task: row.model ?? "",
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
      meta: { runs24h: a.invocations },
    })
    edges.push({
      id: `edge:${clientNodeId}:${agentNodeId}`,
      source: clientNodeId,
      target: agentNodeId,
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
