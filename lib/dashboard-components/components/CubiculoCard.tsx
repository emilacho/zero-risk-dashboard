'use client'
/**
 * CubiculoCard · "cubículo del agente" · collapsed agent detail card.
 *
 * Lumen polish:
 *  - 3D tilt on mouse-move (Framer useMotionValue · perspective transform)
 *  - violet→cyan gradient hairline border revealed on hover
 *  - shimmer chip-style model label
 *  - status dot pulse-glow (active only)
 *  - skill chips with cyan glow on hover
 */
import { useRef, useState, type MouseEvent } from 'react'
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { formatCurrency, formatRelativeTime } from '../utils/format'
import type { AgentInvocation } from '../types'

export interface CubiculoCardProps {
  slug: string
  displayName: string
  role: string
  model: string
  status: 'active' | 'paused' | 'deprecated'
  description?: string
  metrics: {
    invocations30d: number
    costUsd30d: number
    avgDurationMs: number
    /** 0-100. */
    successRate: number
  }
  skills?: string[]
  recentInvocations?: AgentInvocation[]
  /** When true, surfaces the "open →" hint + pointer cursor. Click is
   *  expected to come from a wrapping `<Link>` so the card can stay
   *  serializable from a Server Component (no function prop). */
  interactive?: boolean
  onOpen?: () => void
  className?: string
}

export function CubiculoCard({
  slug,
  displayName,
  role,
  model,
  status,
  description,
  metrics,
  skills = [],
  recentInvocations = [],
  interactive: interactiveProp,
  onOpen,
  className,
}: CubiculoCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState(false)

  // 3D tilt math · max ±8 deg
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const rotateY = useSpring(useTransform(mx, [0, 1], [8, -8]), { stiffness: 220, damping: 18 })
  const rotateX = useSpring(useTransform(my, [0, 1], [-6, 6]), { stiffness: 220, damping: 18 })

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width)
    my.set((e.clientY - r.top) / r.height)
    el.style.setProperty('--spotlight-x', `${e.clientX - r.left}px`)
    el.style.setProperty('--spotlight-y', `${e.clientY - r.top}px`)
  }
  const onLeave = () => {
    mx.set(0.5)
    my.set(0.5)
    setHover(false)
  }

  const interactive = interactiveProp ?? !!onOpen
  const statusTone =
    status === 'active' ? { dot: 'bg-emerald-400', pulse: true }
    : status === 'paused' ? { dot: 'bg-amber-400', pulse: false }
    : { dot: 'bg-zinc-500', pulse: false }

  return (
    <motion.div
      ref={cardRef}
      onMouseEnter={() => setHover(true)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onOpen}
      data-glow="violet"
      data-spotlight="true"
      data-pop="true"
      className={['surface-card group p-5', interactive ? 'cursor-pointer' : '', className ?? ''].join(' ')}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1200,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Top accent gradient hairline */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(263 80% 65%), hsl(187 85% 55%), transparent)',
        }}
      />

      <div className="relative z-[2] flex flex-col gap-3.5" style={{ transform: 'translateZ(20px)' }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                aria-label={`status ${status}`}
                className={[
                  'inline-flex h-1.5 w-1.5 rounded-full',
                  statusTone.dot,
                  statusTone.pulse ? 'animate-pulse-glow' : '',
                ].join(' ')}
              />
              <span className="font-display text-[15px] font-semibold leading-none tracking-tight">
                {displayName}
              </span>
            </div>
            <code className="font-mono text-[11px] text-muted-foreground">{slug}</code>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
              {role}
            </span>
            <span className="rounded-md border border-border bg-secondary/50 px-1.5 py-[2px] font-mono text-[10px] text-foreground/80">
              {model}
            </span>
          </div>
        </div>

        {/* Description */}
        {description ? (
          <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-2">{description}</p>
        ) : null}

        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-2 border-y border-border/60 py-2.5">
          <Stat label="inv 30d" value={metrics.invocations30d.toLocaleString()} />
          <Stat label="costo 30d" value={formatCurrency(metrics.costUsd30d)} />
          <Stat label="latencia" value={`${(metrics.avgDurationMs / 1000).toFixed(1)}s`} />
          <Stat label="success" value={`${metrics.successRate.toFixed(0)}%`} tone="good" />
        </div>

        {/* Skill chips */}
        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {skills.slice(0, 4).map((s) => (
              <span
                key={s}
                className="rounded-md border border-accent/20 bg-accent/8 px-1.5 py-[2px] font-mono text-[9.5px] text-accent/90 transition-colors hover:bg-accent/15 hover:text-accent"
              >
                {s}
              </span>
            ))}
            {skills.length > 4 ? (
              <span className="self-center text-[10px] text-muted-foreground">+ {skills.length - 4}</span>
            ) : null}
          </div>
        ) : null}

        {/* Recent invocations · 2 lines max */}
        {recentInvocations.length > 0 ? (
          <div className="flex flex-col gap-1">
            {recentInvocations.slice(0, 2).map((inv) => (
              <div key={inv.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{inv.task}</span>
                {/* suppressHydrationWarning · see ActivityFeed for rationale */}
                <span className="text-muted-foreground/70 tabular-nums" suppressHydrationWarning>
                  {formatRelativeTime(inv.at)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {/* "Open" hint that appears on hover */}
        {interactive ? (
          <div
            className="mt-1 flex items-center justify-end gap-1 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground transition-opacity"
            style={{ opacity: hover ? 1 : 0.35 }}
          >
            <span>open</span>
            <span aria-hidden>→</span>
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <span
        className={[
          'font-display text-[13px] font-semibold leading-none tabular-nums',
          tone === 'good' ? 'text-emerald-300' : 'text-foreground',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  )
}
