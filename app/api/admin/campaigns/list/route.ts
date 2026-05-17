/**
 * GET /api/admin/campaigns/list?limit=20
 *   - Returns recent meta_ads_campaigns rows (admin only).
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const supa = await getSessionClient()
  const { data: userRes } = await supa.auth.getUser()
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })
  }
  const { data: roleRow } = await supa
    .from("app_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .maybeSingle()
  if (roleRow?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100)

  const svc = getServiceRoleClient()
  const { data, error } = await svc
    .from("meta_ads_campaigns")
    .select(
      "id, created_at, client_id, objective, daily_budget_usd, duration_days, audience_preset, creative_count, destination_url, status, meta_campaign_id, meta_adset_id, meta_creative_ids, meta_ad_ids, meta_ads_manager_url, error_message",
    )
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, count: data?.length ?? 0, campaigns: data ?? [] })
}
