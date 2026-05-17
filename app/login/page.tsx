import { LoginForm } from "@/components/auth/LoginForm"
import { Sparkle } from "@phosphor-icons/react"

export const dynamic = "force-dynamic"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams
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
                Zero Risk · Dashboard
              </p>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                Sign in
              </h1>
            </div>
          </div>
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
            Single-operator dashboard · Emilio Pérez admin único (canon
            2026-05-17). Magic link via Supabase Auth · 0 password to
            remember.
          </p>
          {error === "forbidden" ? (
            <p className="rounded-md border-[0.5px] border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-[11px] text-[hsl(var(--danger))]">
              No autorizado para esa ruta. Sign in con cuenta admin OR
              cliente-scoped.
            </p>
          ) : null}
          <LoginForm next={next ?? "/"} />
        </div>
      </div>
    </main>
  )
}
