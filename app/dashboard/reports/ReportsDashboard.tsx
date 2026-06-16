"use client"
/**
 * ReportsDashboard · Sprint 4 D5 · 4 widget Reports surface.
 *
 * Widgets ·
 *   1. Campaigns started / completed last 30d (Recharts BarChart)
 *   2. Clients active vs dormant (Recharts BarChart)
 *   3. Top events last 7d (Recharts BarChart sorted)
 *   4. Notion sync status (text table · last sync per database)
 *
 * Data sources ·
 *   - `/api/reports/posthog-summary` · PostHog event counts proxy
 *   - `/api/atlas/snapshot` · agents + clients aggregates
 *   - Notion sync timestamps · stub for now (Sprint 4 follow-up to wire
 *     `/api/reports/notion-sync-status` when the 3 databases exist)
 */
import { useMemo } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

export interface ReportsSnapshot {
  posthog: {
    ok: boolean
    window_days: number
    events: Record<string, number>
    posthog_status: "live" | "not_configured"
    generated_at: string
    warning?: string
  } | null
  atlas: {
    agents?: {
      total: number
      with_executions_30d: number
      dormant_count: number
    } | null
    clients?: {
      total: number
      active_real: number
      smoke_with_data: number
      smoke_empty: number
    } | null
  } | null
}

export function ReportsDashboard({
  initial,
}: {
  initial: ReportsSnapshot | null
}) {
  const data = initial ?? { posthog: null, atlas: null }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header generatedAt={data.posthog?.generated_at} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CampaignsWidget posthog={data.posthog} />
        <ClientsWidget atlas={data.atlas} />
        <TopEventsWidget posthog={data.posthog} />
        <NotionSyncWidget />
      </div>
    </div>
  )
}

function Header({ generatedAt }: { generatedAt?: string }) {
  return (
    <section className="surface-card rim-instr p-5" data-rim="cyan">
      <div className="relative z-[2] flex flex-col gap-2">
        <span className="eyebrow-chip">Reports · v1</span>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Operational reports
        </h1>
        <p className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          campaigns · clients · events · notion sync ·{" "}
          {generatedAt
            ? `snapshot ${new Date(generatedAt).toLocaleString()}`
            : "no snapshot"}
        </p>
      </div>
    </section>
  )
}

function CampaignsWidget({
  posthog,
}: {
  posthog: ReportsSnapshot["posthog"]
}) {
  const chartData = useMemo(
    () => [
      { name: "started", value: posthog?.events?.campaign_started ?? 0 },
      { name: "completed", value: posthog?.events?.campaign_completed ?? 0 },
    ],
    [posthog],
  )
  return (
    <Card title="Campaigns · last 30d" subtitle="NEXUS pipeline events">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
          <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--secondary))",
              border: "1px solid hsl(var(--border))",
            }}
          />
          <Bar dataKey="value" fill="hsl(var(--hue-cyan))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {posthog?.posthog_status === "not_configured" ? (
        <UnconfiguredNote detail={posthog.warning} />
      ) : null}
    </Card>
  )
}

function ClientsWidget({ atlas }: { atlas: ReportsSnapshot["atlas"] }) {
  const active = atlas?.clients?.active_real ?? 0
  const smokeData = atlas?.clients?.smoke_with_data ?? 0
  const smokeEmpty = atlas?.clients?.smoke_empty ?? 0
  const chartData = [
    { name: "active", value: active },
    { name: "smoke+data", value: smokeData },
    { name: "smoke-empty", value: smokeEmpty },
  ]
  return (
    <Card title="Clients" subtitle="active vs dormant breakdown">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
          <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--secondary))",
              border: "1px solid hsl(var(--border))",
            }}
          />
          <Bar dataKey="value" fill="hsl(var(--hue-emerald))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

function TopEventsWidget({
  posthog,
}: {
  posthog: ReportsSnapshot["posthog"]
}) {
  const sorted = useMemo(() => {
    const entries = Object.entries(posthog?.events ?? {})
    return entries
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [posthog])
  return (
    <Card
      title={`Top events · ${posthog?.window_days ?? 30}d`}
      subtitle="canon Sprint 4 captures"
    >
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={sorted} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            width={130}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--secondary))",
              border: "1px solid hsl(var(--border))",
            }}
          />
          <Bar dataKey="value" fill="hsl(var(--hue-violet))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {posthog?.posthog_status === "not_configured" ? (
        <UnconfiguredNote detail={posthog.warning} />
      ) : null}
    </Card>
  )
}

function NotionSyncWidget() {
  // Sprint 4 follow-up · wire `/api/reports/notion-sync-status` when the
  // 3 Notion databases exist + env vars populated. For now we surface the
  // canonical 3 databases with "pending" status so the widget has a
  // stable shape from day 1.
  const rows = [
    { name: "Campaigns", env: "NOTION_DATABASE_CAMPAIGNS", status: "pending" },
    { name: "Clients", env: "NOTION_DATABASE_CLIENTS", status: "pending" },
    { name: "Weekly", env: "NOTION_DATABASE_WEEKLY", status: "pending" },
  ]
  return (
    <Card title="Notion sync" subtitle="last sync per database">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--border))]">
            <th className="num py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              database
            </th>
            <th className="num py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              env
            </th>
            <th className="num py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.name}
              className="border-b border-[hsl(var(--border))]/40 last:border-0"
            >
              <td className="py-2 font-display font-medium">{r.name}</td>
              <td className="num py-2 text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
                {r.env}
              </td>
              <td className="py-2">
                <span
                  className="pill"
                  data-hue="muted"
                  style={{ fontSize: "10px" }}
                >
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[10px] text-[hsl(var(--muted-foreground))]/80">
        Live sync timestamps land here once Emilio creates the 3 databases in the
        Notion workspace + populates the corresponding env vars on Vercel.
      </p>
    </Card>
  )
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="surface-card rim-instr p-5" data-rim="cyan">
      <div className="relative z-[2] flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-base font-semibold tracking-tight">
            {title}
          </h2>
          <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            {subtitle}
          </span>
        </div>
        {children}
      </div>
    </section>
  )
}

function UnconfiguredNote({ detail }: { detail?: string }) {
  return (
    <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]/80">
      PostHog not configured · showing zeros{detail ? ` · ${detail}` : ""}
    </p>
  )
}
