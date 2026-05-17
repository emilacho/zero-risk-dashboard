/**
 * n8n node type → business language translation.
 *
 * Maps n8n `node.type` strings (e.g. `n8n-nodes-base.webhook`,
 * `n8n-nodes-base.httpRequest`, custom `runSdk`) to friendly labels +
 * an icon kind + a category color so the workflow visual reads as a
 * "team executing" panel rather than tech jargon.
 *
 * Strategy:
 *   - Exact match on full type string when known
 *   - Fallback to suffix matching (after the last `.`) for community
 *     nodes or n8n-nodes-base variants
 *   - Default · `unknown` kind · neutral label "Acción"
 *
 * Used by · components/workflows/WorkflowSkeleton.tsx (renderer) and
 * the /workflows/[id] dedicated page.
 */

export type IconKind =
  | "agente"
  | "cliente"
  | "sistema"
  | "database"
  | "decision"
  | "notif"
  | "schedule"
  | "email"
  | "api"
  | "function"
  | "wait"
  | "merge"
  | "split"
  | "webhook"
  | "camino_qa"
  | "unknown"

export interface NodeTranslation {
  /** Friendly business label · Spanish */
  label: string
  /** Secondary description for tooltip */
  description?: string
  /** Icon kind · drives SVG component selection */
  icon: IconKind
  /** Hue token · matches globals.css --hue-* family */
  hue:
    | "violet"
    | "cyan"
    | "amber"
    | "emerald"
    | "rose"
    | "orange"
    | "purple"
    | "teal"
    | "sky"
    | "lime"
}

/**
 * Exact-match table · most common n8n built-in node types. Suffix
 * fallback handles the rest (e.g. `n8n-nodes-base.gmail` → `email`).
 */
const EXACT: Record<string, NodeTranslation> = {
  // ── Triggers ─────────────────────────────────────────────
  "n8n-nodes-base.webhook": {
    label: "Llega solicitud externa",
    description: "Punto de entrada · alguien o algo dispara este flujo",
    icon: "webhook",
    hue: "cyan",
  },
  "n8n-nodes-base.scheduleTrigger": {
    label: "Se ejecuta en horario",
    description: "Disparador programado · cron",
    icon: "schedule",
    hue: "amber",
  },
  "n8n-nodes-base.cron": {
    label: "Se ejecuta en horario",
    description: "Cron schedule trigger",
    icon: "schedule",
    hue: "amber",
  },
  "n8n-nodes-base.manualTrigger": {
    label: "Disparo manual",
    description: "Ejecutado manualmente por un operador",
    icon: "cliente",
    hue: "cyan",
  },
  "n8n-nodes-base.executeWorkflowTrigger": {
    label: "Sub-flujo · llamado por otro workflow",
    icon: "sistema",
    hue: "purple",
  },
  // ── External API calls ───────────────────────────────────
  "n8n-nodes-base.httpRequest": {
    label: "Llama herramienta externa",
    description: "API call · Meta · Apify · GHL · OpenAI · etc",
    icon: "api",
    hue: "violet",
  },
  "n8n-nodes-base.openAi": {
    label: "Pide a OpenAI",
    icon: "api",
    hue: "teal",
  },
  "n8n-nodes-base.googleSheets": {
    label: "Lee/escribe Google Sheets",
    icon: "database",
    hue: "emerald",
  },
  "n8n-nodes-base.googleCalendar": {
    label: "Agenda en Google Calendar",
    icon: "schedule",
    hue: "amber",
  },
  // ── AI agents · custom run-sdk nodes ─────────────────────
  "n8n-nodes-base.runSdk": {
    label: "Empleado virtual hace su trabajo",
    description: "AI agent invocation (Claude Sonnet/Opus/Haiku)",
    icon: "agente",
    hue: "cyan",
  },
  // ── Logic ────────────────────────────────────────────────
  "n8n-nodes-base.if": {
    label: "Decisión · si esto, entonces aquello",
    icon: "decision",
    hue: "orange",
  },
  "n8n-nodes-base.switch": {
    label: "Cambia ruta según condición",
    icon: "decision",
    hue: "orange",
  },
  "n8n-nodes-base.merge": {
    label: "Une caminos · combina datos",
    icon: "merge",
    hue: "sky",
  },
  "n8n-nodes-base.splitInBatches": {
    label: "Divide en lotes y procesa",
    icon: "split",
    hue: "sky",
  },
  "n8n-nodes-base.function": {
    label: "Procesa información",
    description: "Lógica custom · JavaScript",
    icon: "function",
    hue: "lime",
  },
  "n8n-nodes-base.functionItem": {
    label: "Procesa información (item-by-item)",
    icon: "function",
    hue: "lime",
  },
  "n8n-nodes-base.code": {
    label: "Procesa información (código)",
    icon: "function",
    hue: "lime",
  },
  "n8n-nodes-base.set": {
    label: "Prepara datos · setea variables",
    icon: "function",
    hue: "lime",
  },
  // ── Wait / control ──────────────────────────────────────
  "n8n-nodes-base.wait": {
    label: "Espera unos minutos",
    icon: "wait",
    hue: "amber",
  },
  // ── Database ────────────────────────────────────────────
  "n8n-nodes-base.postgres": {
    label: "Guarda/lee en Postgres",
    icon: "database",
    hue: "emerald",
  },
  "n8n-nodes-base.supabase": {
    label: "Guarda/lee en Supabase",
    icon: "database",
    hue: "emerald",
  },
  // ── Notifications ───────────────────────────────────────
  "n8n-nodes-base.slack": {
    label: "Avisa al equipo (Slack)",
    icon: "notif",
    hue: "orange",
  },
  "n8n-nodes-base.discord": {
    label: "Avisa al equipo (Discord)",
    icon: "notif",
    hue: "violet",
  },
  // ── Email ───────────────────────────────────────────────
  "n8n-nodes-base.emailSend": {
    label: "Envía email",
    icon: "email",
    hue: "teal",
  },
  "n8n-nodes-base.gmail": {
    label: "Envía email (Gmail)",
    icon: "email",
    hue: "teal",
  },
  "n8n-nodes-base.sendInBlue": {
    label: "Envía email (campaign)",
    icon: "email",
    hue: "teal",
  },
  // ── No-op / utility ─────────────────────────────────────
  "n8n-nodes-base.noOp": {
    label: "Marcador · no hace nada",
    icon: "unknown",
    hue: "rose",
  },
  "n8n-nodes-base.stickyNote": {
    label: "Nota · documentación",
    icon: "unknown",
    hue: "rose",
  },
}

// Suffix-based fallback · keyed by the last segment of node.type
const SUFFIX: Record<string, NodeTranslation> = {
  webhook: EXACT["n8n-nodes-base.webhook"],
  scheduleTrigger: EXACT["n8n-nodes-base.scheduleTrigger"],
  cron: EXACT["n8n-nodes-base.cron"],
  manualTrigger: EXACT["n8n-nodes-base.manualTrigger"],
  httpRequest: EXACT["n8n-nodes-base.httpRequest"],
  runSdk: EXACT["n8n-nodes-base.runSdk"],
  if: EXACT["n8n-nodes-base.if"],
  switch: EXACT["n8n-nodes-base.switch"],
  merge: EXACT["n8n-nodes-base.merge"],
  function: EXACT["n8n-nodes-base.function"],
  code: EXACT["n8n-nodes-base.code"],
  set: EXACT["n8n-nodes-base.set"],
  wait: EXACT["n8n-nodes-base.wait"],
  postgres: EXACT["n8n-nodes-base.postgres"],
  supabase: EXACT["n8n-nodes-base.supabase"],
  slack: EXACT["n8n-nodes-base.slack"],
  gmail: EXACT["n8n-nodes-base.gmail"],
  emailSend: EXACT["n8n-nodes-base.emailSend"],
  noOp: EXACT["n8n-nodes-base.noOp"],
  stickyNote: EXACT["n8n-nodes-base.stickyNote"],
}

const DEFAULT: NodeTranslation = {
  label: "Acción",
  description: "Nodo sin traducción específica",
  icon: "unknown",
  hue: "rose",
}

export function translateNodeType(nodeType: string): NodeTranslation {
  if (!nodeType) return DEFAULT
  if (EXACT[nodeType]) return EXACT[nodeType]
  const suffix = nodeType.split(".").pop()
  if (suffix && SUFFIX[suffix]) return SUFFIX[suffix]
  // Heuristic · keyword match in the full string (lowercased)
  const lower = nodeType.toLowerCase()
  if (lower.includes("trigger") || lower.includes("webhook")) {
    return { ...DEFAULT, label: "Disparador", icon: "cliente", hue: "cyan" }
  }
  if (lower.includes("ai") || lower.includes("sdk") || lower.includes("anthropic")) {
    return { ...DEFAULT, label: "Empleado virtual · AI", icon: "agente", hue: "cyan" }
  }
  if (lower.includes("http") || lower.includes("request") || lower.includes("api")) {
    return { ...DEFAULT, label: "Llama herramienta externa", icon: "api", hue: "violet" }
  }
  if (lower.includes("db") || lower.includes("sql") || lower.includes("postgres")) {
    return { ...DEFAULT, label: "Guarda/lee datos", icon: "database", hue: "emerald" }
  }
  if (lower.includes("slack") || lower.includes("discord") || lower.includes("notify")) {
    return { ...DEFAULT, label: "Avisa al equipo", icon: "notif", hue: "orange" }
  }
  if (lower.includes("email") || lower.includes("mail")) {
    return { ...DEFAULT, label: "Envía email", icon: "email", hue: "teal" }
  }
  return DEFAULT
}
