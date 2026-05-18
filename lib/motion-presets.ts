/**
 * Motion presets · Sprint #8 D5 · Framer variants library.
 *
 * Reusable variants composed from `lib/motion` tokens. Callers pass these
 * straight to `<motion.div variants={...} />` instead of inlining `initial`
 * / `animate` / `transition` props per call site.
 *
 * Pattern:
 *   import { motion } from "framer-motion"
 *   import { containerStagger, itemFadeUp } from "@/lib/motion-presets"
 *
 *   <motion.div variants={containerStagger} initial="hidden" animate="visible">
 *     <motion.div variants={itemFadeUp}>…</motion.div>
 *     <motion.div variants={itemFadeUp}>…</motion.div>
 *   </motion.div>
 *
 * All variants use the `hidden` / `visible` state name pair · combine with
 * `exit` from `framer-motion` AnimatePresence for unmount transitions where
 * needed (see `modalReveal` below for the exit form).
 */
import type { Variants } from "framer-motion"
import { DURATION, EASING, STAGGER } from "@/lib/motion"

// ─── containerStagger ───────────────────────────────────────────────────
/**
 * Parent variant · orchestrates child `itemFadeUp` (or any child variant)
 * via `staggerChildren`. Pair with `itemFadeUp` for the canonical cascade.
 * Caps total cascade at STAGGER.capSeconds (0.6s) via `delayChildren`
 * disabled · the per-child delay is what's bounded.
 */
export const containerStagger: Variants = {
  hidden: { opacity: 1 }, // container itself doesn't fade · children do
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: STAGGER.base,
      delayChildren: 0,
    },
  },
}

/**
 * Variant of containerStagger with tight cadence · use for short lists
 * (≤6 items) where the cascade is decorative.
 */
export const containerStaggerTight: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: STAGGER.tight,
      delayChildren: 0,
    },
  },
}

// ─── itemFadeUp ─────────────────────────────────────────────────────────
/**
 * Child variant · fade + 12px translateY + blur(6px) reveal. The canonical
 * Lumen entry. Pair with `containerStagger`.
 */
export const itemFadeUp: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: DURATION.base, ease: EASING.out },
  },
}

/**
 * Lighter variant · no blur · use for surfaces that re-render frequently
 * (live data feeds · streaming lists) since blur filter is GPU-expensive.
 */
export const itemFadeUpLight: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.fast, ease: EASING.out },
  },
}

// ─── drawerSlide ────────────────────────────────────────────────────────
/**
 * Side-sheet / drawer entrance · slides from `from` side. Default `right`.
 * Pair with AnimatePresence + exit form below for proper unmount.
 *
 *   <motion.aside
 *     variants={drawerSlide("right")}
 *     initial="hidden"
 *     animate="visible"
 *     exit="hidden"
 *   />
 */
export function drawerSlide(from: "left" | "right" | "top" | "bottom" = "right"): Variants {
  const sign = from === "left" || from === "top" ? -1 : 1
  const offset = sign * 32
  if (from === "left" || from === "right") {
    return {
      hidden: { opacity: 0, x: offset },
      visible: {
        opacity: 1,
        x: 0,
        transition: { duration: DURATION.slow, ease: EASING.outQuart },
      },
    }
  }
  return {
    hidden: { opacity: 0, y: offset },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATION.slow, ease: EASING.outQuart },
    },
  }
}

// ─── modalReveal ────────────────────────────────────────────────────────
/**
 * Modal / dialog entrance · scale 0.96 → 1 + fade. Used by Combobox panel,
 * Dialog content, popover surfaces.
 */
export const modalReveal: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.base, ease: EASING.out },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: DURATION.fast, ease: EASING.out },
  },
}

// ─── routeTransition ────────────────────────────────────────────────────
/**
 * Page-level route transition · subtle opacity + y · keeps focus on
 * content, not motion. Used by RouteTransition wrapper in layout.
 */
export const routeTransition: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASING.out },
  },
}

// ─── tooltipPop ─────────────────────────────────────────────────────────
/**
 * Tooltip / chip pop-in · spring-style overshoot. Used by `Tooltip` /
 * `PopoverHover` surfaces. Avoids the "boring fade" of regular reveal.
 */
export const tooltipPop: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.fast, ease: EASING.spring },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    transition: { duration: DURATION.instant, ease: EASING.out },
  },
}

// ─── scaleHoverLift ─────────────────────────────────────────────────────
/**
 * Inline `whileHover` preset · use as `whileHover={scaleHoverLift}` on a
 * `motion.div`. NOT a Variants object · the JSX uses it inline.
 */
export const scaleHoverLift = {
  scale: 1.02,
  transition: { duration: DURATION.fast, ease: EASING.out },
} as const

// ─── Re-exports for convenience ─────────────────────────────────────────
export { DURATION, EASING, STAGGER, CSS_EASING, staggerDelay } from "@/lib/motion"
