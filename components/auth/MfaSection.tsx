"use client"
/**
 * MfaSection · STEP 9 · /settings/security TOTP enrollment + backup codes.
 *
 * Three states ·
 *   1. idle · no verified factor · shows "Activar 2FA" button
 *   2. enrolling · factor created (unverified) · QR + secret + 6-digit
 *      input · on first valid code, factor becomes verified · backup
 *      codes generated + shown ONE-TIME · user must copy/save offline
 *   3. enabled · verified factor exists · shows status + "Desactivar
 *      2FA" flow (requires fresh TOTP or backup code)
 *
 * All MFA ops run client-side via supabase.auth.mfa.* so the session
 * cookie is updated locally on aal upgrade. Backup codes are stored
 * hashed in user_metadata.mfa_backup_codes (writable by the user).
 */
import { useCallback, useEffect, useState } from "react"
import {
  ShieldCheck,
  ShieldWarning,
  Lock,
  CircleNotch,
  Check,
  Copy,
  Warning,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr"
import { getBrowserClient } from "@/lib/supabase-browser"
import {
  generateBackupCodes,
  hashAllBackupCodes,
  hashBackupCode,
  looksLikeBackupCode,
  normalizeBackupCode,
  BACKUP_CODE_COUNT,
} from "@/lib/mfa"

interface FactorRow {
  id: string
  friendly_name?: string | null
  factor_type: string
  status: string
}

type Phase =
  | { kind: "loading" }
  | { kind: "idle" }
  | {
      kind: "enrolling"
      factorId: string
      qr: string
      secret: string
      uri: string
    }
  | { kind: "enabled"; factor: FactorRow }
  | {
      kind: "show_backup_codes"
      codes: string[]
      factor: FactorRow
    }
  | { kind: "disabling"; factor: FactorRow }

export function MfaSection() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [codeInput, setCodeInput] = useState("")

  const reload = useCallback(async () => {
    setError(null)
    const supa = getBrowserClient()
    try {
      const { data, error } = await supa.auth.mfa.listFactors()
      if (error) {
        setPhase({ kind: "idle" })
        setError(error.message)
        return
      }
      const verified = data?.totp?.find((f) => f.status === "verified")
      if (verified) {
        setPhase({ kind: "enabled", factor: verified as FactorRow })
      } else {
        // Clean up any half-enrolled factors so we start fresh
        const stale = data?.totp?.find((f) => f.status !== "verified")
        if (stale) {
          await supa.auth.mfa.unenroll({ factorId: stale.id })
        }
        setPhase({ kind: "idle" })
      }
    } catch (e) {
      setPhase({ kind: "idle" })
      setError(e instanceof Error ? e.message : "mfa_list_failed")
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function startEnroll() {
    setBusy(true)
    setError(null)
    const supa = getBrowserClient()
    try {
      const { data, error } = await supa.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator · ${new Date().toISOString().slice(0, 10)}`,
      })
      if (error) {
        setError(error.message)
        return
      }
      if (!data?.id || !data?.totp) {
        setError("mfa_enroll_unexpected_shape")
        return
      }
      setPhase({
        kind: "enrolling",
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      })
      setCodeInput("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "mfa_enroll_failed")
    } finally {
      setBusy(false)
    }
  }

  async function verifyEnrollment() {
    if (phase.kind !== "enrolling") return
    const trimmed = codeInput.replace(/\s+/g, "")
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Code debe ser 6 dígitos")
      return
    }
    setBusy(true)
    setError(null)
    const supa = getBrowserClient()
    try {
      const challenge = await supa.auth.mfa.challenge({ factorId: phase.factorId })
      if (challenge.error || !challenge.data) {
        setError(challenge.error?.message ?? "challenge_failed")
        return
      }
      const verify = await supa.auth.mfa.verify({
        factorId: phase.factorId,
        challengeId: challenge.data.id,
        code: trimmed,
      })
      if (verify.error) {
        setError(verify.error.message)
        return
      }
      // Generate + persist backup codes
      const codes = generateBackupCodes(BACKUP_CODE_COUNT)
      const hashes = await hashAllBackupCodes(codes)
      const upd = await supa.auth.updateUser({
        data: {
          mfa_backup_codes: hashes,
          mfa_backup_generated_at: new Date().toISOString(),
        },
      })
      if (upd.error) {
        // Verification already succeeded · surface error but keep enabled
        setError(`2FA activado pero backup codes no se guardaron: ${upd.error.message}`)
      }
      // Refresh factor list to get the "verified" row
      const list = await supa.auth.mfa.listFactors()
      const verified = list.data?.totp?.find((f) => f.id === phase.factorId)
      setPhase({
        kind: "show_backup_codes",
        codes,
        factor: (verified as FactorRow) ?? {
          id: phase.factorId,
          factor_type: "totp",
          status: "verified",
        },
      })
      setCodeInput("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "verify_failed")
    } finally {
      setBusy(false)
    }
  }

  async function cancelEnroll() {
    if (phase.kind !== "enrolling") return
    setBusy(true)
    const supa = getBrowserClient()
    try {
      await supa.auth.mfa.unenroll({ factorId: phase.factorId })
    } catch {
      /* swallow · we just want to leave enrollment */
    }
    setBusy(false)
    setError(null)
    setCodeInput("")
    await reload()
  }

  async function startDisable() {
    if (phase.kind !== "enabled") return
    setPhase({ kind: "disabling", factor: phase.factor })
    setCodeInput("")
    setError(null)
  }

  async function confirmDisable() {
    if (phase.kind !== "disabling") return
    const raw = codeInput.trim()
    if (!raw) {
      setError("Ingresá un código TOTP O backup code")
      return
    }
    setBusy(true)
    setError(null)
    const supa = getBrowserClient()
    try {
      if (looksLikeBackupCode(raw)) {
        // Verify backup code against user_metadata
        const userRes = await supa.auth.getUser()
        const meta = (userRes.data.user?.user_metadata ?? {}) as Record<string, unknown>
        const stored = Array.isArray(meta.mfa_backup_codes)
          ? (meta.mfa_backup_codes as string[])
          : []
        const hash = await hashBackupCode(raw)
        if (!stored.includes(hash)) {
          setError("Backup code inválido o ya usado")
          return
        }
      } else {
        // TOTP path · challenge + verify
        const challenge = await supa.auth.mfa.challenge({
          factorId: phase.factor.id,
        })
        if (challenge.error || !challenge.data) {
          setError(challenge.error?.message ?? "challenge_failed")
          return
        }
        const verify = await supa.auth.mfa.verify({
          factorId: phase.factor.id,
          challengeId: challenge.data.id,
          code: normalizeBackupCode(raw).replace(/\D/g, "").slice(0, 6),
        })
        if (verify.error) {
          setError(verify.error.message)
          return
        }
      }
      // Verified · unenroll + wipe backup codes from metadata
      const unenroll = await supa.auth.mfa.unenroll({ factorId: phase.factor.id })
      if (unenroll.error) {
        setError(unenroll.error.message)
        return
      }
      await supa.auth.updateUser({
        data: { mfa_backup_codes: [], mfa_backup_generated_at: null },
      })
      setCodeInput("")
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : "disable_failed")
    } finally {
      setBusy(false)
    }
  }

  async function cancelDisable() {
    if (phase.kind !== "disabling") return
    setPhase({ kind: "enabled", factor: phase.factor })
    setCodeInput("")
    setError(null)
  }

  // ── Render ────────────────────────────────────────────────────────

  const isLoading = phase.kind === "loading"
  const isEnabled = phase.kind === "enabled" || phase.kind === "disabling"
  const rim = isEnabled ? "emerald" : "rose"

  return (
    <section className="surface-card rim-instr p-5" data-rim={rim}>
      <div className="relative z-[2] flex flex-col gap-3">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border-[0.5px]"
              style={{
                borderColor: `hsl(var(--hue-${rim}) / 0.4)`,
                background: `hsl(var(--hue-${rim}) / 0.12)`,
                color: `hsl(var(--hue-${rim}))`,
              }}
            >
              {isEnabled ? (
                <ShieldCheck strokeWidth={1.5} className="h-4 w-4" />
              ) : (
                <ShieldWarning strokeWidth={1.5} className="h-4 w-4" />
              )}
            </span>
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">
                2FA · Two-Factor Authentication
              </h2>
              <p className="num text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                Supabase MFA · TOTP · backup codes únicos
              </p>
            </div>
          </div>
          <span
            className="num text-[10px] uppercase tracking-[0.18em]"
            style={{
              color: isEnabled
                ? "hsl(var(--success))"
                : "hsl(var(--muted-foreground))",
            }}
          >
            {isLoading
              ? "cargando…"
              : isEnabled
                ? "● activo"
                : "○ inactivo"}
          </span>
        </header>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border-[0.5px] border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-[11px] text-[hsl(var(--danger))]">
            <Warning strokeWidth={1.5} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {phase.kind === "loading" ? (
          <div className="flex items-center gap-2 text-[12px] text-[hsl(var(--muted-foreground))]">
            <CircleNotch strokeWidth={1.5} className="h-3.5 w-3.5 animate-spin" />
            Consultando factores MFA…
          </div>
        ) : null}

        {phase.kind === "idle" ? (
          <>
            <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
              Activar 2FA agrega un segundo paso a tu login · vas a
              escanear un QR con Authy, Google Authenticator, 1Password o
              cualquier app TOTP · después de la contraseña te vamos a
              pedir un código de 6 dígitos.
            </p>
            <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
              Te damos {BACKUP_CODE_COUNT} backup codes para casos donde
              perdés el teléfono · cada uno se usa una sola vez.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void startEnroll()}
              className="shimmer-btn inline-flex w-fit items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <CircleNotch strokeWidth={1.5} className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Lock strokeWidth={1.5} className="h-3.5 w-3.5" />
              )}
              Activar 2FA
            </button>
          </>
        ) : null}

        {phase.kind === "enrolling" ? (
          <EnrollPanel
            qr={phase.qr}
            secret={phase.secret}
            codeInput={codeInput}
            setCodeInput={setCodeInput}
            busy={busy}
            onVerify={() => void verifyEnrollment()}
            onCancel={() => void cancelEnroll()}
          />
        ) : null}

        {phase.kind === "show_backup_codes" ? (
          <BackupCodesPanel
            codes={phase.codes}
            onDone={() =>
              setPhase({ kind: "enabled", factor: phase.factor })
            }
          />
        ) : null}

        {phase.kind === "enabled" ? (
          <>
            <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
              2FA activo · factor{" "}
              <code className="font-mono">{phase.factor.id.slice(0, 8)}…</code>
              {phase.factor.friendly_name
                ? ` · ${phase.factor.friendly_name}`
                : ""}
              · próximo login vas a pedir TOTP después del password.
            </p>
            <button
              type="button"
              onClick={() => void startDisable()}
              className="num inline-flex w-fit items-center gap-2 rounded-md border-[0.5px] border-[hsl(var(--danger)/0.5)] bg-[hsl(var(--danger)/0.06)] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--danger))] transition hover:bg-[hsl(var(--danger)/0.12)]"
            >
              Desactivar 2FA
            </button>
          </>
        ) : null}

        {phase.kind === "disabling" ? (
          <DisablePanel
            codeInput={codeInput}
            setCodeInput={setCodeInput}
            busy={busy}
            onConfirm={() => void confirmDisable()}
            onCancel={() => void cancelDisable()}
          />
        ) : null}
      </div>
    </section>
  )
}

// ── Panels ────────────────────────────────────────────────────────────

function EnrollPanel({
  qr,
  secret,
  codeInput,
  setCodeInput,
  busy,
  onVerify,
  onCancel,
}: {
  qr: string
  secret: string
  codeInput: string
  setCodeInput: (v: string) => void
  busy: boolean
  onVerify: () => void
  onCancel: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
        Escaneá el QR con tu autenticador · después escribí el código de
        6 dígitos para confirmar enrollment.
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <div
          className="rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.4)] bg-white p-2"
          dangerouslySetInnerHTML={{ __html: qr }}
        />
        <div className="flex max-w-[260px] flex-col gap-2">
          <p className="num text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
            ¿No podés escanear? · ingresá el secret manualmente
          </p>
          <div className="flex items-center gap-2 rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.6)] px-2.5 py-1.5">
            <code className="font-mono text-[10px] break-all text-[hsl(var(--accent))]">
              {secret}
            </code>
            <button
              type="button"
              aria-label="Copy secret"
              onClick={async () => {
                await navigator.clipboard.writeText(secret)
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              }}
              className="ml-auto shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))]"
            >
              {copied ? (
                <Check strokeWidth={1.5} className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
              ) : (
                <Copy strokeWidth={1.5} className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          Código TOTP (6 dígitos)
        </span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="w-40 rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] px-3 py-2 text-center font-mono text-lg tabular-nums tracking-[0.4em] outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onVerify}
          disabled={busy || codeInput.length !== 6}
          className="shimmer-btn inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <CircleNotch strokeWidth={1.5} className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck strokeWidth={1.5} className="h-3.5 w-3.5" />
          )}
          Verificar + activar
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="num rounded-md border-[0.5px] border-[hsl(var(--border))] px-3 py-2 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-foreground disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function BackupCodesPanel({
  codes,
  onDone,
}: {
  codes: string[]
  onDone: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const joined = codes.join("\n")
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-md border-[0.5px] border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--accent)/0.08)] px-3 py-2 text-[11px] text-[hsl(var(--accent))]">
        <Sparkle strokeWidth={1.5} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          2FA activado · estos {codes.length} backup codes solo se muestran
          UNA vez · guardalos offline (password manager · papel · etc) ·
          cada uno se usa una sola vez para login si perdés el teléfono.
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.5)] p-3 font-mono text-[12px]">
        {codes.map((c, i) => (
          <div
            key={c}
            className="flex items-center justify-between gap-2 tabular-nums"
          >
            <span className="num text-[9px] text-[hsl(var(--muted-foreground))]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <code className="flex-1 text-center">{c}</code>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(joined)
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
          }}
          className="num inline-flex items-center gap-1.5 rounded-md border-[0.5px] border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--accent)/0.08)] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.16)]"
        >
          {copied ? (
            <Check strokeWidth={1.5} className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
          ) : (
            <Copy strokeWidth={1.5} className="h-3.5 w-3.5" />
          )}
          {copied ? "Copiado" : "Copiar todos"}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          Guardé los códigos en lugar seguro
        </label>
      </div>
      <button
        type="button"
        onClick={onDone}
        disabled={!acknowledged}
        className="shimmer-btn inline-flex w-fit items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Check strokeWidth={1.5} className="h-3.5 w-3.5" />
        Listo · cerrar
      </button>
    </div>
  )
}

function DisablePanel({
  codeInput,
  setCodeInput,
  busy,
  onConfirm,
  onCancel,
}: {
  codeInput: string
  setCodeInput: (v: string) => void
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
        Para desactivar 2FA necesitamos confirmar identidad · ingresá un
        código TOTP fresco (6 dígitos) O uno de tus backup codes.
      </p>
      <input
        type="text"
        inputMode="text"
        autoComplete="one-time-code"
        value={codeInput}
        onChange={(e) => setCodeInput(e.target.value)}
        placeholder="000000  ó  AAAA-BBBB-CCCC-DDDD-EEEE"
        className="rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] px-3 py-2 font-mono text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || codeInput.trim().length === 0}
          className="num inline-flex items-center gap-2 rounded-md border-[0.5px] border-[hsl(var(--danger)/0.5)] bg-[hsl(var(--danger)/0.06)] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--danger))] transition hover:bg-[hsl(var(--danger)/0.12)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <CircleNotch strokeWidth={1.5} className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldWarning strokeWidth={1.5} className="h-3.5 w-3.5" />
          )}
          Confirmar desactivación
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="num rounded-md border-[0.5px] border-[hsl(var(--border))] px-3 py-2 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-foreground disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
