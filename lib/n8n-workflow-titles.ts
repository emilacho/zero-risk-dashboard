/**
 * n8n workflow title translation · STEP 7d.
 *
 * Companion to `lib/n8n-node-translations.ts` (which handles individual
 * node.type strings). This module handles the workflow-level NAME · the
 * raw value that comes back from `GET /api/v1/workflows/:id .name`.
 *
 * Raw n8n workflow names are usually tech-ish English ("Creative Fatigue
 * Auto-Refresh Loop (Every 6h)"). The dashboard surfaces them to Emilio
 * and future clients · they need to read like business operations
 * ("Ciclo de revisión creativa · cada 6 horas").
 *
 * Strategy ·
 *   1. Exact lookup (fastest · highest priority · capture our actual
 *      workflow names verbatim where possible)
 *   2. Token replacements (case-insensitive · longest tokens first so
 *      "auto-refresh loop" beats just "loop")
 *   3. Humanize · strip prefix "Zero Risk ·" · de-snake/kebab/camel ·
 *      uppercase only when standalone (II · III · QA · CRM · MCP · etc).
 *
 * NO callbacks · pure string → string · safe everywhere (server, RSC,
 * client) and side-effect free.
 */

const EXACT_TITLES: Record<string, string> = {
  "creative fatigue auto-refresh loop (every 6h)":
    "Ciclo de revisión creativa · cada 6 horas",
  "master journey orchestrator": "Orquestador maestro de jornadas",
  "cascade master": "Cascada principal · multi-agente",
  "cascade daily monitor": "Cascada · monitor diario",
  "daily monitor": "Monitor diario",
  "camino iii qa": "Camino III · QA tres-de-N",
  "camino iii": "Camino III · QA tres-de-N",
  "onboarding": "Onboarding · alta de cliente",
  "onboarding pipeline": "Onboarding · pipeline completo",
  "brand discovery": "Descubrimiento de marca",
  "playbook generator": "Generador de playbooks",
  "competitive intelligence": "Inteligencia competitiva",
  "nexus 7-phase orchestrator": "NEXUS · orquestador 7 fases",
  "campaign brief generator": "Generador de campaign briefs",
  "approval gateway": "Pasarela de aprobación · HITL",
  "lead intake": "Captura de leads",
  "lead intake to crm": "Captura de leads · CRM",
}

const TOKEN_MAP: Array<[RegExp, string]> = [
  // longer phrases first
  [/auto[-_ ]refresh/gi, "renovación automática"],
  [/creative fatigue/gi, "revisión creativa"],
  [/every (\d+)h/gi, "cada $1 horas"],
  [/every (\d+) ?min(utes)?/gi, "cada $1 minutos"],
  [/every (\d+)d/gi, "cada $1 días"],
  [/master journey/gi, "jornada maestra"],
  [/orchestrator/gi, "orquestador"],
  [/cascade/gi, "cascada"],
  [/camino iii/gi, "Camino III"],
  [/onboarding/gi, "Onboarding"],
  [/playbook/gi, "Playbook"],
  [/competitive intelligence/gi, "inteligencia competitiva"],
  [/brand discovery/gi, "descubrimiento de marca"],
  [/daily monitor/gi, "monitor diario"],
  [/campaign brief/gi, "Campaign Brief"],
  [/qa/gi, "QA"],
  [/hitl/gi, "HITL"],
  [/crm/gi, "CRM"],
  [/api/gi, "API"],
  [/lead intake/gi, "captura de leads"],
  [/lead/gi, "lead"],
  [/loop/gi, "ciclo"],
  [/pipeline/gi, "pipeline"],
  [/publish/gi, "publicación"],
  [/draft/gi, "borrador"],
  [/approval/gi, "aprobación"],
  [/approve/gi, "aprobar"],
  [/refresh/gi, "renovación"],
  [/monitor/gi, "monitor"],
  [/scheduler/gi, "programador"],
  [/trigger/gi, "disparador"],
  [/webhook/gi, "webhook"],
  [/discovery/gi, "descubrimiento"],
  [/generator/gi, "generador"],
  [/gateway/gi, "pasarela"],
  [/intake/gi, "captura"],
]

const TITLE_PREFIX_STRIP = /^(zero\s*risk[\s·—-]*|zr[\s·—-]+|prod[\s·—-]+)/i

function tidyWhitespace(s: string): string {
  return s
    .replace(/\s*[·—-]\s*/g, " · ")
    .replace(/\s+/g, " ")
    .replace(/\s*·\s*$/g, "")
    .replace(/^\s*·\s*/, "")
    .trim()
}

function humanizeRaw(s: string): string {
  // de-kebab + de-snake + camel split
  const split = s
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
  // sentence case the first word · preserve acronyms (length <= 4 all caps)
  return split
    .split(" ")
    .map((w, i) => {
      if (/^[A-Z]{2,4}$/.test(w)) return w
      if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      return w.toLowerCase()
    })
    .join(" ")
}

export function translateWorkflowTitle(raw: string | null | undefined): string {
  if (!raw) return "Workflow sin título"
  const cleaned = raw.replace(TITLE_PREFIX_STRIP, "").trim()
  const lower = cleaned.toLowerCase()
  if (EXACT_TITLES[lower]) return EXACT_TITLES[lower]

  // Token replacement pass
  let out = cleaned
  for (const [re, sub] of TOKEN_MAP) {
    out = out.replace(re, sub)
  }
  // If at least one replacement happened, the string is mixed Spanish ·
  // tidy the spacing. Otherwise humanize from raw to drop kebab/camel.
  const changed = out !== cleaned
  if (!changed) {
    out = humanizeRaw(cleaned)
  }
  return tidyWhitespace(out)
}

/**
 * Short subtitle · returned alongside the friendly title for UI surfaces
 * that want to expose the raw n8n name as secondary info (debugging,
 * cross-referencing in the n8n UI). Returns null when raw === title
 * after trim.
 */
export function workflowSubtitle(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.replace(TITLE_PREFIX_STRIP, "").trim()
  const translated = translateWorkflowTitle(raw)
  if (cleaned.toLowerCase() === translated.toLowerCase()) return null
  return cleaned
}
