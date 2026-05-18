/**
 * GET /api/cowork/context-history?channel=campaign_modal&client_id=...&limit=10
 *
 * Returns recent Cowork chat turns for a given (channel, client_id)
 * pair so a freshly-opened modal can re-hydrate its scrollback. Used
 * by CoworkContextChat on mount.
 *
 * Admin-only · the messages contain client + brand context.
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface HistoryTurn {
  role: "user" | "assistant"
  content: string
  form_updates?: Record<string, unknown> | null
  ts: string
}

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
  const channel = url.searchParams.get("channel") ?? "campaign_modal"
  const clientId = url.searchParams.get("client_id") ?? ""
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "10", 10), 1),
    50,
  )
  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: "client_id_required" },
      { status: 400 },
    )
  }

  const svc = getServiceRoleClient()
  const { data, error } = await svc
    .from("cowork_messages")
    .select("id, created_at, content, response_content, metadata")
    .eq("metadata->>channel", channel)
    .eq("metadata->>client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    )
  }

  const turns: HistoryTurn[] = []
  // The newest rows are first · reverse so the rendered order is
  // oldest-first (natural reading direction in the modal).
  for (const row of (data ?? []).reverse()) {
    turns.push({
      role: "user",
      content: String(row.content ?? ""),
      ts: String(row.created_at ?? ""),
    })
    if (row.response_content) {
      const meta = (row.metadata ?? {}) as Record<string, unknown>
      turns.push({
        role: "assistant",
        content: String(row.response_content),
        form_updates:
          (meta.form_updates as Record<string, unknown> | null | undefined) ?? null,
        ts: String(row.created_at ?? ""),
      })
    }
  }
  return NextResponse.json({ ok: true, channel, clientId, count: turns.length, turns })
}
