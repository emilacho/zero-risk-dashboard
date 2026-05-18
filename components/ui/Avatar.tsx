"use client"
/**
 * Avatar · Sprint #8 P3 component · @radix-ui/react-avatar wrapper.
 *
 * Lumen v3 styled · circular · 3 sizes · fallback shows initials or icon
 * when image fails to load (Radix handles the load-state delegation).
 *
 * Use cases · cliente cards (logo + name) · agent identity cards (icon +
 * slug) · user/cowork chat heads · workflow run owner indicator.
 *
 * Accessibility · Radix Avatar.Image inherits alt prop · fallback inherits
 * delay timing so loading flicker is suppressed on fast networks. Consumer
 * must always pass `alt` (lint rule enforces image alt requirements).
 */
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import type { ReactNode } from "react"

export type AvatarSize = "sm" | "md" | "lg" | "xl"
export type AvatarHue = "violet" | "cyan" | "amber" | "emerald" | "rose" | "muted"

const SIZE_PX: Record<AvatarSize, number> = { sm: 24, md: 32, lg: 40, xl: 56 }
const SIZE_TEXT: Record<AvatarSize, string> = {
  sm: "text-[9px]",
  md: "text-[11px]",
  lg: "text-[12px]",
  xl: "text-[14px]",
}
const HUE_BG: Record<AvatarHue, string> = {
  violet: "hsl(var(--primary)/0.18)",
  cyan: "hsl(var(--accent)/0.18)",
  amber: "hsl(var(--hue-amber)/0.18)",
  emerald: "hsl(var(--success)/0.18)",
  rose: "hsl(var(--danger)/0.18)",
  muted: "hsl(var(--muted))",
}
const HUE_FG: Record<AvatarHue, string> = {
  violet: "hsl(var(--primary-glow))",
  cyan: "hsl(var(--accent))",
  amber: "hsl(var(--hue-amber))",
  emerald: "hsl(var(--success))",
  rose: "hsl(var(--danger))",
  muted: "hsl(var(--muted-foreground))",
}

export interface AvatarProps {
  /** Image URL · falls back to initials/icon if undefined or fails to load */
  src?: string | null
  /** Required for screen readers + lint */
  alt: string
  /** Size · default md (32px) */
  size?: AvatarSize
  /** Hue applied to fallback bg + initials text · default muted */
  hue?: AvatarHue
  /** Initials when image fails · default first 2 chars of alt uppercased */
  initials?: string
  /** Custom icon fallback (overrides initials when set) */
  icon?: ReactNode
  /** Container className */
  className?: string
}

function defaultInitials(alt: string): string {
  return alt
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?"
}

export function Avatar({
  src,
  alt,
  size = "md",
  hue = "muted",
  initials,
  icon,
  className = "",
}: AvatarProps) {
  const px = SIZE_PX[size]
  const text = SIZE_TEXT[size]
  const computedInitials = initials ?? defaultInitials(alt)
  const fallbackContent = icon ?? (
    <span className={`num font-mono font-semibold ${text}`} style={{ color: HUE_FG[hue] }}>
      {computedInitials}
    </span>
  )

  return (
    <AvatarPrimitive.Root
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-[hsl(var(--border))] ${className}`}
      style={{ width: px, height: px }}
    >
      {src ? (
        <AvatarPrimitive.Image
          src={src}
          alt={alt}
          className="aspect-square h-full w-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback
        delayMs={src ? 350 : 0}
        className="flex h-full w-full items-center justify-center"
        style={{ backgroundColor: HUE_BG[hue] }}
      >
        {fallbackContent}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
