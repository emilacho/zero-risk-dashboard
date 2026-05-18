/**
 * Dept · FIN · Finanzas.
 *
 * Derived view · no agents owned directly. Surfaces spend 30d total
 * + provider breakdown + per-client spend + MRR placeholder + Anthropic
 * credit balance (wire pending until ANTHROPIC_ADMIN_TOKEN env set).
 */
import { getServiceRoleClient } from "@/lib/supabase-server"
import { api } from "@/lib/api"
import {
  Coins,
  CurrencyDollar,
  TrendUp,
  PiggyBank,
} from "@phosphor-icons/react/dist/ssr"
import { OpsKpiCell } from "@/components/OpsKpiCell"
import { ClickableSummaryCard } from "@/components/ui/ClickableSummaryCard"
import { SpendBreakdownTabs } from "@/components/dept/SpendBreakdownTabs"
import {
  buildBreakdown,
  type RawInvocationRow,
  type BreakdownBucket,
} from "@/lib/spend-classifier"

interface ProviderSpend {
  anthropic: number
  openai: number
  other: number
}

async function loadFinRollup(clientNameById: Map<string, string>) {
  const out = {
    spend30d: 0,
    spendTotal: 0,
    providerBreakdown: { anthropic: 0, openai: 0, other: 0 } as ProviderSpend,
    byClient: [] as BreakdownBucket[],
    byAgent: [] as BreakdownBucket[],
    byService: [] as BreakdownBucket[],
    byBrazo: [] as BreakdownBucket[],
    perAgentTop: [] as Array<{ agent_name: string; cost: number; count: number }>,
  }
  try {
    const supa = getServiceRoleClient()
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const [allRes, recentRes] = await Promise.all([
      supa.from("agent_invocations").select("cost_usd, model"),
      supa
        .from("agent_invocations")
        .select("cost_usd, model, client_id, agent_name, status, metadata, started_at")
        .gte("started_at", since30),
    ])
    out.spendTotal = (allRes.data ?? []).reduce(
      (s, r) => s + Number(r.cost_usd ?? 0),
      0,
    )
    const rows = (recentRes.data ?? []) as RawInvocationRow[]
    const byAgentSimple = new Map<string, { cost: number; count: number }>()
    for (const r of rows) {
      const cost = Number(r.cost_usd ?? 0)
      const model = ((r.model as string) ?? "").toLowerCase()
      out.spend30d += cost
      if (model.startsWith("claude") || model.includes("anthropic"))
        out.providerBreakdown.anthropic += cost
      else if (model.startsWith("gpt") || model.includes("openai"))
        out.providerBreakdown.openai += cost
      else out.providerBreakdown.other += cost
      const aname = (r.agent_name as string) ?? "_unknown"
      const acur = byAgentSimple.get(aname) ?? { cost: 0, count: 0 }
      acur.cost += cost
      acur.count += 1
      byAgentSimple.set(aname, acur)
    }
    // Multi-dim breakdown via shared classifier · Phase 4 safe (server-side compute)
    out.byClient = buildBreakdown(rows, clientNameById, "client")
    out.byAgent = buildBreakdown(rows, clientNameById, "agent")
    out.byService = buildBreakdown(rows, clientNameById, "service")
    out.byBrazo = buildBreakdown(rows, clientNameById, "brazo")
    out.perAgentTop = [...byAgentSimple.entries()]
      .map(([agent_name, v]) => ({ agent_name, cost: v.cost, count: v.count }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)
  } catch (e) {
    console.error("fin rollup failed", e)
  }
  return out
}

export async function DeptFinBody() {
  const clientsRes = await api.clients(100)
  const clientNameById = new Map(clientsRes.clients.map((c) => [c.id, c.name]))
  const fin = await loadFinRollup(clientNameById)

  return (
    <div className="flex flex-col gap-8">
      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ClickableSummaryCard
          title="Spend 30d"
          count={fin.perAgentTop.length}
          displayValue={`$${fin.spend30d.toFixed(2)}`}
          hue="amber"
          icon={<Coins strokeWidth={1.5} className="h-3.5 w-3.5" />}
          sub={`total acumulado · $${fin.spendTotal.toFixed(3)} · click → top 10 agents por spend`}
          modalDescription="Top agents por spend 30d · sumando todos los clientes"
          seeAllHref="/system/agents"
          items={fin.perAgentTop.map((a, i) => ({
            primary: a.agent_name,
            secondary: `#${i + 1}`,
            tertiary: `$${a.cost.toFixed(4)} · ${a.count} invocations`,
            status: "ok",
            href: `/agents/${a.agent_name}`,
          }))}
        />
        <OpsKpiCell
          label="Anthropic 30d"
          icon={<CurrencyDollar strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={fin.providerBreakdown.anthropic}
          format="currency"
          sub={`${(((fin.providerBreakdown.anthropic / Math.max(0.0001, fin.spend30d)) * 100) || 0).toFixed(1)}% del total`}
        />
        <OpsKpiCell
          label="OpenAI 30d"
          icon={<CurrencyDollar strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={fin.providerBreakdown.openai}
          format="currency"
          sub={`GPT Image vía Vercel AI Gateway`}
        />
        <OpsKpiCell
          label="Anthropic credit"
          icon={<PiggyBank strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={null}
          badge="wire pending"
          sub="ANTHROPIC_ADMIN_TOKEN env pending"
        />
      </div>

      {/* Multi-dim spend breakdown · Phase 4.1 safe · 4 tabs · Cliente/Agente/Servicio/Brazo */}
      <SpendBreakdownTabs
        totalSpend={fin.spend30d}
        byClient={fin.byClient}
        byAgent={fin.byAgent}
        byService={fin.byService}
        byBrazo={fin.byBrazo}
      />

      {/* Per-agent top spend */}
      <section className="surface-card rim-instr p-5" data-rim="violet">
        <div className="relative z-[2]">
          <div className="mb-3 flex items-center gap-2">
            <TrendUp strokeWidth={1.5} className="h-4 w-4" />
            <h2 className="font-display text-base font-semibold tracking-tight">
              Top 10 agents por spend · 30d
            </h2>
          </div>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {fin.perAgentTop.map((a, i) => (
              <li
                key={a.agent_name}
                className="flex items-center justify-between rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] px-3 py-2"
              >
                <span className="font-mono text-[11px] text-[hsl(var(--accent))]">
                  #{i + 1} {a.agent_name}
                </span>
                <span className="num text-[11px] tabular-nums">
                  ${a.cost.toFixed(4)} · {a.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* MRR / cash placeholder */}
      <section className="surface-card rim-instr p-5" data-rim="rose">
        <div className="relative z-[2]">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Revenue · MRR · cash position
          </h2>
          <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
            <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--danger))]">
              wire pending
            </span>{" "}
            · GHL invoice/subscription pull + bank API · current view only
            shows AI spend (cost side). Revenue side · activable cuando
            primer cliente real (Náufrago + Seg Industrial Pérez) firme
            contrato + billing landar en GHL.
          </p>
        </div>
      </section>
    </div>
  )
}
