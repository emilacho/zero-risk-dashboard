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
  Banknote,
  TrendingUp,
  PiggyBank,
} from "lucide-react"
import { OpsKpiCell } from "@/components/OpsKpiCell"

interface ProviderSpend {
  anthropic: number
  openai: number
  other: number
}

async function loadFinRollup() {
  const out = {
    spend30d: 0,
    spendTotal: 0,
    providerBreakdown: { anthropic: 0, openai: 0, other: 0 } as ProviderSpend,
    perClient: [] as Array<{ client_id: string; cost: number; count: number }>,
    perAgentTop: [] as Array<{ agent_name: string; cost: number; count: number }>,
  }
  try {
    const supa = getServiceRoleClient()
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const [allRes, recentRes] = await Promise.all([
      supa.from("agent_invocations").select("cost_usd, model"),
      supa
        .from("agent_invocations")
        .select("cost_usd, model, client_id, agent_name, started_at")
        .gte("started_at", since30),
    ])
    out.spendTotal = (allRes.data ?? []).reduce(
      (s, r) => s + Number(r.cost_usd ?? 0),
      0,
    )
    const byClient = new Map<string, { cost: number; count: number }>()
    const byAgent = new Map<string, { cost: number; count: number }>()
    for (const r of recentRes.data ?? []) {
      const cost = Number(r.cost_usd ?? 0)
      const model = ((r.model as string) ?? "").toLowerCase()
      out.spend30d += cost
      if (model.startsWith("claude") || model.includes("anthropic"))
        out.providerBreakdown.anthropic += cost
      else if (model.startsWith("gpt") || model.includes("openai"))
        out.providerBreakdown.openai += cost
      else out.providerBreakdown.other += cost
      const cid = (r.client_id as string) ?? "_unassigned"
      const cur = byClient.get(cid) ?? { cost: 0, count: 0 }
      cur.cost += cost
      cur.count += 1
      byClient.set(cid, cur)
      const aname = (r.agent_name as string) ?? "_unknown"
      const acur = byAgent.get(aname) ?? { cost: 0, count: 0 }
      acur.cost += cost
      acur.count += 1
      byAgent.set(aname, acur)
    }
    out.perClient = [...byClient.entries()]
      .map(([client_id, v]) => ({ client_id, cost: v.cost, count: v.count }))
      .sort((a, b) => b.cost - a.cost)
    out.perAgentTop = [...byAgent.entries()]
      .map(([agent_name, v]) => ({ agent_name, cost: v.cost, count: v.count }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)
  } catch (e) {
    console.error("fin rollup failed", e)
  }
  return out
}

export async function DeptFinBody() {
  const [fin, clientsRes] = await Promise.all([
    loadFinRollup(),
    api.clients(100),
  ])
  const clientNameById = new Map(clientsRes.clients.map((c) => [c.id, c.name]))

  return (
    <div className="flex flex-col gap-8">
      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <OpsKpiCell
          label="Spend 30d"
          icon={<Coins strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={fin.spend30d}
          format="currency"
          sub={`total acumulado · $${fin.spendTotal.toFixed(3)}`}
        />
        <OpsKpiCell
          label="Anthropic 30d"
          icon={<Banknote strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={fin.providerBreakdown.anthropic}
          format="currency"
          sub={`${(((fin.providerBreakdown.anthropic / Math.max(0.0001, fin.spend30d)) * 100) || 0).toFixed(1)}% del total`}
        />
        <OpsKpiCell
          label="OpenAI 30d"
          icon={<Banknote strokeWidth={1.5} className="h-3.5 w-3.5" />}
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

      {/* Per-client spend */}
      <section className="surface-card rim-instr p-5" data-rim="amber">
        <div className="relative z-[2]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Spend por cliente · 30d
            </h2>
            <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
              {fin.perClient.length} buckets · {fin.perClient.reduce((s, p) => s + p.count, 0)} invocations
            </span>
          </div>
          {fin.perClient.length === 0 ? (
            <p className="num text-xs text-[hsl(var(--muted-foreground))]">
              No invocations recorded 30d.
            </p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border)/0.6)]">
              {fin.perClient.map((p) => (
                <li key={p.client_id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[11px] text-[hsl(var(--accent))]">
                      {clientNameById.get(p.client_id) ?? "(unassigned · " + p.client_id.slice(0, 8) + ")"}
                    </span>
                    <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                      {p.count} inv
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="num text-[11px] tabular-nums">${p.cost.toFixed(4)}</span>
                    {/* mini bar */}
                    <div className="relative h-1 w-24 overflow-hidden rounded-full bg-[hsl(var(--muted)/0.4)]">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(100, (p.cost / Math.max(0.0001, fin.spend30d)) * 100)}%`,
                          background: "hsl(var(--hue-amber))",
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Per-agent top spend */}
      <section className="surface-card rim-instr p-5" data-rim="violet">
        <div className="relative z-[2]">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp strokeWidth={1.5} className="h-4 w-4" />
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
