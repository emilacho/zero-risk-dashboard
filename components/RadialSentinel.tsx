"use client"
/**
 * RadialSentinel · Lumen v3 Phase 2 · Jarvis-style concentric ring widget.
 *
 *   - 4 concentric ring levels rotating at different speeds (idle)
 *   - "breathing" pulse on the core when no agent_invocation is active
 *   - "scanning" sweep arc 0.8s when an invocation fires
 *   - intentional hairline gaps signal "open subsystem"
 *   - violet primary base · cyan accent reserved for active state
 *
 * Composition strategy (per ref 02 Cantina · ref 05 GMUNK · ref 09 Jayse):
 *   ring-1  outermost · large gaps · ticks at cardinal points · counter
 *   ring-2  mid · dashed · rotates slow forward
 *   ring-3  inner · solid faint · rotates fast counter
 *   ring-4  core · breathing pulse · cyan accent dot
 *
 * Active mode swaps the breathing pulse for a "scan" sweep arc on the
 * outer ring. Toggle via the `active` prop (default false for now ·
 * future Phase 3 will pipe Supabase Realtime here).
 *
 * Pure SVG · zero deps · no canvas, no WebGL. Sized via the `size`
 * prop (defaults to 480px). Behaves as a decorative overlay; place
 * absolutely-positioned over a graph or just as a hero element.
 */
import { useId } from "react"

export interface RadialSentinelProps {
  size?: number
  active?: boolean
  className?: string
  /** Optional centered label · single line · tiny mono caps */
  label?: string
}

export function RadialSentinel({
  size = 480,
  active = false,
  className,
  label,
}: RadialSentinelProps) {
  const uid = useId().replace(/:/g, "")
  const cx = size / 2
  const cy = size / 2
  const r1 = size * 0.46
  const r2 = size * 0.38
  const r3 = size * 0.29
  const r4 = size * 0.18

  // Ring 1 ticks · 12 cardinal-ish marks · 0.5px hairlines at radius r1
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden
    >
      <defs>
        {/* Soft radial halo behind the core · violet base */}
        <radialGradient id={`halo-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary-glow))" stopOpacity="0.18" />
          <stop offset="60%" stopColor="hsl(var(--primary-glow))" stopOpacity="0.06" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        {/* Active-state scan sweep arc · cyan · masked to a quarter-arc */}
        <linearGradient id={`scan-${uid}`} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0" />
          <stop offset="50%" stopColor="hsl(var(--accent))" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Halo glow */}
      <circle cx={cx} cy={cy} r={r1 + 18} fill={`url(#halo-${uid})`} />

      {/* RING 1 · outermost · 24 cardinal ticks · rotates counter-slow */}
      <g className="animate-ring-counter" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle
          cx={cx}
          cy={cy}
          r={r1}
          fill="none"
          stroke="hsl(var(--primary-glow) / 0.35)"
          strokeWidth="0.5"
        />
        {ticks.map((deg, i) => {
          const isMajor = deg % 90 === 0
          const len = isMajor ? 14 : 6
          const inner = r1 - len
          const x1 = cx + Math.cos(((deg - 90) * Math.PI) / 180) * inner
          const y1 = cy + Math.sin(((deg - 90) * Math.PI) / 180) * inner
          const x2 = cx + Math.cos(((deg - 90) * Math.PI) / 180) * r1
          const y2 = cy + Math.sin(((deg - 90) * Math.PI) / 180) * r1
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isMajor ? "hsl(var(--primary-glow))" : "hsl(var(--primary-glow) / 0.45)"}
              strokeWidth={isMajor ? 1 : 0.5}
            />
          )
        })}
      </g>

      {/* RING 2 · mid · dashed · rotates slow forward · intentional gap top-right */}
      <g className="animate-ring-mid" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle
          cx={cx}
          cy={cy}
          r={r2}
          fill="none"
          stroke="hsl(var(--primary) / 0.6)"
          strokeWidth="0.75"
          strokeDasharray="6 8"
          strokeDashoffset="0"
        />
        {/* Hairline gap marker · two short ticks at +45° */}
        <g transform={`rotate(45 ${cx} ${cy})`}>
          <line
            x1={cx + r2 - 6}
            y1={cy}
            x2={cx + r2 + 6}
            y2={cy}
            stroke="hsl(var(--accent))"
            strokeWidth="0.75"
          />
        </g>
      </g>

      {/* RING 3 · inner · solid faint · fast counter */}
      <g className="animate-ring-slow" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle
          cx={cx}
          cy={cy}
          r={r3}
          fill="none"
          stroke="hsl(var(--primary) / 0.4)"
          strokeWidth="0.5"
        />
        {/* 4 cardinal small dots on ring 3 */}
        {[0, 90, 180, 270].map((deg) => {
          const x = cx + Math.cos(((deg - 90) * Math.PI) / 180) * r3
          const y = cy + Math.sin(((deg - 90) * Math.PI) / 180) * r3
          return (
            <circle
              key={deg}
              cx={x}
              cy={y}
              r={1.5}
              fill="hsl(var(--primary-glow))"
            />
          )
        })}
      </g>

      {/* CORE · breathing pulse (idle) OR cyan scan sweep (active) */}
      {active ? (
        <g style={{ transformOrigin: `${cx}px ${cy}px` }} className="animate-scanning">
          <path
            d={`M ${cx} ${cy - r1} A ${r1} ${r1} 0 0 1 ${cx + r1} ${cy}`}
            fill="none"
            stroke={`url(#scan-${uid})`}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      ) : null}

      {/* RING 4 · core ring · always breathing */}
      <g className="animate-breathing" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle
          cx={cx}
          cy={cy}
          r={r4}
          fill="none"
          stroke="hsl(var(--primary-glow) / 0.65)"
          strokeWidth="1"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r4 - 8}
          fill="hsl(var(--primary) / 0.18)"
          stroke="hsl(var(--accent) / 0.7)"
          strokeWidth="0.5"
        />
      </g>

      {/* Centered label · always mono caps */}
      {label ? (
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          className="num"
          fontSize={11}
          letterSpacing="0.24em"
          fill="hsl(var(--muted-foreground))"
          style={{ fontFamily: "var(--font-mono), monospace", textTransform: "uppercase" }}
        >
          {label}
        </text>
      ) : null}
    </svg>
  )
}
