"use client"

/**
 * HitlCard · client component · botón Approve/Reject conectado a
 * `/api/hitl/resolve` (canon canon-canon-`lib/hitl-resolve.ts`).
 *
 * Estados ·
 *   - idle       · ambos botones habilitados · canon canon-canon-Reject
 *                  reveals textarea para `rejection_reason`
 *   - submitting · ambos botones disabled · spinner inline
 *   - success    · canon canon-canon-success banner · row marked resolved
 *                  (shadow o live según env)
 *   - error      · canon canon-canon-banner rojo con `refused_reason`
 *
 * §148 honest · canon canon-canon-shadow gate (MC_HITL_RESOLVE_WIRE_ENABLED)
 * canon-canon-vive server-side. Si está OFF · canon-canon-`resolveHitlApproval`
 * returns `mode: 'shadow'` y este componente lo muestra explícito en el banner.
 */
import { useState } from "react"

interface HitlCardRow {
  id: string
  status: string
  priority: string | null
  client_id: string | null
  created_at: string
  payload: Record<string, unknown> | null
  context: Record<string, unknown> | null
  rejection_reason: string | null
}

interface HitlCardProps {
  row: HitlCardRow
  reviewerId: string
}

type LocalState =
  | { kind: "idle" }
  | { kind: "submitting"; decision: "approve" | "reject" }
  | {
      kind: "done"
      mode: "live" | "shadow"
      decision: "approve" | "reject"
      n8n_status?: number
    }
  | { kind: "error"; message: string }

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "just now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

export function HitlCard({ row, reviewerId }: HitlCardProps) {
  const [state, setState] = useState<LocalState>({ kind: "idle" })
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectForm, setShowRejectForm] = useState(false)

  async function submit(decision: "approve" | "reject") {
    if (decision === "reject" && !rejectionReason.trim()) {
      setShowRejectForm(true)
      return
    }
    setState({ kind: "submitting", decision })
    try {
      const res = await fetch("/api/hitl/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hitl_id: row.id,
          decision,
          reviewer_id: reviewerId,
          ...(decision === "reject" ? { rejection_reason: rejectionReason.trim() } : {}),
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean
            mode?: "live" | "shadow" | "refused"
            refused_reason?: string
            n8n_status?: number
          }
        | null
      if (!data || !data.ok || data.mode === "refused") {
        setState({
          kind: "error",
          message: data?.refused_reason ?? `HTTP ${res.status}`,
        })
        return
      }
      setState({
        kind: "done",
        mode: data.mode ?? "shadow",
        decision,
        n8n_status: data.n8n_status,
      })
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const submitting = state.kind === "submitting"
  const done = state.kind === "done"

  return (
    <li
      className="surface-card rim-instr p-4"
      data-rim="rose"
      data-testid={`hitl-card-${row.id}`}
    >
      <div className="relative z-[2] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="num text-[9px] uppercase tracking-[0.18em]"
              style={{
                color:
                  row.status === "pending"
                    ? "hsl(var(--danger))"
                    : "hsl(var(--success))",
              }}
            >
              {row.status}
            </span>
            <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
              {row.priority ?? "normal"}
            </span>
            <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
              client {row.client_id ? row.client_id.slice(0, 8) : "?"}
            </span>
          </div>
          <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
            {relativeTime(row.created_at)}
          </span>
        </div>

        {row.payload && Object.keys(row.payload).length > 0 ? (
          <pre className="rounded-md bg-black/20 p-2 text-[10px] leading-tight text-foreground/80 overflow-x-auto max-h-32">
            {JSON.stringify(row.payload, null, 2)}
          </pre>
        ) : (
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            (no payload preview)
          </p>
        )}

        {showRejectForm && state.kind === "idle" ? (
          <textarea
            data-testid={`hitl-reject-reason-${row.id}`}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent p-2 text-[11px]"
            placeholder="Razón del rechazo (requerida)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={2}
          />
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={submitting || done}
            onClick={() => submit("approve")}
            data-testid={`hitl-approve-${row.id}`}
            className="rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{
              background:
                done && state.kind === "done" && state.decision === "approve"
                  ? "hsl(var(--success) / 0.2)"
                  : "hsl(var(--success))",
              color:
                done && state.kind === "done" && state.decision === "approve"
                  ? "hsl(var(--success))"
                  : "white",
              opacity: submitting || done ? 0.7 : 1,
            }}
          >
            {state.kind === "submitting" && state.decision === "approve"
              ? "…"
              : "Approve"}
          </button>
          <button
            type="button"
            disabled={submitting || done}
            onClick={() => submit("reject")}
            data-testid={`hitl-reject-${row.id}`}
            className="rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{
              background:
                done && state.kind === "done" && state.decision === "reject"
                  ? "hsl(var(--danger) / 0.2)"
                  : "hsl(var(--danger))",
              color:
                done && state.kind === "done" && state.decision === "reject"
                  ? "hsl(var(--danger))"
                  : "white",
              opacity: submitting || done ? 0.7 : 1,
            }}
          >
            {state.kind === "submitting" && state.decision === "reject"
              ? "…"
              : "Reject"}
          </button>
          {state.kind === "done" ? (
            <span
              className="num text-[10px]"
              data-testid={`hitl-status-${row.id}`}
              style={{
                color:
                  state.mode === "shadow"
                    ? "hsl(var(--hue-amber))"
                    : "hsl(var(--success))",
              }}
            >
              {state.mode.toUpperCase()} · {state.decision}
              {state.n8n_status ? ` · n8n ${state.n8n_status}` : ""}
            </span>
          ) : null}
          {state.kind === "error" ? (
            <span
              className="num text-[10px]"
              data-testid={`hitl-error-${row.id}`}
              style={{ color: "hsl(var(--danger))" }}
            >
              ERROR · {state.message}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  )
}
