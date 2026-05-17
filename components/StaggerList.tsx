"use client"
/**
 * StaggerList · Lumen v3 entry-stagger wrapper.
 *
 * Wrap any grid or list to get a children-fade-up-blur sequence on
 * mount. Each direct child fades in with the canon `STAGGER.base`
 * (60ms) offset, capped at `STAGGER.capSeconds` (600ms) total so the user
 * never waits on a long list.
 *
 * D5 canon · ANTES inlined `duration: 0.3` + tuple `[0.2, 0.7, 0.2, 1]`
 * + magic `step: 0.06` and `maxStaggerMs: 600`. DESPUÉS reads from
 * `DURATION` / `EASING` / `STAGGER` so all stagger surfaces share one
 * calibration knob. Visual diff: zero (the prior values were already on
 * the canon · the refactor just removes the duplication).
 *
 * Usage:
 *   <StaggerList className="grid grid-cols-3 gap-6">
 *     <Card />
 *     <Card />
 *   </StaggerList>
 */
import { motion } from "framer-motion"
import { Children, type ReactNode } from "react"
import { DURATION, EASING, STAGGER, staggerDelay } from "@/lib/motion"

export interface StaggerListProps {
  children: ReactNode
  className?: string
  /** Base delay before first item starts · default 0.05s */
  delay?: number
  /** Step between items · default STAGGER.base (0.06s) */
  step?: number
}

export function StaggerList({
  children,
  className,
  delay = 0.05,
  step = STAGGER.base,
}: StaggerListProps) {
  const kids = Children.toArray(children)
  return (
    <div className={className}>
      {kids.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration: DURATION.base,
            ease: EASING.out,
            delay: staggerDelay(i, step, delay),
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}
