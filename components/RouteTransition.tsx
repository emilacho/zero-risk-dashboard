"use client"

import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import { type ReactNode } from "react"

/**
 * RouteTransition · subtle blur-fade-up between route swaps.
 *
 * `<AnimatePresence mode="popLayout">` keeps the outgoing tree out of the
 * DOM during the in-animation so the user perceives an instant switch
 * with a slight settle. Whole effect ~360ms · matches the Lumen-Studio
 * "fades and re-composes" feel without slowing real navigation.
 *
 * Rendered once in `app/layout.tsx`, wrapping `{children}`.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -4, filter: "blur(6px)" }}
        transition={{ duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
