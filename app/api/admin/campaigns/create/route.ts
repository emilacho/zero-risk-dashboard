/**
 * POST /api/admin/campaigns/create
 *
 *   - Auth · admin role required (via Supabase Auth session · enforced by
 *     middleware OR via INTERNAL_API_KEY header for n8n callbacks)
 *   - Validates body with `CampaignDraftSchema`
 *   - Inserts row into `meta_ads_campaigns` with status='draft' (or
 *     'queued' if `?queue=1`)
 *   - Returns the inserted row with stub Meta IDs (null until n8n
 *     workflow `Meta Ads Full-Stack Optimizer v2` activates)
 *
 *   Status flow ·
 *     draft → queued (set by user/UI when ready to launch)
 *           → creating (n8n picks up · calls Facebook API)
 *           → live | failed
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { getSessionClient } from "@/lib/supabase-session"
import { CampaignDraftSchema } from "@/lib/campaigns"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  // Auth · admin only · check session first then INTERNAL_API_KEY fallback
  const internalKey = req.headers.get("x-internal-api-key")
  const expectedKey = process.env.INTERNAL_API_KEY
  const allowedViaInternalKey =
    expectedKey && internalKey && internalKey === expectedKey

  if (!allowedViaInternalKey) {
    const supa = await getSessionClient()
    const { data: userRes } = await supa.auth.getUser()
    if (!userRes?.user) {
      return NextResponse.json(
        { ok: false, error: "unauthenticated" },
        { status: 401 },
      )
    }
    const { data: roleRow } = await supa
      .from("app_roles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .maybeSingle()
    if (roleRow?.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "forbidden · admin required" },
        { status: 403 },
      )
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    )
  }

  const parsed = CampaignDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "validation_failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    )
  }

  const url = new URL(req.url)
  const queue = url.searchParams.get("queue") === "1"

  const supa = getServiceRoleClient()
  const { data: row, error } = await supa
    .from("meta_ads_campaigns")
    .insert({
      ...parsed.data,
      status: queue ? "queued" : "draft",
      queued_at: queue ? new Date().toISOString() : null,
    })
    .select(
      "id, created_at, client_id, objective, daily_budget_usd, duration_days, audience_preset, creative_count, destination_url, status, meta_campaign_id, meta_adset_id, meta_creative_ids, meta_ad_ids, meta_ads_manager_url, error_message",
    )
    .single()

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, campaign: row })
}
