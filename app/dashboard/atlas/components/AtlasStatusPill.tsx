/**
 * AtlasStatusPill · semantic status pill.
 *
 * Wraps the Lumen `.pill` utility (defined globals.css line ~537) ·
 * stays SSR-safe (no client hooks). Used across every status surface.
 */
import type { ReactNode } from "react"
import type { SemanticHue } from "../tokens"

export function AtlasStatusPill({
  hue,
  children,
  icon,
  size = "md",
}: {
  hue: SemanticHue
  children: ReactNode
  icon?: ReactNode
  size?: "sm" | "md"
}) {
  const sizeClass =
    size === "sm"
      ? "text-[9px] px-1.5 py-[1px] tracking-[0.16em]"
      : "text-[10px] px-2 py-0.5 tracking-[0.18em]"
  return (
    <span
      data-hue={hue}
      className={`pill uppercase ${sizeClass}`}
    >
      {icon ? <span className="pill-icon">{icon}</span> : null}
      <span>{children}</span>
    </span>
  )
}
