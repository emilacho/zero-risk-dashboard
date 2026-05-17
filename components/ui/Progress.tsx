"use client"
/**
 * Progress · Sprint #8 P2 component · Radix Progress wrapper.
 *
 * Lumen v3 styled · violet/cyan/amber/emerald/danger hue variants ·
 * indeterminate animation when `value` is undefined.
 *
 * Use cases · cascade pipeline status (per-agent step % complete) ·
 * upload progress · long-running n8n workflow runs · meta-agent batch
 * analysis %.
 *
 * Accessibility · Radix Primitive ships role="progressbar" + aria-valuenow
 * + aria-valuemin + aria-valuemax. Pass `aria-label` to caller for screen
 * reader context.
 */
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { useEffect, useState } from "react"

export type ProgressHue = "violet" | "cyan" | "amber" | "emerald" | "danger"

const HUE_BG: Record<ProgressHue, string> = {
  violet: "hsl(var(--primary-glow))",
  cyan: "hsl(var(--accent))",
  amber: "hsl(var(--hue-amber))",
  emerald: "hsl(var(--success))",
  danger: "hsl(var(--danger))",
}

export interface ProgressProps {
  /** 0..100 · pass undefined for indeterminate spinner-style bar */
  value?: number | null
  /** Color hue · default violet */
  hue?: ProgressHue
  /** Height in px · default 4 */
  height?: number
  /** Optional label rendered above the bar · pass JSX or string */
  label?: React.ReactNode
  /** Optional caption rendered to the right of the label */
  caption?: React.ReactNode
  /** aria-label for screen readers · default "Progress" */
  ariaLabel?: string
  /** Extra container className */
  className?: string
}

export function Progress({
  value,
  hue = "violet",
  height = 4,
  label,
  caption,
  ariaLabel = "Progress",
  className,
}: ProgressProps) {
  const indeterminate = value === undefined || value === null
  const clamped = indeterminate ? 0 : Math.min(100, Math.max(0, value))
  const fillColor = HUE_BG[hue]

  return (
    <div className={className}>
      {(label || caption) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          {label && <span className="text-[11px] text-foreground">{label}</span>}
          {caption && (
            <span className="num text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              {caption}
            </span>
          )}
        </div>
      )}
      <ProgressPrimitive.Root
        aria-label={ariaLabel}
        className="relative overflow-hidden rounded-full bg-[hsl(var(--muted))]"
        style={{ height }}
        value={indeterminate ? null : clamped}
      >
        {indeterminate ? (
          <IndeterminateBar fillColor={fillColor} />
        ) : (
          <ProgressPrimitive.Indicator
            className="h-full transition-[width] duration-500 ease-out"
            style={{
              width: `${clamped}%`,
              background: `linear-gradient(90deg, ${fillColor} 0%, ${fillColor}cc 100%)`,
              boxShadow: `0 0 12px -2px ${fillColor}`,
            }}
          />
        )}
      </ProgressPrimitive.Root>
    </div>
  )
}

function IndeterminateBar({ fillColor }: { fillColor: string }) {
  const [pos, setPos] = useState(-30)
  useEffect(() => {
    const interval = setInterval(() => {
      setPos((p) => (p > 130 ? -30 : p + 2))
    }, 30)
    return () => clearInterval(interval)
  }, [])
  return (
    <div
      className="h-full"
      style={{
        width: "30%",
        marginLeft: `${pos}%`,
        background: `linear-gradient(90deg, transparent 0%, ${fillColor} 50%, transparent 100%)`,
        transition: "margin-left 30ms linear",
      }}
    />
  )
}
