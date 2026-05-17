/**
 * DeptOverviewGrid · 5 oficinas gerenciales card grid for home page.
 *
 * Server component · pulls real data via Supabase direct (active agents
 * per dept + sessions 30d + cost 30d) + classifies via lib/departments
 * · clicking a card navigates a /dept/[slug].
 */
import Link from "next/link"
import { Building2, Cpu, Users, Coins, Megaphone, ShieldCheck } from "lucide-react"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { DEPARTMENTS, rollupAgentsByDept, type DeptSlug } from "@/lib/departments"
import type { AgentRow } from "@/lib/api"
import { AnimatedNumber } from "@/components/AnimatedNumber"

const DEPT_ICONS: Record<DeptSlug, React.ReactNode> = {
  ops: <Cpu strokeWidth={1.5} className="h-4 w-4" />,
  csm: <Users strokeWidth={1.5} className="h-4 w-4" />,
  fin: <Coins strokeWidth={1.5} className="h-4 w-4" />,
  mkt: <Megaphone strokeWidth={1.5} className="h-4 w-4" />,
  qa: <ShieldCheck strokeWidth={1.5} className="h-4 w-4" />,
}

async function loadAgentsForRollup(): Promise<AgentRow[]> {
  try {
    const supa = getServiceRoleClient()
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const [agentsRes, invRes] = await Promise.all([
      supa
        .from("agents")
        .select("id, name, display_name, role, model, status")
        .limit(200),
      supa
        .from("agent_invocations")
        .select("agent_name, cost_usd, started_at")
        .gte("started_at", since30)
        .limit(20_000),
    ])
    const agentRows = (agentsRes.data ?? []) as Array<{
      id: string
      name: string | null
      display_name: string | null
      role: string | null
      model: string | null
      status: string | null
    }>
    const invRows = (invRes.data ?? []) as Array<{
      agent_name: string | null
      cost_usd: number | null
      started_at: string | null
    }>
    const statsByName = new Map<string, { sessions: number; cost: number }>()
    for (const row of invRows) {
      const key = row.agent_name ?? ""
      if (!key) continue
      const cur = statsByName.get(key) ?? { sessions: 0, cost: 0 }
      cur.sessions += 1
      cur.cost += Number(row.cost_usd ?? 0)
      statsByName.set(key, cur)
    }
    return agentRows.map((a) => {
      const name = a.name ?? ""
      const stats = statsByName.get(name) ?? { sessions: 0, cost: 0 }
      return {
        id: a.id,
        name,
        display_name: a.display_name ?? name,
        role: a.role ?? "empleado",
        model: a.model ?? "claude-sonnet",
        status: a.status ?? "active",
        identity_chars: 0,
        identity_source: "",
        stats_30d: {
          sessions: stats.sessions,
          tokens_input: 0,
          tokens_output: 0,
          cost_usd: stats.cost,
          last_activity: null,
        },
      } as AgentRow
    })
  } catch (e) {
    console.error("dept rollup load failed", e)
    return []
  }
}

export async function DeptOverviewGrid() {
  const agents = await loadAgentsForRollup()
  const rollup = rollupAgentsByDept(agents)

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow-chip">
          <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
          Gerencia · 5 oficinas · click a drilldown
        </span>
        <Link
          href="/dept/ops"
          className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
        >
          → first office
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {DEPARTMENTS.map((d) => {
          const r = rollup[d.slug]
          // FIN is a derived view · no agents directly assigned, so
          // surface spend from rollup of ALL agents instead (computed
          // upstream by Ops KPI grid). Show "—" for active count here.
          const isDerivedView = d.slug === "fin"
          return (
            <Link
              key={d.slug}
              href={`/dept/${d.slug}`}
              className="surface-card rim-instr group p-4"
              data-hue={d.hue}
              data-rim={d.hue}
              data-pop="true"
              data-rim-zone={d.shortLabel}
            >
              <div className="relative z-[2] flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border-[0.5px]"
                    style={{
                      borderColor: `hsl(var(--hue-${d.hue}) / 0.4)`,
                      background: `hsl(var(--hue-${d.hue}) / 0.12)`,
                      color: `hsl(var(--hue-${d.hue}))`,
                    }}
                  >
                    {DEPT_ICONS[d.slug]}
                  </span>
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.2em]"
                    style={{ color: `hsl(var(--hue-${d.hue}))` }}
                  >
                    {d.shortLabel}
                  </span>
                </div>
                <h3 className="font-display text-[15px] font-semibold leading-tight">
                  {d.label}
                </h3>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="flex flex-col">
                    <span className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                      active · 30d
                    </span>
                    <span className="font-display text-xl font-semibold tabular-nums">
                      {isDerivedView ? "—" : (
                        <AnimatedNumber value={r.activeAgents} format={(v) => v.toFixed(0)} />
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                      spend · 30d
                    </span>
                    <span className="font-display text-xl font-semibold tabular-nums">
                      {isDerivedView ? (
                        "(derived)"
                      ) : (
                        <AnimatedNumber
                          value={r.cost30d}
                          format={(v) =>
                            v < 1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`
                          }
                        />
                      )}
                    </span>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                  {d.tagline}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

// Suppress unused-import warning for Building2 (kept for future home
// section header)
void Building2
