import { api } from "@/lib/api"
import { MemoryGraph } from "@/lib/dashboard-components"
import { buildAgencyMemoryGraph } from "@/lib/transforms"
export const dynamic = "force-dynamic"

/**
 * /graph · fullscreen variant of the same agency memory graph that
 * lives on the home page. Drops the chrome, expands the canvas to
 * cover the viewport so operators can pan + zoom comfortably.
 */
export default async function GraphPage() {
  const [agents, clients, metrics] = await Promise.all([
    api.agents(100).catch(() => null),
    api.clients(100).catch(() => null),
    api.metrics().catch(() => null),
  ])
  const graph = buildAgencyMemoryGraph({
    agents: agents?.agents ?? [],
    clients: clients?.clients ?? [],
    metrics,
  })
  return (
    <>
      <main className="mx-auto max-w-[1600px] px-4 pb-8 pt-6">
        <section className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="eyebrow-chip">Memory graph · fullscreen</span>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              <span className="text-gradient">The Brain</span>
            </h1>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {graph.nodes.length} concepts · {graph.edges.length} relationships
          </p>
        </section>
        <MemoryGraph
          data={graph}
          height="calc(100vh - 160px)"
          title={null}
          chrome="fullscreen"
        />
      </main>
    </>
  )
}
