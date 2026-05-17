"use client"
/**
 * ParallaxBackground · Sprint #8 D5 · scroll-driven Y translate.
 *
 * Wraps a background-positioned element and slides it at a fraction of
 * scroll speed (default 0.3 · slower than scroll for depth). Pure
 * IntersectionObserver + requestAnimationFrame · NO GSAP · NO Framer ·
 * 0 deps beyond React.
 *
 * Respects `prefers-reduced-motion: reduce` · disables parallax for users
 * who request reduced motion (just renders the static content).
 *
 * Usage:
 *   <ParallaxBackground speed={0.3}>
 *     <Image src="/hero.jpg" fill alt="" />
 *   </ParallaxBackground>
 *
 * Notes:
 *   - Caller should set `position: relative` on the parent + give this
 *     wrapper `position: absolute; inset: 0;` for the content to be
 *     parallax-eligible.
 *   - speed > 0 = parallax DOWN (slower than scroll · feels deeper)
 *   - speed < 0 = parallax UP (faster · counter-scroll · feels closer)
 *   - speed = 0 = no parallax (matches static)
 */
import { useEffect, useRef } from "react"
import type { CSSProperties, ReactNode } from "react"

export interface ParallaxBackgroundProps {
  children: ReactNode
  /** Translate fraction of scroll · default 0.3 · clamp [-1, 1] */
  speed?: number
  /** className applied to wrapper */
  className?: string
  /** Inline styles passed through */
  style?: CSSProperties
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function ParallaxBackground({
  children,
  speed = 0.3,
  className = "",
  style,
}: ParallaxBackgroundProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    if (typeof IntersectionObserver === "undefined") return

    const clamped = Math.max(-1, Math.min(1, speed))
    let rafId = 0
    let isVisible = false

    const update = () => {
      if (!el) return
      const rect = el.getBoundingClientRect()
      // Offset from viewport center · drives translate
      const viewportH = window.innerHeight
      const center = rect.top + rect.height / 2 - viewportH / 2
      const translateY = -center * clamped
      el.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0)`
      rafId = 0
    }

    const onScroll = () => {
      if (!isVisible || rafId) return
      rafId = requestAnimationFrame(update)
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
        if (isVisible) {
          update()
          window.addEventListener("scroll", onScroll, { passive: true })
        } else {
          window.removeEventListener("scroll", onScroll)
        }
      },
      { rootMargin: "20% 0px" },
    )
    io.observe(el)

    return () => {
      io.disconnect()
      window.removeEventListener("scroll", onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [speed])

  return (
    <div
      ref={ref}
      className={className}
      style={{ willChange: "transform", ...style }}
    >
      {children}
    </div>
  )
}
