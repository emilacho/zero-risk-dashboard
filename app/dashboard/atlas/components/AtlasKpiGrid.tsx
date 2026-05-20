"use client"
/**
 * AtlasKpiGrid · Section 3 · 4 KPIs principales.
 *
 * agentes (con drift +N) · workflows · clientes activos · spend 30d.
 * "Spend 30d" no tiene API en sprint 2 scaffold · derivado de
 * invocations count como proxy hasta R-future. Marked stub via
 * footnote.
 */
import { useAtlasSnapshot } from "../hooks/useAtlasSnapshot"
import { formatNumberCompact } from "../tokens"

interface KpiCardProps {
  label: string
  value: string
  delta?: { text: string; hue: "emerald" | "amber" | "rose" | "muted" }
  footnote?: string
}

function KpiCard({ label, value, delta, footnote }: KpiCardProps) {
  const deltaColor =
    delta?.hue === "emerald"
      ? "text-[hsl(var(--success))]"
      : delta?.hue === "rose"
        ? "text-[hsl(var(--danger))]"
        : delta?.hue === "amber"
          ? "text-[hsl(var(--hue-amber))]"
          : "text-[hsl(var(--muted-foreground))]"
  return (
    <div className="surface-card rim-instr flex flex-col gap-2 p-5" data-rim="cyan">
      <p className="relative z-[2] num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        {label}
      </p>
      <div className="relative z-[2] flex items-baseline gap-2">
        <span className="num font-display text-3xl font-semibold tabular-nums leading-none">
          {value}
        </span>
      </div>
      <div className="relative z-[2] flex flex-col gap-0.5">
        {delta ? (
          <p className={`num text-[11px] tabular-nums ${deltaColor}`}>
            {delta.text}
          </p>
        ) : null}
        {footnote ? (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]/80">
            {footnote}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function AtlasKpiGrid() {
  const { data } = useAtlasSnapshot()
  const agentsTotal = data?.agents?.total ?? 0
  const dormant = data?.agents?.dormant_count ?? 0
  const active30d = data?.agents?.with_executions_30d ?? 0
  const workflowsTotal = data?.workflows?.total ?? 0
  const workflowsActive = data?.workflows?.active ?? 0
  const clientsActive = data?.clients?.active_real ?? 0
  const clientsTotal = data?.clients?.total ?? 0
  // Spend 30d proxy · sum of invocations_30d across clients
  // (real spend tracking is post-sprint · marked stub footnote)
  const invocations30d =
    data?.clients?.rows.reduce((s, r) => s + (r.invocations_30d ?? 0), 0) ?? 0

  const driftDelta = data?.drift?.findings_count ?? 0
  const driftHue =
    driftDelta === 0
      ? "emerald"
      : data?.drift?.findings.some((f) => f.severity === "critical")
        ? "rose"
        : "amber"

  return (
    <section aria-label="KPIs principales">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="agentes"
          value={String(agentsTotal)}
          delta={{
            text: `${active30d} activos · ${dormant} dormant`,
            hue: dormant > active30d ? "amber" : "emerald",
          }}
          footnote={
            driftDelta > 0
              ? `${driftDelta} drift finding${driftDelta === 1 ? "" : "s"} relacionado${driftDelta === 1 ? "" : "s"}`
              : "canon === reality"
          }
        />
        <KpiCard
          label="workflows"
          value={String(workflowsTotal)}
          delta={{
            text: `${workflowsActive} active · ${Math.max(0, workflowsTotal - workflowsActive)} inactive`,
            hue: workflowsActive > 0 ? "emerald" : "muted",
          }}
          footnote={`n8n · ${data?.workflows?.n8n_status ?? "unknown"}`}
        />
        <KpiCard
          label="clientes activos"
          value={String(clientsActive)}
          delta={{
            text: `${clientsTotal} total · ${clientsTotal - clientsActive} smoke`,
            hue: clientsActive > 0 ? "emerald" : "muted",
          }}
          footnote="archived_at IS NULL"
        />
        <KpiCard
          label="invocations 30d"
          value={formatNumberCompact(invocations30d)}
          delta={
            invocations30d > 0
              ? { text: "live agent_invocations", hue: "emerald" }
              : { text: "0 registradas · instrumentation gap", hue: driftHue }
          }
          footnote="proxy de spend · meter dedicado pending"
        />
      </div>
    </section>
  )
}
