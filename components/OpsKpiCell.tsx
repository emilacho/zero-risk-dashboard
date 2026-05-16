"use client"
/**
 * OpsKpiCell · Phase 3 · client-side cell renderer for OpsKpiGrid.
 *
 * Lives as a separate "use client" file so the parent server component
 * (OpsKpiGrid) can hand it primitive props (no function callbacks
 * across the boundary, which Next 15 will reject).
 *
 * Cell handles its own formatting + the count-up animation via
 * AnimatedNumber.
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

function fmtUsd(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
  if (Math.abs(v) < 1) return `$${v.toFixed(3)}`
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return v.toLocaleString("en-US")
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
  const formatter =
    format === "currency"
      ? fmtUsd
      : format === "percent"
      ? (v: number) => `${v.toFixed(1)}%`
      : fmtCompact

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
              format={formatter}
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
