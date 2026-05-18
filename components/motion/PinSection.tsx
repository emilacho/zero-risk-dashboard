"use client"
/**
 * PinSection · Sprint #8 D5 · CSS-sticky pin + IO state class swap.
 *
 * Wraps a section that should "pin" to the viewport top while a longer
 * content range scrolls past · the classic full-bleed sticky pattern.
 * Uses CSS `position: sticky` (zero JS · GPU-accelerated by default) plus
 * an IntersectionObserver that toggles `data-pinned="true"` while the
 * section is in its pinned window, so children can react with CSS.
 *
 * Usage:
 *   <PinSection className="h-[200vh]">
 *     <div className="sticky top-0 h-screen">
 *       <Hero />
 *     </div>
 *   </PinSection>
 *
 *   In CSS (or via Tailwind):
 *     [data-pinned="true"] .hero-title { letter-spacing: 0.4em; }
 *
 * Pure IO + sticky · NO GSAP · NO Framer · 0 deps beyond React.
 */
import { useEffect, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"

export interface PinSectionProps {
  children: ReactNode
  /** Margin around the trigger element · default "0px" */
  rootMargin?: string
  /** className applied to the outer wrapper · default "" */
  className?: string
  /** Inline styles passed through */
  style?: CSSProperties
}

export function PinSection({
  children,
  rootMargin = "0px",
  className = "",
  style,
}: PinSectionProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      ([entry]) => setPinned(entry.isIntersecting),
      { rootMargin, threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      data-pinned={pinned ? "true" : undefined}
      style={style}
    >
      {children}
    </div>
  )
}
