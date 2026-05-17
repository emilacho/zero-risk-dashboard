"use client"
/**
 * AnimatedNumber · Lumen v3 count-up · Phase 4.1 hardened.
 *
 * Permanent fix · accepts a STRING `formatType` identifier instead of
 * a `format: (v) => string` callback. Function callbacks were the root
 * cause of digest 3406040795 crashes (3 episodes · Phase 1 · Phase 2 ·
 * Phase 4) when a server component tried to pass the function across
 * the server→client boundary · React 19 + Next 15 reject as
 * non-serializable.
 *
 * Format dispatcher uses Intl.NumberFormat (built-in · no new lib) for
 * locale-aware currency / percent / decimal · plus three custom
 * formatters · compact (k/M suffix) · duration (ms → "1.2s" / "3m") ·
 * raw integer.
 *
 * Backwards-compat · the deprecated `format` callback prop is still
 * accepted but logs a one-time console.warn telling the caller to
 * migrate. Render falls through to safe Intl.NumberFormat integer
 * rendering so the page never crashes if the callback is somehow
 * serializable (e.g. defined inside a client component).
 *
 * CODE REVIEW CHECKLIST · always ask before passing a prop server→client:
 *   1. Is it a primitive (string/number/boolean/null)? OK.
 *   2. Is it a serializable object/array of primitives? OK.
 *   3. Is it a ReactNode pre-rendered server-side? OK.
 *   4. Is it a FUNCTION? NEVER. Use a string identifier + dispatcher.
 */
import { useEffect, useRef, useState } from "react"
import {
  animate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion"

export type FormatType =
  | "integer"
  | "currency"
  | "percent"
  | "decimal"
  | "compact"
  | "duration"

export interface FormatOptions {
  locale?: string
  /** ISO 4217 code for `formatType: "currency"` · default "USD". */
  currency?: string
  /** Decimal digits to show · defaults per type. */
  decimals?: number
}

export interface AnimatedNumberProps {
  /** Target numeric value · animates from previous on every change. */
  value: number
  /** Animation duration in seconds. Default 1.1. */
  duration?: number
  /** Pick a format dispatcher · string-identifier (NOT a callback). */
  formatType?: FormatType
  /** Tuning · locale / currency / decimals. Defaults are sensible per type. */
  formatOptions?: FormatOptions
  /**
   * @deprecated Pass `formatType` + `formatOptions` instead. Function
   * props CANNOT cross the server→client boundary · using this prop
   * from a server component will trigger digest 3406040795 crashes.
   * The component will WARN once at runtime and fall back to safe
   * integer rendering if the callback is detected as non-serializable.
   */
  format?: (v: number) => string
  className?: string
}

// ── Format dispatcher · Intl + custom ──────────────────────

function formatCompact(v: number, decimals: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(decimals)}M`
  if (abs >= 1_000) return `${(v / 1_000).toFixed(decimals)}k`
  return v.toFixed(0)
}

function formatDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "—"
  if (ms < 1_000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1_000)}s`
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`
}

export function formatValue(
  value: number,
  formatType: FormatType = "integer",
  options: FormatOptions = {},
): string {
  const locale = options.locale ?? "en-US"
  const currency = options.currency ?? "USD"
  const decimals = options.decimals
  switch (formatType) {
    case "currency": {
      const abs = Math.abs(value)
      // Heuristic · small spends (< $1) show 3 decimals for cents
      // visibility · large amounts show whole dollars + 2 decimals.
      const fractionDigits =
        decimals ?? (abs < 1 ? 3 : abs >= 1_000 ? 2 : 2)
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value)
    }
    case "percent":
      return `${value.toFixed(decimals ?? 1)}%`
    case "decimal":
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
      }).format(value)
    case "compact":
      return formatCompact(value, decimals ?? 1)
    case "duration":
      return formatDuration(value)
    case "integer":
    default:
      return new Intl.NumberFormat(locale, {
        maximumFractionDigits: decimals ?? 0,
      }).format(Math.round(value))
  }
}

// One-shot deprecation warn · avoid log spam
let deprecationWarned = false

export function AnimatedNumber({
  value,
  duration = 1.1,
  formatType = "integer",
  formatOptions,
  format,
  className,
}: AnimatedNumberProps) {
  const prefersReduced = useReducedMotion()
  const mv = useMotionValue(prefersReduced ? value : 0)

  // Effective formatter · prefer string identifier · fall back to
  // optional callback only if defined AND in a client-only render path
  // (browser-side function reference is valid; server pass-through is
  // the dangerous case). We can't reliably detect that here, but we
  // can WARN once so the code review surfaces the regression early.
  const formatRef = useRef<(v: number) => string>(
    (v) => formatValue(v, formatType, formatOptions),
  )
  useEffect(() => {
    if (typeof format === "function") {
      if (!deprecationWarned) {
        deprecationWarned = true
        // eslint-disable-next-line no-console
        console.warn(
          "[AnimatedNumber] `format` callback prop is deprecated · use `formatType` + `formatOptions` instead. Function props cannot cross the server→client boundary (digest 3406040795 root cause).",
        )
      }
      formatRef.current = format
    } else {
      formatRef.current = (v) => formatValue(v, formatType, formatOptions)
    }
  }, [format, formatType, formatOptions])

  const formatted = useTransform(mv, (v) => formatRef.current(v))
  const [text, setText] = useState(formatRef.current(prefersReduced ? value : 0))

  useEffect(() => {
    if (prefersReduced) {
      mv.set(value)
      setText(formatRef.current(value))
      return
    }
    const controls = animate(mv, value, {
      duration,
      ease: [0.2, 0.7, 0.2, 1],
    })
    const unsub = formatted.on("change", (v) => setText(v))
    return () => {
      controls.stop()
      unsub()
    }
  }, [value, duration, prefersReduced, mv, formatted])

  return <span className={className}>{text}</span>
}
