import { Suspense } from "react"
import { HomeControlPanel } from "@/components/HomeControlPanel"
import { Skeleton } from "@/components/Skeleton"
import { getCurrentRole } from "@/lib/supabase-session"

export const dynamic = "force-dynamic"

export default async function DashboardHome() {
  // Best-effort welcome message · falls back to "Operador" if user
  // unauthed (middleware would redirect first · this is belt-and-suspenders)
  let welcomeName = "Operador"
  try {
    const role = await getCurrentRole()
    if (role.email) {
      welcomeName = role.email.split("@")[0]
    }
  } catch {
    /* unauthed · ignore */
  }

  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-16 pt-10">
      {/* Header · welcome + sprint badge */}
      <section className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow-chip self-start">
            <span aria-hidden className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
            Sprint 6 · activo · dashboard-lumen-v3
          </span>
          <h1 className="mt-3 font-display text-[40px] font-semibold leading-[1.02] tracking-tight md:text-[52px]">
            <span className="text-gradient">Buenos días, {welcomeName}</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">
            Sala de comando del Gerente General · 5 oficinas · 8 vistas
            sistémicas · KPIs live · todo navegable hasta el átomo.
          </p>
        </div>
        <div className="text-right">
          <p className="num text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            canon 2026-05-17
          </p>
          <p className="num text-[11px] text-[hsl(var(--muted-foreground))]">
            admin único · Emilio Pérez
          </p>
        </div>
      </section>

      <Suspense fallback={<HomeSkeleton />}>
        <HomeControlPanel />
      </Suspense>
    </main>
  )
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton kind="lines" />
      <Skeleton kind="overview" />
    </div>
  )
}
