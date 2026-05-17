/**
 * GET /api/agents/recent-feed?limit=8
 *
 * Admin-gated · serves the LiveAgentFeed polling fallback when
 * Supabase Realtime is unavailable / no events arrive within 30s.
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"
import { loadAgentFeed } from "@/lib/agent-feed"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
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
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "8", 10), 1),
    50,
  )
  const payload = await loadAgentFeed(limit)
  return NextResponse.json({ ok: true, ...payload })
}
