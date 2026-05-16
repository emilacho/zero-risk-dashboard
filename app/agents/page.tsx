import { Suspense } from "react"
import Link from "next/link"
import { api, type AgentRow } from "@/lib/api"
import { Pill, ToolPill, formatCurrency, formatRelativeTime } from "@/lib/dashboard-components"
import { Header } from "@/components/Header"
import { Skeleton } from "@/components/Skeleton"

export const dynamic = "force-dynamic"

/**
 * Static role → tool inference. The platform endpoint doesn't ship a
 * `tools` field per agent · for the hierarchy view we infer from role.
 * Visual-only · doesn't change any wiring.
 */
const ROLE_TOOLS: Record<string, string[]> = {
  empleado:          ["anthropic", "supabase"],
  reviewer:          ["anthropic", "supabase"],
  "brand-strategist":["anthropic", "notion"],
  "content-creator": ["anthropic", "notion", "ghl"],
  "creative-director":["anthropic", "openai", "higgsfield"],
  "web-designer":    ["anthropic", "figma", "vercel"],
  "media-buyer":     ["anthropic", "meta", "google"],
  "seo-specialist":  ["anthropic", "dataforseo"],
  "social-media-strategist": ["anthropic", "ghl"],
  "competitive-intelligence-agent": ["anthropic", "apify"],
  "email-marketer":  ["anthropic", "ghl"],
  default:           ["anthropic"],
}

function inferTools(a: AgentRow): string[] {
  return ROLE_TOOLS[a.name] ?? ROLE_TOOLS[a.role] ?? ROLE_TOOLS.default
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function groupByRole(agents: AgentRow[]): Array<{ role: string; agents: AgentRow[] }> {
  const map = new Map<string, AgentRow[]>()
  for (const a of agents) {
    const arr = map.get(a.role) ?? []
    arr.push(a)
    map.set(a.role, arr)
  }
  const sortedRoles = Array.from(map.keys()).sort((a, b) => (map.get(b)?.length ?? 0) - (map.get(a)?.length ?? 0))
  return sortedRoles.map((role) => ({ role, agents: (map.get(role) ?? []).sort((x, y) => (y.stats_30d?.cost_usd ?? 0) - (x.stats_30d?.cost_usd ?? 0)) }))
}

async function AgentsHierarchy() {
  const data = await api.agents(100).catch(() => null)
  if (!data) {
    return (
      <p className="text-sm text-rose-300">
        Could not load agents · platform endpoint unreachable.
      </p>
    )
  }
  const groups = groupByRole(data.agents)
  return (
    <div className="flex flex-col gap-10">
      {groups.map((g) => (
        <section key={g.role} className="flex flex-col gap-4">
          {/* Role header · tree-root */}
          <header className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                role ↳
              </span>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {g.role}
              </h2>
              <Pill hue="cyan">{g.agents.length} agentes</Pill>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              total · ${g.agents.reduce((s, a) => s + (a.stats_30d?.cost_usd ?? 0), 0).toFixed(2)} · 30d
            </span>
          </header>
          {/* Branch container · vertical line on the left + leaves */}
          <div className="tree-branch flex flex-col gap-3">
            {g.agents.map((a) => (
              <div key={a.id} className="tree-leaf">
                <AgentRowCard agent={a} tools={inferTools(a)} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function AgentRowCard({ agent: a, tools }: { agent: AgentRow; tools: string[] }) {
  const status = a.status === "active" ? "emerald" : a.status === "paused" ? "amber" : "muted"
  const sessions = a.stats_30d?.sessions ?? 0
  const tokens = (a.stats_30d?.tokens_input ?? 0) + (a.stats_30d?.tokens_output ?? 0)
  const cost = a.stats_30d?.cost_usd ?? 0
  const last = a.stats_30d?.last_activity
  return (
    <Link
      href={`/agents/${a.name}`}
      data-hue="cyan"
      data-pop="true"
      className="surface-card block p-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
        {/* Left · identity + chips */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              aria-label={`status ${a.status}`}
              className={[
                "inline-flex h-2 w-2 rounded-full",
                a.status === "active" ? "bg-emerald-400 animate-pulse-dot"
                : a.status === "paused" ? "bg-amber-400" : "bg-zinc-500",
              ].join(" ")}
            />
            <span className="font-display text-[15px] font-semibold leading-none">
              {a.display_name}
            </span>
            <code className="font-mono text-[11px] text-muted-foreground">{a.name}</code>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill hue="violet">{a.model}</Pill>
            <Pill hue={status as "emerald" | "amber" | "muted"}>{a.status}</Pill>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground ml-1">
              tools ↳
            </span>
            {tools.map((t) => (
              <ToolPill key={t} tool={t} />
            ))}
          </div>
        </div>

        {/* Right · stats matrix */}
        <div className="flex flex-wrap items-center gap-4 md:gap-5">
          <Stat label="sessions" value={sessions.toString()} />
          <Stat label="tokens" value={fmtTokens(tokens)} />
          <Stat label="cost 30d" value={formatCurrency(cost, { compact: true })} />
          <Stat
            label="last"
            value={last ? formatRelativeTime(last) : "—"}
            suppressHydration={!!last}
          />
        </div>
      </div>
    </Link>
  )
}

function Stat({
  label,
  value,
  suppressHydration,
}: {
  label: string
  value: string
  suppressHydration?: boolean
}) {
  return (
    <div className="flex min-w-[64px] flex-col gap-0.5 text-right">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span
        className="font-mono text-[13px] font-semibold tabular-nums"
        suppressHydrationWarning={suppressHydration}
      >
        {value}
      </span>
    </div>
  )
}

export default function AgentsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 pb-16 pt-10">
        <section className="mb-10 flex flex-col gap-3">
          <span className="eyebrow-chip self-start">Hierarchy · agentes</span>
          <h1 className="font-display text-[40px] font-semibold leading-[1.05] tracking-tight md:text-[52px]">
            <span className="text-gradient">Plantilla agéntica</span>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Agentes agrupados por role · cada nodo expone model · status · tools
            integradas · sessions y tokens últimos 30d · click para abrir el
            detail.
          </p>
        </section>
        <Suspense fallback={<Skeleton kind="page" />}>
          <AgentsHierarchy />
        </Suspense>
      </main>
    </>
  )
}
