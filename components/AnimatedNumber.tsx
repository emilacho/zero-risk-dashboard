"use client"
/**
 * AnimatedNumber · Lumen v3 count-up.
 *
 *   - Uses framer-motion's useMotionValue + animate so the value
 *     transitions smoothly from prior render to new.
 *   - Formats via a caller-supplied `format` callback so currency / k
 *     suffixes / decimals match the visual context.
 *   - Reduced-motion aware: if the user prefers reduced motion, the
 *     final value is rendered instantly with no easing.
 */
import { useEffect, useState } from "react"
import {
  animate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion"

export interface AnimatedNumberProps {
  value: number
  duration?: number
  format?: (v: number) => string
  className?: string
}

const defaultFormat = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)

export function AnimatedNumber({
  value,
  duration = 1.1,
  format = defaultFormat,
  className,
}: AnimatedNumberProps) {
  const prefersReduced = useReducedMotion()
  const mv = useMotionValue(prefersReduced ? value : 0)
  const formatted = useTransform(mv, (v) => format(v))
  const [text, setText] = useState(format(prefersReduced ? value : 0))

  useEffect(() => {
    if (prefersReduced) {
      mv.set(value)
      setText(format(value))
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
  }, [value, duration, format, prefersReduced, mv, formatted])

  return <span className={className}>{text}</span>
}
