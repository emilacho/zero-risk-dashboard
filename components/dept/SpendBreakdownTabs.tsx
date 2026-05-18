"use client"
/**
 * SpendBreakdownTabs · STEP 6 surface · multi-dim drill of 30d AI spend.
 *
 * Receives 4 pre-computed `BreakdownBucket[]` (server-side aggregations
 * from `lib/spend-classifier.ts`). Renders Radix Tabs · 4 tabs (Cliente
 * / Agente / Servicio / Brazo) · each tab shows a ranked list with cost
 * + count + relative bar + Radix Tooltip on hover surfacing workflow
 * source · related agents · top models · sample related buckets.
 *
 * Phase 4 regression-safe · ZERO function-prop callbacks · all data
 * passes as primitives + serializable objects.
 */
import { useState, useMemo } from "react"
import * as Tabs from "@radix-ui/react-tabs"
import * as Tooltip from "@radix-ui/react-tooltip"
import { Info } from "@phosphor-icons/react/dist/ssr"
import { formatValue } from "@/components/AnimatedNumber"

interface BreakdownBucket {
  label: string
  cost: number
  count: number
  related: {
    clients: string[]
    agents: string[]
    services: string[]
    brazos: string[]
    models: string[]
    workflows: string[]
  }
}

interface SpendBreakdownTabsProps {
  totalSpend: number
  byClient: BreakdownBucket[]
  byAgent: BreakdownBucket[]
  byService: BreakdownBucket[]
  byBrazo: BreakdownBucket[]
}

type Dim = "client" | "agent" | "service" | "brazo"

const TAB_HUE: Record<Dim, string> = {
  client: "amber",
  agent: "violet",
  service: "cyan",
  brazo: "rose",
}

function SpendList({ rows, dim }: { rows: BreakdownBucket[]; dim: Dim }) {
  const total = useMemo(() => rows.reduce((s, r) => s + r.cost, 0), [rows])
  const hue = TAB_HUE[dim]
  if (rows.length === 0) {
    return (
      <p className="num text-[10px] text-[hsl(var(--muted-foreground))]">
        Sin invocations registradas en esta dimensión.
      </p>
    )
  }
  return (
    <ul className="divide-y divide-[hsl(var(--border)/0.6)]">
      {rows.map((r) => {
        const pct = (r.cost / Math.max(0.0001, total)) * 100
        const tip = buildTooltip(r, dim)
        return (
          <li key={r.label} className="flex items-center justify-between py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: `hsl(var(--hue-${hue}))` }}
              />
              <span className="font-mono text-[11px] text-[hsl(var(--accent))]">
                {r.label}
              </span>
              <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                {r.count} inv
              </span>
              <Tooltip.Provider delayDuration={120}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      aria-label="more info"
                      className="rounded p-0.5 text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--accent))]"
                    >
                      <Info strokeWidth={1.5} className="h-3 w-3" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="top"
                      align="start"
                      sideOffset={6}
                      className="surface-card rim-instr z-[80] max-w-[360px] p-3"
                      data-rim={hue}
                    >
                      <div className="relative z-[2] flex flex-col gap-1.5">
                        <p
                          className="num text-[9px] uppercase tracking-[0.22em]"
                          style={{ color: `hsl(var(--hue-${hue}))` }}
                        >
                          {tip.title}
                        </p>
                        {tip.lines.map((ln, i) => (
                          <p
                            key={i}
                            className="num text-[10px] text-[hsl(var(--muted-foreground))]"
                          >
                            <span className="text-[hsl(var(--foreground))]">{ln.k}</span>
                            {" · "}
                            <span>{ln.v}</span>
                          </p>
                        ))}
                      </div>
                      <Tooltip.Arrow
                        className="fill-[hsl(var(--card))]"
                        width={10}
                        height={4}
                      />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            </div>
            <div className="flex items-center gap-3">
              <span className="num text-[11px] tabular-nums">
                {formatValue(r.cost, "currency", { decimals: r.cost < 1 ? 4 : 2 })}
              </span>
              <div className="relative h-1 w-28 overflow-hidden rounded-full bg-[hsl(var(--muted)/0.4)]">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    background: `hsl(var(--hue-${hue}))`,
                  }}
                />
              </div>
              <span className="num w-10 text-right text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">
                {pct.toFixed(1)}%
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function buildTooltip(
  r: BreakdownBucket,
  dim: Dim,
): { title: string; lines: Array<{ k: string; v: string }> } {
  const lines: Array<{ k: string; v: string }> = []
  if (dim !== "client" && r.related.clients.length > 0) {
    lines.push({ k: "Top clientes", v: r.related.clients.join(" · ") })
  }
  if (dim !== "agent" && r.related.agents.length > 0) {
    lines.push({ k: "Top agentes", v: r.related.agents.slice(0, 3).join(" · ") })
  }
  if (dim !== "service" && r.related.services.length > 0) {
    lines.push({ k: "Servicios", v: r.related.services.join(" · ") })
  }
  if (dim !== "brazo" && r.related.brazos.length > 0) {
    lines.push({ k: "Brazos", v: r.related.brazos.join(" · ") })
  }
  if (r.related.models.length > 0) {
    lines.push({ k: "Modelos", v: r.related.models.join(" · ") })
  }
  if (r.related.workflows.length > 0) {
    lines.push({ k: "Workflows", v: r.related.workflows.slice(0, 2).join(" · ") })
  }
  return {
    title: `${r.label} · ${r.count} invocations`,
    lines,
  }
}

export function SpendBreakdownTabs({
  totalSpend,
  byClient,
  byAgent,
  byService,
  byBrazo,
}: SpendBreakdownTabsProps) {
  const [tab, setTab] = useState<Dim>("client")
  const tabRows: Record<Dim, BreakdownBucket[]> = {
    client: byClient,
    agent: byAgent,
    service: byService,
    brazo: byBrazo,
  }

  return (
    <section
      className="surface-card rim-instr p-5"
      data-rim={TAB_HUE[tab]}
    >
      <div className="relative z-[2]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Spend 30d · breakdown multi-dim
            </h2>
            <p className="num mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
              {formatValue(totalSpend, "currency", { decimals: totalSpend < 1 ? 4 : 2 })}{" "}
              total · clasificación automática via
              <span className="font-mono"> resolveSpendCategory()</span>
            </p>
          </div>
        </div>

        <Tabs.Root value={tab} onValueChange={(v) => setTab(v as Dim)}>
          <Tabs.List className="mb-4 flex gap-1 overflow-x-auto border-b-[0.5px] border-[hsl(var(--border))]">
            {(
              [
                { v: "client", label: "Por Cliente" },
                { v: "agent", label: "Por Agente" },
                { v: "service", label: "Por Servicio" },
                { v: "brazo", label: "Por Brazo" },
              ] as Array<{ v: Dim; label: string }>
            ).map((t) => (
              <Tabs.Trigger
                key={t.v}
                value={t.v}
                className="num relative -mb-px shrink-0 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] transition data-[state=active]:text-[hsl(var(--foreground))]"
                style={{
                  borderBottom:
                    tab === t.v
                      ? `1.5px solid hsl(var(--hue-${TAB_HUE[t.v]}))`
                      : "1.5px solid transparent",
                }}
              >
                {t.label}
                <span className="ml-1.5 text-[9px] opacity-60">
                  {tabRows[t.v].length}
                </span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {(["client", "agent", "service", "brazo"] as Dim[]).map((d) => (
            <Tabs.Content key={d} value={d}>
              <SpendList rows={tabRows[d]} dim={d} />
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </div>
    </section>
  )
}
