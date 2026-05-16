"use client"
/**
 * StaggerList · Lumen v3 entry-stagger wrapper.
 *
 * Wrap any grid or list to get a children-fade-up-blur sequence on
 * mount. Each direct child fades in with a 60ms offset, capped at
 * 600ms total so the user never waits on a long list.
 *
 * Usage:
 *   <StaggerList className="grid grid-cols-3 gap-6">
 *     <Card />
 *     <Card />
 *   </StaggerList>
 */
import { motion } from "framer-motion"
import { Children, type ReactNode } from "react"

export interface StaggerListProps {
  children: ReactNode
  className?: string
  delay?: number
  step?: number
  maxStaggerMs?: number
}

export function StaggerList({
  children,
  className,
  delay = 0.05,
  step = 0.06,
  maxStaggerMs = 600,
}: StaggerListProps) {
  const kids = Children.toArray(children)
  const cap = maxStaggerMs / 1000
  return (
    <div className={className}>
      {kids.map((child, i) => {
        const computed = delay + i * step
        const offset = Math.min(computed, cap)
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              duration: 0.3,
              ease: [0.2, 0.7, 0.2, 1],
              delay: offset,
            }}
          >
            {child}
          </motion.div>
        )
      })}
    </div>
  )
}
