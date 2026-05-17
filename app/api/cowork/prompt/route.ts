/**
 * POST /api/cowork/prompt · STEP 11 · M2 · streaming SSE.
 *
 * Always streams the Anthropic Messages API response back to the
 * client as Server-Sent Events. The CoworkPromptBar parses incoming
 * SSE chunks and renders text token-by-token · tool_use blocks are
 * accumulated server-side and emitted as a single complete event
 * once their content_block_stop arrives.
 *
 * SSE event schema (client-facing) ·
 *   event: text       data: { value: string }            // text delta chunk
 *   event: tool_use   data: { name, input }              // complete tool call
 *   event: done       data: { usage, stop_reason }       // stream ended cleanly
 *   event: error      data: { message }                  // upstream/parsing error
 *
 * Persist happens server-side once the stream completes (or partially
 * if client aborts · we still write what we have).
 */
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
          "Free-shape object · keys match the host form's field names · values are the proposed new values.",
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

function sseError(message: string, status = 400): Response {
  const body = `event: error\ndata: ${JSON.stringify({ message })}\n\n`
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

export async function POST(req: Request) {
  // Auth
  const supa = await getSessionClient()
  const { data: userRes } = await supa.auth.getUser()
  if (!userRes?.user) return sseError("unauthenticated", 401)
  const { data: roleRow } = await supa
    .from("app_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .maybeSingle()
  if (roleRow?.role !== "admin") return sseError("forbidden", 403)

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return sseError("invalid_json")
  }
  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (!message || message.length > 8000) return sseError("message_empty_or_too_long")
  const sessionId = typeof body.session_id === "string" ? body.session_id : ""
  if (!sessionId) return sseError("session_id_required")
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
  if (!apiKey) return sseError("anthropic_api_key_missing", 503)

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

  const brandSummary = summarizeBrandVoice(clientRow?.brand_voice ?? null)
  const formStateBlock = context.form_state
    ? `\n\nCurrent form state (JSON) ·\n\`\`\`json\n${JSON.stringify(context.form_state, null, 2)}\n\`\`\``
    : ""
  const surfaceStateBlock = context.surface_state
    ? `\n\nSurface state (JSON) ·\n\`\`\`json\n${JSON.stringify(context.surface_state, null, 2)}\n\`\`\``
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

  // Multimodal user content
  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  const userContent: ContentBlock[] = []
  const inlineImages = attachments.filter((a) => a.mime?.startsWith("image/")).slice(0, 5)
  for (const a of inlineImages) {
    if (!a.url) continue
    try {
      const r = await fetch(a.url)
      if (!r.ok) continue
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.byteLength > 5 * 1024 * 1024) continue
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: a.mime, data: buf.toString("base64") },
      })
    } catch {
      /* swallow · text fallback below mentions the attachment */
    }
  }
  const nonImageAttachments = attachments.filter((a) => !a.mime?.startsWith("image/"))
  const userText =
    nonImageAttachments.length > 0
      ? `${message}\n\n(Adjuntos no-imagen · ${nonImageAttachments.map((a) => `${a.name} [${a.mime}]`).join(" · ")})`
      : message
  userContent.push({ type: "text", text: userText })

  const claudeMessages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userContent },
  ]

  // ── Streaming response ──────────────────────────────────────────
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // SSE event emitter
      let closed = false
      function emit(event: string, data: unknown) {
        if (closed) return
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          )
        } catch {
          /* controller already closed by client abort · ignore */
        }
      }
      function done() {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          /* ignore */
        }
      }

      let assistantText = ""
      const toolBlocks = new Map<number, { name: string; partial: string }>()
      const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = []
      let usage: { input_tokens?: number; output_tokens?: number } | null = null
      let stopReason: string | null = null

      let claudeRes: Response
      try {
        claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1600,
            stream: true,
            system: systemPrompt,
            tools: TOOLS,
            messages: claudeMessages,
          }),
          signal: req.signal,
        })
      } catch (e) {
        emit("error", { message: e instanceof Error ? e.message : "anthropic_fetch_failed" })
        done()
        return
      }

      if (!claudeRes.ok || !claudeRes.body) {
        const errText = await claudeRes.text().catch(() => "")
        emit("error", {
          message: "anthropic_api_error",
          status: claudeRes.status,
          details: errText.slice(0, 500),
        })
        done()
        return
      }

      const reader = claudeRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let curEvent = ""
      let curData = ""

      const handleEvent = (event: string, dataStr: string) => {
        if (!dataStr) return
        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(dataStr)
        } catch {
          return
        }
        if (event === "content_block_start") {
          const idx = Number(parsed.index ?? -1)
          const block = parsed.content_block as Record<string, unknown> | undefined
          if (block?.type === "tool_use") {
            toolBlocks.set(idx, {
              name: String(block.name ?? ""),
              partial: "",
            })
          }
        } else if (event === "content_block_delta") {
          const idx = Number(parsed.index ?? -1)
          const delta = parsed.delta as Record<string, unknown> | undefined
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            assistantText += delta.text
            emit("text", { value: delta.text })
          } else if (
            delta?.type === "input_json_delta" &&
            typeof delta.partial_json === "string"
          ) {
            const t = toolBlocks.get(idx)
            if (t) t.partial += delta.partial_json
          }
        } else if (event === "content_block_stop") {
          const idx = Number(parsed.index ?? -1)
          const t = toolBlocks.get(idx)
          if (t) {
            try {
              const input = t.partial ? (JSON.parse(t.partial) as Record<string, unknown>) : {}
              toolCalls.push({ name: t.name, input })
              emit("tool_use", { name: t.name, input })
            } catch {
              emit("tool_use", { name: t.name, input: { _raw: t.partial } })
            }
            toolBlocks.delete(idx)
          }
        } else if (event === "message_delta") {
          const delta = parsed.delta as Record<string, unknown> | undefined
          if (delta && typeof delta.stop_reason === "string") {
            stopReason = delta.stop_reason
          }
          if (parsed.usage && typeof parsed.usage === "object") {
            usage = parsed.usage as typeof usage
          }
        } else if (event === "message_stop") {
          // handled after the read loop
        }
      }

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done: isDone, value } = await reader.read()
          if (isDone) break
          buffer += decoder.decode(value, { stream: true })
          // SSE frames are separated by \n\n · within a frame, "event:"
          // and "data:" lines accumulate.
          let nl: number
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).replace(/\r$/, "")
            buffer = buffer.slice(nl + 1)
            if (line === "") {
              if (curEvent || curData) {
                handleEvent(curEvent, curData)
                curEvent = ""
                curData = ""
              }
              continue
            }
            if (line.startsWith(":")) continue // comment
            if (line.startsWith("event:")) curEvent = line.slice(6).trim()
            else if (line.startsWith("data:"))
              curData = (curData ? curData + "\n" : "") + line.slice(5).trim()
          }
        }
      } catch (e) {
        // Client abort or upstream error · we still persist what we have
        emit("error", {
          message: e instanceof Error ? e.message : "stream_interrupted",
          partial: true,
        })
      }

      // Final · persist + emit done
      try {
        await svc.from("cowork_messages").insert([
          {
            content: message,
            sender_user_id: `dashboard:${userRes.user.id}`,
            status: "responded",
            response_content: assistantText || "(stream sin texto)",
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
              usage,
              stop_reason: stopReason,
              streamed: true,
            },
          },
        ])
      } catch (e) {
        console.error("cowork_messages insert failed", e)
      }

      emit("done", {
        reply: assistantText,
        tool_calls: toolCalls,
        usage,
        stop_reason: stopReason,
      })
      done()
    },
    cancel() {
      // Client aborted · nothing to do · reader will throw inside start()
      // and persistence still runs with the partial assistantText.
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
