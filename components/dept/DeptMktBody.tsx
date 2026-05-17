/**
 * Dept · MKT · Marketing.
 *
 * Agents: 17+ (paid_media · marketing_* · jefe-marketing · creative-
 * director · content-creator · etc). KPIs from current invocation
 * activity + placeholder cards for Brazo 3 (Meta Ads) · IG metrics ·
 * landing v2 traffic · email GHL (all "wire pending" until each
 * channel is wired).
 */
import Link from "next/link"
import {
  Megaphone,
  Instagram,
  MousePointerClick,
  Mail,
  Ticket,
  Activity,
} from "lucide-react"
import { api } from "@/lib/api"
import { classifyAgent } from "@/lib/departments"
import { OpsKpiCell } from "@/components/OpsKpiCell"

export async function DeptMktBody() {
  const agentsRes = await api.agents(200)
  const mktAgents = agentsRes.agents.filter((a) => classifyAgent(a) === "mkt")
  const mktSessions = mktAgents.reduce(
    (s, a) => s + (a.stats_30d?.sessions ?? 0),
    0,
  )
  const mktCost = mktAgents.reduce(
    (s, a) => s + (a.stats_30d?.cost_usd ?? 0),
    0,
  )
  const active = mktAgents.filter((a) => (a.stats_30d?.sessions ?? 0) > 0)

  return (
    <div className="flex flex-col gap-8">
      {/* KPI bar · 4 cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <OpsKpiCell
          label="MKT agents active"
          icon={<Activity strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={active.length}
          format="number"
          sub={`${mktAgents.length} total · utilization ${((active.length / Math.max(1, mktAgents.length)) * 100).toFixed(1)}%`}
        />
        <OpsKpiCell
          label="MKT spend 30d"
          icon={<Megaphone strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={mktCost}
          format="currency"
          sub={`${mktSessions} sesiones 30d`}
        />
        <OpsKpiCell
          label="Meta campaigns"
          icon={<MousePointerClick strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={null}
          badge="wire pending"
          sub="Brazo 3 · post Facebook App build"
        />
        <OpsKpiCell
          label="IG followers"
          icon={<Instagram strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={null}
          badge="wire pending"
          sub="Meta Graph API"
        />
      </div>

      {/* Channels */}
      <section className="surface-card rim-instr p-5" data-rim="cyan">
        <div className="relative z-[2]">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Canales · status snapshot
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <ChannelTile
              icon={<MousePointerClick strokeWidth={1.5} className="h-4 w-4" />}
              title="Meta Ads (Brazo 3)"
              status="build"
              note="Facebook Developers App pending · spec ready"
            />
            <ChannelTile
              icon={<Instagram strokeWidth={1.5} className="h-4 w-4" />}
              title="IG organic · @naufrago"
              status="manual"
              note="Posts cliente piloto · metrics pull pending GHL Social wire"
            />
            <ChannelTile
              icon={<Ticket strokeWidth={1.5} className="h-4 w-4" />}
              title="Landing v2 · Náufrago"
              status="live"
              note="ticker promo active · client-sites-template deployed"
            />
            <ChannelTile
              icon={<Mail strokeWidth={1.5} className="h-4 w-4" />}
              title="Email · GHL Unlimited"
              status="ready"
              note="$297/mo subscription · sequences not yet authored"
            />
          </div>
        </div>
      </section>

      {/* Active MKT agents */}
      <section className="surface-card rim-instr p-5" data-rim="cyan">
        <div className="relative z-[2]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold tracking-tight">
              MKT agents · activos 30d
            </h2>
            <Link
              href="/agents"
              className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
            >
              → full agents
            </Link>
          </div>
          {active.length === 0 ? (
            <p className="num text-xs text-[hsl(var(--muted-foreground))]">
              No MKT invocations 30d.
            </p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border)/0.6)]">
              {active
                .sort(
                  (a, b) => (b.stats_30d?.sessions ?? 0) - (a.stats_30d?.sessions ?? 0),
                )
                .map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5">
                    <Link
                      href={`/agents/${a.name}`}
                      className="font-mono text-[12px] text-[hsl(var(--accent))] hover:underline"
                    >
                      {a.name}
                    </Link>
                    <div className="flex items-center gap-4 text-[11px]">
                      <span className="num text-[hsl(var(--muted-foreground))]">
                        {a.stats_30d?.sessions ?? 0} sess
                      </span>
                      <span className="num">${(a.stats_30d?.cost_usd ?? 0).toFixed(3)}</span>
                      <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                        {a.model}
                      </span>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </section>

      {/* Idle MKT agents */}
      <section className="surface-card rim-instr p-5" data-rim="muted">
        <div className="relative z-[2]">
          <h2 className="font-display text-base font-semibold tracking-tight">
            MKT plantilla idle · {mktAgents.length - active.length} agents
          </h2>
          <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
            Sobre-aprovisionados para flujos actuales · esperan activación
            de Brazo 3 (paid_media_*) o flujos automáticos cliente.
          </p>
        </div>
      </section>
    </div>
  )
}

function ChannelTile({
  icon,
  title,
  status,
  note,
}: {
  icon: React.ReactNode
  title: string
  status: "live" | "build" | "ready" | "manual"
  note: string
}) {
  const statusColor: Record<typeof status, string> = {
    live: "hsl(var(--success))",
    build: "hsl(var(--hue-amber))",
    ready: "hsl(var(--accent))",
    manual: "hsl(var(--muted-foreground))",
  }
  return (
    <div className="flex items-start gap-3 rounded-lg border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] p-3">
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{
          background: `${statusColor[status]} / 0.12`,
          color: statusColor[status],
        }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold">{title}</span>
          <span
            className="num rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em]"
            style={{
              color: statusColor[status],
              background: `color-mix(in srgb, ${statusColor[status]} 12%, transparent)`,
            }}
          >
            {status}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
          {note}
        </p>
      </div>
    </div>
  )
}
