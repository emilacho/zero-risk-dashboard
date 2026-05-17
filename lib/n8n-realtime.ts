"use client"
/**
 * useN8nExecutionRealtime · polls n8n executions via dashboard proxy
 * every `pollMs` (default 3000) and surfaces:
 *
 *   - `running` · current running executions for this workflow (array)
 *   - `lastDone` · most recent successful execution
 *   - `lastFailed` · most recent failed execution
 *   - `activeNodeNames` · nodes that should pulse cyan in WorkflowSkeleton
 *
 * For v1 · `activeNodeNames` is derived heuristically · when ANY
 * execution is running, mark the workflow's first trigger node as
 * active. Real per-node activity requires n8n's execution data which
 * lives at /executions/{id} · TODO follow-up (Phase 5.1).
 *
 * Supabase Realtime hook (cascade_runs) is a secondary signal · added
 * when `clientId` is present and we expect cascade events to fire.
 * Skipped for v1 simplicity · easy add-on later.
 */
import { useEffect, useState } from "react"

interface ExecutionRow {
  id: string
  workflowId: string
  startedAt: string
  stoppedAt: string | null
  status?: string
  finished: boolean
  mode?: string
}

interface UseN8nExecutionRealtimeResult {
  running: ExecutionRow[]
  lastDone: ExecutionRow | null
  lastFailed: ExecutionRow | null
  /** Subset of node.name strings that are currently active · v1 heuristic */
  activeNodeNames: string[]
  /** Loading state · false after first fetch completes */
  loading: boolean
  /** Last error if any */
  error: string | null
}

export function useN8nExecutionRealtime(
  workflowId: string,
  triggerNodeNames: string[] = [],
  pollMs: number = 3000,
): UseN8nExecutionRealtimeResult {
  const [running, setRunning] = useState<ExecutionRow[]>([])
  const [lastDone, setLastDone] = useState<ExecutionRow | null>(null)
  const [lastFailed, setLastFailed] = useState<ExecutionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function tick() {
      try {
        const [runRes, allRes] = await Promise.all([
          fetch(
            `/api/workflows/executions?workflowId=${workflowId}&status=running&limit=10`,
            { cache: "no-store" },
          ),
          fetch(
            `/api/workflows/executions?workflowId=${workflowId}&limit=20`,
            { cache: "no-store" },
          ),
        ])
        if (!runRes.ok || !allRes.ok) throw new Error("n8n proxy failed")
        const runJson = (await runRes.json()) as { executions: ExecutionRow[] }
        const allJson = (await allRes.json()) as { executions: ExecutionRow[] }
        if (cancelled) return
        setRunning(runJson.executions ?? [])
        const success = (allJson.executions ?? []).find(
          (e) => e.status === "success" || (e.finished && e.status !== "error"),
        )
        const failed = (allJson.executions ?? []).find(
          (e) => e.status === "error" || e.status === "failed",
        )
        setLastDone(success ?? null)
        setLastFailed(failed ?? null)
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "poll_failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    tick()
    const id = window.setInterval(tick, pollMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [workflowId, pollMs])

  // v1 heuristic · if any execution is running, the workflow's triggers
  // are presumed active. Phase 5.1 will fetch /executions/{id} for
  // per-node status.
  const activeNodeNames = running.length > 0 ? triggerNodeNames : []

  return { running, lastDone, lastFailed, activeNodeNames, loading, error }
}
