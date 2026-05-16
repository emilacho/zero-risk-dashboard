'use client'
/**
 * KpiGrid · bento-style varied grid of 4 KPIs. Lumen polish:
 *  - one "feature" cell (Spend) spans 2 cols on lg+ · bigger digit · cyan glow
 *  - 3 standard cells · violet glow
 *  - gradient hairline on the feature card via surface-card
 *
 * The layout falls back to a 1-col stack on mobile, 2-col on md, then
 * lays out as `feature feature std / std std std` on lg.
 */
import { KpiCard } from './KpiCard'
import { Bot, Users, DollarSign, Workflow } from 'lucide-react'
import type { KpiSnapshot } from '../types'

export interface KpiGridProps {
  snapshot: KpiSnapshot
}

export function KpiGrid({ snapshot }: KpiGridProps) {
  return (
    <div
      className="
        grid gap-4
        grid-cols-1
        md:grid-cols-2
        lg:grid-cols-4 lg:grid-rows-[auto_auto]
      "
    >
      {/* Hero feature · Spend del mes · spans 2 cols + 2 rows on lg */}
      <div className="lg:col-span-2 lg:row-span-2">
        <KpiCard
          label="Spend del mes"
          metric={snapshot.spendMonth}
          format="currency"
          deltaIsGood={false}
          size="feature"
          glow="cyan"
          icon={<DollarSign className="h-3.5 w-3.5" />}
          className="h-full"
        />
      </div>

      <KpiCard
        label="Agentes activos"
        metric={snapshot.agentsActive}
        format="number"
        deltaIsGood
        glow="violet"
        icon={<Bot className="h-3.5 w-3.5" />}
      />
      <KpiCard
        label="Clientes activos"
        metric={snapshot.clientsActive}
        format="number"
        deltaIsGood
        glow="violet"
        icon={<Users className="h-3.5 w-3.5" />}
      />
      <KpiCard
        label="Workflows activos"
        metric={snapshot.workflowsActive}
        format="number"
        deltaIsGood
        glow="violet"
        icon={<Workflow className="h-3.5 w-3.5" />}
      />
      {/* Optional 4th tile on the second row · reserved for the spend
          card's expanded breathing room on lg. On md and below the grid
          flows naturally without needing a placeholder. */}
      <div className="hidden lg:block" />
    </div>
  )
}
