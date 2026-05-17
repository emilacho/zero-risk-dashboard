/**
 * /settings/security · logged-in user changes password.
 *
 *   - Same UpdatePasswordForm component as /auth/update-password
 *   - Variant "change" · no recovery-context messaging
 *   - On success · redirects to /settings/security (stays here · shows
 *     fresh-session confirmation)
 */
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { getSessionClient } from "@/lib/supabase-session"
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm"

export const dynamic = "force-dynamic"

export default async function SettingsSecurityPage() {
  const supa = await getSessionClient()
  const { data: userRes } = await supa.auth.getUser()
  if (!userRes?.user) {
    redirect("/login?next=/settings/security")
  }
  const email = userRes.user.email ?? "(no email on session)"

  return (
    <main className="mx-auto max-w-2xl px-6 pb-16 pt-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft strokeWidth={1.5} className="h-3 w-3" /> Home
      </Link>

      <header className="mt-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.4)] bg-[hsl(var(--primary-glow)/0.12)] text-[hsl(var(--primary-glow))]">
          <ShieldCheck strokeWidth={1.5} className="h-5 w-5" />
        </span>
        <div>
          <p className="num text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--accent))]">
            Settings · security
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Cambiar contraseña
          </h1>
        </div>
      </header>

      <div className="mt-8 surface-card rim-instr p-6" data-rim="violet">
        <div className="relative z-[2]">
          <UpdatePasswordForm
            email={email}
            next="/settings/security"
            variant="change"
            submitLabel="Guardar cambio"
          />
        </div>
      </div>

      <section className="mt-6 surface-card rim-instr p-5" data-rim="rose">
        <div className="relative z-[2]">
          <h2 className="font-display text-base font-semibold tracking-tight">
            2FA · Two-Factor Authentication
          </h2>
          <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
            <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--danger))]">
              backlog
            </span>{" "}
            · Supabase MFA · TOTP enrollment + recovery codes · pending separate dispatch.
          </p>
        </div>
      </section>
    </main>
  )
}
