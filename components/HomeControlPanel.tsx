/**
 * HomeControlPanel · Phase 4.7 redesign · sala de comando.
 *
 * Order (top → bottom):
 *   1. StatsBar (always-visible global metrics)
 *   2. DeptOverviewGrid (5 oficinas · primary navigation)
 *   3. SystemTabsGrid (8 sistemicas · secondary navigation)
 *   4. OpsKpiGrid (Phase 3 · 8 operational KPIs)
 *   5. MemoryGraphCollapsedSection (reduced · linked to /graph for full)
 */
import Link from "next/link"
import {
  Cpu,
  Workflow,
  Boxes,
  Layers,
  HardDrive,
  Brain,
  Inbox,
  Map,
  ArrowRight,
  Network,
} from "lucide-react"
import { api } from "@/lib/api"
import { MemoryGraph, StatsBar } from "@/lib/dashboard-components"
import {
  buildAgencyMemoryGraph,
  buildStatsBarSnapshot,
} from "@/lib/transforms"
import { DeptOverviewGrid } from "@/components/DeptOverviewGrid"
import { OpsKpiGrid } from "@/components/OpsKpiGrid"
import { SYSTEM_TABS } from "@/lib/system-tabs"
import { WorkflowsRunningKpi } from "@/components/workflows/WorkflowsRunningKpi"
import { LiveAgentFeed } from "@/components/home/LiveAgentFeed"
import { loadAgentFeed } from "@/lib/agent-feed"

const SYSTEM_TAB_ICONS: Record<string, React.ReactNode> = {
  agents: <Cpu strokeWidth={1.5} className="h-4 w-4" />,
  workflows: <Workflow strokeWidth={1.5} className="h-4 w-4" />,
  brazos: <Boxes strokeWidth={1.5} className="h-4 w-4" />,
  plataformas: <Layers strokeWidth={1.5} className="h-4 w-4" />,
  storage: <HardDrive strokeWidth={1.5} className="h-4 w-4" />,
  memoria: <Brain strokeWidth={1.5} className="h-4 w-4" />,
  inbox: <Inbox strokeWidth={1.5} className="h-4 w-4" />,
  roadmap: <Map strokeWidth={1.5} className="h-4 w-4" />,
}

export async function HomeControlPanel() {
  const [metrics, agents, clients, agentFeed] = await Promise.all([
    api.metrics().catch(() => null),
    api.agents(100).catch(() => null),
    api.clients(100).catch(() => null),
    loadAgentFeed(7).catch(() => ({
      rows: [],
      count24h: 0,
      totalCost24h: 0,
      generatedAt: new Date().toISOString(),
    })),
  ])

  const stats = buildStatsBarSnapshot({ metrics, agents, clients })
  const graph = buildAgencyMemoryGraph({
    metrics,
    agents: agents?.agents ?? [],
    clients: clients?.clients ?? [],
  })

  return (
    <div className="flex flex-col gap-8">
      <StatsBar snapshot={stats} />

      {/* PRIMARY · 5 oficinas · the dept grid is the headline */}
      <DeptOverviewGrid />

      {/* SECONDARY · 8 sistemicas · /system shortcuts */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow-chip">
            <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
            Capa B · sistema desplegado · 8 vistas
          </span>
          <Link
            href="/system/agents"
            className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
          >
            → all system
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {SYSTEM_TABS.map((t) => (
            <Link
              key={t.slug}
              href={`/system/${t.slug}`}
              className="surface-card rim-instr group p-3"
              data-rim={t.hue}
              data-pop="true"
            >
              <div className="relative z-[2] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border-[0.5px]"
                    style={{
                      borderColor: `hsl(var(--hue-${t.hue}) / 0.4)`,
                      background: `hsl(var(--hue-${t.hue}) / 0.12)`,
                      color: `hsl(var(--hue-${t.hue}))`,
                    }}
                  >
                    {SYSTEM_TAB_ICONS[t.slug] ?? null}
                  </span>
                  <ArrowRight
                    strokeWidth={1.5}
                    className="h-3 w-3 text-[hsl(var(--muted-foreground))] transition group-hover:text-[hsl(var(--accent))]"
                  />
                </div>
                <p
                  className="num text-[9px] uppercase tracking-[0.18em]"
                  style={{ color: `hsl(var(--hue-${t.hue}))` }}
                >
                  {t.slug.slice(0, 3).toUpperCase()}
                </p>
                <p className="text-[13px] font-semibold leading-tight">
                  {t.label}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* LIVE · workflows running + STEP 10 live agent feed (Realtime
          subscribe on agent_invocations · ver equipo virtual trabajando
          en vivo). Layout · KPI tile narrow left · feed wide right. */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow-chip">
            <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
            Equipo virtual · live
          </span>
          <Link
            href="/system/workflows"
            className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
          >
            → todos los workflows
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1">
            <WorkflowsRunningKpi />
          </div>
          <LiveAgentFeed
            initialRows={agentFeed.rows}
            initialCount24h={agentFeed.count24h}
            initialCost24h={agentFeed.totalCost24h}
            maxRows={7}
          />
        </div>
      </section>

      {/* QUICK KPIS · 8 operational metrics · Phase 3 grid */}
      <OpsKpiGrid />

      {/* MEMORY GRAPH · reduced · collapsed section · link out to /graph */}
      <section className="surface-card rim-instr p-5" data-rim="violet">
        <div className="relative z-[2] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.4)] bg-[hsl(var(--primary-glow)/0.12)] text-[hsl(var(--primary-glow))]">
                <Network strokeWidth={1.5} className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold tracking-tight">
                  Memory Graph · agency memory
                </h2>
                <p className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  {graph.nodes.length} concepts · {graph.edges.length} relationships ·
                  cardinal-zone grid-pack
                </p>
              </div>
            </div>
            <Link
              href="/graph"
              className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
            >
              → fullscreen
            </Link>
          </div>

          {/* Reduced canvas · 360px height · pan/zoom interactive */}
          <MemoryGraph
            data={graph}
            height={360}
            title={null}
            chrome="fullscreen"
          />
        </div>
      </section>
    </div>
  )
}
