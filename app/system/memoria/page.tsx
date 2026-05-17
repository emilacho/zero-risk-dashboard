import { api } from "@/lib/api"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

async function loadMemoriaData() {
  const supa = getServiceRoleClient()
  const [agentsRes, clientsRes, invocations30d] = await Promise.all([
    api.agents(200).catch(() => null),
    api.clients(100).catch(() => null),
    supa
      .from("agent_invocations")
      .select("id", { count: "exact", head: true })
      .gte(
        "started_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      ),
  ])
  return {
    agentsCount: agentsRes?.count ?? 0,
    clientsCount: clientsRes?.count ?? 0,
    invocations30d: invocations30d.count ?? 0,
  }
}

export default async function SystemMemoriaTab() {
  const d = await loadMemoriaData()

  return (
    <div className="flex flex-col gap-6">
      <span className="eyebrow-chip">
        <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
        Memoria · vault · memory graph · skills canonical
      </span>

      {/* Memory graph KPIs */}
      <section className="surface-card rim-instr p-5" data-rim="lime">
        <div className="relative z-[2]">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Memory Graph · live counts
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="num text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                agents
              </p>
              <p className="num font-display text-xl font-semibold tabular-nums">
                {d.agentsCount}
              </p>
            </div>
            <div>
              <p className="num text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                clients
              </p>
              <p className="num font-display text-xl font-semibold tabular-nums">
                {d.clientsCount}
              </p>
            </div>
            <div>
              <p className="num text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                relationships 30d
              </p>
              <p className="num font-display text-xl font-semibold tabular-nums">
                {d.invocations30d}
              </p>
            </div>
            <div>
              <p className="num text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                renderer
              </p>
              <p className="num text-[12px] text-[hsl(var(--muted-foreground))]">
                /graph · cardinal grid-pack
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Vault */}
      <section className="surface-card rim-instr p-5" data-rim="lime">
        <div className="relative z-[2]">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Obsidian Vault · `zr-vault/`
          </h2>
          <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
            Knowledge base local · OneDrive synced cross-laptop (Lenovo ↔
            HP3) · LLM-readable atomic notes + Karpathy-style wiki.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
            <VaultStat label="raw/" sub="chats · state · handoffs · findings" hint="~80 docs" />
            <VaultStat label="wiki/concepts/" sub="atomic notes" hint="~30 notes" />
            <VaultStat label="wiki/decisions/" sub="timestamped" hint="~25 entries" />
            <VaultStat label="wiki/playbooks/" sub="how-to patterns" hint="~10 docs" />
            <VaultStat label="wiki/people/" sub="actors profiles" hint="sparse · early" />
            <VaultStat label="00-meta/" sub="CLAUDE.md · PROCESSING_LOG" hint="active" />
          </div>
          <p className="num mt-4 text-[10px] text-[hsl(var(--muted-foreground))]">
            wire pending · server filesystem read NOT exposed via dashboard
            yet · count above is Tier-3 estimate per architecture doc.
          </p>
        </div>
      </section>

      {/* Skills canonical */}
      <section className="surface-card rim-instr p-5" data-rim="emerald">
        <div className="relative z-[2]">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Skills canonical · sources
          </h2>
          <ul className="mt-3 space-y-2 text-[12px]">
            <SkillSource
              repo="github.com/msitarzewski/agency-agents"
              stars="~97K★"
              note="canonical seed · 38 managed_agents_registry rows"
            />
            <SkillSource
              repo="marketingskills (19K★)"
              stars="19K★"
              note="marketing-specific skills mirror"
            />
            <SkillSource
              repo="bmad-marketing-growth (Max Growth)"
              stars="—"
              note="growth playbooks"
            />
            <SkillSource
              repo="stitch-skills (google-labs-code)"
              stars="—"
              note="web design skills · used by web-designer agent"
            />
            <SkillSource repo="21st.dev" stars="—" note="UI components library" />
          </ul>
        </div>
      </section>
    </div>
  )
}

function VaultStat({ label, sub, hint }: { label: string; sub: string; hint: string }) {
  return (
    <div className="rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] p-3">
      <p className="font-mono text-[12px] text-[hsl(var(--accent))]">{label}</p>
      <p className="num mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{sub}</p>
      <p className="num mt-2 text-[11px] text-[hsl(var(--foreground))]">{hint}</p>
    </div>
  )
}

function SkillSource({ repo, stars, note }: { repo: string; stars: string; note: string }) {
  return (
    <li className="flex items-center justify-between rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] px-3 py-2">
      <div className="min-w-0">
        <p className="font-mono text-[12px] text-[hsl(var(--accent))]">{repo}</p>
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{note}</p>
      </div>
      <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        {stars}
      </span>
    </li>
  )
}
