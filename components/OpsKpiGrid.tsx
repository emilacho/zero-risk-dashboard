/**
 * OpsKpiGrid · Phase 3 · 8 operational KPI cards.
 *
 * Server component · fetches platform metrics + dashboard ops-extras
 * (lib/api.ts metrics + same-origin /api/dashboard/ops-extras) and
 * renders an 8-card grid with mono numerals + rim instrumentation per
 * Lumen v3 canon.
 *
 * Cells that have no wired source render a "wire pending" sub-badge
 * rather than a 0 · honest placeholder beats fabricated metrics.
 */
import { api } from "@/lib/api"
import { headers } from "next/headers"
import {
  Cpu,
  Activity,
  Banknote,
  Coins,
  CheckCircle2,
  Clock,
  Workflow,
  Users,
} from "lucide-react"
import { AnimatedNumber } from "@/components/AnimatedNumber"

interface OpsExtras {
  ok: boolean
  invocations_24h: number | null
  invocations_30d: number | null
  cascade_success_rate: number | null
  pending_hitl: number | null
  tokens_24h: number | null
  tokens_30d: number | null
  spend_by_provider_30d: {
    anthropic: number | null
    openai: number | null
    other: number | null
  }
  timestamp: string
}

async function loadExtras(): Promise<OpsExtras | null> {
  // Build absolute URL from request headers so server-side fetch works
  // in Vercel preview + prod (no NEXT_PUBLIC_SITE_URL needed).
  const h = await headers()
  const host = h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  if (!host) return null
  try {
    const res = await fetch(`${proto}://${host}/api/dashboard/ops-extras`, {
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as OpsExtras
  } catch {
    return null
  }
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null) return "—"
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
  if (Math.abs(v) < 1) return `$${v.toFixed(3)}`
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtCompact(v: number | null | undefined): string {
  if (v == null) return "—"
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return v.toLocaleString("en-US")
}

interface CellProps {
  label: string
  cardinal?: string
  icon: React.ReactNode
  /** Numeric value · null means unwired */
  value: number | null
  /** "currency" | "number" | "percent" */
  format?: "currency" | "number" | "percent"
  sub?: string
  /** "wire pending" when source unwired · "" when ok */
  badge?: string
}

function Cell({ label, cardinal, icon, value, format = "number", sub, badge }: CellProps) {
  const pending = value == null || badge === "wire pending"
  const fmt =
    format === "currency"
      ? (v: number) => fmtUsd(v)
      : format === "percent"
      ? (v: number) => `${v.toFixed(1)}%`
      : (v: number) => fmtCompact(v)

  return (
    <div
      className="surface-card rim-instr p-4"
      data-hue="violet"
      data-rim="violet"
      data-pop="true"
      data-rim-zone={cardinal}
    >
      <div className="relative z-[2] flex flex-col gap-2.5">
        <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary-glow))]">
            {icon}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
            {label}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          {pending ? (
            <span className="font-display text-[28px] font-semibold leading-none tabular-nums text-[hsl(var(--muted-foreground))]">
              —
            </span>
          ) : (
            <AnimatedNumber
              value={value}
              format={fmt}
              className="font-display text-[28px] font-semibold leading-none tabular-nums"
            />
          )}
          {pending ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--danger))] opacity-80">
              wire pending
            </span>
          ) : null}
        </div>
        {sub ? (
          <p className="num text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export async function OpsKpiGrid() {
  const [metrics, extras] = await Promise.all([api.metrics().catch(() => null), loadExtras()])

  const tokens24h = extras?.tokens_24h ?? null
  const tokens30d = extras?.tokens_30d ?? null
  const invocations24h = extras?.invocations_24h ?? null
  const cascade = extras?.cascade_success_rate ?? null
  const pendingHitl = extras?.pending_hitl ?? null
  const spendAnthropic = extras?.spend_by_provider_30d.anthropic ?? null
  const spendOpenai = extras?.spend_by_provider_30d.openai ?? null
  const spend30d = metrics?.totals.spend_usd_30d ?? null
  const clientsTotal = metrics?.totals.clients_total ?? null
  const workflowsN8n = metrics?.totals.workflows_n8n ?? null

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow-chip">
          <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
          Operations · 8 KPI · 24h + 30d windows
        </span>
        <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
          updated {new Date().toLocaleTimeString("en-US", { hour12: false })}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Cell
          label="Token usage · 24h"
          icon={<Activity strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={tokens24h}
          format="number"
          sub={
            tokens30d != null
              ? `30d total · ${fmtCompact(tokens30d)} tokens · in+out`
              : "Anthropic + OpenAI · in+out"
          }
        />
        <Cell
          label="Anthropic credit"
          icon={<Banknote strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={null}
          badge="wire pending"
          sub="Console API · not yet wired"
        />
        <Cell
          label="Invocations · 24h"
          icon={<Cpu strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={invocations24h}
          format="number"
          sub={
            extras?.invocations_30d != null
              ? `30d · ${fmtCompact(extras.invocations_30d)}`
              : undefined
          }
        />
        <Cell
          label="Cascade success rate"
          icon={<CheckCircle2 strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={cascade}
          format="percent"
          sub={
            extras?.invocations_30d != null && cascade != null
              ? `${Math.round((cascade / 100) * (extras.invocations_30d || 0))} / ${extras.invocations_30d} completed · 30d`
              : "completed / total"
          }
        />
        <Cell
          label="Pending HITL"
          icon={<Clock strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={pendingHitl}
          format="number"
          badge={pendingHitl == null ? "wire pending" : undefined}
          sub="hitl_approvals · status=pending"
        />
        <Cell
          label="n8n · 24h"
          icon={<Workflow strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={workflowsN8n}
          format="number"
          badge={workflowsN8n == null ? "wire pending" : undefined}
          sub="n8n API · executions count"
        />
        <Cell
          label="Spend · provider"
          icon={<Coins strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={spend30d}
          format="currency"
          sub={
            spendAnthropic != null && spendOpenai != null
              ? `anthropic ${fmtUsd(spendAnthropic)} · openai ${fmtUsd(spendOpenai)}`
              : "30d total · breakdown pending"
          }
        />
        <Cell
          label="Active clients"
          icon={<Users strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={clientsTotal}
          format="number"
          sub={
            metrics?.totals.agents_active != null
              ? `agents active · ${metrics.totals.agents_active}`
              : undefined
          }
        />
      </div>
    </section>
  )
}
