/**
 * POST /api/cowork/prompt · STEP 11 master endpoint for CoworkPromptBar.
 *
 * Body shape ·
 *   message · string · the user prompt
 *   attachments · Array<{ name · mime · path · url? }> · already
 *     uploaded by /api/cowork/upload
 *   context · {
 *     page?: string,            // e.g. "home" · "dept/mkt" · "clients/[id]"
 *     channel: string,          // matches localStorage cowork session key
 *     client_id?: string,       // if surface is client-scoped
 *     form_state?: Record<…>,  // optional · campaign modal etc
 *     surface_state?: Record<…>// optional · whatever the host wants to expose
 *   }
 *   history · Array<{ role · content }>  // last 12 turns capped server-side
 *   session_id · string
 *
 * Milestone 1 · non-streaming · returns full reply in one JSON.
 * Milestone 2 · same body but switch to SSE chunked transfer.
 *
 * Persists every turn to `cowork_messages` with metadata =
 *   { channel · session_id · page · client_id · attachments · form_state
 *   · usage · stop_reason · form_updates }.
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

interface Attachment {
  name: string
  mime: string
  path: string
  url?: string | null
}
interface HistoryTurn {
  role: "user" | "assistant"
  content: string
}
interface PromptContext {
  page?: string
  channel?: string
  client_id?: string
  form_state?: Record<string, unknown>
  surface_state?: Record<string, unknown>
}
interface Body {
  message?: unknown
  attachments?: unknown
  context?: unknown
  history?: unknown
  session_id?: unknown
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
    "Suggest a concrete change to one or more fields in the form the user is filling out. Surfaces as a HITL 'Aplicar sugerencias' button · never auto-applies.",
  input_schema: {
    type: "object",
    properties: {
      updates: {
        type: "object",
        description:
          "Free-shape object · keys match the host form's field names · values are the proposed new values. The host component picks which keys to apply.",
        additionalProperties: true,
      },
      reasoning: {
        type: "string",
        description: "1-3 sentences explaining the suggestion · shown next to the apply button.",
      },
    },
    required: ["updates"],
    additionalProperties: false,
  },
} as const

const TRIGGER_WORKFLOW_TOOL = {
  name: "trigger_workflow",
  description:
    "Propose triggering an n8n workflow run · surfaces as a HITL button · never fires without the user clicking.",
  input_schema: {
    type: "object",
    properties: {
      workflow_id: { type: "string" },
      reason: { type: "string" },
      payload_preview: { type: "object", additionalProperties: true },
    },
    required: ["workflow_id"],
    additionalProperties: false,
  },
} as const

const TOOLS = [FORM_UPDATE_TOOL, TRIGGER_WORKFLOW_TOOL]

function summarizeBrandVoice(voice: Record<string, unknown> | null): string | null {
  if (!voice) return null
  const keys = ["tone", "voice", "personality", "values", "target_audience", "tagline", "mission"]
  const out: string[] = []
  for (const k of keys) {
    const v = voice[k]
    if (!v) continue
    if (typeof v === "string") out.push(`- ${k} · ${v.slice(0, 200)}`)
    else if (Array.isArray(v))
      out.push(`- ${k} · ${v.slice(0, 4).map((x) => String(x).slice(0, 80)).join(" · ")}`)
    else out.push(`- ${k} · ${JSON.stringify(v).slice(0, 200)}`)
  }
  return out.length > 0 ? out.join("\n") : null
}

export async function POST(req: Request) {
  // Auth
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
  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (!message || message.length > 8000) {
    return NextResponse.json(
      { ok: false, error: "message_empty_or_too_long" },
      { status: 400 },
    )
  }
  const sessionId = typeof body.session_id === "string" ? body.session_id : ""
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "session_id_required" },
      { status: 400 },
    )
  }
  const attachments: Attachment[] = Array.isArray(body.attachments)
    ? (body.attachments as Attachment[]).slice(0, 10)
    : []
  const context: PromptContext =
    body.context && typeof body.context === "object"
      ? (body.context as PromptContext)
      : { channel: "default" }
  const channel = context.channel ?? "default"
  const history: HistoryTurn[] = Array.isArray(body.history)
    ? (body.history as HistoryTurn[]).slice(-12)
    : []

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "anthropic_api_key_missing",
        hint: "Set ANTHROPIC_API_KEY env on this Vercel project to enable CoworkPromptBar.",
      },
      { status: 503 },
    )
  }

  // Optional client context lookup
  const svc = getServiceRoleClient()
  let clientRow: ClientRow | null = null
  if (context.client_id) {
    const { data } = await svc
      .from("clients")
      .select("id, name, brand_voice, website_url")
      .eq("id", context.client_id)
      .maybeSingle<ClientRow>()
    clientRow = data ?? null
  }

  // ── Build system prompt ──────────────────────────────────────────
  const brandSummary = summarizeBrandVoice(clientRow?.brand_voice ?? null)
  const formStateBlock = context.form_state
    ? `\n\nCurrent form state (JSON) ·\n\`\`\`json\n${JSON.stringify(
        context.form_state,
        null,
        2,
      )}\n\`\`\``
    : ""
  const surfaceStateBlock = context.surface_state
    ? `\n\nSurface state (JSON) ·\n\`\`\`json\n${JSON.stringify(
        context.surface_state,
        null,
        2,
      )}\n\`\`\``
    : ""
  const systemPrompt = [
    "You are Cowork · the embedded operator AI inside Zero Risk's dashboard.",
    "Emilio (the sole admin) talks to you from a prompt bar that lives on the page he is currently looking at.",
    "Reply in Spanish · concise · operative tone · prefer bullets / short paragraphs · markdown allowed (headers · lists · code fences · tables).",
    "",
    `Current surface · ${context.page ?? "unknown"}`,
    `Channel · ${channel}`,
    clientRow ? `Client in scope · ${clientRow.name} (${clientRow.id.slice(0, 8)}…)` : null,
    clientRow?.website_url ? `Website · ${clientRow.website_url}` : null,
    brandSummary ? `\nBrand voice summary:\n${brandSummary}` : null,
    formStateBlock,
    surfaceStateBlock,
    "",
    "When you want the user to apply a structural change · USE tools (suggest_form_update · trigger_workflow). NEVER embed proposed JSON in the text reply · the tool surfaces a HITL button.",
    "Never claim to have taken an action unless you actually triggered a tool · be honest about what you can vs cannot do from this surface.",
  ]
    .filter(Boolean)
    .join("\n")

  // ── Build messages array (multimodal user turn) ─────────────────
  type ContentBlock =
    | { type: "text"; text: string }
    | {
        type: "image"
        source: {
          type: "base64"
          media_type: string
          data: string
        }
      }
  const userContent: ContentBlock[] = []
  // Inline image attachments (limit to ~5 to stay sane)
  const inlineImages = attachments.filter((a) => a.mime?.startsWith("image/")).slice(0, 5)
  for (const a of inlineImages) {
    if (!a.url) continue
    try {
      const r = await fetch(a.url)
      if (!r.ok) continue
      const buf = Buffer.from(await r.arrayBuffer())
      // Anthropic accepts at most a few MB per image · skip oversized
      if (buf.byteLength > 5 * 1024 * 1024) continue
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: a.mime,
          data: buf.toString("base64"),
        },
      })
    } catch {
      /* swallow · text fallback below mentions the attachment */
    }
  }
  // Mention non-image attachments as text references (Claude can't open
  // arbitrary PDFs natively · the user can describe them or we extend
  // later to convert PDFs to text server-side)
  const nonImageAttachments = attachments.filter((a) => !a.mime?.startsWith("image/"))
  const userText =
    nonImageAttachments.length > 0
      ? `${message}\n\n(Adjuntos no-imagen · ${nonImageAttachments
          .map((a) => `${a.name} [${a.mime}]`)
          .join(" · ")})`
      : message
  userContent.push({ type: "text", text: userText })

  const claudeMessages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userContent },
  ]

  // ── Call Anthropic ───────────────────────────────────────────────
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
        max_tokens: 1600,
        system: systemPrompt,
        tools: TOOLS,
        messages: claudeMessages,
      }),
    })
    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      return NextResponse.json(
        {
          ok: false,
          error: "anthropic_api_error",
          status: claudeRes.status,
          details: errText.slice(0, 500),
        },
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

  const blocks = claudeJson.content ?? []
  const textBlocks: string[] = []
  const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = []
  for (const b of blocks) {
    if (b.type === "text") textBlocks.push(b.text)
    else if (b.type === "tool_use") toolCalls.push({ name: b.name, input: b.input })
  }
  const reply = textBlocks.join("\n\n").trim() || "(sin respuesta textual · ver acciones)"

  // ── Persist ──────────────────────────────────────────────────────
  try {
    await svc.from("cowork_messages").insert([
      {
        content: message,
        sender_user_id: `dashboard:${userRes.user.id}`,
        status: "responded",
        response_content: reply,
        responded_at: new Date().toISOString(),
        metadata: {
          channel,
          session_id: sessionId,
          page: context.page,
          client_id: context.client_id ?? null,
          form_state: context.form_state ?? null,
          surface_state: context.surface_state ?? null,
          attachments,
          tool_calls: toolCalls,
          usage: claudeJson.usage,
          stop_reason: claudeJson.stop_reason,
        },
      },
    ])
  } catch (e) {
    console.error("cowork_messages insert failed", e)
  }

  return NextResponse.json({
    ok: true,
    reply,
    tool_calls: toolCalls,
    usage: claudeJson.usage ?? null,
    stop_reason: claudeJson.stop_reason ?? null,
  })
}
