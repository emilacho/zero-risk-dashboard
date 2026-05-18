import { api } from "@/lib/api"
import { classifyAgent } from "@/lib/departments"
import { SystemAgentsTable, type SystemAgentRow } from "@/components/system/SystemAgentsTable"

export const dynamic = "force-dynamic"

export default async function SystemAgentsTab() {
  const data = await api.agents(200).catch(() => null)
  if (!data) {
    return (
      <p className="text-sm text-[hsl(var(--danger))]">
        Could not load agents · platform endpoint unreachable.
      </p>
    )
  }

  const rows: SystemAgentRow[] = data.agents
    .map((a) => ({
      id: a.id,
      name: a.name,
      display_name: a.display_name,
      role: a.role,
      model: a.model,
      status: a.status,
      dept: classifyAgent(a) ?? "—",
      sessions30d: a.stats_30d?.sessions ?? 0,
      cost30d: a.stats_30d?.cost_usd ?? 0,
      identity_chars: a.identity_chars ?? 0,
    }))
    .sort((a, b) => b.sessions30d - a.sessions30d || a.name.localeCompare(b.name))

  const active = rows.filter((r) => r.sessions30d > 0).length

  return <SystemAgentsTable rows={rows} totalCount={data.count} active={active} />
}
