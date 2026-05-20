"use client"
/**
 * AtlasGitActivity · Section 10 · last 8 commits.
 *
 * Renders hash · date · message · author. PR# link extracted from
 * message via regex `#NNN` (squash-merge convention). If git source is
 * `none` (no env nor exec), shows graceful "no git data" banner.
 */
import { useAtlasGit } from "../hooks/useAtlasGit"
import type { AtlasCommitRow } from "../types"
import { formatRelativeIso, truncate } from "../tokens"

function extractPrNumber(message: string): number | null {
  const m = message.match(/#(\d{2,5})\b/)
  return m ? Number(m[1]) : null
}

function CommitRow({ commit }: { commit: AtlasCommitRow }) {
  const pr = extractPrNumber(commit.message)
  return (
    <tr className="border-b border-[hsl(var(--border))]/40 last:border-0">
      <td className="num py-2 pr-3 align-top text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
        {commit.hash.slice(0, 7)}
      </td>
      <td className="num py-2 pr-3 align-top text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
        {formatRelativeIso(commit.date)}
      </td>
      <td className="py-2 pr-3 align-top text-sm">
        {truncate(commit.message, 90)}
      </td>
      <td className="num py-2 align-top text-[11px] tabular-nums">
        {pr ? (
          <span className="text-[hsl(var(--accent))]">#{pr}</span>
        ) : (
          <span className="text-[hsl(var(--muted-foreground))]">—</span>
        )}
      </td>
    </tr>
  )
}

export function AtlasGitActivity() {
  const { data, isLoading } = useAtlasGit()
  const commits = (data?.last_10_commits ?? []).slice(0, 8)

  return (
    <section
      className="surface-card rim-instr p-5"
      data-rim="cyan"
      aria-label="Git activity"
    >
      <div className="relative z-[2] flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Git activity
          </h2>
          <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            {data?.branch ? `${data.branch} · ` : ""}
            last {commits.length} commits · source {data?.source ?? "—"}
          </span>
        </div>

        {isLoading ? (
          <p className="num text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            cargando git log…
          </p>
        ) : commits.length === 0 ? (
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            no git data · source={data?.source ?? "none"}
            {data?.warning ? ` · ${data.warning}` : ""}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="num py-2 pr-3 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    hash
                  </th>
                  <th className="num py-2 pr-3 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    when
                  </th>
                  <th className="num py-2 pr-3 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    message
                  </th>
                  <th className="num py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    pr
                  </th>
                </tr>
              </thead>
              <tbody>
                {commits.map((c) => (
                  <CommitRow key={c.hash} commit={c} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
