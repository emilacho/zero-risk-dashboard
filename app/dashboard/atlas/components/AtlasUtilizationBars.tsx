"use client"
/**
 * AtlasUtilizationBars · Section 4 · utilización vs inventario.
 *
 * 2 progress bars · agents ejecutan vs dormantes · workflows active vs
 * inactive. Numbers tabular · barras sin gradient.
 */
import { useAtlasSnapshot } from "../hooks/useAtlasSnapshot"

interface UtilBarProps {
  label: string
  numerator: number
  denominator: number
  numLabel: string
  denomLabel: string
  context: string
}

function UtilBar({ label, numerator, denominator, numLabel, denomLabel, context }: UtilBarProps) {
  const pct = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
  return (
    <div className="surface-card rim-instr p-5" data-rim="cyan">
      <div className="relative z-[2] flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            {label}
          </p>
          <p className="num text-[10px] uppercase tracking-[0.18em] tabular-nums">
            <span className="font-semibold">{pct}%</span>
            <span className="text-[hsl(var(--muted-foreground))]"> utilización</span>
          </p>
        </div>

        <div
          className="relative h-2 overflow-hidden rounded-full bg-[hsl(var(--secondary))]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            aria-hidden
            className="h-full rounded-full bg-[hsl(var(--success))]"
            style={{ width: `${pct}%`, transition: "width 240ms ease-out" }}
          />
        </div>

        <div className="num flex items-baseline justify-between gap-3 text-[11px] tabular-nums">
          <span>
            <span className="font-semibold">{numerator}</span>
            <span className="ml-1 text-[hsl(var(--muted-foreground))]">{numLabel}</span>
          </span>
          <span>
            <span className="font-semibold">{denominator - numerator}</span>
            <span className="ml-1 text-[hsl(var(--muted-foreground))]">{denomLabel}</span>
          </span>
        </div>

        <p className="text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          {context}
        </p>
      </div>
    </div>
  )
}

export function AtlasUtilizationBars() {
  const { data } = useAtlasSnapshot()
  const agentsTotal = data?.agents?.total ?? 0
  const agentsActive = data?.agents?.with_executions_30d ?? 0
  const workflowsTotal = data?.workflows?.total ?? 0
  const workflowsActive = data?.workflows?.active ?? 0

  return (
    <section aria-label="Utilización vs inventario">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <UtilBar
          label="agentes"
          numerator={agentsActive}
          denominator={agentsTotal}
          numLabel="ejecutaron 30d"
          denomLabel="dormant"
          context="Dormants ocupan slot en managed_agents_registry pero no facturan. Ratio bajo = oportunidad de pruning OR cliente nuevo que aún no rotó."
        />
        <UtilBar
          label="workflows n8n"
          numerator={workflowsActive}
          denominator={workflowsTotal}
          numLabel="active"
          denomLabel="inactive / draft"
          context="Active flag se setea cuando el workflow está deployed + trigger habilitado. Inactive incluye drafts + workflows pausados manualmente."
        />
      </div>
    </section>
  )
}
