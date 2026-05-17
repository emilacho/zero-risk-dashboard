import Link from "next/link"

export const dynamic = "force-dynamic"

interface WorkflowRow {
  id: string
  name: string
  active: boolean
  trigger: string
  nodeCount: number
  updatedAt: string
  versionId?: string
}

async function loadWorkflows(): Promise<WorkflowRow[] | null> {
  const base = process.env.N8N_BASE_URL
  const key = process.env.N8N_API_KEY
  if (!base || !key) return null
  try {
    const res = await fetch(
      `${base.replace(/\/+$/, "")}/api/v1/workflows?limit=250`,
      {
        headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
        cache: "no-store",
      },
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: unknown[] }
    return (json.data ?? []).map((w) => {
      type WfRow = {
        id?: string
        name?: string
        active?: boolean
        nodes?: { type?: string }[]
        updatedAt?: string
        versionId?: string
      }
      const wf = w as WfRow
      const trigger =
        (wf.nodes ?? []).find((n) =>
          /trigger|webhook|cron|schedule/i.test(n.type ?? ""),
        )?.type?.split(".").pop() ?? "?"
      return {
        id: wf.id ?? "",
        name: wf.name ?? "",
        active: wf.active === true,
        trigger,
        nodeCount: (wf.nodes ?? []).length,
        updatedAt: wf.updatedAt ?? "",
        versionId: wf.versionId,
      }
    })
  } catch {
    return null
  }
}

function fmtRelative(iso: string): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "just now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

export default async function SystemWorkflowsTab() {
  const wfs = await loadWorkflows()
  if (!wfs) {
    return (
      <div className="surface-card rim-instr p-6" data-rim="rose">
        <p className="num text-xs text-[hsl(var(--danger))]">
          n8n API unreachable · check `N8N_BASE_URL` + `N8N_API_KEY` envs on
          this Vercel project (dashboard). Currently only `SUPABASE_*` +
          `SLACK_COWORK_WEBHOOK_URL` are wired here. n8n credentials live
          on platform · need to be copied for live workflow drill-down.
        </p>
      </div>
    )
  }
  const rows = wfs.sort((a, b) =>
    a.active === b.active
      ? a.name.localeCompare(b.name)
      : a.active
        ? -1
        : 1,
  )
  const active = rows.filter((r) => r.active).length
  const byTrigger: Record<string, number> = {}
  rows.forEach((r) => (byTrigger[r.trigger] = (byTrigger[r.trigger] ?? 0) + 1))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <span className="eyebrow-chip">
          <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
          {rows.length} workflows · {active} active · {rows.length - active} inactive ·{" "}
          {Object.entries(byTrigger)
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => `${k} ${n}`)
            .join(" · ")}
        </span>
        <a
          href="https://n8n-production-72be.up.railway.app"
          target="_blank"
          rel="noreferrer"
          className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
        >
          open n8n ↗
        </a>
      </div>

      <div className="surface-card rim-instr overflow-hidden p-0" data-rim="amber">
        <div className="relative z-[2] max-h-[70vh] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[hsl(var(--background)/0.92)] backdrop-blur">
              <tr className="border-b-[0.5px] border-[hsl(var(--primary-glow)/0.18)] text-left">
                <th className="px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">status</th>
                <th className="px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">name</th>
                <th className="px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">trigger</th>
                <th className="px-3 py-2.5 text-right font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">nodes</th>
                <th className="px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">updated</th>
                <th className="px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">id</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b-[0.5px] border-[hsl(var(--border)/0.4)] transition hover:bg-[hsl(var(--primary-glow)/0.04)]"
                >
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex h-1.5 w-1.5 rounded-full"
                      style={{
                        background: r.active
                          ? "hsl(var(--success))"
                          : "hsl(var(--muted-foreground) / 0.5)",
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/workflows/${r.id}`}
                      title={r.name}
                      className="hover:text-[hsl(var(--accent))] hover:underline"
                    >
                      {r.name.replace(/^Zero Risk[ ·—-]*/, "")}
                    </Link>
                  </td>
                  <td className="num px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                    {r.trigger.replace("Trigger", "")}
                  </td>
                  <td className="num px-3 py-2 text-right tabular-nums">
                    {r.nodeCount}
                  </td>
                  <td className="num px-3 py-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                    {fmtRelative(r.updatedAt)}
                  </td>
                  <td className="num px-3 py-2 text-[9px] text-[hsl(var(--muted-foreground))]">
                    <a
                      href={`https://n8n-production-72be.up.railway.app/workflow/${r.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-[hsl(var(--accent))]"
                    >
                      {r.id.slice(0, 12)} ↗
                    </a>
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
