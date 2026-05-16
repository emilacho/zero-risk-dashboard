import { Suspense } from "react"
import { HomeMemoryHero } from "@/components/HomeMemoryHero"
import { Skeleton } from "@/components/Skeleton"

export const dynamic = "force-dynamic"

export default function DashboardHome() {
  return (
    <>
      <main className="mx-auto max-w-[1400px] px-6 pb-16 pt-10">
        <section className="mb-8 flex flex-col gap-3">
          <span className="eyebrow-chip self-start">
            <span aria-hidden className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
            Build a 24/7 AI Team · The Brain
          </span>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-display text-[44px] font-semibold leading-[1.02] tracking-tight md:text-[64px]">
              <span className="text-gradient">Memory Graph</span>
            </h1>
            <p className="max-w-md text-right text-[12px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
              Zero Risk · agency memory · entities, relationships, sources ·
              live from the platform endpoints
            </p>
          </div>
        </section>
        <Suspense fallback={<HomeHeroSkeleton />}>
          <HomeMemoryHero />
        </Suspense>
      </main>
    </>
  )
}

function HomeHeroSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="stats-bar">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="stats-cell">
            <div className="skel-line w-1/2" style={{ height: "0.6rem" }} />
            <div className="skel-line w-3/4" style={{ height: "1.5rem" }} />
            <div className="skel-line w-1/2" style={{ height: "0.5rem" }} />
          </div>
        ))}
      </div>
      <Skeleton kind="page" />
    </div>
  )
}
