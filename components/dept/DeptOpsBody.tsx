/**
 * Dept · OPS · Operations & Observability.
 *
 *   - agent grid filtered to OPS slugs + the "untagged" pool (transversal
 *     agents that nobody owns yet) · 50/59 idle visible
 *   - workflow status rollup (active / inactive · trigger type)
 *   - cascade health rollup (count + last status)
 *   - failure / latency placeholder ("wire pending" badges)
 */
import { getServiceRoleClient } from "@/lib/supabase-server"
import { api } from "@/lib/api"
import { classifyAgent } from "@/lib/departments"
import Link from "next/link"
import {
  Cpu,
  FlowArrow,
  Warning,
  GitBranch,
  Pulse,
} from "@phosphor-icons/react"
import { OpsKpiCell } from "@/components/OpsKpiCell"
import { ClickableSummaryCard } from "@/components/ui/ClickableSummaryCard"

interface FlowArrow {
  id: string
  name: string
  active: boolean
  trigger: string
}

async function loadWorkflows(): Promise<{ all: FlowArrow[]; total: number } | null> {
  const base = process.env.N8N_BASE_URL
  const key = process.env.N8N_API_KEY
  if (!base || !key) return null
  try {
    const res = await fetch(
      `${base.replace(/\/+$/, "")}/api/v1/workflows?limit=200`,
      {
        headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
        cache: "no-store",
      },
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: unknown[] }
    const all = (json.data ?? []).map((w) => {
      type WfRow = {
        id?: string
        name?: string
        active?: boolean
        nodes?: { type?: string }[]
      }
      const wf = w as WfRow
      const trigger =
        (wf.nodes ?? []).find((n) =>
          /trigger|webhook|cron|schedule/i.test(n.type ?? ""),
        )?.type?.split(".").pop() ?? "?"
      return {
        id: wf.id ?? "",
        name: wf.name ?? "",
        active: wf.active === true,
        trigger,
      }
    })
    return { all, total: all.length }
  } catch {
    return null
  }
}

async function loadCascadeRollup() {
  try {
    const supa = getServiceRoleClient()
    const { count } = await supa
      .from("cascade_runs")
      .select("id", { count: "exact", head: true })
    return { total: count ?? 0, pending: 0 }
  } catch {
    return { total: 0, pending: 0 }
  }
}

export async function DeptOpsBody() {
  const agentsRes = await api.agents(200).catch(() => null)
  const workflows = await loadWorkflows()
  const cascadeRollup = await loadCascadeRollup()

  const allAgents = agentsRes?.agents ?? []
  const opsAgents = allAgents.filter((a) => classifyAgent(a) === "ops")
  const untagged = allAgents.filter((a) => classifyAgent(a) === null)
  const allAgentsCount = allAgents.length
  const activeAgentsAll = allAgents.filter(
    (a) => (a.stats_30d?.sessions ?? 0) > 0,
  ).length

  return (
    <div className="flex flex-col gap-8">
      {/* KPI bar · 4 cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <OpsKpiCell
          label="Agents total"
          icon={<Cpu strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={allAgentsCount}
          format="number"
          sub={`active 30d · ${activeAgentsAll} · utilization ${((activeAgentsAll / allAgentsCount) * 100).toFixed(1)}%`}
        />
        <OpsKpiCell
          label="Workflows total"
          icon={<FlowArrow strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={workflows?.total ?? null}
          format="number"
          sub={
            workflows
              ? `${workflows.all.filter((w) => w.active).length} active · ${workflows.all.filter((w) => !w.active).length} inactive`
              : "n8n API unreachable"
          }
        />
        <OpsKpiCell
          label="Cascade runs"
          icon={<GitBranch strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={cascadeRollup.total}
          format="number"
          sub="cascade_runs table · platform writes pending"
        />
        <OpsKpiCell
          label="Failure rate"
          icon={<Warning strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={null}
          format="percent"
          badge="wire pending"
          sub="Sentry + n8n exec error count"
        />
      </div>

      {/* Agents OPS table */}
      <section className="surface-card rim-instr p-5" data-rim="violet">
        <div className="relative z-[2]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold tracking-tight">
              OPS · agents directos
            </h2>
            <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
              {opsAgents.length} agents · transversal + gerente
            </span>
          </div>
          {opsAgents.length === 0 ? (
            <p className="num text-xs text-[hsl(var(--muted-foreground))]">
              No agents classified as OPS yet.
            </p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border)/0.6)]">
              {opsAgents.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/agents/${a.name}`}
                      className="font-mono text-[12px] text-[hsl(var(--accent))] hover:underline"
                    >
                      {a.name}
                    </Link>
                    <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                      {a.role}
                    </span>
                    <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                      {a.model}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="num text-[hsl(var(--muted-foreground))]">
                      {a.stats_30d?.sessions ?? 0} sess
                    </span>
                    <span className="num text-[hsl(var(--accent))]">
                      ${(a.stats_30d?.cost_usd ?? 0).toFixed(3)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Workflows n8n table */}
      <section className="surface-card rim-instr p-5" data-rim="amber">
        <div className="relative z-[2]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Workflows n8n · {workflows?.total ?? "—"} total
            </h2>
            <Link
              href="/system"
              className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
            >
              → full system
            </Link>
          </div>
          {workflows == null ? (
            <p className="num text-xs text-[hsl(var(--danger))]">
              n8n API unreachable · check `N8N_BASE_URL` + `N8N_API_KEY`
              envs.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {workflows.all.slice(0, 20).map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px]">
                      <span
                        className="num mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                        style={{
                          background: w.active
                            ? "hsl(var(--success))"
                            : "hsl(var(--muted-foreground) / 0.5)",
                        }}
                      />
                      {w.name.replace(/^Zero Risk[ ·—-]*/, "")}
                    </p>
                  </div>
                  <span className="num ml-3 shrink-0 text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                    {w.trigger.replace("Trigger", "")}
                  </span>
                </div>
              ))}
            </div>
          )}
          {workflows && workflows.all.length > 20 ? (
            <p className="mt-3 num text-[10px] text-[hsl(var(--muted-foreground))]">
              + {workflows.all.length - 20} more · open `/system` for full
              virtual-scroll table.
            </p>
          ) : null}
        </div>
      </section>

      {/* Untagged agents · STEP 4.5 ClickableSummaryCard pattern */}
      {untagged.length > 0 ? (
        <ClickableSummaryCard
          title="Untagged agents · sin departamento v1"
          count={untagged.length}
          hue="rose"
          icon={<Pulse strokeWidth={1.5} className="h-3.5 w-3.5" />}
          sub="Sales · Intel · transversal · pending v2 dept activation · click → ver lista"
          variant="full"
          modalDescription="Cuando se activen Sales + Intel como departamentos v2 estos se reclasifican automáticamente."
          seeAllHref="/system/agents"
          items={untagged
            .sort(
              (a, b) =>
                (b.stats_30d?.sessions ?? 0) - (a.stats_30d?.sessions ?? 0) ||
                a.name.localeCompare(b.name),
            )
            .map((a) => ({
              primary: a.name,
              secondary: a.role,
              tertiary: `${a.model} · ${a.stats_30d?.sessions ?? 0} sess 30d · $${(a.stats_30d?.cost_usd ?? 0).toFixed(4)}`,
              status: (a.stats_30d?.sessions ?? 0) > 0 ? "active" : "idle",
              href: `/agents/${a.name}`,
            }))}
        />
      ) : null}
    </div>
  )
}
