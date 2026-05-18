/**
 * Dept · CSM · Client Success.
 *
 * 2 operational clients (Náufrago + Seg Industrial Pérez · canon
 * correction 2026-05-17 · Xavier purged). Per-client KPI cards +
 * journey state placeholder + HITL pending + health score.
 */
import Link from "next/link"
import {
  Users,
  Compass,
  Clock,
  Pulse,
  ArrowSquareOut,
} from "@phosphor-icons/react/dist/ssr"
import { api } from "@/lib/api"
import { OpsKpiCell } from "@/components/OpsKpiCell"
import { ClickableSummaryCard } from "@/components/ui/ClickableSummaryCard"
import { getServiceRoleClient } from "@/lib/supabase-server"

async function loadJourneyAndHitl() {
  try {
    const supa = getServiceRoleClient()
    const [journey, hitl] = await Promise.all([
      supa
        .from("journey_executions")
        .select("client_id, journey_state, stage, last_activity_at")
        .is("completed_at", null),
      supa
        .from("hitl_approvals")
        .select("id, client_id, status", { count: "exact" })
        .eq("status", "pending"),
    ])
    return {
      journeyByClient: new Map(
        (journey.data ?? []).map((j) => [j.client_id as string, j]),
      ),
      hitlByClient: new Map<string, number>(
        (hitl.data ?? []).reduce((m: [string, number][], row) => {
          const cid = (row.client_id as string) ?? ""
          if (!cid) return m
          const existing = m.find((e) => e[0] === cid)
          if (existing) existing[1] += 1
          else m.push([cid, 1])
          return m
        }, []),
      ),
      hitlTotal: hitl.count ?? 0,
    }
  } catch {
    return { journeyByClient: new Map(), hitlByClient: new Map(), hitlTotal: 0 }
  }
}

export async function DeptCsmBody() {
  const clientsRes = await api.clients(100)
  const { journeyByClient, hitlByClient, hitlTotal } = await loadJourneyAndHitl()
  const activeInvocations = clientsRes.clients.reduce(
    (s, c) => s + c.stats.invocations,
    0,
  )
  const totalSpend = clientsRes.clients.reduce(
    (s, c) => s + c.stats.total_spend_usd,
    0,
  )

  return (
    <div className="flex flex-col gap-8">
      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <OpsKpiCell
          label="Active clients"
          icon={<Users strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={clientsRes.count}
          format="number"
          sub="archived_at IS NULL · post Sprint 6 cleanup"
        />
        <OpsKpiCell
          label="Invocations 30d"
          icon={<Pulse strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={activeInvocations}
          format="number"
          sub={`spend 30d · $${totalSpend.toFixed(3)}`}
        />
        <ClickableSummaryCard
          title="Pending HITL"
          count={hitlTotal}
          hue="rose"
          icon={<Clock strokeWidth={1.5} className="h-3.5 w-3.5" />}
          sub={
            hitlTotal === 0
              ? "0 items · runtime emisión pending"
              : "click → ver lista por cliente"
          }
          modalDescription="hitl_approvals con status=pending · agrupado por cliente"
          seeAllHref="/system/inbox"
          items={Array.from(hitlByClient.entries()).map(([cid, count]) => {
            const client = clientsRes.clients.find((c) => c.id === cid)
            return {
              primary: client?.name ?? cid.slice(0, 8),
              secondary: `${count} pending`,
              tertiary: `cliente · ${cid.slice(0, 8)}`,
              status: count > 0 ? "pending" : "ok",
              href: `/clients/${cid}`,
            }
          })}
        />
        <OpsKpiCell
          label="Journey active"
          icon={<Compass strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={journeyByClient.size}
          format="number"
          sub={`${clientsRes.count} clients · ${clientsRes.count - journeyByClient.size} sin journey aún`}
        />
      </div>

      {/* Per-client breakdown */}
      <section className="surface-card rim-instr p-5" data-rim="emerald">
        <div className="relative z-[2]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Clientes operativos · {clientsRes.count}
            </h2>
            <Link
              href="/clients"
              className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
            >
              → portfolio
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {clientsRes.clients.map((c) => {
              const journey = journeyByClient.get(c.id) as
                | { journey_state: string; stage: string | null; last_activity_at: string | null }
                | undefined
              const hitlCount = hitlByClient.get(c.id) ?? 0
              const health = Math.min(100, c.stats.invocations * 5)
              return (
                <Link
                  key={c.id}
                  href={`/clients/${c.id}`}
                  className="surface-card rim-instr p-4 transition hover:scale-[1.005]"
                  data-rim="emerald"
                  data-pop="true"
                >
                  <div className="relative z-[2] flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                          {c.status} · {c.industry ?? "—"}
                        </p>
                        <h3 className="mt-1 font-display text-lg font-semibold leading-tight">
                          {c.name}
                        </h3>
                      </div>
                      <ArrowSquareOut
                        strokeWidth={1.5}
                        className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]"
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      <div>
                        <p className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                          spend 30d
                        </p>
                        <p className="num text-sm font-semibold tabular-nums">
                          ${c.stats.total_spend_usd.toFixed(3)}
                        </p>
                      </div>
                      <div>
                        <p className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                          invs 30d
                        </p>
                        <p className="num text-sm font-semibold tabular-nums">
                          {c.stats.invocations}
                        </p>
                      </div>
                      <div>
                        <p className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                          hitl pending
                        </p>
                        <p
                          className="num text-sm font-semibold tabular-nums"
                          style={{
                            color:
                              hitlCount > 0
                                ? "hsl(var(--danger))"
                                : "hsl(var(--success))",
                          }}
                        >
                          {hitlCount}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="num text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                        journey ·
                      </span>
                      {journey ? (
                        <span
                          className="num text-[10px] uppercase tracking-[0.18em]"
                          style={{ color: "hsl(var(--accent))" }}
                        >
                          {journey.journey_state}
                          {journey.stage ? ` / ${journey.stage}` : ""}
                        </span>
                      ) : (
                        <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--danger))]">
                          no journey · platform write pending
                        </span>
                      )}
                    </div>
                    {/* health bar */}
                    <div className="mt-1">
                      <div className="flex items-center justify-between">
                        <span className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                          health
                        </span>
                        <span className="num text-[10px] tabular-nums">{health}/100</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[hsl(var(--muted)/0.4)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${health}%`,
                            background:
                              health >= 70
                                ? "hsl(var(--success))"
                                : health >= 40
                                  ? "hsl(var(--hue-amber))"
                                  : "hsl(var(--danger))",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Owner note */}
      <section className="surface-card rim-instr p-4" data-rim="cyan">
        <div className="relative z-[2] flex items-center gap-3">
          <span
            className="num text-[10px] uppercase tracking-[0.2em]"
            style={{ color: "hsl(var(--accent))" }}
          >
            Canon 2026-05-17
          </span>
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
            Seg Industrial Pérez · owner único Emilio Pérez. Xavier
            Pérez NO existe (figura ficticia · purged in canon update).
          </p>
        </div>
      </section>
    </div>
  )
}
