/**
 * Conversation export helpers · STEP 12.
 *
 * Two formats supported · markdown (operator-readable · pastes into
 * Obsidian zr-vault `raw/chats/` cleanly) and JSON (full structural
 * dump · includes tool_calls + attachments + timestamps · useful for
 * re-import in another session OR debugging).
 *
 * Pure data-in/data-out · the host (CoworkPromptBar) wires the
 * download via a Blob URL + temporary `<a download>`.
 */

export interface ExportableTurn {
  role: "user" | "assistant"
  content: string
  attachments?: Array<{ name: string; mime: string; size?: number; url?: string | null }>
  tool_calls?: Array<{ name: string; input: Record<string, unknown> }>
  ts?: string | null
}

export interface ExportMeta {
  channel: string
  sessionId: string
  label?: string
  page?: string
  clientName?: string
  exportedAt?: string
}

function fmtTs(ts: string | null | undefined): string {
  if (!ts) return ""
  return new Date(ts).toISOString().replace("T", " ").slice(0, 16) + " UTC"
}

export function toMarkdown(meta: ExportMeta, turns: ExportableTurn[]): string {
  const lines: string[] = []
  lines.push(`# Cowork · conversación`)
  lines.push("")
  lines.push(`- channel · \`${meta.channel}\``)
  lines.push(`- session · \`${meta.sessionId}\``)
  if (meta.label) lines.push(`- label · ${meta.label}`)
  if (meta.page) lines.push(`- surface · ${meta.page}`)
  if (meta.clientName) lines.push(`- cliente · ${meta.clientName}`)
  lines.push(`- exported · ${fmtTs(meta.exportedAt ?? new Date().toISOString())}`)
  lines.push(`- turns · ${turns.length}`)
  lines.push("")
  lines.push("---")
  lines.push("")
  for (const t of turns) {
    const ts = t.ts ? `_${fmtTs(t.ts)}_` : ""
    lines.push(`## ${t.role === "user" ? "🧑 Emilio" : "🤖 Cowork"} ${ts}`)
    lines.push("")
    lines.push(t.content || "_(vacío)_")
    if (t.attachments && t.attachments.length > 0) {
      lines.push("")
      lines.push("**Adjuntos**")
      for (const a of t.attachments) {
        const url = a.url ? ` · [link](${a.url})` : ""
        lines.push(`- \`${a.name}\` (${a.mime})${url}`)
      }
    }
    if (t.tool_calls && t.tool_calls.length > 0) {
      lines.push("")
      lines.push("**Tool calls**")
      for (const tc of t.tool_calls) {
        lines.push(`- \`${tc.name}\``)
        lines.push("  ```json")
        for (const ln of JSON.stringify(tc.input, null, 2).split("\n")) {
          lines.push("  " + ln)
        }
        lines.push("  ```")
      }
    }
    lines.push("")
    lines.push("---")
    lines.push("")
  }
  return lines.join("\n")
}

export function toJSON(meta: ExportMeta, turns: ExportableTurn[]): string {
  return JSON.stringify(
    {
      ...meta,
      exportedAt: meta.exportedAt ?? new Date().toISOString(),
      turns,
    },
    null,
    2,
  )
}

export function downloadBlob(filename: string, content: string, mime: string) {
  if (typeof window === "undefined") return
  const blob = new Blob([content], { type: mime + ";charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 500)
}

export function suggestFilename(meta: ExportMeta, ext: "md" | "json"): string {
  const dt = new Date().toISOString().slice(0, 16).replace("T", "-").replace(/:/g, "")
  const channel = meta.channel.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40)
  const sess = meta.sessionId.slice(0, 8)
  return `cowork_${channel}_${sess}_${dt}.${ext}`
}
