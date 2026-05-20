/**
 * Atlas design tokens · Sprint 2.
 *
 * Status → hue + label maps shared across the 12 v2 components.
 * Sobriedad rule · color solo carga semántica (verde ok · amber warn ·
 * rojo danger · gris neutral). Nada decorativo.
 */
import type {
  AtlasDriftSeverity,
  AtlasHealthStatus,
  AtlasN8nStatus,
} from "./types"

export type SemanticHue =
  | "emerald" // OK · live · success
  | "amber" // warning · degraded · pending
  | "rose" // critical · down · broken
  | "cyan" // info · neutral-active
  | "muted" // disabled · not_configured · dormant

export const HEALTH_HUE: Record<AtlasHealthStatus, SemanticHue> = {
  ok: "emerald",
  degraded: "amber",
  down: "rose",
  not_configured: "muted",
}

export const HEALTH_LABEL: Record<AtlasHealthStatus, string> = {
  ok: "ok",
  degraded: "degraded",
  down: "down",
  not_configured: "n/a",
}

export const DRIFT_HUE: Record<AtlasDriftSeverity, SemanticHue> = {
  critical: "rose",
  warning: "amber",
  info: "cyan",
}

export const DRIFT_LABEL: Record<AtlasDriftSeverity, string> = {
  critical: "critical",
  warning: "warning",
  info: "info",
}

export const DRIFT_SORT_ORDER: Record<AtlasDriftSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

export const N8N_HUE: Record<AtlasN8nStatus, SemanticHue> = {
  live: "emerald",
  unauthorized: "amber",
  error: "rose",
  not_configured: "muted",
}

export const N8N_LABEL: Record<AtlasN8nStatus, string> = {
  live: "live",
  unauthorized: "401 unauthorized",
  error: "error",
  not_configured: "n/a",
}

export function formatRelativeIso(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const deltaSec = Math.round((Date.now() - d.getTime()) / 1000)
  if (deltaSec < 60) return `${deltaSec}s ago`
  if (deltaSec < 3600) return `${Math.round(deltaSec / 60)}m ago`
  if (deltaSec < 86400) return `${Math.round(deltaSec / 3600)}h ago`
  return `${Math.round(deltaSec / 86400)}d ago`
}

export function formatNumberCompact(n: number): string {
  if (Math.abs(n) < 1000) return String(n)
  if (Math.abs(n) < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

export function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "—"
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
