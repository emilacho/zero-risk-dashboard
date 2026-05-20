"use client"
import Link from "next/link"
import { ArrowSquareOut, ChartBar } from "@phosphor-icons/react/dist/ssr"
import { useForms } from "../hooks/useFormsAdmin"

export function FormsTable() {
  const { data, isLoading, error } = useForms()

  return (
    <section className="surface-card rim-instr p-5" data-rim="cyan">
      <div className="relative z-[2] flex flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Forms catalog</h2>
            <p className="num mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              {data?.total ?? 0} total · Tally-backed · Stack V4 forms-out
            </p>
          </div>
          <Link
            href="/dashboard/forms/submissions"
            className="num inline-flex items-center gap-1 rounded border border-[hsl(var(--border))] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] hover:border-[hsl(var(--foreground))]"
          >
            <ChartBar size={12} />
            view submissions
          </Link>
        </header>

        {isLoading ? (
          <div className="grid gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-[hsl(var(--muted))]/40" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 p-3 text-xs text-[hsl(var(--destructive))]">
            {(error as Error).message}
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="rounded border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
            No hay forms registrados.
            <br />
            <span className="num mt-2 inline-block uppercase tracking-[0.18em]">
              Set up · zr-vault/wiki/playbooks/tally-forms-setup.md
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  {["name", "vertical", "tally id", "submissions", "status", "actions"].map((h) => (
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
                {data.rows.map((f) => (
                  <tr key={f.id} className="border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--muted))]/20">
                    <td className="py-3 pr-4">
                      <div className="font-medium">{f.name}</div>
                      {f.description ? (
                        <div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))] line-clamp-1">
                          {f.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="num py-3 pr-4 text-xs text-[hsl(var(--muted-foreground))]">{f.vertical ?? "—"}</td>
                    <td className="num py-3 pr-4 text-xs font-mono text-[hsl(var(--muted-foreground))]">
                      {f.tally_form_id ?? "—"}
                    </td>
                    <td className="num py-3 pr-4 font-mono text-sm">
                      <Link
                        href={`/dashboard/forms/submissions?form_id=${f.id}`}
                        className="hover:underline"
                      >
                        {f.submissions_count}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      {f.is_active ? (
                        <span className="num inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-600">
                          <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse-dot" />
                          active
                        </span>
                      ) : (
                        <span className="num rounded bg-zinc-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                          inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {f.tally_form_id ? (
                        <a
                          href={`https://tally.so/forms/${f.tally_form_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="num inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-foreground"
                        >
                          tally
                          <ArrowSquareOut size={10} />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
