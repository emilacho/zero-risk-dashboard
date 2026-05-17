"use client"
/**
 * TotpChallengeForm · STEP 9 · post-password MFA prompt on login.
 *
 * Shown by /login/mfa AFTER a successful password sign-in when the
 * user's nextLevel === "aal2" and currentLevel === "aal1". User
 * supplies their 6-digit TOTP from authenticator app · OR a backup
 * code (one-time use · marked consumed in user_metadata).
 *
 * On success · router.replace(next) lands them in the dashboard at the
 * originally-requested route.
 */
import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  ShieldCheck,
  CircleNotch,
  Lock,
  Lifebuoy,
  Warning,
} from "@phosphor-icons/react"
import { getBrowserClient } from "@/lib/supabase-browser"
import {
  hashBackupCode,
  looksLikeBackupCode,
  normalizeBackupCode,
} from "@/lib/mfa"

export function TotpChallengeForm({ next }: { next: string }) {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [state, setState] = useState<
    "loading" | "ready" | "verifying" | "error"
  >("loading")
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<"totp" | "backup">("totp")

  useEffect(() => {
    const supa = getBrowserClient()
    void (async () => {
      const list = await supa.auth.mfa.listFactors()
      const verified = list.data?.totp?.find((f) => f.status === "verified")
      if (!verified) {
        // No factor · MFA not actually required · forward.
        router.replace(next)
        return
      }
      setFactorId(verified.id)
      setState("ready")
    })()
  }, [next, router])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!factorId) return
    const raw = code.trim()
    if (!raw) {
      setError("Ingresá un código")
      setState("error")
      return
    }
    setState("verifying")
    setError(null)
    const supa = getBrowserClient()
    try {
      if (mode === "backup" || looksLikeBackupCode(raw)) {
        const { data: userRes } = await supa.auth.getUser()
        const meta = (userRes.user?.user_metadata ?? {}) as Record<string, unknown>
        const stored = Array.isArray(meta.mfa_backup_codes)
          ? (meta.mfa_backup_codes as string[])
          : []
        const hash = await hashBackupCode(raw)
        const idx = stored.indexOf(hash)
        if (idx < 0) {
          setError("Backup code inválido o ya usado")
          setState("error")
          return
        }
        // Mark consumed
        const remaining = stored.filter((h) => h !== hash)
        await supa.auth.updateUser({
          data: { mfa_backup_codes: remaining },
        })
        // Force a session refresh to acknowledge MFA path · the AAL
        // upgrade for backup codes is logical (we don't have an aal2
        // session from Supabase MFA). For routes that require aal2,
        // they should accept backup-code recovery as "trusted" by the
        // user_metadata trail. Simpler approach · we don't gate by aal
        // in middleware · we just check session existence. So just
        // navigate.
        router.replace(next)
        router.refresh()
        return
      }
      const numeric = raw.replace(/\D/g, "")
      if (numeric.length !== 6) {
        setError("Código TOTP debe ser 6 dígitos")
        setState("error")
        return
      }
      const challenge = await supa.auth.mfa.challenge({ factorId })
      if (challenge.error || !challenge.data) {
        setError(challenge.error?.message ?? "challenge_failed")
        setState("error")
        return
      }
      const verify = await supa.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: numeric,
      })
      if (verify.error) {
        setError(verify.error.message)
        setState("error")
        return
      }
      router.replace(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "verify_failed")
      setState("error")
    }
  }

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[hsl(var(--muted-foreground))]">
        <CircleNotch strokeWidth={1.5} className="h-3.5 w-3.5 animate-spin" />
        Cargando factor MFA…
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] px-3 py-2">
        <Lock strokeWidth={1.5} className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
        <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          2FA requerido · password verificado
        </span>
      </div>

      <div className="flex gap-1 rounded-full border-[0.5px] border-[hsl(var(--primary-glow)/0.18)] bg-[hsl(var(--card)/0.5)] p-1">
        <button
          type="button"
          onClick={() => {
            setMode("totp")
            setError(null)
            setState("ready")
          }}
          className={[
            "num flex-1 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition",
            mode === "totp"
              ? "bg-[hsl(var(--primary-glow)/0.14)] text-foreground"
              : "text-[hsl(var(--muted-foreground))] hover:text-foreground",
          ].join(" ")}
        >
          TOTP
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("backup")
            setError(null)
            setState("ready")
          }}
          className={[
            "num inline-flex flex-1 items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition",
            mode === "backup"
              ? "bg-[hsl(var(--primary-glow)/0.14)] text-foreground"
              : "text-[hsl(var(--muted-foreground))] hover:text-foreground",
          ].join(" ")}
        >
          <Lifebuoy strokeWidth={1.5} className="h-3 w-3" />
          Backup code
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          {mode === "totp" ? "Código TOTP (6 dígitos)" : "Backup code"}
        </span>
        <input
          type="text"
          inputMode={mode === "totp" ? "numeric" : "text"}
          autoComplete="one-time-code"
          autoFocus
          maxLength={mode === "totp" ? 6 : 30}
          value={code}
          onChange={(e) =>
            setCode(
              mode === "totp"
                ? e.target.value.replace(/\D/g, "")
                : normalizeBackupCode(e.target.value)
            )
          }
          placeholder={mode === "totp" ? "000000" : "AAAA-BBBB-CCCC-DDDD-EEEE"}
          disabled={state === "verifying"}
          className={[
            "rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] px-3 py-2.5 outline-none transition focus:border-[hsl(var(--accent)/0.6)]",
            mode === "totp"
              ? "text-center font-mono text-lg tabular-nums tracking-[0.4em]"
              : "font-mono text-sm",
          ].join(" ")}
        />
      </label>

      <button
        type="submit"
        disabled={state === "verifying" || code.length === 0}
        className="shimmer-btn inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {state === "verifying" ? (
          <CircleNotch strokeWidth={1.5} className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ShieldCheck strokeWidth={1.5} className="h-3.5 w-3.5" />
        )}
        {state === "verifying" ? "Verificando…" : "Verificar + entrar"}
      </button>

      {state === "error" && error ? (
        <div className="flex items-start gap-2 rounded-md border-[0.5px] border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-[11px] text-[hsl(var(--danger))]">
          <Warning strokeWidth={1.5} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <p className="num text-[10px] text-[hsl(var(--muted-foreground))]">
        Si perdiste el dispositivo · usá un backup code · cada uno
        funciona UNA vez · podés generar nuevos en{" "}
        <code className="font-mono text-[hsl(var(--accent))]">/settings/security</code>
        .
      </p>
    </form>
  )
}
