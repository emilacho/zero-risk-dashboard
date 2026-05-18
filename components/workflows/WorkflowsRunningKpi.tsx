"use client"
/**
 * WorkflowsRunningKpi · home page KPI · "Workflows ejecutándose ahora · N"
 *
 * Polls `/api/workflows/running` every 5s · click opens Radix Dialog
 * modal with the live list · row click → /workflows/{id} fullscreen.
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import * as Dialog from "@radix-ui/react-dialog"
import {
  Pulse,
  ArrowRight,
  X,
  CircleNotch,
} from "@phosphor-icons/react/dist/ssr"

interface RunningRow {
  workflowId: string
  workflowName: string
  executionId: string
  startedAt: string
}

function fmtRelative(iso: string): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "just now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  return `${Math.floor(ms / 3_600_000)}h ago`
}

export function WorkflowsRunningKpi() {
  const [rows, setRows] = useState<RunningRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const res = await fetch("/api/workflows/running", { cache: "no-store" })
        if (!res.ok) return
        const json = (await res.json()) as { running?: RunningRow[] }
        if (cancelled) return
        setRows(json.running ?? [])
        setLoading(false)
      } catch {
        /* ignore · keep last value */
      }
    }
    tick()
    const id = window.setInterval(tick, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="surface-card rim-instr group relative w-full p-4 text-left"
          data-rim="cyan"
          data-pop="true"
        >
          <div className="relative z-[2]">
            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border-[0.5px] border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]">
                <Pulse strokeWidth={1.5} className="h-3.5 w-3.5" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
                workflows · ejecutándose ahora
              </span>
            </div>
            <div className="mt-2 flex items-end justify-between">
              <span className="font-display text-3xl font-semibold leading-none tabular-nums">
                {loading ? (
                  <CircleNotch strokeWidth={1.5} className="h-6 w-6 animate-spin" />
                ) : (
                  rows.length
                )}
              </span>
              <span className="num text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] transition group-hover:text-foreground">
                ver lista →
              </span>
            </div>
            <p className="num mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
              poll 5s · n8n live executions
            </p>
            {rows.length > 0 ? (
              <span
                aria-hidden
                className="animate-breathing absolute right-3 top-3 inline-block h-2 w-2 rounded-full bg-[hsl(var(--accent))]"
              />
            ) : null}
          </div>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm data-[state=open]:animate-blur-fade" />
        <Dialog.Content
          className="surface-card rim-instr fixed left-1/2 top-1/2 z-[71] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-6"
          data-rim="cyan"
        >
          <div className="relative z-[2]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p
                  className="num text-[10px] uppercase tracking-[0.22em]"
                  style={{ color: "hsl(var(--accent))" }}
                >
                  equipo virtual · live
                </p>
                <Dialog.Title className="font-display text-xl font-semibold tracking-tight">
                  Workflows ejecutándose ahora · {rows.length}
                </Dialog.Title>
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

            {rows.length === 0 ? (
              <p className="num text-xs text-[hsl(var(--muted-foreground))]">
                Sin executions activas en este momento · próximo poll en 5s.
              </p>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-[hsl(var(--border)/0.6)] overflow-y-auto">
                {rows.map((r) => (
                  <li key={r.executionId}>
                    <Link
                      href={`/workflows/${r.workflowId}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between gap-3 px-1 py-3 transition hover:bg-[hsl(var(--primary-glow)/0.06)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="animate-breathing inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />
                          <span className="truncate text-[13px]">
                            {r.workflowName.replace(/^Zero Risk[ ·—-]*/, "")}
                          </span>
                        </div>
                        <p className="num mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                          execution {r.executionId} · started {fmtRelative(r.startedAt)}
                        </p>
                      </div>
                      <ArrowRight
                        strokeWidth={1.5}
                        className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--accent))]"
                      />
                    </Link>
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
