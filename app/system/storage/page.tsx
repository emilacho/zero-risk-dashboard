import { getServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

interface TableRow {
  name: string
  rows: number | null
  desc: string
}

interface BucketRow {
  name: string
  publicAccess: boolean
  created: string
  notes: string
}

async function loadTableCounts(): Promise<TableRow[]> {
  const supa = getServiceRoleClient()
  const tables = [
    { name: "agents", desc: "59 canonical agents" },
    { name: "managed_agents_registry", desc: "canonical seed registry (msitarzewski mirror)" },
    { name: "clients", desc: "2 operativos + 11 archived smoke/dupes" },
    { name: "agent_invocations", desc: "every Claude SDK call · primary metric source" },
    { name: "agent_image_generations", desc: "GPT Image 1.5 generations" },
    { name: "cowork_messages", desc: "dashboard chat inbox (Phase 3)" },
    { name: "hitl_approvals", desc: "HITL queue · created STEP 1" },
    { name: "cascade_runs", desc: "cascade tracking parent · STEP 1" },
    { name: "cascade_stages", desc: "per-stage detail · STEP 1" },
    { name: "journey_executions", desc: "client journey state machine · STEP 1" },
  ]
  const out: TableRow[] = []
  for (const t of tables) {
    try {
      const { count } = await supa
        .from(t.name)
        .select("id", { count: "exact", head: true })
      out.push({ name: t.name, rows: count ?? 0, desc: t.desc })
    } catch {
      out.push({ name: t.name, rows: null, desc: t.desc })
    }
  }
  return out
}

async function loadBuckets(): Promise<BucketRow[]> {
  const supa = getServiceRoleClient()
  try {
    const url = `${process.env.SUPABASE_URL}/storage/v1/bucket`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      },
      cache: "no-store",
    })
    const json = (await res.json()) as Array<{
      name: string
      public: boolean
      created_at: string
    }>
    void supa
    return json.map((b) => ({
      name: b.name,
      publicAccess: b.public,
      created: b.created_at?.slice(0, 10) ?? "—",
      notes:
        b.name === "client-websites"
          ? "10 Náufrago 3D GLBs · brand assets per cliente"
          : b.name === "agent-images"
            ? "GPT Image outputs · 4 images"
            : "Weekly Supabase dumps · cron n8n",
    }))
  } catch {
    return []
  }
}

export default async function SystemStorageTab() {
  const [tables, buckets] = await Promise.all([loadTableCounts(), loadBuckets()])

  return (
    <div className="flex flex-col gap-6">
      <span className="eyebrow-chip">
        <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
        Supabase storage · {tables.length} tables · {buckets.length} buckets
      </span>

      <section className="surface-card rim-instr p-5" data-rim="teal">
        <div className="relative z-[2]">
          <h2 className="font-display text-base font-semibold tracking-tight">Tables</h2>
          <table className="mt-3 w-full text-[12px]">
            <thead>
              <tr className="border-b-[0.5px] border-[hsl(var(--border))] text-left">
                <th className="px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">name</th>
                <th className="px-3 py-2 text-right font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">rows</th>
                <th className="px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">desc</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => (
                <tr
                  key={t.name}
                  className="border-b-[0.5px] border-[hsl(var(--border)/0.4)]"
                >
                  <td className="px-3 py-2 font-mono text-[hsl(var(--accent))]">{t.name}</td>
                  <td className="num px-3 py-2 text-right tabular-nums">
                    {t.rows == null ? "(missing)" : t.rows.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">{t.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card rim-instr p-5" data-rim="violet">
        <div className="relative z-[2]">
          <h2 className="font-display text-base font-semibold tracking-tight">Buckets</h2>
          {buckets.length === 0 ? (
            <p className="num mt-3 text-xs text-[hsl(var(--muted-foreground))]">
              Storage API unreachable.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {buckets.map((b) => (
                <div
                  key={b.name}
                  className="rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[12px] text-[hsl(var(--accent))]">
                      {b.name}
                    </p>
                    <span
                      className="num text-[9px] uppercase tracking-[0.18em]"
                      style={{
                        color: b.publicAccess
                          ? "hsl(var(--success))"
                          : "hsl(var(--muted-foreground))",
                      }}
                    >
                      {b.publicAccess ? "public" : "private"}
                    </span>
                  </div>
                  <p className="num mt-2 text-[9px] text-[hsl(var(--muted-foreground))]">
                    created {b.created}
                  </p>
                  <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                    {b.notes}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
