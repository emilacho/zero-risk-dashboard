"use client"
/**
 * WorkflowLiveCanvas · client-side wrapper that wires WorkflowSkeleton
 * to the realtime poll hook + a sidebar showing recent executions.
 *
 * Layout · main canvas 80vh (canon dispatch G) + right rail history.
 */
import { useState } from "react"
import { WorkflowSkeleton, type N8nNode, type N8nConnections } from "./WorkflowSkeleton"
import { NodeActivityDrawer, type OpenNode } from "./NodeActivityDrawer"
import { useN8nExecutionRealtime } from "@/lib/n8n-realtime"
import {
  CircleNotch,
  Warning,
  ClockCounterClockwise,
  Play,
} from "@phosphor-icons/react/dist/ssr"

interface WorkflowLiveCanvasProps {
  workflowId: string
  nodes: N8nNode[]
  connections: N8nConnections
  triggerNodeNames: string[]
}

function fmtRelative(iso: string): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "just now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

export function WorkflowLiveCanvas({
  workflowId,
  nodes,
  connections,
  triggerNodeNames,
}: WorkflowLiveCanvasProps) {
  const { running, lastDone, lastFailed, activeNodeNames, loading, error } =
    useN8nExecutionRealtime(workflowId, triggerNodeNames, 3000)
  const [triggerState, setTriggerState] = useState<"idle" | "firing" | "ok" | "err">("idle")
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)
  const [openNode, setOpenNode] = useState<OpenNode | null>(null)

  async function fireManual() {
    setTriggerState("firing")
    setTriggerMsg(null)
    try {
      const res = await fetch(
        `/api/workflows/trigger?workflowId=${workflowId}`,
        { method: "POST" },
      )
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setTriggerState("err")
        setTriggerMsg(json.error ?? `HTTP ${res.status}`)
        return
      }
      setTriggerState("ok")
      setTimeout(() => setTriggerState("idle"), 2000)
    } catch (e) {
      setTriggerState("err")
      setTriggerMsg(e instanceof Error ? e.message : "trigger_failed")
    }
  }

  // Heuristic doneNodes · cuando lastDone existe Y ningún execution
  // running · todos los nodos quedan "done" green check. Visual cue
  // útil para Emilio · 100% accurate per-node tracking es follow-up.
  const allDone =
    running.length === 0 && lastDone != null
      ? nodes.map((n) => n.name)
      : []
  const allFailed =
    running.length === 0 && lastFailed != null && !lastDone
      ? nodes.map((n) => n.name)
      : []

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-3">
        {/* Status banner */}
        <div className="flex items-center justify-between rounded-lg border-[0.5px] border-[hsl(var(--primary-glow)/0.2)] bg-[hsl(var(--card)/0.5)] px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-3">
            {running.length > 0 ? (
              <>
                <span className="num inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
                  <span className="animate-breathing inline-block h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />
                  ejecutándose ahora · {running.length} run{running.length === 1 ? "" : "s"}
                </span>
              </>
            ) : lastFailed && (!lastDone || new Date(lastFailed.startedAt) > new Date(lastDone.startedAt)) ? (
              <span className="num inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--danger))]">
                <Warning strokeWidth={1.5} className="h-3.5 w-3.5" />
                última falló · {fmtRelative(lastFailed.startedAt)}
              </span>
            ) : lastDone ? (
              <span className="num text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--success))]">
                ● última ejecución ok · {fmtRelative(lastDone.startedAt)}
              </span>
            ) : (
              <span className="num text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                {loading ? "cargando..." : "sin ejecuciones recientes"}
              </span>
            )}
            {error ? (
              <span className="num text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--danger))]">
                · poll error: {error}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={fireManual}
            disabled={triggerState === "firing"}
            className="num inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--accent)/0.08)] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] transition hover:bg-[hsl(var(--accent)/0.16)] disabled:opacity-50"
          >
            {triggerState === "firing" ? (
              <CircleNotch strokeWidth={1.5} className="h-3 w-3 animate-spin" />
            ) : (
              <Play strokeWidth={1.5} className="h-3 w-3" />
            )}
            {triggerState === "ok"
              ? "disparado ✓"
              : triggerState === "err"
                ? "error · ver consola"
                : "disparar manual"}
          </button>
        </div>

        <p className="num self-end text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
          tip · click cualquier nodo del canvas → drawer con actividad reciente
        </p>

        {/* Canvas · 80vh per dispatch */}
        <WorkflowSkeleton
          nodes={nodes}
          connections={connections}
          height="80vh"
          activeNodeNames={activeNodeNames}
          doneNodeNames={allDone}
          failedNodeNames={allFailed}
          onNodeClick={({ name, type }) =>
            setOpenNode({ workflowId, nodeName: name, nodeType: type })
          }
        />

        {triggerState === "err" && triggerMsg ? (
          <p className="num text-[10px] text-[hsl(var(--danger))]">
            trigger error: {triggerMsg}
          </p>
        ) : null}
      </div>

      {/* ClockCounterClockwise sidebar · últimas 10 executions */}
      <aside className="surface-card rim-instr p-4" data-rim="violet">
        <div className="relative z-[2]">
          <div className="mb-3 flex items-center gap-2">
            <ClockCounterClockwise strokeWidth={1.5} className="h-4 w-4 text-[hsl(var(--primary-glow))]" />
            <h2 className="font-display text-sm font-semibold tracking-tight">
              Historial · últimas 10
            </h2>
          </div>
          <HistoryList workflowId={workflowId} />
        </div>
      </aside>

      {/* Phase 5.1 · per-node activity drawer · slides from right */}
      <NodeActivityDrawer
        open={openNode != null}
        onClose={() => setOpenNode(null)}
        node={openNode}
      />
    </div>
  )
}

function HistoryList({ workflowId }: { workflowId: string }) {
  const { running, lastDone, lastFailed } = useN8nExecutionRealtime(
    workflowId,
    [],
    8000,
  )
  // Combine + dedupe · running first, then most recent done/failed
  const rows: Array<{ id: string; startedAt: string; state: "running" | "done" | "failed" }> = []
  running.forEach((r) =>
    rows.push({ id: r.id, startedAt: r.startedAt, state: "running" }),
  )
  if (lastDone) rows.push({ id: lastDone.id, startedAt: lastDone.startedAt, state: "done" })
  if (lastFailed)
    rows.push({ id: lastFailed.id, startedAt: lastFailed.startedAt, state: "failed" })

  if (rows.length === 0) {
    return (
      <p className="num text-[10px] text-[hsl(var(--muted-foreground))]">
        Sin ejecuciones registradas en n8n.
      </p>
    )
  }
  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => (
        <li
          key={r.id + "-" + i}
          className="flex items-center justify-between rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] px-2 py-1.5"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  r.state === "running"
                    ? "hsl(var(--accent))"
                    : r.state === "done"
                      ? "hsl(var(--success))"
                      : "hsl(var(--danger))",
              }}
            />
            <span className="num text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
              {r.state}
            </span>
          </div>
          <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
            {fmtRelative(r.startedAt)}
          </span>
        </li>
      ))}
    </ul>
  )
}
