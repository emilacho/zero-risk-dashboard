/**
 * Slash-command catalog · STEP 11 · M3.
 *
 * Each command is a shortcut that pre-fills the prompt textarea with
 * a well-formed question · optionally fetches a small server-side
 * context blob and merges it into `surfaceState` so Cowork has
 * authoritative data instead of guessing.
 *
 * Commands live as plain data here so the menu UI doesn't have to
 * import anything fancy · M4 will extend `fetch` to return richer
 * blobs (per-agent metrics · per-workflow recent runs · etc).
 */

export interface CoworkCommand {
  slug: string
  /** Short label shown in the menu. */
  label: string
  /** One-line hint shown next to the label. */
  hint: string
  /** Prompt template to drop into the textarea after the slash is
   * consumed. Use `{cursor}` to mark where caret should land · NOT
   * required · default puts caret at end. */
  template: string
}

export const COWORK_COMMANDS: CoworkCommand[] = [
  {
    slug: "/agents",
    label: "/agents",
    hint: "Resumen de agentes · spend · estado · invocaciones",
    template:
      "Resumen del estado de los agentes · top 5 por spend 30d · invocaciones fallidas · agentes inactivos sospechosos · {cursor}",
  },
  {
    slug: "/workflows",
    label: "/workflows",
    hint: "Workflows live · fallas · triggers · idle",
    template:
      "Workflows live ahora · cuáles fallaron en las últimas 24h · cuáles están idle · qué triggers tienen activos · {cursor}",
  },
  {
    slug: "/clients",
    label: "/clients",
    hint: "Spend + engagement + brand voice gaps",
    template:
      "Resumen de clientes · spend 30d por cliente · último engagement · gaps en brand voice · próximas acciones recomendadas · {cursor}",
  },
  {
    slug: "/campaign",
    label: "/campaign",
    hint: "Estructurar nueva campaña Meta Ads",
    template:
      "Sugerime estructura de campaña Meta Ads · cliente · {cursor} · objetivo · audiencia · daily budget · creative count · destination URL",
  },
  {
    slug: "/dispatch",
    label: "/dispatch",
    hint: "Brief para Claude Code (CC1/CC2/CC3)",
    template:
      "Necesito un brief dispatch a Claude Code · tarea · {cursor} · contexto · entregable esperado · regression-safe Phase 4.1 mantener",
  },
]

/** Returns the command that matches the slash-prefix the user typed.
 * Empty string is allowed · then ALL commands are surfaced. */
export function filterCommands(query: string): CoworkCommand[] {
  const q = query.trim().toLowerCase()
  if (!q || q === "/") return COWORK_COMMANDS
  return COWORK_COMMANDS.filter(
    (c) => c.slug.toLowerCase().includes(q) || c.label.toLowerCase().includes(q),
  )
}

/** Replace the slug at the start of the input with the command's
 * template · returns the new input plus the caret position. */
export function applyCommandTemplate(
  current: string,
  command: CoworkCommand,
): { value: string; caret: number } {
  // Strip any leading slash-query (one token) and replace with template.
  const m = current.match(/^\/[^\s]*\s?/)
  const rest = m ? current.slice(m[0].length) : current
  const t = command.template
  const cursorMarker = "{cursor}"
  const idx = t.indexOf(cursorMarker)
  if (idx === -1) {
    const value = t + (rest ? " " + rest : "")
    return { value, caret: value.length }
  }
  const before = t.slice(0, idx)
  const after = t.slice(idx + cursorMarker.length)
  const value = before + after + (rest ? " " + rest : "")
  return { value, caret: before.length }
}
