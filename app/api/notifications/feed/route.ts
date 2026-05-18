/**
 * GET /api/notifications/feed?limit=N
 *
 * Aggregator for the NotificationInbox UI · pulls latest items from 4
 * source families and returns a unified inverse-chronological feed.
 *
 * Source families (Sprint #8 baseline):
 *   1. cowork_messages · `status=pending` (REAL · queryable via Supabase service-role)
 *   2. HITL pending · Mission Control inbox bridge (STUB · wire in Sprint #10 when MC bridge endpoint stabilizes)
 *   3. Slack notifications · #equipo important pings (STUB · Sprint #10 · would proxy Slack API)
 *   4. Sentry errors · last 24h unresolved (STUB · Sprint #10 · would call Sentry Issues API)
 *
 * Returns { ok, items: [...], unread_count, sources: {...} }.
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export type NotificationKind = "cowork" | "hitl" | "slack" | "sentry"
export type NotificationSeverity = "info" | "warn" | "danger"

export interface NotificationItem {
  id: string
  kind: NotificationKind
  severity: NotificationSeverity
  title: string
  subtitle: string | null
  href: string | null
  created_at: string
  unread: boolean
}

interface CoworkRow {
  id: string
  message: string | null
  source_role: string | null
  status: string | null
  created_at: string | null
  campaign_id?: string | null
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10), 1),
    100,
  )

  const items: NotificationItem[] = []
  const sources: Record<string, "ok" | "stub" | "error"> = {
    cowork: "ok",
    hitl: "stub",
    slack: "stub",
    sentry: "stub",
  }

  // ── 1 · cowork_messages (REAL) ───────────────────────────────────────
  try {
    const supa = getServiceRoleClient()
    const { data, error } = await supa
      .from("cowork_messages")
      .select("id, message, source_role, status, created_at, campaign_id")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) {
      sources.cowork = "error"
    } else {
      for (const r of (data || []) as CoworkRow[]) {
        items.push({
          id: `cowork:${r.id}`,
          kind: "cowork",
          severity: "info",
          title: r.source_role
            ? `Cowork · ${r.source_role}`
            : "Cowork message",
          subtitle: (r.message || "").slice(0, 140) || null,
          href: r.campaign_id ? `/clients?campaign=${r.campaign_id}` : null,
          created_at: r.created_at || new Date().toISOString(),
          unread: true,
        })
      }
    }
  } catch {
    sources.cowork = "error"
  }

  // ── 2 · HITL pending (STUB · Sprint #10 wire-up) ─────────────────────
  // When MC inbox bridge is live · query mission-control `/api/inbox` filtered
  // by status=pending and shape to NotificationItem with kind: "hitl",
  // severity: "warn", href: /system/hitl/{id}.

  // ── 3 · Slack notifications (STUB · Sprint #10) ──────────────────────
  // Would proxy a curated subset of #equipo messages tagged [NEEDS-REPLY].

  // ── 4 · Sentry errors (STUB · Sprint #10) ────────────────────────────
  // Would call Sentry Issues API for last-24h unresolved errors in the
  // zero-risk-dashboard project · severity: "danger".

  items.sort((a, b) => b.created_at.localeCompare(a.created_at))
  const trimmed = items.slice(0, limit)
  const unread_count = trimmed.filter((i) => i.unread).length

  return NextResponse.json({
    ok: true,
    items: trimmed,
    unread_count,
    sources,
    generated_at: new Date().toISOString(),
  })
}
