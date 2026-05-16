import { Suspense } from "react"
import { Header } from "@/components/Header"
import { DashboardOverview } from "@/components/DashboardOverview"
import { Skeleton } from "@/components/Skeleton"

export const dynamic = "force-dynamic"

export default function DashboardHome() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Control surface
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Operations overview
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Real-time status of the Zero Risk agentic agency · 30-day window.
            Cards wired to the platform dashboard endpoints (PR #31).
          </p>
        </div>
        <Suspense fallback={<Skeleton lines={6} />}>
          <DashboardOverview />
        </Suspense>
      </main>
    </>
  )
}
