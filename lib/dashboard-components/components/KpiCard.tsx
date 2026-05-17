'use client'
/**
 * KpiCard · atomic single-metric card. Lumen-style polish:
 *  - gradient-mask border (revealed on hover)
 *  - violet/cyan spotlight that follows the cursor
 *  - large display-font digit · tabular-nums · trend-colored delta
 *  - optional sparkline embed
 *
 * Composable via the `size` prop · "feature" doubles the digit height and
 * gives the card more breathing room, used by the headline KPI in the
 * bento grid (Spend).
 */
import { ReactNode, useRef, type MouseEvent } from 'react'
import { Sparkline } from './Sparkline'
import { AnimatedNumber } from '../../../components/AnimatedNumber'
import type { KpiMetric } from '../types'

export interface KpiCardProps {
  label: string
  /** Optional icon element rendered above the label · usually a Lucide-style 16-20px svg. */
  icon?: ReactNode
  metric: KpiMetric
  /** How to format the value. */
  format?: 'number' | 'currency' | 'percent'
  /** Higher delta = better (true · default) or worse (false · e.g., spend, latency). */
  deltaIsGood?: boolean
  /** Render an inline sparkline strip when `metric.sparkline` is provided. */
  showSparkline?: boolean
  /** "feature" doubles digit size · used for the bento hero card. */
  size?: 'standard' | 'feature'
  /** Color of the hover spotlight + sparkline · matches what's emphasized. */
  glow?: 'violet' | 'cyan'
  className?: string
}

// Phase 4.1 · `format` prop is now a string identifier · maps to
// AnimatedNumber's formatType dispatcher. The old `fmt(value, kind)`
// helper is gone · NO function callbacks crossing boundaries.

function mapFormat(kind: KpiCardProps['format']):
  | 'currency'
  | 'percent'
  | 'compact' {
  if (kind === 'currency') return 'currency'
  if (kind === 'percent') return 'percent'
  return 'compact'
}

function fmtDelta(p: number): string {
  const sign = p > 0 ? '+' : ''
  return `${sign}${p.toFixed(1)}%`
}

export function KpiCard({
  label,
  icon,
  metric,
  format = 'number',
  deltaIsGood = true,
  showSparkline = true,
  size = 'standard',
  glow = 'violet',
  className,
}: KpiCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--spotlight-x', `${e.clientX - r.left}px`)
    el.style.setProperty('--spotlight-y', `${e.clientY - r.top}px`)
  }

  const deltaPositive = metric.delta > 0
  const deltaNeutral = metric.delta === 0
  const deltaGood = deltaNeutral ? null : deltaPositive ? deltaIsGood : !deltaIsGood

  const deltaClass =
    deltaGood === null
      ? 'text-muted-foreground'
      : deltaGood
      ? 'text-emerald-400'
      : 'text-rose-400'

  const isFeature = size === 'feature'

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      data-glow={glow}
      data-spotlight="true"
      data-pop="true"
      data-rim={glow}
      className={[
        'surface-card rim-instr group',
        isFeature ? 'p-6' : 'p-5',
        className ?? '',
      ].join(' ')}
    >
      {/* All real content sits above the spotlight pseudo · z-index 2 to lift above ::before border */}
      <div className="relative z-[2] flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {icon ? (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-secondary/40 text-primary shadow-[inset_0_0_8px_-2px_hsl(var(--primary)/0.4)]">
              {icon}
            </span>
          ) : null}
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </span>
        </div>

        <div className="flex items-end justify-between gap-4">
          <AnimatedNumber
            value={metric.value}
            formatType={mapFormat(format)}
            className={[
              'font-display font-semibold leading-none tabular-nums',
              isFeature ? 'text-5xl' : 'text-3xl',
            ].join(' ')}
          />
          {showSparkline && metric.sparkline?.length ? (
            <Sparkline
              points={metric.sparkline}
              width={isFeature ? 140 : 92}
              height={isFeature ? 44 : 30}
              stroke={glow === 'cyan' ? 'hsl(187 85% 55%)' : 'hsl(263 80% 65%)'}
              showEndDot
            />
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className={`font-semibold tabular-nums ${deltaClass}`}>
            {deltaNeutral ? '·' : fmtDelta(metric.delta)}
          </span>
          <span className="text-muted-foreground">{metric.deltaLabel}</span>
        </div>
      </div>
    </div>
  )
}
