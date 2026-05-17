"use client"
/**
 * RevealOnScroll · Sprint #8 D5 · IntersectionObserver entry animation.
 *
 * Plays the `reveal-fade-up` (default) · `reveal-fade-in` · or
 * `reveal-scale-in` CSS keyframe ONCE when the wrapper enters the
 * viewport. Pure IntersectionObserver · NO Framer · NO GSAP · 0 deps
 * beyond React. Animation respects `prefers-reduced-motion: reduce` via
 * the CSS rule in globals.css.
 *
 * Usage:
 *   <RevealOnScroll>
 *     <SectionHero />
 *   </RevealOnScroll>
 *
 *   <RevealOnScroll variant="scale" rootMargin="-10% 0px">
 *     <KpiCard />
 *   </RevealOnScroll>
 *
 * Why IO not Framer's `whileInView` · IO is browser-native · zero JS bundle
 * cost · doesn't bring in `framer-motion/dom` tree-shake exclusions. Use
 * Framer presets (`itemFadeUp` + `containerStagger`) when you need
 * orchestrated multi-child cascades · use RevealOnScroll for single-element
 * reveals.
 */
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"

export type RevealVariant = "fade-up" | "fade" | "scale"

export interface RevealOnScrollProps {
  children: ReactNode
  /** Variant · default fade-up (the canonical Lumen entry) */
  variant?: RevealVariant
  /** rootMargin · default "0px 0px -10% 0px" (fires slightly before fully in view) */
  rootMargin?: string
  /** Intersection threshold · default 0.1 (10% visible triggers) */
  threshold?: number
  /** Skip animation · always render in revealed state · default false */
  immediate?: boolean
  /** className applied to the wrapper div */
  className?: string
  /** Optional tag override · default "div" */
  as?: keyof React.JSX.IntrinsicElements
}

const VARIANT_DATA: Record<RevealVariant, string | undefined> = {
  "fade-up": undefined, // default · no data-variant attribute
  fade: "fade",
  scale: "scale",
}

export function RevealOnScroll({
  children,
  variant = "fade-up",
  rootMargin = "0px 0px -10% 0px",
  threshold = 0.1,
  immediate = false,
  className = "",
  as: Tag = "div",
}: RevealOnScrollProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [revealed, setRevealed] = useState(immediate)

  useEffect(() => {
    if (revealed) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") {
      // SSR or unsupported · fall through to revealed so content shows
      setRevealed(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          io.disconnect()
        }
      },
      { rootMargin, threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [revealed, rootMargin, threshold])

  const variantAttr = VARIANT_DATA[variant]
  const TagComponent = Tag as unknown as React.ComponentType<{
    ref: React.RefObject<HTMLElement | null>
    className?: string
    "data-revealed"?: string
    "data-variant"?: string
    children?: ReactNode
  }>

  return (
    <TagComponent
      ref={ref}
      className={`reveal-on-scroll ${className}`}
      data-revealed={revealed ? "true" : undefined}
      data-variant={variantAttr}
    >
      {children}
    </TagComponent>
  )
}
