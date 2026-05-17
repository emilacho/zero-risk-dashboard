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
import { getServiceRoleClient } from "@/lib/supabase-server"
import {
  Cpu,
  Pulse,
  CurrencyDollar,
  Coins,
  CheckCircle,
  Clock,
  FlowArrow,
  Users,
} from "@phosphor-icons/react/dist/ssr"
import { OpsKpiCell } from "@/components/OpsKpiCell"

interface OpsExtras {
  invocations_24h: number | null
  invocations_30d: number | null
  cascade_success_rate: number | null
  pending_hitl: number | null
  /** Sprint 6 cleanup · counts clients with archived_at IS NULL. */
  active_clients: number | null
  tokens_24h: number | null
  tokens_30d: number | null
  spend_by_provider_30d: {
    anthropic: number | null
    openai: number | null
    other: number | null
  }
}

async function loadExtras(): Promise<OpsExtras> {
  // Server-component direct Supabase access · no HTTP round-trip ·
  // mirrors the same logic exposed at /api/dashboard/ops-extras for
  // external consumers (future cron / monitoring).
  const out: OpsExtras = {
    invocations_24h: null,
    invocations_30d: null,
    cascade_success_rate: null,
    pending_hitl: null,
    active_clients: null,
    tokens_24h: null,
    tokens_30d: null,
    spend_by_provider_30d: { anthropic: null, openai: null, other: null },
  }
  try {
    const supa = getServiceRoleClient()
    const now = Date.now()
    const t24h = new Date(now - 24 * 60 * 60 * 1000).toISOString()
    const t30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [count24, rows30, hitl, activeClients] = await Promise.all([
      supa
        .from("agent_invocations")
        .select("id", { count: "exact", head: true })
        .gte("started_at", t24h),
      supa
        .from("agent_invocations")
        .select("status, tokens_input, tokens_output, cost_usd, model, started_at")
        .gte("started_at", t30d),
      supa
        .from("hitl_approvals")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .then(
          (r) => r,
          () => ({ count: null as number | null, error: null }),
        ),
      supa
        .from("clients")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null),
    ])

    out.invocations_24h = count24.count ?? 0
    out.pending_hitl = hitl.count ?? null
    out.active_clients = activeClients.count ?? null

    if (rows30.data) {
      const total = rows30.data.length
      const completed = rows30.data.filter((r) => r.status === "completed").length
      out.invocations_30d = total
      out.cascade_success_rate =
        total > 0 ? +((completed / total) * 100).toFixed(1) : null

      let t30dSum = 0
      let t24hSum = 0
      let ant = 0
      let oai = 0
      let other = 0
      const cutoff24 = now - 24 * 60 * 60 * 1000
      for (const r of rows30.data) {
        const ti = (r.tokens_input as number) ?? 0
        const to = (r.tokens_output as number) ?? 0
        const tt = ti + to
        t30dSum += tt
        if (r.started_at && new Date(r.started_at).getTime() >= cutoff24) {
          t24hSum += tt
        }
        const cost = (r.cost_usd as number) ?? 0
        const model = ((r.model as string) ?? "").toLowerCase()
        if (model.startsWith("claude") || model.includes("anthropic")) ant += cost
        else if (model.startsWith("gpt") || model.includes("openai")) oai += cost
        else other += cost
      }
      out.tokens_24h = t24hSum
      out.tokens_30d = t30dSum
      out.spend_by_provider_30d = {
        anthropic: +ant.toFixed(3),
        openai: +oai.toFixed(3),
        other: +other.toFixed(3),
      }
    }
  } catch (e) {
    // Soft-fail · the grid renders with `null` placeholders rather than crash
    console.error("ops-extras direct fetch failed", e)
  }
  return out
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

// Cell rendering lives in OpsKpiCell (a client component). The parent
// server component passes only serializable primitives + ReactNode
// icon trees · no function callbacks cross the boundary.
const Cell = OpsKpiCell

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
  // Active clients = non-archived count from Supabase direct (preferred)
  // OR fall back to metrics endpoint clients_total (raw count including
  // archived) if Supabase direct failed.
  const activeClients =
    extras?.active_clients ?? metrics?.totals.clients_total ?? null
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
          icon={<Pulse strokeWidth={1.5} className="h-3.5 w-3.5" />}
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
          icon={<CurrencyDollar strokeWidth={1.5} className="h-3.5 w-3.5" />}
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
          icon={<CheckCircle strokeWidth={1.5} className="h-3.5 w-3.5" />}
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
          icon={<FlowArrow strokeWidth={1.5} className="h-3.5 w-3.5" />}
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
          value={activeClients}
          format="number"
          sub={
            metrics?.totals.agents_active != null
              ? `agents active · ${metrics.totals.agents_active} · 11 archived smoke/dupes`
              : undefined
          }
        />
      </div>
    </section>
  )
}
