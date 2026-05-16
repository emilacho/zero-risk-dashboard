'use client'
/**
 * ClienteCarpetaCard · "carpeta del cliente" · folder-style client card.
 *
 * Lumen polish:
 *  - violet→cyan folder tab + faint glow halo
 *  - animated SVG arc gauge for health-score (svg dasharray draw)
 *  - status pill with subtle bg + matching text tone
 *  - hover-lift + gradient hairline border (via surface-card)
 *  - tabular-nums everywhere
 */
import { useEffect, useRef, useState } from 'react'
import { formatCurrency, formatNumber, formatRelativeTime } from '../utils/format'
import type { ClientFolder, ClientStatus } from '../types'

export interface ClienteCarpetaCardProps {
  folder: ClientFolder
  onOpen?: () => void
  className?: string
}

const STATUS_STYLES: Record<ClientStatus, { fg: string; bg: string; label: string }> = {
  active:     { fg: 'text-emerald-300', bg: 'bg-emerald-500/14',  label: 'activo' },
  onboarding: { fg: 'text-cyan-300',    bg: 'bg-cyan-500/14',     label: 'onboarding' },
  paused:     { fg: 'text-amber-300',   bg: 'bg-amber-500/14',    label: 'pausado' },
  churned:    { fg: 'text-rose-300',    bg: 'bg-rose-500/14',     label: 'churn' },
}

export function ClienteCarpetaCard({ folder, onOpen, className }: ClienteCarpetaCardProps) {
  const s = STATUS_STYLES[folder.status]
  const interactive = !!onOpen
  const healthColor =
    folder.healthScore >= 75 ? 'hsl(160 84% 50%)'
    : folder.healthScore >= 50 ? 'hsl(40 95% 55%)'
    : 'hsl(0 75% 60%)'

  return (
    <div
      onClick={onOpen}
      data-glow="violet"
      data-pop="true"
      className={[
        'surface-card relative',
        interactive ? 'cursor-pointer' : '',
        className ?? '',
      ].join(' ')}
    >
      {/* Folder tab · top-left · violet→cyan accent ribbon + glow halo */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-5 top-0 h-1.5 w-16 rounded-b-md"
        style={{
          background: 'linear-gradient(90deg, hsl(263 80% 65%), hsl(187 85% 55%))',
          boxShadow: '0 6px 18px -8px hsl(263 80% 65% / 0.7)',
        }}
      />

      <div className="relative z-[2] flex flex-col gap-3.5 p-5 pt-6">
        {/* Header · name + status pill */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-[17px] font-semibold leading-none tracking-tight">
              {folder.name}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{folder.industry}</div>
          </div>
          <span
            className={[
              'rounded-md px-1.5 py-[2px] font-mono text-[9.5px] font-bold uppercase tracking-[0.1em]',
              s.bg, s.fg,
            ].join(' ')}
          >
            {s.label}
          </span>
        </div>

        {/* Body grid · KPI strip (2 cols) + health gauge */}
        <div className="grid grid-cols-[1fr_88px] gap-4 border-y border-border/60 py-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="spend" value={formatCurrency(folder.spendMonth, { compact: true })} />
            <Stat label="inv 30d" value={formatNumber(folder.invocations30d, { compact: true })} />
            <Stat label="workflows" value={String(folder.workflowsActive)} />
          </div>
          <HealthGauge value={folder.healthScore} color={healthColor} />
        </div>

        {/* Footer · cascadas + last activity */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>{folder.cascadesShipped} cascadas enviadas</span>
          <span>última · {formatRelativeTime(folder.lastActivity)}</span>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <span className="font-display text-[15px] font-semibold leading-none tabular-nums">
        {value}
      </span>
    </div>
  )
}

/**
 * HealthGauge · SVG arc that "draws in" on mount using stroke-dasharray.
 * 240° sweep (top arc) · pure CSS animation · no extra deps.
 */
function HealthGauge({ value, color }: { value: number; color: string }) {
  const safe = Math.max(0, Math.min(100, value))
  // Geometry · arc from 150° to 30° clockwise (i.e. 240° sweep).
  // We render as a circle + dashoffset trick: circumference = 2πr;
  // visible arc = sweepRatio × circumference; offset starts from "empty"
  // and animates down to "filled" via CSS transition.
  const R = 32
  const C = 2 * Math.PI * R
  const VISIBLE = 0.68 * C            // 240° / 360° ≈ 0.68
  const fill = (safe / 100) * VISIBLE
  const dashArray = `${fill} ${C - fill}`
  const hidden = C - VISIBLE
  const ref = useRef<SVGCircleElement | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // small delay so the CSS transition runs (start from 0, end at fill)
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative h-[88px] w-[88px]">
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-[126deg]">
        {/* Background arc */}
        <circle
          cx="40" cy="40" r={R}
          fill="none"
          stroke="hsl(240 6% 16%)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${VISIBLE} ${hidden}`}
        />
        {/* Foreground arc · animates dasharray on mount */}
        <circle
          ref={ref}
          cx="40" cy="40" r={R}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={mounted ? dashArray : `0 ${C}`}
          style={{
            transition: 'stroke-dasharray 900ms cubic-bezier(.2,.8,.2,1)',
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
      </svg>
      {/* Number in the middle */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[20px] font-semibold leading-none tabular-nums" style={{ color }}>
          {safe}
        </span>
        <span className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground">
          health
        </span>
      </div>
    </div>
  )
}
