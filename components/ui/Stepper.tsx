"use client"
/**
 * Stepper · Sprint #8 P2 component · generic reusable progress indicator.
 *
 * Generic equivalent of `zero-risk-platform`'s onboarding-scoped
 * `StepIndicator` (PR #50 · 5-step literal typing · wizard-bound). This
 * dashboard primitive accepts arbitrary step count · Lumen v3 dark tokens ·
 * optional click navigation · controlled or display-only.
 *
 * Use cases · onboarding wizards · cascade pipeline progress · multi-step
 * forms · workflow execution state · meta-agent run phases.
 *
 * Accessibility · <nav aria-label> + <ol role="list"> + aria-current="step"
 * on the active step · disabled future steps not clickable unless onStepClick
 * is omitted (display-only).
 */
import { Check } from "@phosphor-icons/react/dist/ssr"

export interface StepperItem {
  /** Stable id · used as React key + click handler arg */
  id: string | number
  /** Display name · short label */
  name: string
  /** Optional 1-line description below name (sm+ only) */
  description?: string
}

export interface StepperProps {
  /** Steps in display order */
  steps: readonly StepperItem[]
  /** 0-indexed active step · default 0 */
  currentStep: number
  /** When set · enables click-to-navigate · receives step id */
  onStepClick?: (id: StepperItem["id"], index: number) => void
  /** Allow clicking future steps · default false (only back-nav) */
  allowFutureNav?: boolean
  /** Lumen hue accent · default violet (primary) */
  hue?: "violet" | "cyan" | "amber" | "emerald"
  /** When true · forces vertical layout · default false (horizontal) */
  vertical?: boolean
  /** Optional className for outer nav */
  className?: string
  /** aria-label for the outer nav · default "Progress" */
  ariaLabel?: string
}

const HUE_FILL: Record<NonNullable<StepperProps["hue"]>, string> = {
  violet: "hsl(var(--primary))",
  cyan: "hsl(var(--accent))",
  amber: "hsl(var(--hue-amber))",
  emerald: "hsl(var(--success))",
}

export function Stepper({
  steps,
  currentStep,
  onStepClick,
  allowFutureNav = false,
  hue = "violet",
  vertical = false,
  className = "",
  ariaLabel = "Progress",
}: StepperProps) {
  const hueFill = HUE_FILL[hue]
  const interactive = !!onStepClick

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol
        role="list"
        className={
          vertical
            ? "flex flex-col gap-3"
            : "flex items-center gap-2 sm:gap-4"
        }
      >
        {steps.map((step, idx) => {
          const isComplete = idx < currentStep
          const isActive = idx === currentStep
          const isFuture = idx > currentStep
          const isClickable =
            interactive && (!isFuture || allowFutureNav) && !isActive

          const dotStyle: React.CSSProperties = {
            backgroundColor: isComplete
              ? hueFill
              : isActive
                ? "hsl(var(--background))"
                : "hsl(var(--muted))",
            color: isComplete
              ? "hsl(var(--primary-foreground))"
              : isActive
                ? hueFill
                : "hsl(var(--muted-foreground))",
            borderColor: isActive ? hueFill : "transparent",
            boxShadow: isActive ? `0 0 0 4px ${hueFill}33` : "none",
          }

          const textColor = isActive
            ? "text-foreground"
            : isComplete
              ? "text-[hsl(var(--muted-foreground))]"
              : "text-[hsl(var(--muted-foreground)/0.6)]"

          const stepInner = (
            <span className={vertical ? "flex items-start gap-3" : "flex items-center gap-3"}>
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-mono font-bold transition-all"
                style={dotStyle}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" weight="bold" /> : idx + 1}
              </span>
              <span className={`flex flex-col ${textColor}`}>
                <span className="text-[12px] font-semibold leading-tight">{step.name}</span>
                {step.description && (
                  <span className="hidden text-[10px] text-[hsl(var(--muted-foreground))] sm:inline">
                    {step.description}
                  </span>
                )}
              </span>
            </span>
          )

          return (
            <li
              key={step.id}
              aria-current={isActive ? "step" : undefined}
              className={vertical ? "" : "flex flex-1 items-center gap-3"}
            >
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick!(step.id, idx)}
                  className="group cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                >
                  {stepInner}
                </button>
              ) : (
                <div className={interactive ? "cursor-not-allowed opacity-90" : ""}>
                  {stepInner}
                </div>
              )}
              {idx < steps.length - 1 && !vertical && (
                <span
                  aria-hidden
                  className="hidden h-px flex-1 sm:block"
                  style={{
                    backgroundColor: isComplete
                      ? hueFill
                      : "hsl(var(--border))",
                    transition: "background-color 200ms",
                  }}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
