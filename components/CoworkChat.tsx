"use client"
/**
 * CoworkChat · floating message button + 400px slide-in drawer.
 *
 *   - Button bottom-right · `ChatCircle` Lucide stroke 1.5
 *   - Click opens drawer · autosize textarea + PaperPlaneTilt cyan shimmer
 *   - POST to /api/cowork/message · persists + fires Slack #equipo
 *   - Toast feedback inline (success / failure)
 *
 * Local React state (no Zustand needed for this scope).
 */
import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChatCircle,
  PaperPlaneTilt,
  X,
  Check,
  CircleNotch,
} from "@phosphor-icons/react/dist/ssr"
import { DURATION, EASING } from "@/lib/motion"

type SendState = "idle" | "sending" | "ok" | "error"

export function CoworkChat() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [state, setState] = useState<SendState>("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Autosize textarea on input
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = "0px"
    ta.style.height = Math.min(ta.scrollHeight, 240) + "px"
  }, [text])

  async function send() {
    const trimmed = text.trim()
    if (!trimmed) return
    setState("sending")
    setErrorMsg(null)
    try {
      const res = await fetch("/api/cowork/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          sender_user_id: "emilio",
        }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setState("error")
        setErrorMsg(json.error ?? `HTTP ${res.status}`)
        return
      }
      setState("ok")
      setText("")
      // auto-reset confirmation after 1.6s
      setTimeout(() => setState("idle"), 1600)
    } catch (e) {
      setState("error")
      setErrorMsg(e instanceof Error ? e.message : "network_error")
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl + Enter sends
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Floating button · bottom-right · always visible */}
      <button
        type="button"
        aria-label="Mensaje a Cowork"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[60] inline-flex h-12 w-12 items-center justify-center rounded-full border-[0.5px] border-[hsl(var(--primary-glow)/0.45)] bg-[hsl(var(--background)/0.85)] shadow-[0_0_28px_-4px_hsl(var(--primary-glow)/0.65)] backdrop-blur-xl transition hover:shadow-[0_0_36px_-2px_hsl(var(--primary-glow)/0.9)]"
      >
        {open ? (
          <X strokeWidth={1.5} className="h-5 w-5 text-[hsl(var(--foreground))]" />
        ) : (
          <ChatCircle
            strokeWidth={1.5}
            className="h-5 w-5 text-[hsl(var(--accent))]"
          />
        )}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.aside
            key="drawer"
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ duration: DURATION.base, ease: EASING.out }}
            className="fixed right-0 top-0 z-50 flex h-screen w-[400px] flex-col border-l-[0.5px] border-[hsl(var(--primary-glow)/0.2)] bg-[hsl(var(--background)/0.92)] backdrop-blur-xl"
            role="dialog"
            aria-label="Mensaje a Cowork"
          >
            {/* Drawer header */}
            <div className="flex h-14 items-center justify-between border-b-[0.5px] border-[hsl(var(--primary-glow)/0.18)] px-5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-[hsl(var(--accent))] shadow-[0_0_8px_hsl(var(--accent)/0.7)]" />
                <span className="font-display text-sm font-semibold tracking-tight">
                  Mensaje a Cowork
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close drawer"
                className="rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--primary-glow)/0.08)] hover:text-foreground"
              >
                <X strokeWidth={1.5} className="h-4 w-4" />
              </button>
            </div>

            {/* Body · intro text + textarea + send */}
            <div className="flex flex-1 flex-col gap-4 px-5 py-5">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Escribe un mensaje · llega a Cowork (Lenovo / HP3) vía
                Slack <code className="font-mono text-[10px] text-[hsl(var(--accent))]">#equipo</code>{" "}
                y queda persistido en Supabase para la próxima sesión.
              </p>

              <textarea
                ref={taRef}
                value={text}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setText(e.target.value)
                }
                onKeyDown={onKey}
                placeholder="Escribe acá · Ctrl/⌘+Enter para enviar"
                rows={6}
                className="w-full resize-none rounded-lg border-[0.5px] border-[hsl(var(--primary-glow)/0.25)] bg-[hsl(var(--card)/0.6)] px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition focus:border-[hsl(var(--accent)/0.6)] focus:bg-[hsl(var(--card)/0.8)]"
                style={{ minHeight: 120, maxHeight: 240 }}
              />

              <div className="flex items-center justify-between">
                <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                  {text.length} / 4000
                </span>
                <button
                  type="button"
                  onClick={send}
                  disabled={state === "sending" || text.trim().length === 0}
                  className="shimmer-btn inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {state === "sending" ? (
                    <CircleNotch strokeWidth={1.5} className="h-3.5 w-3.5 animate-spin" />
                  ) : state === "ok" ? (
                    <Check strokeWidth={1.5} className="h-3.5 w-3.5" />
                  ) : (
                    <PaperPlaneTilt strokeWidth={1.5} className="h-3.5 w-3.5" />
                  )}
                  {state === "ok" ? "Sent" : state === "sending" ? "Enviando..." : "PaperPlaneTilt"}
                </button>
              </div>

              {state === "error" && errorMsg ? (
                <div className="rounded-md border-[0.5px] border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-xs text-[hsl(var(--danger))]">
                  Falló · <code className="font-mono">{errorMsg}</code>
                </div>
              ) : null}
              {state === "ok" ? (
                <div className="rounded-md border-[0.5px] border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.08)] px-3 py-2 text-xs text-[hsl(var(--success))]">
                  Mensaje persistido · Slack #equipo notificado.
                </div>
              ) : null}
            </div>

            {/* Footer · hint */}
            <div className="border-t-[0.5px] border-[hsl(var(--primary-glow)/0.12)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              cowork inbox · supabase persist + slack relay
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  )
}
