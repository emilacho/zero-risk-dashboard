"use client"
/**
 * CoworkContextChat · STEP 8 reusable inline-chat pattern.
 *
 * Drops into ANY client component (modal · drawer · panel) that wants
 * a contextual "Pregunta a Cowork" affordance. The chat owns its own
 * thread + history fetch · the parent passes:
 *
 *   - channel · string (e.g. "campaign_modal" · "vault" · "workflow_drill")
 *   - clientId · string · scopes history + adds to API context
 *   - formState · current form values · passed into the system prompt
 *   - onApplySuggestion · client-only callback fired when the user
 *     clicks "Aplicar sugerencias" on a Cowork response (HITL)
 *
 * Phase 4.1 safe · `onApplySuggestion` is a client→client callback
 * (both this component AND the consumer are client components · no
 * server→client boundary involved).
 *
 * Backend · POST /api/cowork/campaign-context (channel-overridable) ·
 * GET /api/cowork/context-history for re-hydrate on mount.
 *
 * Persistence · every turn lands in `cowork_messages` with metadata =
 * { channel, client_id, form_state, form_updates }.
 */
import { useEffect, useRef, useState } from "react"
import {
  CircleNotch,
  PaperPlaneTilt,
  Sparkle,
  Warning,
  Check,
} from "@phosphor-icons/react"

export interface ChatTurn {
  role: "user" | "assistant"
  content: string
  /** Populated only on assistant turns when Cowork called the
   * suggest_form_update tool. Drives the "Aplicar sugerencias" button. */
  form_updates?: Record<string, unknown> | null
  /** ISO timestamp · null for in-flight turns */
  ts?: string | null
  /** Local-only flag · greyed out & no "apply" button after applied */
  applied?: boolean
}

export interface CoworkContextChatProps {
  channel: string
  clientId: string
  clientName?: string
  /** Live form snapshot · gets serialized into the system prompt on each send */
  formState: Record<string, unknown>
  /** Called when user clicks "Aplicar sugerencias" · receives only the
   * fields that came back from the tool call (no `reasoning` text). */
  onApplySuggestion?: (updates: Record<string, unknown>) => void
  /** Placeholder copy · default "Preguntá a Cowork sobre esta campaña..." */
  placeholder?: string
  /** Max thread height in px · default 200 per dispatch */
  maxThreadHeight?: number
  /** Optional title for the section header · default "Pregunta a Cowork" */
  title?: string
}

const APPLY_BLOCKLIST = new Set(["reasoning"])

function pickApplicableUpdates(
  raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!raw) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (APPLY_BLOCKLIST.has(k)) continue
    if (v === null || v === undefined) continue
    out[k] = v
  }
  return out
}

export function CoworkContextChat({
  channel,
  clientId,
  clientName,
  formState,
  onApplySuggestion,
  placeholder = "Preguntá a Cowork sobre esta campaña · objetivos · audiencia · presupuesto",
  maxThreadHeight = 200,
  title = "Pregunta a Cowork",
}: CoworkContextChatProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hydrating, setHydrating] = useState(true)
  const threadRef = useRef<HTMLDivElement | null>(null)

  // ── Hydrate history on mount + on (channel, clientId) change ────
  useEffect(() => {
    let cancelled = false
    setHydrating(true)
    setTurns([])
    const params = new URLSearchParams({ channel, client_id: clientId, limit: "8" })
    fetch(`/api/cowork/context-history?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { ok: boolean; turns?: ChatTurn[]; error?: string }) => {
        if (cancelled) return
        if (json.ok && Array.isArray(json.turns)) {
          setTurns(json.turns)
        }
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
  }, [channel, clientId])

  // ── Autoscroll to bottom on new turn ────────────────────────────
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns, sending])

  async function onSend() {
    const trimmed = input.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError(null)
    const userTurn: ChatTurn = {
      role: "user",
      content: trimmed,
      ts: new Date().toISOString(),
    }
    // Optimistic append
    setTurns((prev) => [...prev, userTurn])
    setInput("")
    try {
      const res = await fetch("/api/cowork/campaign-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          form_state: formState,
          message: trimmed,
          channel,
          // PaperPlaneTilt recent context to Claude (cap on backend at 12 turns)
          history: turns.map((t) => ({ role: t.role, content: t.content })),
        }),
      })
      const json = (await res.json()) as {
        ok: boolean
        reply?: string
        form_updates?: Record<string, unknown> | null
        error?: string
        hint?: string
      }
      if (!res.ok || !json.ok) {
        setError(json.hint ?? json.error ?? `HTTP ${res.status}`)
      } else {
        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            content: json.reply ?? "(sin contenido)",
            form_updates: json.form_updates ?? null,
            ts: new Date().toISOString(),
          },
        ])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "network_error")
    } finally {
      setSending(false)
    }
  }

  function onApply(idx: number) {
    const t = turns[idx]
    if (!t || t.role !== "assistant" || !t.form_updates || !onApplySuggestion) return
    onApplySuggestion(pickApplicableUpdates(t.form_updates))
    setTurns((prev) => prev.map((x, i) => (i === idx ? { ...x, applied: true } : x)))
  }

  return (
    <section
      className="mt-2 rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.22)] bg-[hsl(var(--card)/0.45)] p-3"
      data-cowork-channel={channel}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkle strokeWidth={1.5} className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
          <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
            {title}
          </span>
          {clientName ? (
            <span className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
              · {clientName}
            </span>
          ) : null}
        </div>
        {hydrating ? (
          <CircleNotch strokeWidth={1.5} className="h-3 w-3 animate-spin text-[hsl(var(--muted-foreground))]" />
        ) : null}
      </div>

      <div
        ref={threadRef}
        className="flex flex-col gap-2 overflow-y-auto pr-1"
        style={{ maxHeight: maxThreadHeight }}
      >
        {turns.length === 0 && !hydrating ? (
          <p className="num text-[10px] text-[hsl(var(--muted-foreground))]">
            Sin conversación previa · empezá preguntando algo como{" "}
            <em>&ldquo;¿qué objetivo recomendás para este cliente?&rdquo;</em> o{" "}
            <em>&ldquo;sugerí un audience preset coherente con el brand voice&rdquo;</em>.
          </p>
        ) : null}
        {turns.map((t, i) => (
          <ChatBubble
            key={i}
            turn={t}
            onApply={onApplySuggestion ? () => onApply(i) : undefined}
          />
        ))}
        {sending ? (
          <div className="flex items-center gap-1.5 self-start rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] px-2 py-1 text-[10px] text-[hsl(var(--muted-foreground))]">
            <CircleNotch strokeWidth={1.5} className="h-3 w-3 animate-spin" />
            Cowork piensa…
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-2 flex items-start gap-2 rounded-md border-[0.5px] border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.08)] px-2 py-1.5 text-[10px] text-[hsl(var(--danger))]">
          <Warning strokeWidth={1.5} className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void onSend()
            }
          }}
          rows={2}
          placeholder={placeholder}
          disabled={sending}
          className="min-h-[36px] w-full resize-none rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--background)/0.7)] px-2.5 py-1.5 text-[11.5px] leading-snug outline-none transition focus:border-[hsl(var(--accent)/0.6)] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void onSend()}
          disabled={sending || input.trim().length === 0}
          className="num inline-flex shrink-0 items-center gap-1 rounded-md border-[0.5px] border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--accent)/0.1)] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] transition hover:bg-[hsl(var(--accent)/0.18)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? (
            <CircleNotch strokeWidth={1.5} className="h-3 w-3 animate-spin" />
          ) : (
            <PaperPlaneTilt strokeWidth={1.5} className="h-3 w-3" />
          )}
          Enviar
        </button>
      </div>
      <p className="num mt-1.5 text-[9px] text-[hsl(var(--muted-foreground))]">
        Enter · enviar · Shift+Enter · nueva línea
      </p>
    </section>
  )
}

function ChatBubble({
  turn,
  onApply,
}: {
  turn: ChatTurn
  onApply?: () => void
}) {
  const isUser = turn.role === "user"
  const updates = pickApplicableUpdates(turn.form_updates)
  const hasUpdates = Object.keys(updates).length > 0
  return (
    <div className={isUser ? "self-end" : "self-start"} style={{ maxWidth: "90%" }}>
      <div
        className={[
          "rounded-md px-2.5 py-1.5 text-[11px] leading-snug",
          isUser
            ? "border-[0.5px] border-[hsl(var(--accent)/0.35)] bg-[hsl(var(--accent)/0.08)] text-[hsl(var(--accent))]"
            : "border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] text-[hsl(var(--foreground))]",
        ].join(" ")}
      >
        <p className="whitespace-pre-wrap">{turn.content}</p>
      </div>
      {!isUser && hasUpdates ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {turn.applied ? (
            <span className="num inline-flex items-center gap-1 rounded-full border-[0.5px] border-[hsl(var(--success)/0.5)] bg-[hsl(var(--success)/0.1)] px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--success))]">
              <Check strokeWidth={1.5} className="h-2.5 w-2.5" /> aplicado
            </span>
          ) : onApply ? (
            <button
              type="button"
              onClick={onApply}
              className="num inline-flex items-center gap-1 rounded-full border-[0.5px] border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--accent)/0.08)] px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] transition hover:bg-[hsl(var(--accent)/0.18)]"
            >
              <Sparkle strokeWidth={1.5} className="h-2.5 w-2.5" />
              Aplicar sugerencias · {Object.keys(updates).length} campo{Object.keys(updates).length === 1 ? "" : "s"}
            </button>
          ) : null}
          <details className="text-[9.5px] text-[hsl(var(--muted-foreground))]">
            <summary className="cursor-pointer">ver sugerencias</summary>
            <pre className="mt-1 max-w-full overflow-x-auto rounded bg-[hsl(var(--background)/0.7)] px-2 py-1 text-[9px]">
              {JSON.stringify(turn.form_updates, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  )
}
