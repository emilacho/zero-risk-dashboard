/**
 * Departments · Phase 4 STEP 2 · 5 oficinas gerenciales canonical.
 *
 * Each `Department` owns a slug + display label + cardinal sector
 * (matching the MemoryGraph layout from Phase 3) + hue token + agent
 * classifier (name → department).
 *
 * Source mapping per architecture doc
 * `zr-vault/raw/state/2026-05-17-dashboard-arquitectura-completa.md`
 * section 1. Legal + HR + Sales + Intel deferred (NOT v1).
 */
import type { AgentRow } from "./api"

export type DeptSlug = "ops" | "csm" | "fin" | "mkt" | "qa"

export interface Department {
  slug: DeptSlug
  label: string
  /** Mono-caps short label · uppercase · for chips */
  shortLabel: string
  /** Cardinal sector · matches MemoryGraph cardinal-zone layout */
  cardinal: string
  /** Hue token · maps to globals.css --hue-* family */
  hue: "violet" | "cyan" | "amber" | "emerald" | "rose" | "orange" | "purple" | "teal" | "sky" | "lime"
  description: string
  /** Friendly subtitle shown on dept page header */
  tagline: string
  /** "Manager" agent slug · the jefe_departamento responsible · null when
   *  the office has no formal jefe yet (per architecture doc · OPS uses
   *  gerente-general as transversal, FIN is derived view, MKT/QA/CSM
   *  each have a jefe). */
  managerAgent: string | null
}

export const DEPARTMENTS: Department[] = [
  {
    slug: "ops",
    label: "Operations & Observability",
    shortLabel: "OPS",
    cardinal: "OPS · E",
    hue: "violet",
    description: "Plantilla agéntica · workflows live · cascade health · uptime · alerts",
    tagline: "Sistema desplegado · 59 agents · 58 workflows · cascade health rollup",
    managerAgent: "gerente-general",
  },
  {
    slug: "csm",
    label: "Client Success",
    shortLabel: "CSM",
    cardinal: "CSM · W",
    hue: "emerald",
    description: "Clientes operativos · journey state · HITL pending · health score · churn risk",
    tagline: "2 clientes operativos · onboarding pipeline · journey tracking",
    managerAgent: "jefe_client_success",
  },
  {
    slug: "fin",
    label: "Finanzas",
    shortLabel: "FIN",
    cardinal: "FIN · S",
    hue: "amber",
    description: "Spend daily / 30d · provider breakdown · per-client · MRR · cash position",
    tagline: "Cost & spend visibility · provider attribution · Anthropic / OpenAI",
    managerAgent: null,
  },
  {
    slug: "mkt",
    label: "Marketing",
    shortLabel: "MKT",
    cardinal: "MKT · N",
    hue: "cyan",
    description: "Campañas Meta · IG social · landing v2 traffic · email GHL · ticker promo",
    tagline: "Content + paid + organic · cliente piloto Náufrago + lift to portfolio",
    managerAgent: "jefe-marketing",
  },
  {
    slug: "qa",
    label: "Producción & QA",
    shortLabel: "QA",
    cardinal: "QA · SE",
    hue: "rose",
    description: "Camino III reviews · verdicts · revision rate · spell-check stats · time-to-publish",
    tagline: "3-of-N voting · editor-en-jefe + spell-check + style-consistency",
    managerAgent: "editor_en_jefe",
  },
]

export const DEPT_BY_SLUG: Record<DeptSlug, Department> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.slug, d]),
) as Record<DeptSlug, Department>

/**
 * Agent → Department classifier.
 *
 * Reads agent.name + agent.role + heuristics to assign one of the 5
 * dept slugs. Returns `null` when the agent doesn't belong to a v1 dept
 * (e.g. sales, intel, transversal agents like ruflo · they're tracked
 * under "Capa B · Sistema desplegado" in /system, not in /dept/[slug]).
 *
 * Mapping rules (per architecture doc section 1):
 *  - MKT · jefe-marketing + content-creator + creative-director +
 *    seo-specialist + cro-specialist + growth-hacker + media-buyer +
 *    email-marketer + carousel-designer + social-media-strategist +
 *    community_manager + all paid_media_* + all marketing_* + web_designer
 *  - CSM · jefe_client_success + account_manager + onboarding_specialist +
 *    reporting_agent + community_manager (shared with MKT)
 *  - QA · editor_en_jefe + spell-check-corrector + style-consistency-reviewer
 *    + delivery-coordinator + optimization-agent
 *  - OPS · tracking-specialist + ruflo + gerente-general + agents w/o
 *    clearer dept home
 *  - FIN · NO agents directly · derived view from agent_invocations
 *
 * Sales + Intel agents return null (deferred from v1).
 */
const MKT_AGENTS = new Set([
  "jefe-marketing",
  "content-creator",
  "creative-director",
  "seo-specialist",
  "cro-specialist",
  "growth-hacker",
  "media-buyer",
  "email-marketer",
  "carousel-designer",
  "social-media-strategist",
  "community_manager",
  "campaign-brief-agent",
  "web_designer",
  "video_editor_motion_designer",
  "video-editor",
])

const MKT_PREFIXES = ["paid_media_", "marketing_"]

const CSM_AGENTS = new Set([
  "jefe_client_success",
  "account_manager",
  "onboarding_specialist",
  "reporting_agent",
])

const QA_AGENTS = new Set([
  "editor_en_jefe",
  "spell-check-corrector",
  "style-consistency-reviewer",
  "delivery-coordinator",
  "optimization-agent",
])

const OPS_AGENTS = new Set([
  "gerente-general",
  "tracking-specialist",
  "ruflo",
])

export function classifyAgent(a: { name: string; role?: string }): DeptSlug | null {
  const n = a.name
  if (MKT_AGENTS.has(n)) return "mkt"
  if (MKT_PREFIXES.some((p) => n.startsWith(p))) return "mkt"
  if (CSM_AGENTS.has(n)) return "csm"
  if (QA_AGENTS.has(n)) return "qa"
  if (OPS_AGENTS.has(n)) return "ops"
  // Sales · Intel · transversal not-yet-classified · v1 deferred · null
  return null
}

/**
 * Return agents that belong to a department, plus a summary count
 * + sum of 30d sessions + 30d cost.
 */
export interface DeptAgentRollup {
  dept: DeptSlug
  totalAgents: number
  activeAgents: number
  sessions30d: number
  cost30d: number
  agents: AgentRow[]
}

export function rollupAgentsByDept(
  allAgents: AgentRow[],
): Record<DeptSlug, DeptAgentRollup> {
  const buckets: Record<DeptSlug, AgentRow[]> = {
    ops: [],
    csm: [],
    fin: [],
    mkt: [],
    qa: [],
  }
  for (const a of allAgents) {
    const slug = classifyAgent(a)
    if (slug) buckets[slug].push(a)
  }
  return Object.fromEntries(
    DEPARTMENTS.map((d) => {
      const agents = buckets[d.slug]
      const sessions = agents.reduce((s, a) => s + (a.stats_30d?.sessions ?? 0), 0)
      const cost = agents.reduce((s, a) => s + (a.stats_30d?.cost_usd ?? 0), 0)
      const active = agents.filter((a) => (a.stats_30d?.sessions ?? 0) > 0).length
      return [
        d.slug,
        {
          dept: d.slug,
          totalAgents: agents.length,
          activeAgents: active,
          sessions30d: sessions,
          cost30d: cost,
          agents,
        },
      ]
    }),
  ) as Record<DeptSlug, DeptAgentRollup>
}
