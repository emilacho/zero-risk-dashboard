'use client'
/**
 * ActivityFeed · time-ordered stream of recent agent_invocations rows.
 *
 * Lumen polish:
 *  - staggered fade-up reveal (Framer Motion) on mount
 *  - status dot with halo per status
 *  - mono code + display-font task summary
 *  - subtle row hover highlight
 */
import { motion } from 'framer-motion'
import { formatCurrency, formatRelativeTime } from '../utils/format'
import type { AgentInvocation, InvocationStatus } from '../types'

export interface ActivityFeedProps {
  invocations: AgentInvocation[]
  title?: string
  /** Cap rendered rows · the rest stays available via scroll. */
  limit?: number
  onRowClick?: (inv: AgentInvocation) => void
  className?: string
}

const STATUS_STYLE: Record<
  InvocationStatus,
  { dot: string; halo: string; chipBg: string; chipFg: string; label: string }
> = {
  success: {
    dot: 'bg-emerald-400',
    halo: 'shadow-[0_0_0_4px_rgba(16,185,129,0.16)]',
    chipBg: 'bg-emerald-500/12',
    chipFg: 'text-emerald-300',
    label: 'success',
  },
  failure: {
    dot: 'bg-rose-400',
    halo: 'shadow-[0_0_0_4px_rgba(244,63,94,0.18)]',
    chipBg: 'bg-rose-500/14',
    chipFg: 'text-rose-300',
    label: 'fail',
  },
  escalated: {
    dot: 'bg-amber-400',
    halo: 'shadow-[0_0_0_4px_rgba(245,158,11,0.18)]',
    chipBg: 'bg-amber-500/14',
    chipFg: 'text-amber-300',
    label: 'escalated',
  },
  revision: {
    dot: 'bg-violet-400',
    halo: 'shadow-[0_0_0_4px_rgba(124,58,237,0.20)]',
    chipBg: 'bg-violet-500/14',
    chipFg: 'text-violet-300',
    label: 'revision',
  },
  running: {
    dot: 'bg-cyan-400',
    halo: 'shadow-[0_0_0_4px_rgba(6,182,212,0.20)]',
    chipBg: 'bg-cyan-500/14',
    chipFg: 'text-cyan-300',
    label: 'running',
  },
}

export function ActivityFeed({
  invocations,
  title = 'Actividad reciente',
  limit = 12,
  onRowClick,
  className,
}: ActivityFeedProps) {
  const rows = invocations.slice(0, limit)
  return (
    <div
      data-glow="cyan"
      className={['surface-card p-5', className ?? ''].join(' ')}
    >
      <div className="relative z-[2]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold tracking-tight">
              {title}
            </h3>
            <p className="mt-0.5 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              live stream · agent_invocations
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {invocations.length} eventos
          </span>
        </div>

        <ul className="flex flex-col">
          {rows.map((inv, idx) => {
            const s = STATUS_STYLE[inv.status]
            const interactive = !!onRowClick
            return (
              <motion.li
                key={inv.id}
                initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.4, delay: idx * 0.035, ease: [0.2, 0.8, 0.2, 1] }}
                onClick={interactive ? () => onRowClick!(inv) : undefined}
                className={[
                  'grid grid-cols-[14px_minmax(0,1fr)_auto] gap-3 py-2.5',
                  idx === 0 ? '' : 'border-t border-border/60',
                  interactive ? 'cursor-pointer transition-colors hover:bg-secondary/30 -mx-2 px-2 rounded' : '',
                ].join(' ')}
              >
                {/* Status dot + halo */}
                <span aria-hidden className={`mt-1.5 inline-flex h-2 w-2 rounded-full ${s.dot} ${s.halo}`} />

                {/* Middle column · agent slug + status + task */}
                <div className="flex min-w-0 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-[12px] text-foreground">
                      {inv.agent}
                    </code>
                    <span
                      className={`rounded px-1.5 py-[1px] text-[9.5px] font-bold uppercase tracking-[0.06em] ${s.chipBg} ${s.chipFg}`}
                    >
                      {s.label}
                    </span>
                    {inv.clientId ? (
                      <span className="text-[10px] text-muted-foreground">
                        · client {inv.clientId.slice(0, 8)}
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    {inv.task}
                  </span>
                </div>

                {/* Right column · time + meta */}
                <div className="text-right">
                  <div className="text-[12px] text-foreground tabular-nums">
                    {formatRelativeTime(inv.at)}
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {(inv.durationMs / 1000).toFixed(1)}s · {formatCurrency(inv.costUsd)}
                  </div>
                </div>
              </motion.li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
