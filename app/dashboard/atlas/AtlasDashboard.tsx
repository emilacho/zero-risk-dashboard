"use client"
/**
 * AtlasDashboard · client island scaffold.
 *
 * Sprint 2 scaffold · placeholder shell que CC#4 reemplaza con
 * componentes v2 sobrio. Acepta `initialData` del server component +
 * usa TanStack Query hooks para refresh client-side. Renderiza 7
 * secciones stub correspondientes a las streams Tier 1.
 */
import { useAtlasSnapshot } from "./hooks/useAtlasSnapshot"
import type { AtlasSnapshotResponse } from "./types"

interface AtlasDashboardProps {
  initialSnapshot: AtlasSnapshotResponse | null
}

export function AtlasDashboard({ initialSnapshot }: AtlasDashboardProps) {
  const { data, isLoading, isError, error, refetch } = useAtlasSnapshot(
    initialSnapshot ?? undefined,
  )

  if (isLoading && !data) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Loading snapshot...
      </p>
    )
  }
  if (isError) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-[hsl(var(--danger))]">
          Failed to load snapshot · {(error as Error)?.message ?? "unknown"}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="num self-start rounded-md border border-[hsl(var(--border))] px-3 py-1 text-[10px] uppercase tracking-[0.18em]"
        >
          retry
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="flex flex-col gap-6">
      <section className="surface-card rim-instr p-5" data-rim="violet">
        <div className="relative z-[2]">
          <p className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            Snapshot · last validated{" "}
            {new Date(data.last_validated_at).toLocaleString()}
          </p>
          <h2 className="font-display mt-1 text-xl font-semibold tracking-tight">
            ZeroRiskBible · ground truth dashboard
          </h2>
        </div>
      </section>

      <SourceStrip data={data} />

      {/* 7 stub secciones · CC#4 reemplaza cada placeholder con componente v2 sobrio */}
      <SectionStub
        title="Agents"
        subtitle={
          data.agents
            ? `${data.agents.total} total · ${data.agents.with_executions_30d} active 30d · ${data.agents.dormant_count} dormant`
            : "no data"
        }
      />
      <SectionStub
        title="Workflows"
        subtitle={
          data.workflows
            ? `n8n ${data.workflows.n8n_status} · ${data.workflows.total} total · ${data.workflows.active} active`
            : "no data"
        }
      />
      <SectionStub
        title="Clients"
        subtitle={
          data.clients
            ? `${data.clients.total} total · ${data.clients.active_real} active · ${data.clients.smoke_with_data} smoke-with-data · ${data.clients.smoke_empty} smoke-empty`
            : "no data"
        }
      />
      <SectionStub
        title="Drift findings"
        subtitle={
          data.drift
            ? `${data.drift.findings_count} findings detected`
            : "no data"
        }
      />
      <SectionStub
        title="Git"
        subtitle={
          data.git?.head_commit
            ? `HEAD ${data.git.head_commit.substring(0, 7)} · ${data.git.head_message?.substring(0, 60) ?? ""}`
            : "no git data"
        }
      />
      <SectionStub
        title="Integrations health"
        subtitle={
          data.integrations
            ? `${data.integrations.rows.length} integrations · ${data.integrations.rows.filter((r) => r.status === "ok").length} ok`
            : "no data"
        }
      />
    </div>
  )
}

function SourceStrip({ data }: { data: AtlasSnapshotResponse }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(data.sources_status).map(([key, status]) => (
        <span
          key={key}
          className="num inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-[10px] uppercase tracking-[0.18em]"
        >
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor:
                status === "ok"
                  ? "hsl(var(--success))"
                  : "hsl(var(--danger))",
            }}
          />
          {key}
        </span>
      ))}
    </div>
  )
}

function SectionStub({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="surface-card rim-instr p-5" data-rim="cyan">
      <div className="relative z-[2] flex flex-col gap-1">
        <p className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          section · stub · CC#4 implementa
        </p>
        <h3 className="font-display text-lg font-semibold leading-tight">
          {title}
        </h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{subtitle}</p>
      </div>
    </section>
  )
}
