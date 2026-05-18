/**
 * POST /api/cowork/campaign-context
 *
 * Inline Cowork chat backing the CampaignCreatorModal · STEP 8.
 *
 * Body · {
 *   client_id: string,
 *   form_state: Record<string, unknown>,
 *   message: string,
 *   history?: Array<{ role: "user" | "assistant"; content: string }>,
 *   channel?: string  // defaults "campaign_modal"
 * }
 *
 * Resolves the client's brand_voice + display name · constructs a
 * system prompt + tool definition · calls Claude (claude-sonnet-4-6
 * via raw Anthropic Messages API · no SDK dep) · extracts the textual
 * reply + any `suggest_form_update` tool calls · persists the
 * conversation turn (user + assistant) to `cowork_messages` with
 * channel + client_id in metadata · returns { reply, form_updates }.
 *
 * Reusable by any future "ask Cowork in context" modal (Vault tabs ·
 * Workflows drill-down · etc) by changing the `channel` field.
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

interface HistoryTurn {
  role: "user" | "assistant"
  content: string
}

interface Body {
  client_id?: unknown
  form_state?: unknown
  message?: unknown
  history?: unknown
  channel?: unknown
}

interface ClientRow {
  id: string
  name: string
  brand_voice: Record<string, unknown> | null
  website_url: string | null
}

const FORM_UPDATE_TOOL = {
  name: "suggest_form_update",
  description:
    "Use ONLY when you want to suggest a concrete change to one or more fields in the campaign form the user is filling out. The user will see your suggestion as a button and decide whether to apply it. NEVER auto-apply · this is HITL by design.",
  input_schema: {
    type: "object",
    properties: {
      objective: {
        type: "string",
        enum: [
          "OUTCOME_TRAFFIC",
          "OUTCOME_AWARENESS",
          "OUTCOME_ENGAGEMENT",
          "OUTCOME_LEADS",
          "OUTCOME_SALES",
          "OUTCOME_APP_PROMOTION",
        ],
        description: "Meta campaign objective",
      },
      daily_budget_usd: {
        type: "number",
        minimum: 0.5,
        maximum: 5000,
        description: "Suggested daily budget in USD",
      },
      duration_days: {
        type: "integer",
        minimum: 1,
        maximum: 180,
        description: "Campaign duration in days",
      },
      audience_preset: {
        type: "string",
        description: "Audience description / preset name",
      },
      creative_count: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        description: "Number of creatives the agency should produce",
      },
      destination_url: {
        type: "string",
        description: "Landing page URL · usually the client's site or a specific menu/page",
      },
      reasoning: {
        type: "string",
        description:
          "1-2 sentence explanation of why these values fit · shown to the user next to the apply button.",
      },
    },
    additionalProperties: false,
  },
} as const

export async function POST(req: Request) {
  // Auth · same gate as other admin Cowork surfaces
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

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    )
  }
  const clientId = typeof body.client_id === "string" ? body.client_id : ""
  const message = typeof body.message === "string" ? body.message.trim() : ""
  const formState =
    body.form_state && typeof body.form_state === "object"
      ? (body.form_state as Record<string, unknown>)
      : {}
  const channel =
    typeof body.channel === "string" && body.channel.length > 0
      ? body.channel
      : "campaign_modal"
  const history = Array.isArray(body.history)
    ? (body.history as HistoryTurn[]).slice(-12)
    : []

  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: "client_id_required" },
      { status: 400 },
    )
  }
  if (!message || message.length > 4000) {
    return NextResponse.json(
      { ok: false, error: "message_empty_or_too_long" },
      { status: 400 },
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "anthropic_api_key_missing",
        hint: "Set ANTHROPIC_API_KEY env on this Vercel project to enable inline Cowork chat.",
      },
      { status: 503 },
    )
  }

  // Load client + brand voice via service role (RLS-bypassing read · safe
  // because we just gated by admin role above)
  const svc = getServiceRoleClient()
  const { data: clientRow, error: clientErr } = await svc
    .from("clients")
    .select("id, name, brand_voice, website_url")
    .eq("id", clientId)
    .maybeSingle<ClientRow>()
  if (clientErr) {
    return NextResponse.json(
      { ok: false, error: clientErr.message },
      { status: 500 },
    )
  }
  if (!clientRow) {
    return NextResponse.json(
      { ok: false, error: "client_not_found" },
      { status: 404 },
    )
  }

  // ── Construct system prompt ──────────────────────────────────────
  const brandSummary = summarizeBrandVoice(clientRow.brand_voice)
  const systemPrompt = [
    "You are Cowork · an AI brand strategist embedded in Zero Risk's dashboard.",
    "You assist Emilio (the agency operator) while he fills out a Meta Ads campaign form for one of his clients.",
    "",
    `Client · ${clientRow.name}`,
    clientRow.website_url ? `Website · ${clientRow.website_url}` : null,
    brandSummary ? `\nBrand voice summary:\n${brandSummary}` : null,
    "",
    "Current form state (JSON) ·",
    "```json",
    JSON.stringify(formState, null, 2),
    "```",
    "",
    "Style guidelines ·",
    "- Spanish · concise · operative tone · no fluff.",
    "- 2-4 short paragraphs OR bullets · prefer bullets when listing options.",
    "- When you want to change form values, ALWAYS use the `suggest_form_update` tool. Never embed JSON in the text.",
    "- Reasoning behind a suggestion goes in the tool's `reasoning` field · the text reply can summarize at a high level.",
    "- If the question is conceptual (no form change needed) · just answer in text.",
    "- NEVER promise to launch the campaign · only Emilio approves drafts in this surface.",
  ]
    .filter(Boolean)
    .join("\n")

  const claudeMessages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ]

  // ── Call Anthropic Messages API ─────────────────────────────────
  let claudeJson: {
    content?: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; name: string; input: Record<string, unknown> }
    >
    stop_reason?: string
    usage?: { input_tokens: number; output_tokens: number }
  }
  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        tools: [FORM_UPDATE_TOOL],
        messages: claudeMessages,
      }),
    })
    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      return NextResponse.json(
        { ok: false, error: "anthropic_api_error", status: claudeRes.status, details: errText.slice(0, 500) },
        { status: 502 },
      )
    }
    claudeJson = await claudeRes.json()
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "anthropic_fetch_failed",
        details: e instanceof Error ? e.message : "unknown",
      },
      { status: 502 },
    )
  }

  // ── Extract text reply + tool use ────────────────────────────────
  const blocks = claudeJson.content ?? []
  const textBlocks: string[] = []
  let formUpdates: Record<string, unknown> | null = null
  for (const b of blocks) {
    if (b.type === "text") textBlocks.push(b.text)
    else if (b.type === "tool_use" && b.name === "suggest_form_update") {
      formUpdates = b.input
    }
  }
  const reply = textBlocks.join("\n\n").trim() || "(sin respuesta textual · ver sugerencia)"

  // ── Persist to cowork_messages ───────────────────────────────────
  const sender = `dashboard:${userRes.user.id}`
  try {
    await svc.from("cowork_messages").insert([
      {
        content: message,
        sender_user_id: sender,
        status: "responded",
        response_content: reply,
        responded_at: new Date().toISOString(),
        metadata: {
          channel,
          client_id: clientId,
          form_state: formState,
          form_updates: formUpdates,
          usage: claudeJson.usage,
          stop_reason: claudeJson.stop_reason,
        },
      },
    ])
  } catch (e) {
    // Best-effort · don't fail the response over a persistence error
    console.error("cowork_messages insert failed", e)
  }

  return NextResponse.json({
    ok: true,
    reply,
    form_updates: formUpdates,
    usage: claudeJson.usage ?? null,
  })
}

function summarizeBrandVoice(
  voice: Record<string, unknown> | null,
): string | null {
  if (!voice) return null
  const keysOfInterest = [
    "tone",
    "voice",
    "personality",
    "values",
    "target_audience",
    "audience",
    "tagline",
    "mission",
    "differentiators",
    "do_use",
    "dont_use",
  ]
  const lines: string[] = []
  for (const k of keysOfInterest) {
    const v = voice[k]
    if (!v) continue
    if (typeof v === "string") lines.push(`- ${k} · ${v.slice(0, 240)}`)
    else if (Array.isArray(v) && v.length > 0)
      lines.push(`- ${k} · ${v.slice(0, 5).map((x) => String(x).slice(0, 80)).join(" · ")}`)
    else if (typeof v === "object")
      lines.push(`- ${k} · ${JSON.stringify(v).slice(0, 240)}`)
  }
  return lines.length > 0 ? lines.join("\n") : null
}
