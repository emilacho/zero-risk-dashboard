import Link from "next/link"
import { api } from "@/lib/api"
import { classifyAgent } from "@/lib/departments"

export const dynamic = "force-dynamic"

interface RowDisplay {
  id: string
  name: string
  display_name: string
  role: string
  model: string
  status: string
  dept: string
  sessions30d: number
  cost30d: number
  identity_chars: number
}

function fmtUsd(v: number) {
  if (v === 0) return "$0.000"
  if (Math.abs(v) < 1) return `$${v.toFixed(4)}`
  return `$${v.toFixed(2)}`
}

export default async function SystemAgentsTab() {
  const data = await api.agents(200).catch(() => null)
  if (!data) {
    return (
      <p className="text-sm text-[hsl(var(--danger))]">
        Could not load agents · platform endpoint unreachable.
      </p>
    )
  }

  const rows: RowDisplay[] = data.agents
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <span className="eyebrow-chip">
          <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
          {data.count} agents · {active} active 30d · utilization{" "}
          {((active / data.count) * 100).toFixed(1)}%
        </span>
        <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
          sorted · sessions 30d desc
        </span>
      </div>

      <div className="surface-card rim-instr overflow-hidden p-0" data-rim="cyan">
        <div className="relative z-[2] max-h-[70vh] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[hsl(var(--background)/0.92)] backdrop-blur">
              <tr className="border-b-[0.5px] border-[hsl(var(--primary-glow)/0.18)] text-left">
                <th className="px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">#</th>
                <th className="px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">slug</th>
                <th className="px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">role</th>
                <th className="px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">dept</th>
                <th className="px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">model</th>
                <th className="px-3 py-2.5 text-right font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">sess 30d</th>
                <th className="px-3 py-2.5 text-right font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">cost 30d</th>
                <th className="px-3 py-2.5 text-right font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">id chars</th>
                <th className="px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">→</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className="border-b-[0.5px] border-[hsl(var(--border)/0.4)] transition hover:bg-[hsl(var(--primary-glow)/0.04)]"
                >
                  <td className="num px-4 py-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="font-mono text-[hsl(var(--accent))]"
                      title={r.display_name}
                    >
                      {r.name}
                    </span>
                  </td>
                  <td className="num px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                    {r.role}
                  </td>
                  <td className="num px-3 py-2 text-[10px] uppercase tracking-[0.18em]">
                    {r.dept === "—" ? (
                      <span className="text-[hsl(var(--muted-foreground))]">—</span>
                    ) : (
                      <Link
                        href={`/dept/${r.dept}`}
                        className="text-[hsl(var(--accent))] hover:underline"
                      >
                        {r.dept}
                      </Link>
                    )}
                  </td>
                  <td className="num px-3 py-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                    {r.model}
                  </td>
                  <td className="num px-3 py-2 text-right tabular-nums">
                    {r.sessions30d}
                  </td>
                  <td className="num px-3 py-2 text-right tabular-nums">
                    {fmtUsd(r.cost30d)}
                  </td>
                  <td className="num px-3 py-2 text-right text-[10px] text-[hsl(var(--muted-foreground))]">
                    {r.identity_chars}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/agents/${r.name}`}
                      className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
                    >
                      open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
