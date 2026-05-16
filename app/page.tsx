import { Suspense } from "react"
import { Header } from "@/components/Header"
import { DashboardOverview } from "@/components/DashboardOverview"
import { Skeleton } from "@/components/Skeleton"

export const dynamic = "force-dynamic"

export default function DashboardHome() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 pb-16 pt-12">
        <section className="mb-10 flex flex-col gap-3">
          <span className="eyebrow-chip self-start">
            <span aria-hidden className="h-1 w-1 rounded-full bg-current animate-pulse-glow" />
            Live · control surface
          </span>
          <h1 className="font-display text-[40px] font-semibold leading-[1.05] tracking-tight md:text-[52px]">
            <span className="text-gradient">Operations overview</span>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Real-time status of the Zero Risk agentic agency · 30-day window.
            Cards wired to the platform dashboard endpoints (PR&nbsp;#31).
          </p>
        </section>
        <Suspense fallback={<Skeleton kind="overview" />}>
          <DashboardOverview />
        </Suspense>
      </main>
    </>
  )
}
