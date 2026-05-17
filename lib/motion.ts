/**
 * Motion canon · Sprint #8 D5 source of truth.
 *
 * Single source of truth for animation easing curves, durations, and stagger
 * increments across the dashboard. Both TS (Framer variants · inline style)
 * and CSS (custom-property mirrors in globals.css) consume from here so the
 * dashboard reads as one calibrated system, not 8 components with subtly
 * different ease curves.
 *
 * Pre-D5 audit found 2 nearly-identical bezier tuples ([0.2,0.7,0.2,1] vs
 * [0.2,0.8,0.2,1]) and 3 ad-hoc duration values (0.3 · 0.36 · 1.1) used
 * inconsistently. Canon below picks ONE per band; refactor follow-ups
 * migrate stragglers (StaggerList · RouteTransition done this PR · others
 * tracked in vault doc).
 *
 * Rules:
 *   - Reach for tokens · NEVER hardcode bezier tuples or magic durations
 *   - If a new motion needs a different curve · add it here first · don't
 *     inline a one-off
 *   - CSS callers use `var(--ease-out)` + `var(--dur-base)` from globals.css
 *   - Framer callers use EASING / DURATION / STAGGER objects below
 *   - When passing easing to Framer · use the *tuple* form (number[]) not
 *     the string form · Framer handles tuples natively + tree-shakes better
 */

// ─── EASING · canonical bezier curves ───────────────────────────────────

export const EASING = {
  /** Default exit-side ease · "Lumen out" · used for most fade-ins +
   *  surface entries. Equivalent CSS: cubic-bezier(.2,.7,.2,1) */
  out: [0.2, 0.7, 0.2, 1] as [number, number, number, number],

  /** Slightly steeper ease-out · used for sweeps + dramatic flourishes
   *  (sweep-bar fill · long blur-fade · large modal arrival). */
  outQuart: [0.2, 0.8, 0.2, 1] as [number, number, number, number],

  /** Default entry-side · for exits or "leave-the-stage" feel. */
  in: [0.8, 0.2, 0.8, 0.2] as [number, number, number, number],

  /** Symmetric · use for property transitions that should feel balanced
   *  (toggles · stateful color shifts). */
  inOut: [0.4, 0, 0.2, 1] as [number, number, number, number],

  /** Soft spring-like · for playful surfaces (Toaster · Tooltip pop-ins)
   *  · slightly overshoots on the way in. */
  spring: [0.34, 1.56, 0.64, 1] as [number, number, number, number],

  /** Pure linear · use only for shimmer/sweep continuous animations · NEVER
   *  for one-shot transitions (linear feels mechanical for entries). */
  linear: [0, 0, 1, 1] as [number, number, number, number],
} as const

// ─── DURATION · seconds · 6-rung scale ──────────────────────────────────

export const DURATION = {
  /** 100ms · hover state · pill color shift · instant-feeling response */
  instant: 0.1,
  /** 200ms · tooltips · toast appear · small interactions */
  fast: 0.2,
  /** 300ms · default for most entries · stagger items · cards · modals */
  base: 0.3,
  /** 500ms · drawer slides · sheet entries · larger surfaces */
  slow: 0.5,
  /** 800ms · hero reveals · scroll-driven moments · scrub finishes */
  deliberate: 0.8,
  /** 1200ms · big-stage flourishes · count-up to a large number · loading
   *  marker animations. Use sparingly · long durations test patience. */
  languid: 1.2,
} as const

// ─── STAGGER · seconds between children · 3-rung scale ──────────────────

export const STAGGER = {
  /** 40ms · tight ripple · feels almost simultaneous · use for short lists
   *  (≤6 items) where the cascade is decorative, not informative. */
  tight: 0.04,
  /** 60ms · default · readable cascade · 6-15 items. */
  base: 0.06,
  /** 100ms · pronounced · use for storytelling cascades · 3-5 items where
   *  each step should "land" individually. */
  loose: 0.1,
  /** Maximum total stagger time · seconds · the cascade caps here so users
   *  with 50+ items never wait 5s for the last row to appear. */
  capSeconds: 0.6,
} as const

// ─── CSS_EASING · string mirrors for inline `style={{ transition }}` ────

export const CSS_EASING = {
  out: `cubic-bezier(${EASING.out.join(",")})`,
  outQuart: `cubic-bezier(${EASING.outQuart.join(",")})`,
  in: `cubic-bezier(${EASING.in.join(",")})`,
  inOut: `cubic-bezier(${EASING.inOut.join(",")})`,
  spring: `cubic-bezier(${EASING.spring.join(",")})`,
  linear: "linear",
} as const

// ─── Helper · staggered delay capped at STAGGER.capSeconds ──────────────

/**
 * Compute the entry delay for the i-th child in a stagger cascade · returns
 * seconds · caps at STAGGER.capSeconds so long lists don't trail past 600ms.
 *
 *   const offset = staggerDelay(i, STAGGER.base)
 */
export function staggerDelay(
  index: number,
  step: number = STAGGER.base,
  base: number = 0,
): number {
  return Math.min(base + index * step, STAGGER.capSeconds)
}

// ─── Type exports ───────────────────────────────────────────────────────

export type EasingName = keyof typeof EASING
export type DurationName = keyof Omit<typeof DURATION, never>
export type StaggerName = "tight" | "base" | "loose"
