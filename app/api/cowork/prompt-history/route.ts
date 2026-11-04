/**
 * GET /api/cowork/prompt-history?session_id=...&limit=20
 *
 * Re-hydrates a CoworkPromptBar's thread on mount. Filters cowork_messages
 * by metadata.session_id (which the client stores in localStorage). Admin-
 * gated · same auth pattern as the rest of the cowork/* surface.
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface HistoryTurn {
  role: "user" | "assistant"
  content: string
  attachments?: unknown[]
  tool_calls?: Array<{ name: string; input: Record<string, unknown> }>
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
  const sessionId = url.searchParams.get("session_id") ?? ""
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10), 1),
    100,
  )
  // 3-nov (saludo viejo en /nuevo): el chat pide solo lo reciente; lo más viejo existe en la base pero no se presenta como la conversación de hoy
  const edadH = Number(url.searchParams.get("max_edad_horas") ?? "")
  const desde = Number.isFinite(edadH) && edadH > 0 ? new Date(Date.now() - edadH * 3600_000).toISOString() : null
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "session_id_required" },
      { status: 400 },
    )
  }

  const svc = getServiceRoleClient()
  let consulta = svc
    .from("cowork_messages")
    .select("id, created_at, content, response_content, metadata")
    .eq("metadata->>session_id", sessionId)
  if (desde) consulta = consulta.gte("created_at", desde)
  const { data, error } = await consulta
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    )
  }

  const turns: HistoryTurn[] = []
  for (const row of (data ?? []).reverse()) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>
    turns.push({
      role: "user",
      content: String(row.content ?? ""),
      attachments:
        (meta.attachments as unknown[] | undefined) ?? undefined,
      ts: String(row.created_at ?? ""),
    })
    if (row.response_content) {
      turns.push({
        role: "assistant",
        content: String(row.response_content),
        tool_calls:
          (meta.tool_calls as HistoryTurn["tool_calls"]) ?? undefined,
        ts: String(row.created_at ?? ""),
      })
    }
  }
  return NextResponse.json({ ok: true, session_id: sessionId, count: turns.length, turns })
}
