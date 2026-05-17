"use client"
/**
 * CoworkPromptBar · STEP 11 · M1 (MVP).
 *
 * The dashboard's main prompt-surface to Cowork · transforms the
 * old small chat drawer + per-modal CoworkContextChat into a full
 * claude.ai-equivalent bar.
 *
 * Milestone 1 features (this commit) ·
 *   - multi-line autosize textarea · Enter sends · Shift+Enter newline
 *   - paperclip → multi-file picker · folder → directory picker
 *     (webkitdirectory) · clipboard paste for screenshots
 *   - drag & drop files anywhere over the bar
 *   - file chips above the input (name · size · X to remove)
 *   - markdown rendering of replies (react-markdown + remark-gfm) ·
 *     code fences · tables · links · lists
 *   - thread scroll · re-hydrates on mount via /api/cowork/prompt-
 *     history?session_id=... with per-channel localStorage session id
 *   - context aware · accepts page · channel · clientId · formState ·
 *     surfaceState · passes to /api/cowork/prompt
 *
 * Milestones 2-4 will layer streaming · slash commands · action
 * widgets · multi-session tabs on top of this baseline.
 *
 * Phase 4.1 regression-safe · all props are primitives or
 * serializable objects · the only callback prop (onApplySuggestion)
 * lives strictly client↔client.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import {
  Paperclip,
  FolderOpen,
  PaperPlaneRight,
  CircleNotch,
  X,
  Image as PhImage,
  FileText,
  Sparkle,
  ArrowsCounterClockwise,
  ArrowSquareOut,
  Stop,
} from "@phosphor-icons/react/dist/ssr"
import { getOrCreateSessionId, rotateSessionId } from "@/lib/cowork-session"

export interface PromptAttachment {
  name: string
  mime: string
  path: string
  url: string | null
  size: number
}

export interface PromptToolCall {
  name: string
  input: Record<string, unknown>
}

export interface PromptTurn {
  role: "user" | "assistant"
  content: string
  attachments?: PromptAttachment[]
  tool_calls?: PromptToolCall[]
  ts?: string | null
  /** Local-only · true once a tool_call action button has been clicked. */
  applied?: Record<string, boolean>
}

export interface CoworkPromptBarProps {
  /** Logical channel · scopes the localStorage session id + DB
   * metadata.channel for the cowork_messages row. */
  channel: string
  /** Current page slug · e.g. "home" · "dept/mkt" · "clients/[id]" ·
   * sent to the backend so Cowork knows where Emilio is. */
  page?: string
  /** Optional · scopes brand/voice loading on the server. */
  clientId?: string
  clientName?: string
  /** Optional · live form snapshot · serialized into the system prompt. */
  formState?: Record<string, unknown>
  /** Optional · any surface-specific state worth giving Cowork. */
  surfaceState?: Record<string, unknown>
  /** Called when the user clicks "Aplicar sugerencias" on a tool_use
   * card · receives the suggested updates object. */
  onApplySuggestion?: (updates: Record<string, unknown>) => void
  /** Called when the user clicks "Disparar workflow" on a tool_use card. */
  onTriggerWorkflow?: (info: { workflow_id: string; reason?: string }) => void
  /** Max thread height in px · default 360 for the home placement. */
  maxThreadHeight?: number
  /** Optional eyebrow chip above the title. */
  eyebrow?: string
  /** Visual variant · default `full` (home/main) · `compact` for
   * embedded modal placements. */
  variant?: "full" | "compact"
  /** When true, focuses the textarea on mount · default false. */
  autoFocus?: boolean
}

const APPLY_BLOCKLIST = new Set(["reasoning"])

function bytesShort(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}

function applicableUpdates(input: Record<string, unknown> | null | undefined) {
  if (!input) return {}
  const raw = (input.updates ?? input) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (APPLY_BLOCKLIST.has(k)) continue
    if (v === null || v === undefined) continue
    out[k] = v
  }
  return out
}

export function CoworkPromptBar({
  channel,
  page,
  clientId,
  clientName,
  formState,
  surfaceState,
  onApplySuggestion,
  onTriggerWorkflow,
  maxThreadHeight = 360,
  eyebrow,
  variant = "full",
  autoFocus = false,
}: CoworkPromptBarProps) {
  const [sessionId, setSessionId] = useState<string>("")
  const [turns, setTurns] = useState<PromptTurn[]>([])
  const [input, setInput] = useState("")
  const [pending, setPending] = useState<PromptAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  /** Live token-by-token assistant content while a stream is in flight.
   * Rendered as a separate "ghost" turn at the tail · committed into
   * `turns` once the stream emits its `done` event (or aborts). */
  const [streamingText, setStreamingText] = useState<string>("")
  const [streamingTools, setStreamingTools] = useState<PromptToolCall[]>([])
  const [hydrating, setHydrating] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── Session id (per channel) ─────────────────────────────────────
  useEffect(() => {
    setSessionId(getOrCreateSessionId(channel))
  }, [channel])

  // ── Hydrate thread on session change ─────────────────────────────
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    setHydrating(true)
    setTurns([])
    fetch(
      `/api/cowork/prompt-history?session_id=${encodeURIComponent(sessionId)}&limit=20`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((json: { ok: boolean; turns?: PromptTurn[] }) => {
        if (cancelled) return
        if (json.ok && Array.isArray(json.turns)) setTurns(json.turns)
      })
      .catch(() => {
        /* history is best-effort */
      })
      .finally(() => {
        if (!cancelled) setHydrating(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  // ── Autosize textarea ────────────────────────────────────────────
  useEffect(() => {
    const t = textareaRef.current
    if (!t) return
    t.style.height = "0px"
    const next = Math.min(220, t.scrollHeight)
    t.style.height = next + "px"
  }, [input])

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus])

  // ── Autoscroll thread bottom on new turns ────────────────────────
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns, sending, streamingText])

  // ── Upload helper ────────────────────────────────────────────────
  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!sessionId || files.length === 0) return
      setUploading(true)
      setError(null)
      const fd = new FormData()
      fd.append("session_id", sessionId)
      fd.append("channel", channel)
      for (const f of files) fd.append("files", f)
      try {
        const res = await fetch("/api/cowork/upload", {
          method: "POST",
          body: fd,
        })
        const json = (await res.json()) as {
          ok: boolean
          uploaded?: PromptAttachment[]
          errors?: Array<{ name: string; error: string }>
          error?: string
          hint?: string
        }
        if (!res.ok) {
          setError(json.hint ?? json.error ?? `HTTP ${res.status}`)
          toast.error("Upload falló · " + (json.error ?? `HTTP ${res.status}`))
          return
        }
        if (json.errors && json.errors.length > 0) {
          for (const e of json.errors) toast.error(`${e.name} · ${e.error}`)
        }
        if (json.uploaded && json.uploaded.length > 0) {
          setPending((p) => [...p, ...json.uploaded!])
          toast.success(
            `${json.uploaded.length} archivo${json.uploaded.length === 1 ? "" : "s"} listo${json.uploaded.length === 1 ? "" : "s"}`,
          )
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "network_error"
        setError(msg)
        toast.error("Upload network error · " + msg)
      } finally {
        setUploading(false)
      }
    },
    [channel, sessionId],
  )

  // ── Send (streaming via SSE) ─────────────────────────────────────
  async function onSend() {
    const trimmed = input.trim()
    if (!trimmed || sending) return
    if (!sessionId) {
      setError("session_not_ready")
      return
    }
    setSending(true)
    setError(null)
    setStreamingText("")
    setStreamingTools([])
    const attachments = pending
    const userTurn: PromptTurn = {
      role: "user",
      content: trimmed,
      attachments: attachments.length > 0 ? attachments : undefined,
      ts: new Date().toISOString(),
    }
    setTurns((prev) => [...prev, userTurn])
    setInput("")
    setPending([])

    const ac = new AbortController()
    abortRef.current = ac

    let accumulatedText = ""
    let accumulatedTools: PromptToolCall[] = []
    let streamError: string | null = null
    let aborted = false

    try {
      const res = await fetch("/api/cowork/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          message: trimmed,
          attachments,
          context: {
            page,
            channel,
            client_id: clientId,
            form_state: formState,
            surface_state: surfaceState,
          },
          history: turns.map((t) => ({ role: t.role, content: t.content })),
          session_id: sessionId,
        }),
        signal: ac.signal,
      })
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "")
        streamError = `HTTP ${res.status} · ${txt.slice(0, 200)}`
        toast.error("Cowork falló · " + streamError)
      } else {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let curEvent = ""
        let curData = ""

        const handle = (event: string, dataStr: string) => {
          if (!dataStr) return
          let parsed: Record<string, unknown>
          try {
            parsed = JSON.parse(dataStr)
          } catch {
            return
          }
          if (event === "text") {
            const v = typeof parsed.value === "string" ? (parsed.value as string) : ""
            if (v) {
              accumulatedText += v
              setStreamingText(accumulatedText)
            }
          } else if (event === "tool_use") {
            const name = String(parsed.name ?? "")
            const inputObj = (parsed.input ?? {}) as Record<string, unknown>
            if (name) {
              accumulatedTools = [...accumulatedTools, { name, input: inputObj }]
              setStreamingTools(accumulatedTools)
            }
          } else if (event === "error") {
            streamError = String(parsed.message ?? "stream_error")
            if (!parsed.partial) toast.error("Cowork · " + streamError)
          } else if (event === "done") {
            // handled after loop · we already have accumulatedText
          }
        }

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done: isDone, value } = await reader.read()
          if (isDone) break
          buffer += decoder.decode(value, { stream: true })
          let nl: number
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).replace(/\r$/, "")
            buffer = buffer.slice(nl + 1)
            if (line === "") {
              if (curEvent || curData) {
                handle(curEvent, curData)
                curEvent = ""
                curData = ""
              }
              continue
            }
            if (line.startsWith(":")) continue
            if (line.startsWith("event:")) curEvent = line.slice(6).trim()
            else if (line.startsWith("data:"))
              curData = (curData ? curData + "\n" : "") + line.slice(5).trim()
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network_error"
      if (ac.signal.aborted) {
        aborted = true
      } else {
        streamError = msg
        toast.error("Network · " + msg)
      }
    } finally {
      // Commit whatever we have as the assistant turn (full · partial · or abort)
      const finalText =
        accumulatedText ||
        (aborted ? "_(cancelado por el usuario)_" : "_(sin respuesta)_")
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: finalText,
          tool_calls: accumulatedTools.length > 0 ? accumulatedTools : undefined,
          ts: new Date().toISOString(),
        },
      ])
      setStreamingText("")
      setStreamingTools([])
      setSending(false)
      abortRef.current = null
      if (streamError) setError(streamError)
    }
  }

  function onCancel() {
    if (abortRef.current && sending) {
      abortRef.current.abort()
      toast("Stream cancelado · respuesta parcial guardada")
    }
  }

  function onTextareaKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void onSend()
    }
  }

  // ── Clipboard paste · capture image blobs ────────────────────────
  function onTextareaPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items ?? []
    const files: File[] = []
    for (const item of items) {
      if (item.kind === "file") {
        const f = item.getAsFile()
        if (f) files.push(f)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      void uploadFiles(files)
    }
  }

  // ── Drag & drop ──────────────────────────────────────────────────
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const files: File[] = []
    if (e.dataTransfer.items) {
      for (const item of e.dataTransfer.items) {
        if (item.kind === "file") {
          const f = item.getAsFile()
          if (f) files.push(f)
        }
      }
    } else {
      for (const f of e.dataTransfer.files) files.push(f)
    }
    if (files.length > 0) void uploadFiles(files)
  }

  // ── New session ──────────────────────────────────────────────────
  function onNewSession() {
    const next = rotateSessionId(channel)
    setSessionId(next)
    setTurns([])
    setInput("")
    setPending([])
    toast.success("Sesión Cowork nueva · iniciada")
  }

  const headerTitle = useMemo(() => {
    if (variant === "compact") return "Pregunta a Cowork"
    return "Cowork · prompt bar"
  }, [variant])

  return (
    <section
      className={[
        "surface-card rim-instr",
        variant === "full" ? "p-5" : "p-4",
        dragOver ? "ring-2 ring-[hsl(var(--accent))]" : "",
      ].join(" ")}
      data-rim="cyan"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="relative z-[2] flex flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border-[0.5px] border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]">
              <Sparkle weight="duotone" className="h-4 w-4" />
            </span>
            <div>
              {eyebrow ? (
                <p className="num text-[9.5px] uppercase tracking-[0.22em] text-[hsl(var(--accent))]">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="font-display text-base font-semibold tracking-tight">
                {headerTitle}
              </h2>
              <p className="num text-[9.5px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                {page ? `surface · ${page}` : "surface · global"}
                {clientName ? ` · cliente · ${clientName}` : ""}
                {sessionId ? ` · sesión · ${sessionId.slice(0, 8)}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNewSession}
            className="num inline-flex items-center gap-1 rounded-full border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.5)] px-2.5 py-1 text-[9.5px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--accent))]"
            title="Empezar conversación nueva"
          >
            <ArrowsCounterClockwise weight="bold" className="h-3 w-3" />
            Nueva sesión
          </button>
        </header>

        {/* Thread */}
        <div
          ref={threadRef}
          className="flex flex-col gap-2.5 overflow-y-auto pr-1"
          style={{ maxHeight: maxThreadHeight }}
        >
          {hydrating ? (
            <p className="num text-[10px] text-[hsl(var(--muted-foreground))]">
              <CircleNotch weight="bold" className="mr-1 inline h-3 w-3 animate-spin" />
              Cargando historial…
            </p>
          ) : turns.length === 0 ? (
            <EmptyHint variant={variant} />
          ) : (
            turns.map((t, i) => (
              <Bubble
                key={i}
                turn={t}
                onApply={
                  onApplySuggestion
                    ? (input) => {
                        const upd = applicableUpdates(input)
                        if (Object.keys(upd).length === 0) return
                        onApplySuggestion(upd)
                        setTurns((prev) =>
                          prev.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  applied: {
                                    ...(x.applied ?? {}),
                                    suggest_form_update: true,
                                  },
                                }
                              : x,
                          ),
                        )
                      }
                    : undefined
                }
                onTrigger={
                  onTriggerWorkflow
                    ? (input) => {
                        const id = String(input.workflow_id ?? "")
                        if (!id) return
                        onTriggerWorkflow({
                          workflow_id: id,
                          reason:
                            typeof input.reason === "string"
                              ? (input.reason as string)
                              : undefined,
                        })
                        setTurns((prev) =>
                          prev.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  applied: {
                                    ...(x.applied ?? {}),
                                    trigger_workflow: true,
                                  },
                                }
                              : x,
                          ),
                        )
                      }
                    : undefined
                }
              />
            ))
          )}
          {sending && streamingText ? (
            <Bubble
              turn={{
                role: "assistant",
                content: streamingText,
                tool_calls: streamingTools.length > 0 ? streamingTools : undefined,
              }}
            />
          ) : null}
          {sending && !streamingText ? (
            <div className="flex items-center gap-2 self-start rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.6)] px-2.5 py-1.5 text-[10.5px] text-[hsl(var(--muted-foreground))]">
              <CircleNotch weight="bold" className="h-3 w-3 animate-spin" />
              Cowork piensa…
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="num text-[10px] text-[hsl(var(--danger))]">{error}</p>
        ) : null}

        {/* Pending attachments */}
        {pending.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {pending.map((a) => (
              <span
                key={a.path}
                className="num inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] px-2 py-1 text-[10px] text-[hsl(var(--muted-foreground))]"
              >
                {a.mime.startsWith("image/") ? (
                  <PhImage weight="duotone" className="h-3 w-3 text-[hsl(var(--accent))]" />
                ) : (
                  <FileText weight="duotone" className="h-3 w-3 text-[hsl(var(--accent))]" />
                )}
                <span className="max-w-[180px] truncate">{a.name}</span>
                <span className="text-[9px] opacity-70">{bytesShort(a.size)}</span>
                <button
                  type="button"
                  aria-label={`Quitar ${a.name}`}
                  onClick={() =>
                    setPending((p) => p.filter((x) => x.path !== a.path))
                  }
                  className="ml-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--danger))]"
                >
                  <X weight="bold" className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {/* Composer */}
        <div className="flex items-end gap-2">
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !sessionId}
              title="Adjuntar archivos"
              className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--primary-glow)/0.08)] hover:text-[hsl(var(--accent))] disabled:opacity-50"
            >
              <Paperclip weight="bold" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading || !sessionId}
              title="Adjuntar carpeta completa"
              className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--primary-glow)/0.08)] hover:text-[hsl(var(--accent))] disabled:opacity-50"
            >
              <FolderOpen weight="bold" className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const fs = [...(e.target.files ?? [])]
                if (fs.length > 0) void uploadFiles(fs)
                e.target.value = ""
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              hidden
              // @ts-expect-error · webkitdirectory is non-standard but supported
              webkitdirectory="true"
              directory="true"
              multiple
              onChange={(e) => {
                const fs = [...(e.target.files ?? [])]
                if (fs.length > 0) void uploadFiles(fs)
                e.target.value = ""
              }}
            />
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onTextareaKey}
            onPaste={onTextareaPaste}
            rows={1}
            placeholder={
              clientName
                ? `Preguntale a Cowork sobre ${clientName}…`
                : "Preguntale a Cowork · adjuntá archivos · pegá screenshots"
            }
            disabled={sending}
            className="min-h-[40px] w-full resize-none rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--background)/0.7)] px-3 py-2 text-[13px] leading-snug outline-none transition focus:border-[hsl(var(--accent)/0.6)] disabled:opacity-60"
          />

          {sending ? (
            <button
              type="button"
              onClick={onCancel}
              className="num inline-flex shrink-0 items-center gap-1.5 rounded-md border-[0.5px] border-[hsl(var(--danger)/0.5)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--danger))] transition hover:bg-[hsl(var(--danger)/0.16)]"
              title="Cancelar stream"
            >
              <Stop weight="fill" className="h-3.5 w-3.5" />
              Detener
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={input.trim().length === 0 || !sessionId}
              className="shimmer-btn inline-flex shrink-0 items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40"
              title="Enviar (Enter)"
            >
              <PaperPlaneRight weight="bold" className="h-3.5 w-3.5" />
              Enviar
            </button>
          )}
        </div>

        <p className="num text-[9px] text-[hsl(var(--muted-foreground))]">
          Enter envía · Shift+Enter nueva línea · arrastrá archivos · pegá
          screenshots · paperclip multi-file · folder sube carpeta entera
          {dragOver ? " · soltá para subir" : ""}
        </p>
      </div>
    </section>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function EmptyHint({ variant }: { variant: "full" | "compact" }) {
  return (
    <div className="rounded-md border-[0.5px] border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/0.3)] px-3 py-4 text-[11px] text-[hsl(var(--muted-foreground))]">
      {variant === "full" ? (
        <>
          Empezá una conversación con Cowork desde acá · adjuntá screenshots
          o documentos para que tenga el contexto exacto · todo queda
          archivado por sesión y se re-hidrata al volver.
        </>
      ) : (
        <>Sin contexto previo · empezá preguntando algo.</>
      )}
    </div>
  )
}

function Bubble({
  turn,
  onApply,
  onTrigger,
}: {
  turn: PromptTurn
  onApply?: (input: Record<string, unknown>) => void
  onTrigger?: (input: Record<string, unknown>) => void
}) {
  const isUser = turn.role === "user"
  return (
    <div className={isUser ? "self-end" : "self-start"} style={{ maxWidth: "92%" }}>
      <div
        className={[
          "rounded-md px-3 py-2 text-[12.5px] leading-relaxed",
          isUser
            ? "border-[0.5px] border-[hsl(var(--accent)/0.35)] bg-[hsl(var(--accent)/0.08)] text-[hsl(var(--accent))]"
            : "border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] text-[hsl(var(--foreground))]",
        ].join(" ")}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{turn.content}</p>
        ) : (
          <div className="cowork-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* User attachment previews */}
      {turn.attachments && turn.attachments.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {turn.attachments.map((a) => (
            <a
              key={a.path}
              href={a.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.5)] px-2 py-1 text-[10px] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--accent)/0.6)] hover:text-[hsl(var(--accent))]"
            >
              {a.mime.startsWith("image/") && a.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.url}
                  alt={a.name}
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <FileText weight="duotone" className="h-3 w-3" />
              )}
              <span className="max-w-[160px] truncate">{a.name}</span>
              <ArrowSquareOut weight="bold" className="h-2.5 w-2.5 opacity-60" />
            </a>
          ))}
        </div>
      ) : null}

      {/* Tool-call cards · M1 surfaces them as HITL action buttons */}
      {!isUser && turn.tool_calls && turn.tool_calls.length > 0 ? (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {turn.tool_calls.map((tc, idx) => {
            const reasoning = tc.input?.reasoning as string | undefined
            const applied =
              tc.name === "suggest_form_update"
                ? turn.applied?.suggest_form_update
                : tc.name === "trigger_workflow"
                  ? turn.applied?.trigger_workflow
                  : false
            return (
              <div
                key={idx}
                className="rounded-md border-[0.5px] border-[hsl(var(--accent)/0.35)] bg-[hsl(var(--accent)/0.05)] px-2.5 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="num text-[9.5px] uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
                    {tc.name === "suggest_form_update"
                      ? "Sugerencia de form"
                      : tc.name === "trigger_workflow"
                        ? "Disparar workflow"
                        : tc.name}
                  </span>
                  {applied ? (
                    <span className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--success))]">
                      aplicado
                    </span>
                  ) : tc.name === "suggest_form_update" && onApply ? (
                    <button
                      type="button"
                      onClick={() => onApply(tc.input)}
                      className="num rounded-full border-[0.5px] border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--accent)/0.12)] px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.2)]"
                    >
                      Aplicar sugerencias
                    </button>
                  ) : tc.name === "trigger_workflow" && onTrigger ? (
                    <button
                      type="button"
                      onClick={() => onTrigger(tc.input)}
                      className="num rounded-full border-[0.5px] border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--accent)/0.12)] px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.2)]"
                    >
                      Disparar
                    </button>
                  ) : null}
                </div>
                {reasoning ? (
                  <p className="num mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                    {reasoning}
                  </p>
                ) : null}
                <details className="mt-1">
                  <summary className="num cursor-pointer text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                    ver payload
                  </summary>
                  <pre className="mt-1 max-w-full overflow-x-auto rounded bg-[hsl(var(--background)/0.7)] px-2 py-1 text-[9px]">
                    {JSON.stringify(tc.input, null, 2)}
                  </pre>
                </details>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
