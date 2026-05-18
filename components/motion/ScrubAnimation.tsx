"use client"
/**
 * ScrubAnimation · Sprint #8 D5 · scroll-progress → 0..1 driver.
 *
 * Computes a scroll progress value (0 at section enters viewport bottom ·
 * 1 at section exits viewport top) and passes it to the render-prop child
 * as a primitive number. Child can then drive any visual (CSS variable,
 * style prop, conditional render) without managing the IO + RAF loop
 * itself.
 *
 * Pure IntersectionObserver + requestAnimationFrame · NO GSAP · NO Framer ·
 * 0 deps beyond React. Respects `prefers-reduced-motion: reduce` by pinning
 * progress at 1 immediately so content lands in its final state.
 *
 * Usage:
 *   <ScrubAnimation>
 *     {(progress) => (
 *       <div style={{ transform: `translateY(${progress * 50}px)` }}>…</div>
 *     )}
 *   </ScrubAnimation>
 *
 * Or expose progress as a CSS custom property:
 *   <ScrubAnimation>
 *     {(p) => (
 *       <section style={{ "--p": p } as React.CSSProperties}>
 *         <div className="opacity-[calc(var(--p))]">…</div>
 *       </section>
 *     )}
 *   </ScrubAnimation>
 */
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"

export interface ScrubAnimationProps {
  /** Render prop · receives progress 0..1 */
  children: (progress: number) => ReactNode
  /** Throttle to RAF (default true) · set false for one-time-snap effects */
  throttle?: boolean
  /** className applied to the wrapper · default "" */
  className?: string
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function ScrubAnimation({
  children,
  throttle = true,
  className = "",
}: ScrubAnimationProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [progress, setProgress] = useState(0)
  const rafIdRef = useRef(0)
  const visibleRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") return
    if (prefersReducedMotion()) {
      setProgress(1)
      return
    }

    const computeProgress = () => {
      const node = ref.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const vh = window.innerHeight
      const total = rect.height + vh
      const traveled = vh - rect.top
      const raw = traveled / total
      setProgress(Math.max(0, Math.min(1, raw)))
    }

    const scheduleUpdate = () => {
      if (!visibleRef.current) return
      if (!throttle) {
        computeProgress()
        return
      }
      if (rafIdRef.current) return
      rafIdRef.current = requestAnimationFrame(() => {
        computeProgress()
        rafIdRef.current = 0
      })
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting
        if (entry.isIntersecting) {
          computeProgress()
          window.addEventListener("scroll", scheduleUpdate, { passive: true })
          window.addEventListener("resize", scheduleUpdate, { passive: true })
        } else {
          window.removeEventListener("scroll", scheduleUpdate)
          window.removeEventListener("resize", scheduleUpdate)
        }
      },
      { rootMargin: "20% 0px" },
    )
    io.observe(el)

    return () => {
      io.disconnect()
      window.removeEventListener("scroll", scheduleUpdate)
      window.removeEventListener("resize", scheduleUpdate)
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [throttle])

  return (
    <div ref={ref} className={className}>
      {children(progress)}
    </div>
  )
}
