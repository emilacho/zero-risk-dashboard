"use client"
/**
 * LoginForm · Phase 4.8 · 2-tab UI · password (default) + magic link.
 *
 *   - Password tab · email + password · `signInWithPassword` ·
 *     fastest day-to-day flow · 1-click sign-in
 *   - Magic link tab · email · `signInWithOtp` · password reset
 *     fallback OR initial onboarding (user sin password aún)
 *   - "¿Olvidaste contraseña?" link en password tab switches a magic
 *     link tab (state lifted to parent)
 *
 * Both flows land on `/auth/callback?next=...` which exchanges code
 * for session cookie · same callback handler.
 */
import { useState, type FormEvent } from "react"
import * as Tabs from "@radix-ui/react-tabs"
import {
  Mail,
  Lock,
  Send,
  LogIn,
  Loader2,
  Check,
  CircleAlert,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { getBrowserClient } from "@/lib/supabase-browser"

type Tab = "password" | "magic"

export function LoginForm({ next }: { next: string }) {
  const [tab, setTab] = useState<Tab>("password")

  return (
    <Tabs.Root value={tab} onValueChange={(v) => setTab(v as Tab)}>
      <Tabs.List
        className="mb-4 grid grid-cols-2 gap-1 rounded-full border-[0.5px] border-[hsl(var(--primary-glow)/0.18)] bg-[hsl(var(--card)/0.5)] p-1"
        aria-label="Login method"
      >
        <Tabs.Trigger
          value="password"
          className="num rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] transition data-[state=active]:bg-[hsl(var(--primary-glow)/0.12)] data-[state=active]:text-foreground"
        >
          Contraseña
        </Tabs.Trigger>
        <Tabs.Trigger
          value="magic"
          className="num rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] transition data-[state=active]:bg-[hsl(var(--primary-glow)/0.12)] data-[state=active]:text-foreground"
        >
          Magic link
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="password">
        <PasswordForm next={next} switchToMagic={() => setTab("magic")} />
      </Tabs.Content>
      <Tabs.Content value="magic">
        <MagicLinkForm next={next} />
      </Tabs.Content>
    </Tabs.Root>
  )
}

// ── Password sign-in ────────────────────────────────────────────────

function PasswordForm({
  next,
  switchToMagic,
}: {
  next: string
  switchToMagic: () => void
}) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle")
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState("submitting")
    setErrMsg(null)
    const supa = getBrowserClient()
    const { error } = await supa.auth.signInWithPassword({ email, password })
    if (error) {
      setState("error")
      setErrMsg(error.message)
      return
    }
    // Session cookie set · navigate
    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field
        label="email"
        icon={<Mail strokeWidth={1.5} className="h-4 w-4" />}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="emilio@…"
          disabled={state === "submitting"}
          className="w-full rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
        />
      </Field>
      <Field
        label="password"
        icon={<Lock strokeWidth={1.5} className="h-4 w-4" />}
      >
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={state === "submitting"}
          className="w-full rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
        />
      </Field>

      <button
        type="submit"
        disabled={state === "submitting" || !email || !password}
        className="shimmer-btn inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {state === "submitting" ? (
          <Loader2 strokeWidth={1.5} className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <LogIn strokeWidth={1.5} className="h-3.5 w-3.5" />
        )}
        {state === "submitting" ? "Verificando..." : "Iniciar sesión"}
      </button>

      <button
        type="button"
        onClick={switchToMagic}
        className="num self-start text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))]"
      >
        ¿Olvidaste contraseña? · usar magic link →
      </button>

      {state === "error" && errMsg ? (
        <ErrorTile msg={errMsg} />
      ) : null}

      <p className="num mt-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        canon 2026-05-17 · admin único = Emilio Pérez · xavier no existe
      </p>
    </form>
  )
}

// ── Magic link sign-in ──────────────────────────────────────────────

function MagicLinkForm({ next }: { next: string }) {
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
        shouldCreateUser: false,
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
      <Field
        label="email"
        icon={<Mail strokeWidth={1.5} className="h-4 w-4" />}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="emilio@…"
          disabled={state === "sending" || state === "sent"}
          className="w-full rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
        />
      </Field>

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

      {state === "error" && errMsg ? <ErrorTile msg={errMsg} /> : null}

      <p className="num mt-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        Magic link · primera vez · sets password en /settings/security (backlog)
      </p>
    </form>
  )
}

function Field({
  label,
  icon,
  children,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="num text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <span className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
          {icon}
        </span>
        {children}
      </span>
    </label>
  )
}

function ErrorTile({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border-[0.5px] border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-[11px] text-[hsl(var(--danger))]">
      <CircleAlert strokeWidth={1.5} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{msg}</span>
    </div>
  )
}
