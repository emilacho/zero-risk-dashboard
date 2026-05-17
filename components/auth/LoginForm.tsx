"use client"
/**
 * LoginForm · magic-link form for Supabase Auth.
 *
 *   - Input · email
 *   - Submit · `signInWithOtp` · sends a magic link · user clicks it ·
 *     redirects to `/auth/callback?next=...` which exchanges the code
 *     for a session cookie.
 *   - No password handling here.
 */
import { useState, type FormEvent } from "react"
import { Mail, Send, Loader2, Check } from "lucide-react"
import { getBrowserClient } from "@/lib/supabase-browser"

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState("sending")
    setErrMsg(null)
    const supa = getBrowserClient()
    const origin =
      typeof window !== "undefined" ? window.location.origin : ""
    const { error } = await supa.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: false, // admin must already exist in app_roles
      },
    })
    if (error) {
      setState("error")
      setErrMsg(error.message)
    } else {
      setState("sent")
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="num text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
          email
        </span>
        <span className="relative">
          <Mail
            strokeWidth={1.5}
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="emilio@…"
            disabled={state === "sending" || state === "sent"}
            className="w-full rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
          />
        </span>
      </label>

      <button
        type="submit"
        disabled={state === "sending" || state === "sent" || !email}
        className="shimmer-btn inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {state === "sending" ? (
          <Loader2 strokeWidth={1.5} className="h-3.5 w-3.5 animate-spin" />
        ) : state === "sent" ? (
          <Check strokeWidth={1.5} className="h-3.5 w-3.5" />
        ) : (
          <Send strokeWidth={1.5} className="h-3.5 w-3.5" />
        )}
        {state === "sent"
          ? "Magic link enviado"
          : state === "sending"
            ? "Enviando..."
            : "Enviar magic link"}
      </button>

      {state === "sent" ? (
        <div className="rounded-md border-[0.5px] border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.08)] px-3 py-2 text-[11px] text-[hsl(var(--success))]">
          Revisá el inbox de <code className="font-mono">{email}</code> ·
          tocá el link · será redirected a <code className="font-mono">{next}</code>.
        </div>
      ) : null}

      {state === "error" && errMsg ? (
        <div className="rounded-md border-[0.5px] border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-[11px] text-[hsl(var(--danger))]">
          {errMsg}
        </div>
      ) : null}

      <p className="num mt-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        canon 2026-05-17 · admin único = Emilio Pérez · xavier no existe
      </p>
    </form>
  )
}
