'use client'
/**
 * BarListTopAgents · ranked horizontal bar list (top N agents by cost).
 * Lumen polish:
 *  - violet→cyan gradient fill with running shimmer
 *  - rank badge with display font + tabular nums
 *  - trend chevron · success/danger/muted
 *  - bars draw in with sweep-bar keyframe on mount
 */
import { useId } from 'react'
import { formatCurrency } from '../utils/format'
import type { AgentSummary } from '../types'

export interface BarListTopAgentsProps {
  agents: AgentSummary[]
  limit?: number
  title?: string
  className?: string
}

export function BarListTopAgents({
  agents,
  limit = 8,
  title = 'Top agentes por costo',
  className,
}: BarListTopAgentsProps) {
  const sorted = [...agents].sort((a, b) => b.costUsd - a.costUsd)
  const shown = sorted.slice(0, limit)
  const hidden = sorted.length - shown.length
  const max = shown[0]?.costUsd ?? 1
  const seed = useId().replace(/[^a-z0-9]/gi, '')

  return (
    <div
      data-glow="violet"
      className={['surface-card p-5', className ?? ''].join(' ')}
    >
      <div className="relative z-[2]">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <h3 className="font-display text-base font-semibold tracking-tight">
              {title}
            </h3>
            <p className="mt-0.5 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              usd · últimos 30 días
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {sorted.length} agentes
          </span>
        </div>

        <ul className="flex flex-col gap-3.5">
          {shown.map((a, i) => {
            const pct = Math.max(2, (a.costUsd / max) * 100)
            return (
              <li key={a.slug + seed + i} className="relative">
                <div className="mb-1 flex items-baseline justify-between text-[12px]">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-mono tabular-nums text-[10px] text-muted-foreground w-5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <code className="font-mono text-[12px] text-foreground truncate">
                      {a.slug}
                    </code>
                    <TrendIcon trend={a.trend} />
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      · {a.model}
                    </span>
                  </span>
                  <span className="tabular-nums text-foreground font-semibold">
                    {formatCurrency(a.costUsd)}
                  </span>
                </div>
                {/* Track */}
                <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary/50">
                  {/* Bar fill · violet→cyan · animates on mount */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-primary/80 to-accent animate-sweep-bar"
                    style={{ ['--sweep-target' as unknown as string]: `${pct}%` }}
                  />
                  {/* Shimmer overlay · runs across the filled portion only */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
                    style={{ width: `${pct}%` }}
                  >
                    <div className="absolute inset-0 animate-shimmer rounded-full opacity-60" />
                  </div>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                  {a.invocations.toLocaleString()} invocaciones
                </div>
              </li>
            )
          })}
          {hidden > 0 ? (
            <li className="pt-1 text-[10px] text-muted-foreground">
              + {hidden} agentes más
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

function TrendIcon({ trend }: { trend: AgentSummary['trend'] }) {
  if (trend === 'up') {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" className="text-emerald-400">
        <path d="M1 7l3-3 2 2 3-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (trend === 'down') {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" className="text-rose-400">
        <path d="M1 3l3 3 2-2 3 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted-foreground">
      <path d="M1 5h8" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}
