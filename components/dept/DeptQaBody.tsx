/**
 * Dept · QA · Producción & Calidad (Camino III).
 *
 * QA agents: editor_en_jefe · spell-check-corrector · style-consistency-
 * reviewer · delivery-coordinator · optimization-agent.
 *
 * Camino III voting rollup · reviews stored embedded in agent_invocations
 * metadata for now (cascade_runs.cascade_stages will hold canonical
 * once runtime writes start). Surface placeholders + the data we DO have.
 */
import Link from "next/link"
import {
  ShieldCheck,
  CheckCircle2,
  RefreshCcw,
  AlertOctagon,
  Type,
} from "lucide-react"
import { api } from "@/lib/api"
import { classifyAgent } from "@/lib/departments"
import { OpsKpiCell } from "@/components/OpsKpiCell"

export async function DeptQaBody() {
  const agentsRes = await api.agents(200)
  const qaAgents = agentsRes.agents.filter((a) => classifyAgent(a) === "qa")
  const qaSessions = qaAgents.reduce(
    (s, a) => s + (a.stats_30d?.sessions ?? 0),
    0,
  )
  const qaCost = qaAgents.reduce(
    (s, a) => s + (a.stats_30d?.cost_usd ?? 0),
    0,
  )

  const spellCheck = qaAgents.find((a) => a.name === "spell-check-corrector")
  const styleConsistency = qaAgents.find(
    (a) => a.name === "style-consistency-reviewer",
  )
  const editorEnJefe = qaAgents.find((a) => a.name === "editor_en_jefe")

  return (
    <div className="flex flex-col gap-8">
      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <OpsKpiCell
          label="QA agents · 30d"
          icon={<ShieldCheck strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={qaAgents.length}
          format="number"
          sub={`${qaSessions} sesiones · $${qaCost.toFixed(3)}`}
        />
        <OpsKpiCell
          label="Approve rate"
          icon={<CheckCircle2 strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={null}
          format="percent"
          badge="wire pending"
          sub="metadata.review_verdict rollup needed"
        />
        <OpsKpiCell
          label="Revision rate"
          icon={<RefreshCcw strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={null}
          format="percent"
          badge="wire pending"
          sub="revisions / total reviews"
        />
        <OpsKpiCell
          label="Time-to-publish p50"
          icon={<AlertOctagon strokeWidth={1.5} className="h-3.5 w-3.5" />}
          value={null}
          format="number"
          badge="wire pending"
          sub="cascade_runs.duration_ms median"
        />
      </div>

      {/* Camino III · 3-of-N voting */}
      <section className="surface-card rim-instr p-5" data-rim="rose">
        <div className="relative z-[2]">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Camino III · 3-of-N voting
          </h2>
          <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
            Reviews ejecutadas por editor_en_jefe + style-consistency-reviewer +
            spell-check-corrector dentro del cascade Phase 2. Verdicts persistidos
            en `agent_invocations.metadata.review_verdict`. Aggregate rollup ·
            pending materialized view sobre la metadata jsonb.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <ReviewerTile
              agent={editorEnJefe}
              label="editor_en_jefe"
              role="QA jefe · semantic + structure"
            />
            <ReviewerTile
              agent={styleConsistency}
              label="style-consistency-reviewer"
              role="brand voice + tone enforcement"
            />
            <ReviewerTile
              agent={spellCheck}
              label="spell-check-corrector"
              role="Haiku · cheap orthography pass"
            />
          </div>
        </div>
      </section>

      {/* All QA agents */}
      <section className="surface-card rim-instr p-5" data-rim="rose">
        <div className="relative z-[2]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold tracking-tight">
              QA agents · plantilla
            </h2>
            <Link
              href="/agents"
              className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
            >
              → full agents
            </Link>
          </div>
          {qaAgents.length === 0 ? (
            <p className="num text-xs text-[hsl(var(--muted-foreground))]">
              No QA agents classified.
            </p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border)/0.6)]">
              {qaAgents.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/agents/${a.name}`}
                      className="font-mono text-[12px] text-[hsl(var(--accent))] hover:underline"
                    >
                      {a.name}
                    </Link>
                    <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                      {a.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="num text-[hsl(var(--muted-foreground))]">
                      {a.stats_30d?.sessions ?? 0} sess
                    </span>
                    <span className="num">${(a.stats_30d?.cost_usd ?? 0).toFixed(3)}</span>
                    <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                      {a.model.includes("haiku") ? (
                        <Type strokeWidth={1.5} className="inline h-3 w-3" />
                      ) : null}{" "}
                      {a.model}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function ReviewerTile({
  agent,
  label,
  role,
}: {
  agent: { stats_30d?: { sessions?: number; cost_usd?: number }; model?: string } | undefined
  label: string
  role: string
}) {
  return (
    <div className="rounded-lg border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] p-3">
      <p className="font-mono text-[12px] text-[hsl(var(--accent))]">{label}</p>
      <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{role}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          30d · sess
        </span>
        <span className="num text-sm font-semibold tabular-nums">
          {agent?.stats_30d?.sessions ?? 0}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          spend
        </span>
        <span className="num text-sm font-semibold tabular-nums">
          ${(agent?.stats_30d?.cost_usd ?? 0).toFixed(4)}
        </span>
      </div>
      <p className="mt-1 num text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        {agent?.model ?? "—"}
      </p>
    </div>
  )
}
