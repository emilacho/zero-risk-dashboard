import { Header } from "@/components/Header"
import { BentoCard } from "@/components/BentoCard"
import { Activity, Users, Bot, GitBranch, DollarSign, Clock } from "lucide-react"

/**
 * Main dashboard page · bento grid placeholder layout.
 *
 * Phase 0 ships the chrome + navigation + card slots. Phase 1 wires each
 * card to a Supabase query / Tremor chart / ReactFlow cascade graph.
 */
export default function DashboardHome() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Control surface
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Operations overview
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Real-time status of the Zero Risk agentic agency · agent
              invocations, client journeys, cascade outputs, spend. Placeholder
              cards · Phase 1 wires live data via Supabase + Tremor charts.
            </p>
          </div>
          <p className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground md:block">
            v0 · scaffold
          </p>
        </div>

        <div className="grid auto-rows-[minmax(180px,auto)] grid-cols-1 gap-4 md:grid-cols-3">
          <BentoCard
            title="Agents"
            subtitle="Active managed-agents registry · canonical via Anthropic"
            href="/agents"
            span="2"
            accent="primary"
          >
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-semibold tabular-nums">39</p>
                <p className="mt-1 text-xs text-muted-foreground">registered</p>
              </div>
              <Bot className="h-10 w-10 text-primary/40" />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Last sync · 2026-04-15 · registry mirror to `agents.identity_content`
              read-only per governance rule (16-may decisions).
            </p>
          </BentoCard>

          <BentoCard
            title="Clients"
            subtitle="Onboarded · in journey · churned"
            href="/clients"
            accent="accent"
          >
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-semibold tabular-nums">—</p>
                <p className="mt-1 text-xs text-muted-foreground">active</p>
              </div>
              <Users className="h-10 w-10 text-accent/40" />
            </div>
          </BentoCard>

          <BentoCard title="Invocations · 24h" subtitle="agent_invocations rollup">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-semibold tabular-nums">—</p>
                <p className="mt-1 text-xs text-muted-foreground">calls</p>
              </div>
              <Activity className="h-10 w-10 text-muted-foreground/40" />
            </div>
          </BentoCard>

          <BentoCard title="Anthropic spend · 24h" subtitle="cost_usd sum">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-semibold tabular-nums">$ —</p>
                <p className="mt-1 text-xs text-muted-foreground">last 24h</p>
              </div>
              <DollarSign className="h-10 w-10 text-muted-foreground/40" />
            </div>
          </BentoCard>

          <BentoCard
            title="Cascades"
            subtitle="Onboarding orchestrations · ReactFlow graph"
            href="/cascades"
            span="2"
            accent="primary"
          >
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-semibold tabular-nums">—</p>
                <p className="mt-1 text-xs text-muted-foreground">in flight · 24h</p>
              </div>
              <GitBranch className="h-10 w-10 text-primary/40" />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              6-agent sequential cascade (brand → research → creative → web →
              content → editor). Click to see graph + status per run.
            </p>
          </BentoCard>

          <BentoCard title="p95 latency · cascade" subtitle="6-agent sequence">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-semibold tabular-nums">—</p>
                <p className="mt-1 text-xs text-muted-foreground">seconds</p>
              </div>
              <Clock className="h-10 w-10 text-muted-foreground/40" />
            </div>
          </BentoCard>
        </div>
      </main>
    </>
  )
}
