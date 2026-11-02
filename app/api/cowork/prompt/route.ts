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
import { ejecutarHerramienta, HERRAMIENTAS_DE_LECTURA, leerTraspaso, lineasDeAccesoAlSistema, MAX_VUELTAS_DE_HERRAMIENTAS, NOMBRES_DE_LECTURA } from "@/lib/chat-herramientas"
import { lectoresDeLaPlataforma } from "@/lib/chat-plataforma"

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

/** 01-nov (chat de /nuevo): la única herramienta es PROPONER un pedido; nunca se ejecuta sola, sale como botón y, si Emilio lo toca, queda guardado como pedido para Lenovo (no despacha nada a n8n). */
const PEDIDO_TOOL = {
  name: "proponer_pedido",
  description:
    "Cuando Emilio pida construir, cambiar o arreglar algo, propón dejarlo como PEDIDO para Lenovo. Sale como un botón; no se ejecuta ni se despacha nada hasta que él lo toque, y aun entonces solo queda anotado.",
  input_schema: {
    type: "object",
    properties: {
      titulo: { type: "string", description: "Frase corta que nombra el pedido." },
      detalle: { type: "string", description: "Qué quiere Emilio, con las palabras de él, en 1-4 frases." },
    },
    required: ["titulo", "detalle"],
    additionalProperties: false,
  },
} as const

/** 02-nov: tres herramientas de LECTURA (vault y plataforma) + la que propone un pedido como botón */
const TOOLS = [...HERRAMIENTAS_DE_LECTURA, PEDIDO_TOOL]

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
  // 01-nov: el cuadro de /nuevo todavía no sube archivos; los adjuntos del cuerpo se ignoran (el servidor no baja direcciones que le manda el navegador)
  const attachments: Attachment[] = []
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
  const porVoz = !!context.surface_state && (context.surface_state as Record<string, unknown>).voz === true
  // 02-nov: el traspaso vivo entra completo al arrancar la conversación (con caché de pedido: repetirlo cuesta ~10 %)
  const traspaso = await leerTraspaso(svc)
  const systemPrompt = [
    "Eres el asistente de Zero Risk dentro del tablero. Hablas con Emilio Pérez, el dueño y único administrador, desde el cuadro de chat de abajo.",
    "Responde en español de Ecuador, con tuteo (nunca voseo). Sé breve, claro y práctico, como un jefe de operaciones: cuentas, empleados, servicios, proveedores, entregas.",
    "Evita la jerga técnica; si hace falta un dato técnico, ponlo al final entre paréntesis.",
    porVoz
      ? "Esta respuesta se va a LEER EN VOZ ALTA: frases cortas, sin listas, sin tablas, sin markdown, sin símbolos; máximo unas 4 frases."
      : "Puedes usar listas cortas.",
    "",
    `Pantalla actual · ${context.page ?? "desconocida"}`,
    clientRow ? `Cliente en foco · ${clientRow.name}` : null,
    clientRow?.website_url ? `Sitio · ${clientRow.website_url}` : null,
    brandSummary ? `\nVoz de marca:\n${brandSummary}` : null,
    formStateBlock,
    surfaceStateBlock,
    "",
    ...lineasDeAccesoAlSistema(traspaso),
    "Si Emilio pide construir, cambiar o arreglar algo, usa la herramienta proponer_pedido (sale como botón; nunca ejecutas nada). No afirmes haber hecho algo que no hiciste.",
  ]
    .filter(Boolean)
    .join("\n")

  const systemBlocks: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> = [
    ...(traspaso.texto
      ? [{ type: "text" as const, text: `TRASPASO DEL SISTEMA (léelo como lo haría un orquestador al empezar su turno)\n\n${traspaso.texto}`, cache_control: { type: "ephemeral" as const } }]
      : []),
    { type: "text", text: systemPrompt },
  ]

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
      const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = []
      let usage: { input_tokens?: number; output_tokens?: number } | null = null
      let stopReason: string | null = null
      let vueltasDeHerramientas = 0
      let fallo = false
      const deps = { svc, plataforma: lectoresDeLaPlataforma(svc) }
      const mensajes: Array<{ role: string; content: unknown }> = [...claudeMessages]

      type BloqueDeTexto = { type: "text"; text: string }
      type BloqueDeHerramienta = { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      interface ResultadoDeVuelta {
        ok: boolean
        bloques: Array<BloqueDeTexto | BloqueDeHerramienta>
        parada: string | null
      }

      /** una llamada al modelo: emite el texto al cliente a medida que llega y devuelve los bloques completos de esa vuelta */
      async function unaVuelta(): Promise<ResultadoDeVuelta> {
        const toolBlocks = new Map<number, { id: string; name: string; partial: string }>()
        const textBlocks = new Map<number, string>()
        const orden: number[] = []
        const bloquesDeHerramienta: BloqueDeHerramienta[] = []
        let parada: string | null = null

        let claudeRes: Response
        try {
          claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey as string,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 1600,
              stream: true,
              system: systemBlocks,
              tools: TOOLS,
              messages: mensajes,
            }),
            signal: req.signal,
          })
        } catch (e) {
          emit("error", { message: e instanceof Error ? e.message : "anthropic_fetch_failed" })
          return { ok: false, bloques: [], parada: null }
        }

        if (!claudeRes.ok || !claudeRes.body) {
          const errText = await claudeRes.text().catch(() => "")
          // 01-nov: queda en los registros de Vercel (sin la llave) para saber el motivo real cuando el cuadro de /nuevo no puede responder
          console.error("cowork/prompt: anthropic_api_error", claudeRes.status, errText.slice(0, 300))
          emit("error", {
            message: "anthropic_api_error",
            status: claudeRes.status,
            details: errText.slice(0, 500),
          })
          return { ok: false, bloques: [], parada: null }
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
            orden.push(idx)
            if (block?.type === "tool_use") {
              toolBlocks.set(idx, { id: String(block.id ?? ""), name: String(block.name ?? ""), partial: "" })
            } else if (block?.type === "text") {
              textBlocks.set(idx, "")
            }
          } else if (event === "content_block_delta") {
            const idx = Number(parsed.index ?? -1)
            const delta = parsed.delta as Record<string, unknown> | undefined
            if (delta?.type === "text_delta" && typeof delta.text === "string") {
              assistantText += delta.text
              textBlocks.set(idx, (textBlocks.get(idx) ?? "") + delta.text)
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
              let input: Record<string, unknown>
              try {
                input = t.partial ? (JSON.parse(t.partial) as Record<string, unknown>) : {}
              } catch {
                input = { _raw: t.partial }
              }
              bloquesDeHerramienta.push({ type: "tool_use", id: t.id, name: t.name, input })
              toolBlocks.delete(idx)
            }
          } else if (event === "message_delta") {
            const delta = parsed.delta as Record<string, unknown> | undefined
            if (delta && typeof delta.stop_reason === "string") {
              stopReason = delta.stop_reason
              parada = delta.stop_reason
            }
            if (parsed.usage && typeof parsed.usage === "object") {
              const u = parsed.usage as { input_tokens?: number; output_tokens?: number }
              usage = { input_tokens: (usage?.input_tokens ?? 0) + (u.input_tokens ?? 0), output_tokens: (usage?.output_tokens ?? 0) + (u.output_tokens ?? 0) }
            }
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
          return { ok: false, bloques: [], parada }
        }

        // los bloques de la vuelta en el orden en que llegaron (texto y herramientas)
        const bloques: Array<BloqueDeTexto | BloqueDeHerramienta> = []
        for (const idx of orden) {
          if (textBlocks.has(idx)) {
            const tx = textBlocks.get(idx) ?? ""
            if (tx) bloques.push({ type: "text", text: tx })
          }
        }
        bloques.push(...bloquesDeHerramienta)
        return { ok: true, bloques, parada }
      }

      // bucle: el modelo puede LEER (buscar en el vault, leer un documento, consultar la plataforma) hasta MAX_VUELTAS_DE_HERRAMIENTAS veces; proponer_pedido nunca ejecuta nada
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (vueltasDeHerramientas > 0 && assistantText && !assistantText.endsWith("\n\n")) {
          assistantText += "\n\n"
          emit("text", { value: "\n\n" })
        }
        const v = await unaVuelta()
        if (!v.ok) { fallo = true; break }
        const usos = v.bloques.filter((b): b is BloqueDeHerramienta => b.type === "tool_use")
        for (const u of usos) {
          toolCalls.push({ name: u.name, input: u.input })
          if (!NOMBRES_DE_LECTURA.has(u.name)) emit("tool_use", { name: u.name, input: u.input })
        }
        const lecturas = usos.filter((u) => NOMBRES_DE_LECTURA.has(u.name))
        if (v.parada !== "tool_use" || lecturas.length === 0 || vueltasDeHerramientas >= MAX_VUELTAS_DE_HERRAMIENTAS) break
        vueltasDeHerramientas += 1
        const resultados: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = []
        for (const u of usos) {
          if (NOMBRES_DE_LECTURA.has(u.name)) {
            emit("estado", { value: u.name })
            resultados.push({ type: "tool_result", tool_use_id: u.id, content: await ejecutarHerramienta(u.name, u.input, deps) })
          } else {
            resultados.push({ type: "tool_result", tool_use_id: u.id, content: "El botón ya se le mostró a Emilio; no se ejecuta nada hasta que lo toque." })
          }
        }
        mensajes.push({ role: "assistant", content: v.bloques })
        mensajes.push({ role: "user", content: resultados })
      }
      // si la primera llamada falló y no hay nada que guardar, el error ya salió: no se registra una fila vacía
      if (fallo && !assistantText) {
        done()
        return
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
