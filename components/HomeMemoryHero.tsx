import { api } from "@/lib/api"
import {
  MemoryGraph,
  StatsBar,
} from "@/lib/dashboard-components"
import {
  buildAgencyMemoryGraph,
  buildStatsBarSnapshot,
} from "@/lib/transforms"
import { RadialSentinel } from "@/components/RadialSentinel"

/**
 * HomeMemoryHero · the v3 home-page hero.
 *
 * Lumen-exact match · monitoring stats bar across the top + the agency
 * memory graph as the dominant visual, replacing the old KPI/list cards.
 *
 * Server component · fetches metrics + agents + clients in parallel,
 * builds the graph + stats bar, then hands strict prop shapes to the
 * client components.
 */
export async function HomeMemoryHero() {
  const [metrics, agents, clients] = await Promise.all([
    api.metrics().catch(() => null),
    api.agents(100).catch(() => null),
    api.clients(100).catch(() => null),
  ])

  if (!metrics && !agents && !clients) {
    return (
      <div className="surface-card p-6 text-sm text-rose-300" data-hue="rose">
        Could not load memory graph · platform endpoints unreachable.
      </div>
    )
  }

  const stats = buildStatsBarSnapshot({ metrics, agents, clients })
  const graph = buildAgencyMemoryGraph({
    metrics,
    agents: agents?.agents ?? [],
    clients: clients?.clients ?? [],
  })

  return (
    <div className="flex flex-col gap-6">
      <StatsBar snapshot={stats} />
      {/* Phase 2 · radial sentinel sits BEHIND the MemoryGraph, centred
          in the canvas. The graph remains the primary affordance; the
          sentinel adds the "system at rest, instrumentation alive"
          read per refs 02/05/09. */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
        >
          <RadialSentinel size={560} label="LUMEN · ZERO RISK" />
        </div>
        <div className="relative z-10">
          <MemoryGraph data={graph} height={720} title={null} chrome="chrome" />
        </div>
      </div>
    </div>
  )
}
