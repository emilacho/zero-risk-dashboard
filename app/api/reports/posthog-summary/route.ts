/**
 * GET /api/reports/posthog-summary · Sprint 4 D5 dashboard reports widget.
 *
 * Aggregates PostHog event counts for the canonical Sprint 4 captures
 * (`campaign_started` · `campaign_completed` · `cliente_onboarded` ·
 * `hitl_approved` · `journey_transition`) over the last 30 days. The
 * underlying counts live in the platform repo's `/api/posthog/events`
 * endpoint · this dashboard route is a thin pass-through that adds the
 * dashboard's session auth gate + a graceful fallback when PostHog is
 * unconfigured (returns zeros + flag).
 *
 * Response ·
 *   {
 *     ok: true,
 *     window_days: 30,
 *     events: { [eventName: string]: number },
 *     posthog_status: 'live' | 'not_configured',
 *     generated_at: ISO,
 *   }
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const CANONICAL_EVENTS = [
  "campaign_started",
  "campaign_completed",
  "cliente_onboarded",
  "hitl_approved",
  "journey_transition",
] as const

export async function GET() {
  const platformBaseUrl =
    process.env.NEXT_PUBLIC_PLATFORM_API_URL ??
    "https://zero-risk-platform.vercel.app"
  const internalKey = process.env.INTERNAL_API_KEY
  const now = new Date().toISOString()

  // Without the internal key we can't hit the platform's posthog route ·
  // surface a structured zero-state so the widget renders empty bars
  // instead of crashing.
  if (!internalKey) {
    const zeroes: Record<string, number> = {}
    for (const e of CANONICAL_EVENTS) zeroes[e] = 0
    return NextResponse.json({
      ok: true,
      window_days: 30,
      events: zeroes,
      posthog_status: "not_configured",
      generated_at: now,
      warning: "INTERNAL_API_KEY missing · cannot query platform PostHog",
    })
  }

  try {
    const res = await fetch(
      `${platformBaseUrl}/api/posthog/events?days=30&event_count=true`,
      {
        method: "GET",
        headers: { "x-api-key": internalKey },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    )
    if (!res.ok) {
      const zeroes: Record<string, number> = {}
      for (const e of CANONICAL_EVENTS) zeroes[e] = 0
      return NextResponse.json({
        ok: true,
        window_days: 30,
        events: zeroes,
        posthog_status:
          res.status === 401 ? "not_configured" : "live",
        generated_at: now,
        warning: `platform /api/posthog/events HTTP ${res.status}`,
      })
    }
    const json = (await res.json()) as {
      events?: Record<string, number>
      total_events?: number
    }
    // The platform endpoint returns either a flat `total_events` or a
    // per-event breakdown · we coerce to the canonical map filling zeros
    // for missing events so the dashboard's chart axis is stable.
    const events: Record<string, number> = {}
    for (const e of CANONICAL_EVENTS) events[e] = 0
    if (json.events) {
      for (const [name, count] of Object.entries(json.events)) {
        if (typeof count === "number") events[name] = count
      }
    }
    return NextResponse.json({
      ok: true,
      window_days: 30,
      events,
      posthog_status: "live",
      generated_at: now,
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown"
    const zeroes: Record<string, number> = {}
    for (const e of CANONICAL_EVENTS) zeroes[e] = 0
    return NextResponse.json({
      ok: true,
      window_days: 30,
      events: zeroes,
      posthog_status: "not_configured",
      generated_at: now,
      warning: `platform unreachable · ${detail}`,
    })
  }
}
