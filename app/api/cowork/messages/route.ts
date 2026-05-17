/**
 * GET /api/cowork/messages?status=pending|read|responded&limit=N
 *
 * Lists Cowork chat messages · default returns pending DESC. Next
 * Cowork session calls this on first turn to surface unread inbox.
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const status = url.searchParams.get("status") ?? "pending"
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10), 1),
    200,
  )
  if (!["pending", "read", "responded", "all"].includes(status)) {
    return NextResponse.json(
      { ok: false, error: "invalid_status" },
      { status: 400 },
    )
  }

  const supa = getServiceRoleClient()
  const q = supa
    .from("cowork_messages")
    .select(
      "id, created_at, sender_user_id, content, status, response_content, responded_at, metadata",
    )
    .order("created_at", { ascending: false })
    .limit(limit)
  if (status !== "all") q.eq("status", status)
  const { data, error } = await q
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    )
  }
  return NextResponse.json({
    ok: true,
    count: data?.length ?? 0,
    status,
    messages: data ?? [],
  })
}
