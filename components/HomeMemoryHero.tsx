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
      {/* Phase 2 · radial sentinel as foreground HUD overlay on top of
          the MemoryGraph. The graph remains the primary affordance via
          ReactFlow interactions (pan/zoom); the sentinel reads as a
          translucent instrumentation rim around the centre, per refs
          02 Cantina / 05 GMUNK / 09 Jayse · "system at rest, but
          alive". Lower z-index of the sentinel rings is fine because
          `pointer-events-none` keeps the graph fully interactive. */}
      <div className="relative">
        <MemoryGraph data={graph} height={720} title={null} chrome="chrome" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-70 mix-blend-screen"
        >
          <RadialSentinel size={640} label="LUMEN · ZERO RISK" />
        </div>
      </div>
    </div>
  )
}
