import { api } from "@/lib/api"
import {
  KpiGrid,
  BarListTopAgents,
  ActivityFeed,
} from "@/lib/dashboard-components"
import {
  metricsToKpiSnapshot,
  agentRowToSummary,
  invocationsToActivity,
} from "@/lib/transforms"

/**
 * Async server component · fetches 3 endpoints in parallel and feeds the
 * Tremor-style components from `@/lib/dashboard-components`. Wrapped in a
 * Suspense boundary by the route page.
 */
export async function DashboardOverview() {
  const [metrics, agents, activity] = await Promise.all([
    api.metrics().catch(() => null),
    api.agents(50).catch(() => null),
    api.activity(15).catch(() => null),
  ])

  if (!metrics) {
    return (
      <ErrorTile message="Could not load metrics · platform endpoint unreachable" />
    )
  }

  const snapshot = metricsToKpiSnapshot(metrics)
  const topAgents = (agents?.agents ?? [])
    .map(agentRowToSummary)
    .filter((a) => a.costUsd > 0)
  const invocations = activity ? invocationsToActivity(activity) : []

  return (
    <div className="space-y-8">
      <KpiGrid snapshot={snapshot} />
      <div className="grid gap-6 lg:grid-cols-2">
        {topAgents.length > 0 ? (
          <BarListTopAgents agents={topAgents} limit={8} />
        ) : (
          <ErrorTile message="No agent cost data yet · placeholder" subtle />
        )}
        {invocations.length > 0 ? (
          <ActivityFeed invocations={invocations} limit={12} />
        ) : (
          <ErrorTile message="No recent invocations · placeholder" subtle />
        )}
      </div>
    </div>
  )
}

function ErrorTile({ message, subtle }: { message: string; subtle?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-6 text-sm ${
        subtle ? "text-muted-foreground" : "text-destructive-foreground"
      }`}
    >
      {message}
    </div>
  )
}
