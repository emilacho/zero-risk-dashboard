"use client"
/**
 * NodeActivityDrawer · slides in from the right (480px) when a node in
 * the workflow canvas is clicked. Shows recent activity for that node ·
 * input/output previews · drill-down links a /agents/{slug} y /clients/{id}.
 *
 *   - Polls `/api/workflows/node-activity` every 5s while open
 *   - Pause polling cuando drawer cerrado
 *   - Expand/collapse payload previews
 *
 * Trigger · WorkflowLiveCanvas owns `openNode` state · passes el node
 * a este drawer (NO function-prop callbacks crossing boundary · both
 * live in client tree).
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import * as Dialog from "@radix-ui/react-dialog"
import {
  X,
  ArrowSquareOut,
  ArrowRight,
  CircleNotch,
  Check,
  Warning,
  Pulse,
  CaretDown,
  CaretRight,
} from "@phosphor-icons/react/dist/ssr"
import { translateNodeType, type IconKind } from "@/lib/n8n-node-translations"
import { IconForKind } from "./NodeIcons"

interface NodeActivityRow {
  id: string
  source: "n8n" | "agent_invocations"
  status: string
  startedAt: string
  durationMs: number | null
  costUsd: number | null
  tokensIn: number | null
  tokensOut: number | null
  model: string | null
  agentName: string | null
  clientId: string | null
  inputPreview: string | null
  outputPreview: string | null
  errorMessage: string | null
  rawRef: string | null
}

export interface OpenNode {
  workflowId: string
  nodeName: string
  nodeType: string
}

export function NodeActivityDrawer({
  open,
  onClose,
  node,
}: {
  open: boolean
  onClose: () => void
  node: OpenNode | null
}) {
  const [rows, setRows] = useState<NodeActivityRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, "input" | "output" | "error" | null>>({})

  useEffect(() => {
    if (!open || !node) {
      setRows([])
      setError(null)
      setExpanded({})
      return
    }
    let cancelled = false
    setLoading(true)

    async function tick() {
      if (!node) return
      try {
        const params = new URLSearchParams({
          workflowId: node.workflowId,
          nodeName: node.nodeName,
          nodeType: node.nodeType,
          limit: "20",
        })
        const res = await fetch(`/api/workflows/node-activity?${params.toString()}`, {
          cache: "no-store",
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as { rows: NodeActivityRow[] }
        if (!cancelled) {
          setRows(json.rows ?? [])
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "fetch_failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    tick()
    const id = window.setInterval(tick, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [open, node])

  if (!node) return null
  const translation = translateNodeType(node.nodeType)

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-blur-fade" />
        <Dialog.Content
          className="surface-card rim-instr fixed right-0 top-0 z-[71] flex h-screen w-[min(480px,100vw)] flex-col overflow-hidden border-l-[0.5px] border-l-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--background)/0.96)] p-0"
          data-rim={translation.hue}
        >
          {/* Header */}
          <div className="relative z-[2] border-b-[0.5px] border-[hsl(var(--primary-glow)/0.18)] bg-[hsl(var(--background)/0.92)] p-5 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-[0.5px]"
                  style={{
                    borderColor: `hsl(var(--hue-${translation.hue}) / 0.5)`,
                    background: `hsl(var(--hue-${translation.hue}) / 0.15)`,
                    color: `hsl(var(--hue-${translation.hue}))`,
                  }}
                >
                  <IconForKind kind={translation.icon as IconKind} />
                </span>
                <div>
                  <p
                    className="num text-[10px] uppercase tracking-[0.22em]"
                    style={{ color: `hsl(var(--hue-${translation.hue}))` }}
                  >
                    nodo · drill-down
                  </p>
                  <Dialog.Title className="font-display text-base font-semibold tracking-tight">
                    {translation.label}
                  </Dialog.Title>
                  <p className="num mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                    {node.nodeName} · {node.nodeType}
                  </p>
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--primary-glow)/0.08)]"
                >
                  <X strokeWidth={1.5} className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            <p className="num mt-3 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              actualiza 5s · {rows.length} actividad reciente
            </p>
            {error ? (
              <p className="num mt-1 text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--danger))]">
                error · {error}
              </p>
            ) : null}
          </div>

          {/* Body · scroll */}
          <div className="relative z-[2] flex-1 overflow-y-auto p-5">
            {loading && rows.length === 0 ? (
              <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                <CircleNotch strokeWidth={1.5} className="h-4 w-4 animate-spin" />
                <span className="num text-[11px] uppercase tracking-[0.18em]">
                  cargando...
                </span>
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-lg border-[0.5px] border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/0.3)] p-6 text-center">
                <Pulse strokeWidth={1.5} className="mx-auto h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                <p className="num mt-2 text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                  Sin actividad reciente para este nodo
                </p>
                <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                  Cuando el workflow se ejecute · las invocaciones aparecen acá automáticamente.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {rows.map((r) => (
                  <li
                    key={`${r.source}-${r.id}`}
                    className="rounded-lg border-[0.5px] border-[hsl(var(--primary-glow)/0.18)] bg-[hsl(var(--card)/0.45)] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={r.status} />
                        <span
                          className="num text-[10px] uppercase tracking-[0.18em]"
                          style={{ color: statusColor(r.status) }}
                        >
                          {r.status}
                        </span>
                        <span className="num text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                          {r.source}
                        </span>
                      </div>
                      <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                        {fmtRelative(r.startedAt)}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                      <Stat label="duration" value={r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"} />
                      <Stat label="cost" value={r.costUsd != null ? `$${r.costUsd.toFixed(4)}` : "—"} />
                      <Stat
                        label="tokens"
                        value={
                          r.tokensIn != null || r.tokensOut != null
                            ? `${(r.tokensIn ?? 0) + (r.tokensOut ?? 0)}`
                            : "—"
                        }
                      />
                    </div>

                    {r.model || r.agentName ? (
                      <p className="num mt-2 text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                        {r.model ? `${r.model}` : null}
                        {r.model && r.agentName ? " · " : ""}
                        {r.agentName ? r.agentName : null}
                      </p>
                    ) : null}

                    {r.inputPreview ? (
                      <ExpandableBlock
                        label="input"
                        preview={r.inputPreview}
                        expanded={expanded[r.id] === "input"}
                        onToggle={() =>
                          setExpanded((s) => ({
                            ...s,
                            [r.id]: s[r.id] === "input" ? null : "input",
                          }))
                        }
                      />
                    ) : null}
                    {r.outputPreview ? (
                      <ExpandableBlock
                        label="output"
                        preview={r.outputPreview}
                        expanded={expanded[r.id] === "output"}
                        onToggle={() =>
                          setExpanded((s) => ({
                            ...s,
                            [r.id]: s[r.id] === "output" ? null : "output",
                          }))
                        }
                      />
                    ) : null}
                    {r.errorMessage ? (
                      <ExpandableBlock
                        label="error"
                        preview={r.errorMessage}
                        hue="danger"
                        expanded={expanded[r.id] === "error"}
                        onToggle={() =>
                          setExpanded((s) => ({
                            ...s,
                            [r.id]: s[r.id] === "error" ? null : "error",
                          }))
                        }
                      />
                    ) : null}

                    {/* Drill-down links */}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px]">
                      {r.agentName ? (
                        <Link
                          href={`/agents/${r.agentName}`}
                          onClick={onClose}
                          className="num inline-flex items-center gap-1 uppercase tracking-[0.16em] text-[hsl(var(--accent))] hover:text-foreground"
                        >
                          agent <ArrowRight strokeWidth={1.5} className="h-3 w-3" />
                        </Link>
                      ) : null}
                      {r.clientId ? (
                        <Link
                          href={`/clients/${r.clientId}`}
                          onClick={onClose}
                          className="num inline-flex items-center gap-1 uppercase tracking-[0.16em] text-[hsl(var(--accent))] hover:text-foreground"
                        >
                          cliente <ArrowRight strokeWidth={1.5} className="h-3 w-3" />
                        </Link>
                      ) : null}
                      {r.source === "n8n" && r.rawRef ? (
                        <a
                          href={r.rawRef}
                          target="_blank"
                          rel="noreferrer"
                          className="num inline-flex items-center gap-1 uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] hover:text-foreground"
                        >
                          n8n raw <ArrowSquareOut strokeWidth={1.5} className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === "completed" || s === "success" || s === "ok") return "hsl(var(--success))"
  if (s === "failed" || s === "error") return "hsl(var(--danger))"
  if (s === "running" || s === "in_progress") return "hsl(var(--accent))"
  return "hsl(var(--muted-foreground))"
}

function StatusIcon({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === "completed" || s === "success") {
    return <Check strokeWidth={2} className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
  }
  if (s === "failed" || s === "error") {
    return <Warning strokeWidth={2} className="h-3.5 w-3.5 text-[hsl(var(--danger))]" />
  }
  if (s === "running" || s === "in_progress") {
    return (
      <CircleNotch strokeWidth={2} className="h-3.5 w-3.5 animate-spin text-[hsl(var(--accent))]" />
    )
  }
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--muted-foreground))]" />
}

function fmtRelative(iso: string): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "just now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
        {label}
      </p>
      <p className="num text-[11px] tabular-nums">{value}</p>
    </div>
  )
}

function ExpandableBlock({
  label,
  preview,
  expanded,
  onToggle,
  hue = "muted",
}: {
  label: string
  preview: string
  expanded: boolean
  onToggle: () => void
  hue?: "muted" | "danger"
}) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        className="num inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] hover:text-foreground"
      >
        {expanded ? (
          <CaretDown strokeWidth={1.5} className="h-3 w-3" />
        ) : (
          <CaretRight strokeWidth={1.5} className="h-3 w-3" />
        )}
        {label}
      </button>
      {expanded ? (
        <pre
          className="mt-1 max-h-[260px] overflow-y-auto rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.55)] p-2 text-[10px] leading-relaxed"
          style={{
            color: hue === "danger" ? "hsl(var(--danger))" : "hsl(var(--foreground)/0.85)",
          }}
        >
          {preview}
        </pre>
      ) : null}
    </div>
  )
}
