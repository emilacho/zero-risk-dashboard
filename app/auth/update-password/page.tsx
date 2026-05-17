/**
 * /auth/update-password
 *
 * Post-recovery-email landing · the Supabase recovery flow:
 *   1. User clicks "¿Olvidaste?" → resetPasswordForEmail with
 *      redirectTo = /auth/callback?next=/auth/update-password
 *   2. Recovery email link → /auth/callback exchanges code for session
 *   3. Callback redirects here with the session live
 *   4. User picks new password · supabase.auth.updateUser({ password })
 *   5. Redirect to "/"
 *
 * If a non-authenticated user lands here, the middleware will have
 * already bounced them to /login (this is gated as a regular page).
 */
import { redirect } from "next/navigation"
import { getSessionClient } from "@/lib/supabase-session"
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm"
import { Sparkle } from "@phosphor-icons/react"

export const dynamic = "force-dynamic"

export default async function UpdatePasswordPage() {
  const supa = await getSessionClient()
  const { data: userRes } = await supa.auth.getUser()
  if (!userRes?.user) {
    // Middleware should have caught this · belt-and-suspenders
    redirect("/login?next=/auth/update-password")
  }
  const email = userRes.user.email ?? "(no email on session)"

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div
        className="surface-card rim-instr w-full max-w-md p-8"
        data-rim="violet"
        data-pop="true"
      >
        <div className="relative z-[2] flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-foreground shadow-[0_0_24px_-4px_hsl(var(--primary-glow)/0.7)]">
              <Sparkle strokeWidth={1.5} className="h-4 w-4" />
            </span>
            <div>
              <p
                className="num text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "hsl(var(--accent))" }}
              >
                Zero Risk · Recovery
              </p>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                Nueva contraseña
              </h1>
            </div>
          </div>
          <UpdatePasswordForm
            email={email}
            next="/"
            variant="recovery"
            submitLabel="Guardar nueva contraseña"
          />
          <p className="num mt-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            canon 2026-05-17 · admin único = Emilio Pérez
          </p>
        </div>
      </div>
    </main>
  )
}
