/**
 * /login/mfa · STEP 9 · post-password 2FA prompt.
 *
 * The LoginForm redirects here after a successful password sign-in
 * when the user's nextLevel === 'aal2'. Renders the TOTP challenge
 * form · accepts TOTP code OR backup code · forwards to `next` on
 * success.
 */
import { redirect } from "next/navigation"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { getSessionClient } from "@/lib/supabase-session"
import { TotpChallengeForm } from "@/components/auth/TotpChallengeForm"

export const dynamic = "force-dynamic"

export default async function LoginMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const supa = await getSessionClient()
  const { data: userRes } = await supa.auth.getUser()
  if (!userRes?.user) {
    redirect(`/login?next=${encodeURIComponent(next ?? "/")}`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div
        className="surface-card rim-instr w-full max-w-md p-8"
        data-rim="emerald"
        data-pop="true"
      >
        <div className="relative z-[2] flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(var(--hue-emerald)/0.6)] to-[hsl(var(--accent)/0.6)] text-foreground">
              <ShieldCheck strokeWidth={1.5} className="h-4 w-4" />
            </span>
            <div>
              <p
                className="num text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "hsl(var(--hue-emerald))" }}
              >
                Zero Risk · Dashboard
              </p>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                Verificación 2FA
              </h1>
            </div>
          </div>
          <TotpChallengeForm next={next ?? "/"} />
          <Link
            href="/login"
            className="num self-start text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))]"
          >
            ← volver al login
          </Link>
        </div>
      </div>
    </main>
  )
}
