"use client"
import { useState } from "react"
import { X, Eye, ShieldCheck, Warning } from "@phosphor-icons/react/dist/ssr"
import { useFormSubmissions, type FormSubmissionRow } from "../hooks/useFormsAdmin"

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}

export function SubmissionsTable({ formId }: { formId: string | null }) {
  const [viewing, setViewing] = useState<FormSubmissionRow | null>(null)
  const { data, isLoading, error } = useFormSubmissions(formId)

  return (
    <section className="surface-card rim-instr p-5" data-rim="violet">
      <div className="relative z-[2] flex flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Form submissions</h2>
            <p className="num mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              {data?.total ?? 0} total{formId ? ` · filtered by form_id ${formId.slice(0, 8)}…` : " · all forms"}
            </p>
          </div>
        </header>

        {isLoading ? (
          <div className="grid gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-[hsl(var(--muted))]/40" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 p-3 text-xs text-[hsl(var(--destructive))]">
            {(error as Error).message}
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="rounded border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
            No submissions todavía. Verify webhook config in Tally points to <span className="num">/api/forms/submit</span>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  {["received", "source", "form_id", "event_id", "verified", "actions"].map((h) => (
                    <th
                      key={h}
                      className="num py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((s) => (
                  <tr key={s.id} className="border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--muted))]/20">
                    <td className="num py-3 pr-4 text-xs text-[hsl(var(--muted-foreground))]">
                      {formatRelative(s.created_at)}
                    </td>
                    <td className="num py-3 pr-4 text-xs">{s.source}</td>
                    <td className="num py-3 pr-4 text-xs font-mono text-[hsl(var(--muted-foreground))]">
                      {s.form_id ? s.form_id.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="num py-3 pr-4 text-xs font-mono text-[hsl(var(--muted-foreground))]">
                      {s.source_event_id ?? "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {s.signature_verified ? (
                        <span className="num inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-emerald-600">
                          <ShieldCheck size={12} />
                          verified
                        </span>
                      ) : (
                        <span className="num inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-amber-600">
                          <Warning size={12} />
                          unverified
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => setViewing(s)}
                        className="num inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-foreground"
                      >
                        <Eye size={12} />
                        payload
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewing ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setViewing(null)}
        >
          <div
            className="surface-card max-h-[80vh] w-full max-w-3xl overflow-hidden p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold tracking-tight">Submission payload</h3>
                <p className="num mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  id {viewing.id} · {formatRelative(viewing.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                aria-label="close"
                className="rounded p-1 hover:bg-[hsl(var(--muted))]/40"
              >
                <X size={16} />
              </button>
            </header>
            <pre className="max-h-[60vh] overflow-auto rounded bg-[hsl(var(--muted))]/30 p-4 font-mono text-xs">
              {JSON.stringify(viewing.payload, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </section>
  )
}
