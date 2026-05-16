/**
 * POST /api/cowork/message
 *
 * Persists a Cowork chat message to `public.cowork_messages` and fires
 * a Slack #equipo notification via SLACK_COWORK_WEBHOOK_URL. The next
 * Cowork (Lenovo / HP3) session reads pending entries on first turn.
 *
 * Body:
 *   { content: string, sender_user_id?: string, metadata?: object }
 *
 * Auth: none for now · single-operator dashboard. If we open this up
 * later, add a bearer-key check via INTERNAL_API_KEY before the insert.
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface Body {
  content?: unknown
  sender_user_id?: unknown
  metadata?: unknown
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    )
  }

  const content =
    typeof body.content === "string" ? body.content.trim() : ""
  if (!content || content.length > 4000) {
    return NextResponse.json(
      { ok: false, error: "content_empty_or_too_long" },
      { status: 400 },
    )
  }
  const sender =
    typeof body.sender_user_id === "string"
      ? body.sender_user_id.trim().slice(0, 64)
      : "dashboard"
  const metadata =
    body.metadata && typeof body.metadata === "object"
      ? (body.metadata as Record<string, unknown>)
      : {}

  const supa = getServiceRoleClient()
  const { data, error } = await supa
    .from("cowork_messages")
    .insert({
      content,
      sender_user_id: sender,
      status: "pending",
      metadata,
    })
    .select("id, created_at, content, status, sender_user_id")
    .single()

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    )
  }

  // Fire Slack notification · best-effort · we don't fail the insert if
  // Slack is down. The next Cowork session can still pick up the
  // pending message from Supabase directly.
  const webhook = process.env.SLACK_COWORK_WEBHOOK_URL
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `[FROM-DASHBOARD] [COWORK-CHAT-NEW]\nSender · \`${sender}\`\nMessage · ${content.slice(0, 1800)}\nRow · \`${data.id}\``,
        }),
      })
    } catch (e) {
      // swallow · the insert is the source of truth
      console.error("slack-cowork-webhook failed", e)
    }
  }

  return NextResponse.json({ ok: true, message: data })
}
