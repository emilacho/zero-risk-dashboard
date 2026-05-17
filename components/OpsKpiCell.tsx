"use client"
/**
 * OpsKpiCell · Phase 3 · client-side cell renderer for OpsKpiGrid.
 *
 * Phase 4.1 refactor · removed local `fmtUsd` + `fmtCompact` callbacks
 * passed to `<AnimatedNumber format={...} />`. Now uses the
 * string-identifier `formatType` API · NO function callbacks anywhere
 * in this component (server → client safe).
 *
 * `format` prop maps:
 *   "currency" → AnimatedNumber formatType="currency" (small spends
 *                 show 3 decimals · large amounts show 2)
 *   "percent"  → formatType="percent" with 1 decimal
 *   "number"   → formatType="compact" with k/M suffix
 */
import type { ReactNode } from "react"
import { AnimatedNumber } from "@/components/AnimatedNumber"

export type OpsFormat = "currency" | "number" | "percent"

interface OpsKpiCellProps {
  label: string
  cardinal?: string
  icon: ReactNode
  value: number | null
  format?: OpsFormat
  sub?: string
  badge?: string
}

function mapOpsFormat(f: OpsFormat = "number"):
  | "currency"
  | "percent"
  | "compact" {
  if (f === "currency") return "currency"
  if (f === "percent") return "percent"
  return "compact"
}

export function OpsKpiCell({
  label,
  cardinal,
  icon,
  value,
  format = "number",
  sub,
  badge,
}: OpsKpiCellProps) {
  const pending = value == null || badge === "wire pending"
  const formatType = mapOpsFormat(format)

  return (
    <div
      className="surface-card rim-instr p-4"
      data-hue="violet"
      data-rim="violet"
      data-pop="true"
      data-rim-zone={cardinal}
    >
      <div className="relative z-[2] flex flex-col gap-2.5">
        <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary-glow))]">
            {icon}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
            {label}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          {pending ? (
            <span className="font-display text-[28px] font-semibold leading-none tabular-nums text-[hsl(var(--muted-foreground))]">
              —
            </span>
          ) : (
            <AnimatedNumber
              value={value}
              formatType={formatType}
              className="font-display text-[28px] font-semibold leading-none tabular-nums"
            />
          )}
          {pending ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--danger))] opacity-80">
              wire pending
            </span>
          ) : null}
        </div>
        {sub ? (
          <p className="num text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  )
}
