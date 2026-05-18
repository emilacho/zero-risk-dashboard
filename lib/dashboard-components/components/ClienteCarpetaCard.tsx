'use client'
/**
 * ClienteCarpetaCard · "carpeta del cliente" · folder-style client card.
 *
 * v3 polish:
 *  - violet→cyan folder tab + faint glow halo
 *  - animated SVG arc gauge for health-score (svg dasharray draw)
 *  - status pill with subtle bg + matching text tone
 *  - hover-lift + gradient hairline border (via surface-card)
 *  - **NEW v3** · optional `pills` array · color-coded pills below status
 *    (industry · contract · tools · segment chips)
 *  - **NEW v3** · `data-hue` follows the status (emerald active · cyan
 *    onboarding · amber paused · rose churned) instead of always violet
 *  - tabular-nums everywhere
 */
import { useEffect, useRef, useState } from 'react'
import { formatCurrency, formatNumber, formatRelativeTime } from '../utils/format'
import { Pill, ToolPill, TOOL_CATALOG } from './Pill'
import type { ClientFolder, ClientStatus } from '../types'

export interface ClienteCarpetaCardProps {
  folder: ClientFolder
  /** When true, surfaces pointer cursor. Click is expected to come from
   *  a wrapping `<Link>` so the card can stay serializable from a Server
   *  Component (no function prop). */
  interactive?: boolean
  onOpen?: () => void
  className?: string
}

const STATUS_HUE: Record<ClientStatus, 'emerald' | 'cyan' | 'amber' | 'rose'> = {
  active:     'emerald',
  onboarding: 'cyan',
  paused:     'amber',
  churned:    'rose',
}
const STATUS_LABEL: Record<ClientStatus, string> = {
  active:     'activo',
  onboarding: 'onboarding',
  paused:     'pausado',
  churned:    'churn',
}

export function ClienteCarpetaCard({
  folder,
  interactive: interactiveProp,
  onOpen,
  className,
}: ClienteCarpetaCardProps) {
  const statusHue = STATUS_HUE[folder.status]
  const statusLabel = STATUS_LABEL[folder.status]
  const interactive = interactiveProp ?? !!onOpen
  const healthColor =
    folder.healthScore >= 75 ? 'hsl(160 84% 50%)'
    : folder.healthScore >= 50 ? 'hsl(40 95% 55%)'
    : 'hsl(0 75% 60%)'

  return (
    <div
      onClick={onOpen}
      data-hue={statusHue}
      data-pop="true"
      data-rim="violet"
      className={[
        'surface-card rim-instr relative',
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
          <Pill hue={statusHue}>{statusLabel}</Pill>
        </div>

        {/* v3 · color-coded pills row · tools / contract / segment */}
        {folder.pills && folder.pills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {folder.pills.slice(0, 6).map((p) => {
              const slug = p.toLowerCase().trim()
              if (TOOL_CATALOG[slug]) {
                return <ToolPill key={p} tool={p} />
              }
              return (
                <Pill key={p} hue="muted">
                  {p}
                </Pill>
              )
            })}
          </div>
        ) : null}

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
          {/* suppressHydrationWarning · formatRelativeTime uses Date.now()
              which differs by ms between server render and client hydration ·
              the displayed string is intentionally approximate, hydration
              mismatch on the seconds digit is harmless and silenced here. */}
          <span suppressHydrationWarning>última · {formatRelativeTime(folder.lastActivity)}</span>
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
            transition: 'stroke-dasharray var(--dur-deliberate) var(--ease-out-quart)',
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
