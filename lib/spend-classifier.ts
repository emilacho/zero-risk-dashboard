/**
 * Spend classifier · resolves a flat `agent_invocations` row into 4
 * orthogonal taxonomy buckets used by the FIN spend-breakdown surface.
 *
 *   - clientLabel · who paid for the work (Náufrago · Seg Ind Pérez ·
 *     Internal · Onboarding · Testing · Cascade-only · Unknown)
 *   - agentLabel · the canonical agent slug (brand-strategist · etc)
 *   - serviceLabel · the operational service that invoked it
 *     (Cascade Master · Daily Monitor · Camino III · Onboarding · etc)
 *   - brazoLabel · which "brazo" execution surface the cost belongs to
 *     (Brazo 1 GPT Image · Brazo 2 Apify · Cascade Anthropic · Camino III QA)
 *
 * No callbacks · pure data in / data out · safe to call from both
 * server components (loadFinRollup) and any future API route.
 */
export type ClassifierClientMap = Map<string, string>

export interface RawInvocationRow {
  client_id: string | null
  agent_name: string | null
  model: string | null
  cost_usd: number | null
  status: string | null
  metadata: Record<string, unknown> | null
  started_at?: string | null
}

export interface InvocationTags {
  clientLabel: string
  agentLabel: string
  serviceLabel: string
  brazoLabel: string
}

function pickMeta(meta: Record<string, unknown> | null, keys: string[]): string | null {
  if (!meta) return null
  for (const k of keys) {
    const v = meta[k]
    if (typeof v === "string" && v.length > 0) return v
  }
  return null
}

function classifyClient(row: RawInvocationRow, clientNames: ClassifierClientMap): string {
  if (row.client_id) {
    const name = clientNames.get(row.client_id)
    if (name) return name
  }
  const meta = row.metadata ?? {}
  const kind = String(meta.kind ?? meta.run_kind ?? meta.session_kind ?? "").toLowerCase()
  const tag = String(meta.tag ?? meta.label ?? "").toLowerCase()
  if (kind === "test" || tag.includes("test") || tag.includes("smoke")) return "Testing"
  if (kind === "qa" || tag.includes("qa")) return "QA"
  if (kind === "onboarding" || tag.includes("onboarding")) return "Onboarding"
  if (meta.cascade_run_id || meta.cascade_id || tag.includes("cascade")) return "Cascade-only"
  if (kind === "internal" || tag.includes("internal")) return "Internal"
  return "Unknown"
}

function classifyAgent(row: RawInvocationRow): string {
  if (row.agent_name && row.agent_name.length > 0) return row.agent_name
  const fromMeta = pickMeta(row.metadata, ["agent", "agent_slug", "role"])
  if (fromMeta) return fromMeta
  return "_unknown"
}

function classifyService(row: RawInvocationRow): string {
  const meta = row.metadata ?? {}
  const name = (row.agent_name ?? "").toLowerCase()
  const source = String(meta.source ?? meta.workflow_name ?? meta.workflow ?? "").toLowerCase()
  const tag = String(meta.tag ?? meta.kind ?? "").toLowerCase()

  if (meta.camino_round || /qa|reviewer|camino|critic/.test(name)) return "Camino III"
  if (meta.cascade_run_id || meta.cascade_id || /cascade/.test(source) || /cascade/.test(tag)) return "Cascade Master"
  if (/daily-monitor|daily_monitor|monitor/.test(source) || /monitor/.test(tag)) return "Daily Monitor"
  if (/onboarding/.test(source) || /onboarding/.test(tag) || /onboard/.test(name)) return "Onboarding"
  if (/playbook|generator/.test(source)) return "Playbook Generator"
  if (/competitive|landscape|fatigue/.test(source) || /competitive/.test(name)) return "Competitive Intel"
  if (/image|video/.test(source)) return "Creative Pipeline"
  if (source) return source.split(/[\s_-]/).slice(0, 3).join(" ")
  return "Ad-hoc"
}

function classifyBrazo(row: RawInvocationRow): string {
  const model = (row.model ?? "").toLowerCase()
  const name = (row.agent_name ?? "").toLowerCase()
  const meta = row.metadata ?? {}
  const source = String(meta.source ?? meta.workflow_name ?? meta.workflow ?? "").toLowerCase()

  if (model.startsWith("gpt-image") || /image-gen|image_gen|image-prompt/.test(name)) {
    return "Brazo 1 · GPT Image"
  }
  if (/apify|scrape|scraper/.test(name) || /apify/.test(source)) {
    return "Brazo 2 · Apify"
  }
  if (meta.camino_round || /qa|reviewer|camino|critic/.test(name)) {
    return "Camino III · QA"
  }
  if (model.startsWith("claude") || model.includes("anthropic")) {
    return "Cascade · Anthropic"
  }
  if (model.startsWith("gpt") || model.includes("openai")) {
    return "OpenAI · misc"
  }
  if (model.length > 0) return `Other · ${model}`
  return "Unclassified"
}

export function resolveSpendCategory(
  row: RawInvocationRow,
  clientNames: ClassifierClientMap,
): InvocationTags {
  return {
    clientLabel: classifyClient(row, clientNames),
    agentLabel: classifyAgent(row),
    serviceLabel: classifyService(row),
    brazoLabel: classifyBrazo(row),
  }
}

// ── Aggregation helpers ─────────────────────────────────────────────

export interface BreakdownBucket {
  label: string
  cost: number
  count: number
  /** Up to 3 secondary labels (top clients · top agents · etc) used in tooltip. */
  related: {
    clients: string[]
    agents: string[]
    services: string[]
    brazos: string[]
    models: string[]
    workflows: string[]
  }
}

type Dim = "client" | "agent" | "service" | "brazo"

interface AggInner {
  cost: number
  count: number
  clients: Map<string, number>
  agents: Map<string, number>
  services: Map<string, number>
  brazos: Map<string, number>
  models: Map<string, number>
  workflows: Map<string, number>
}

function topKeys(m: Map<string, number>, k = 3): string[] {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map((e) => e[0])
}

function bumpRelated(inner: AggInner, tags: InvocationTags, row: RawInvocationRow) {
  inner.clients.set(tags.clientLabel, (inner.clients.get(tags.clientLabel) ?? 0) + 1)
  inner.agents.set(tags.agentLabel, (inner.agents.get(tags.agentLabel) ?? 0) + 1)
  inner.services.set(tags.serviceLabel, (inner.services.get(tags.serviceLabel) ?? 0) + 1)
  inner.brazos.set(tags.brazoLabel, (inner.brazos.get(tags.brazoLabel) ?? 0) + 1)
  if (row.model) inner.models.set(row.model, (inner.models.get(row.model) ?? 0) + 1)
  const meta = row.metadata ?? {}
  const wf = String(meta.workflow_name ?? meta.workflow ?? meta.source ?? "")
  if (wf) inner.workflows.set(wf, (inner.workflows.get(wf) ?? 0) + 1)
}

export function buildBreakdown(
  rows: RawInvocationRow[],
  clientNames: ClassifierClientMap,
  dim: Dim,
): BreakdownBucket[] {
  const map = new Map<string, AggInner>()
  for (const row of rows) {
    const tags = resolveSpendCategory(row, clientNames)
    const label =
      dim === "client"
        ? tags.clientLabel
        : dim === "agent"
          ? tags.agentLabel
          : dim === "service"
            ? tags.serviceLabel
            : tags.brazoLabel
    let inner = map.get(label)
    if (!inner) {
      inner = {
        cost: 0,
        count: 0,
        clients: new Map(),
        agents: new Map(),
        services: new Map(),
        brazos: new Map(),
        models: new Map(),
        workflows: new Map(),
      }
      map.set(label, inner)
    }
    inner.cost += Number(row.cost_usd ?? 0)
    inner.count += 1
    bumpRelated(inner, tags, row)
  }
  return [...map.entries()]
    .map(([label, inner]) => ({
      label,
      cost: inner.cost,
      count: inner.count,
      related: {
        clients: topKeys(inner.clients),
        agents: topKeys(inner.agents),
        services: topKeys(inner.services),
        brazos: topKeys(inner.brazos),
        models: topKeys(inner.models),
        workflows: topKeys(inner.workflows),
      },
    }))
    .sort((a, b) => b.cost - a.cost)
}
