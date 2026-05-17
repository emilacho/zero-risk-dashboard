"use client"
/**
 * UpdatePasswordForm · sets a new password for the current Supabase
 * session.
 *
 * Two entry points:
 *   - /auth/update-password · post-recovery email flow (callback already
 *     exchanged code → session is live) · `redirectTo` defaults to "/"
 *   - /settings/security · logged-in user changing password · same
 *     form · `redirectTo` defaults to "/settings/security"
 *
 * Validation · zod via lib/auth-validation.ts (min 8 chars · 1 letter ·
 * 1 number · confirm match). Show/hide toggle per field.
 */
import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  Lock,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Check,
  CircleAlert,
} from "lucide-react"
import { getBrowserClient } from "@/lib/supabase-browser"
import { UpdatePasswordFormSchema } from "@/lib/auth-validation"

export interface UpdatePasswordFormProps {
  /** Read-only email · shown above the form for context */
  email: string
  /** Where to redirect after success · defaults "/" */
  next?: string
  /** Optional label override for the submit button */
  submitLabel?: string
  /** Variant · "recovery" surfaces the recovery context · "change" just changes */
  variant?: "recovery" | "change"
}

export function UpdatePasswordForm({
  email,
  next = "/",
  submitLabel,
  variant = "recovery",
}: UpdatePasswordFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [state, setState] = useState<"idle" | "submitting" | "ok" | "error">("idle")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState("submitting")
    setErrors({})
    setErrMsg(null)

    const parsed = UpdatePasswordFormSchema.safeParse({ password, confirm })
    if (!parsed.success) {
      const flat: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = (issue.path[0] as string) ?? "form"
        flat[key] = issue.message
      }
      setErrors(flat)
      setState("error")
      setErrMsg("Validation failed")
      return
    }

    const supa = getBrowserClient()
    const { error } = await supa.auth.updateUser({ password: parsed.data.password })
    if (error) {
      setState("error")
      setErrMsg(error.message)
      return
    }
    setState("ok")
    setPassword("")
    setConfirm("")
    // Small delay so the success state is visible before navigating
    setTimeout(() => {
      router.replace(next)
      router.refresh()
    }, 900)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p className="num text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
        sesión · <code className="font-mono text-[hsl(var(--accent))]">{email}</code>
      </p>

      {variant === "recovery" ? (
        <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
          Recovery email validated · setea tu nueva contraseña abajo · vas
          a quedar logueado al confirmar.
        </p>
      ) : null}

      <Field
        label="nueva contraseña"
        error={errors["password"]}
      >
        <span className="relative">
          <Lock
            strokeWidth={1.5}
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
          />
          <input
            type={showPw ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min 8 chars · 1 letra · 1 número"
            disabled={state === "submitting" || state === "ok"}
            className="w-full rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] py-2.5 pl-9 pr-10 text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
          />
          <button
            type="button"
            aria-label={showPw ? "Hide password" : "Show password"}
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--primary-glow)/0.08)]"
          >
            {showPw ? (
              <EyeOff strokeWidth={1.5} className="h-4 w-4" />
            ) : (
              <Eye strokeWidth={1.5} className="h-4 w-4" />
            )}
          </button>
        </span>
      </Field>

      <Field
        label="confirmar contraseña"
        error={errors["confirm"]}
      >
        <span className="relative">
          <Lock
            strokeWidth={1.5}
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
          />
          <input
            type={showConfirm ? "text" : "password"}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="re-type"
            disabled={state === "submitting" || state === "ok"}
            className="w-full rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] py-2.5 pl-9 pr-10 text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
          />
          <button
            type="button"
            aria-label={showConfirm ? "Hide password" : "Show password"}
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--primary-glow)/0.08)]"
          >
            {showConfirm ? (
              <EyeOff strokeWidth={1.5} className="h-4 w-4" />
            ) : (
              <Eye strokeWidth={1.5} className="h-4 w-4" />
            )}
          </button>
        </span>
      </Field>

      <button
        type="submit"
        disabled={state === "submitting" || state === "ok" || !password || !confirm}
        className="shimmer-btn inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {state === "submitting" ? (
          <Loader2 strokeWidth={1.5} className="h-3.5 w-3.5 animate-spin" />
        ) : state === "ok" ? (
          <Check strokeWidth={1.5} className="h-3.5 w-3.5" />
        ) : (
          <Save strokeWidth={1.5} className="h-3.5 w-3.5" />
        )}
        {state === "ok"
          ? "Saved · redirigiendo..."
          : state === "submitting"
            ? "Guardando..."
            : submitLabel ?? "Guardar nueva contraseña"}
      </button>

      {state === "ok" ? (
        <div className="rounded-md border-[0.5px] border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.08)] px-3 py-2 text-[11px] text-[hsl(var(--success))]">
          Password actualizada · session activa · redirect a <code className="font-mono">{next}</code> en 1s
        </div>
      ) : null}

      {state === "error" && errMsg ? (
        <div className="flex items-start gap-2 rounded-md border-[0.5px] border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-[11px] text-[hsl(var(--danger))]">
          <CircleAlert strokeWidth={1.5} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{errMsg}</span>
        </div>
      ) : null}
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="num text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      {children}
      {error ? (
        <span className="num text-[10px] text-[hsl(var(--danger))]">{error}</span>
      ) : null}
    </label>
  )
}
