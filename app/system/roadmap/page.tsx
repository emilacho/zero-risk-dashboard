export const dynamic = "force-dynamic"

interface Lane {
  label: string
  hue: "violet" | "cyan" | "amber" | "emerald" | "rose" | "orange" | "purple" | "teal" | "sky" | "lime"
  items: Array<{ title: string; meta: string; status: "done" | "active" | "queued" }>
}

const LANES: Lane[] = [
  {
    label: "Now · Sprint 6",
    hue: "violet",
    items: [
      { title: "Phase 1-3 Lumen v3 dashboard", meta: "shipped 2026-05-17", status: "done" },
      { title: "STEP 1 cleanup migrations · 11 archived + 4 new tables", meta: "shipped · platform PR #47 merged", status: "done" },
      { title: "STEP 2 · 5 oficinas gerenciales", meta: "shipped 2026-05-17", status: "done" },
      { title: "STEP 3 · /system tabs Capa B", meta: "this commit", status: "active" },
      { title: "Xavier purge canon · 14 files + Supabase scan", meta: "shipped 2026-05-17", status: "done" },
    ],
  },
  {
    label: "Next · STEP 4 + research v2",
    hue: "cyan",
    items: [
      { title: "STEP 4 · Phase 9 Supabase Auth permissions", meta: "ETA 4-6h · admin Emilio + client_viewer per cliente_id", status: "queued" },
      { title: "Phase 10 · estética research v2", meta: "post-arquitectura ACK · 15 dashboards CC#2 refs", status: "queued" },
      { title: "Anthropic Console API wire", meta: "pending ANTHROPIC_ADMIN_TOKEN", status: "queued" },
      { title: "Brazo 3 · Meta Ads build", meta: "Facebook Developers App + System User Token", status: "queued" },
    ],
  },
  {
    label: "Backlog · prioritized",
    hue: "amber",
    items: [
      { title: "Cascade runtime emisión", meta: "writes a cascade_runs + cascade_stages", status: "queued" },
      { title: "Journey runtime", meta: "writes a journey_executions on cliente events", status: "queued" },
      { title: "HITL runtime", meta: "inserts on revision_needed verdicts", status: "queued" },
      { title: "Camino III verdict materialized view", meta: "approve/revision rate KPI live", status: "queued" },
      { title: "n8n executions count → metrics", meta: "fix `workflows_n8n: null` placeholder", status: "queued" },
      { title: "22 inactive workflows · burn-down activation", meta: "Cost Watchdog + Account Health + Churn Pred + ...", status: "queued" },
      { title: "GHL pipelines API proxy", meta: "Sales depto wire", status: "queued" },
      { title: "Brazo 5 Higgsfield video real wire", meta: "currently spec-only", status: "queued" },
      { title: "Storage size aggregator", meta: "per-bucket + per-client breakdown", status: "queued" },
    ],
  },
  {
    label: "Done · last 7d",
    hue: "emerald",
    items: [
      { title: "Phase 3 · 8 KPI grid + Cowork chat + cardinal layout", meta: "2026-05-17", status: "done" },
      { title: "Phase 2 · RadialSentinel + rim + motion vocabulary", meta: "2026-05-17", status: "done" },
      { title: "Phase 1 · Lumen v3 scaffold + sidebar + tokens", meta: "2026-05-16", status: "done" },
      { title: "Náufrago piloto cascade shipped", meta: "2026-05-16 · 4 agents", status: "done" },
      { title: "Identity backfill · 35 placeholder identities", meta: "2026-05-16 · canonical seed completed", status: "done" },
      { title: "10 GLB uploads · Náufrago 3D models", meta: "Storage `client-websites/naufrago/3d-models/`", status: "done" },
    ],
  },
]

const recentCommits = [
  { sha: "b44cb32", subject: "fix(dashboard): drop AnimatedNumber from DeptOverviewGrid + DeptOpsBody" },
  { sha: "aabfbe9", subject: "fix(dashboard): /dept/[slug] pure dynamic" },
  { sha: "06154b1", subject: "fix(dashboard): defensive guards on DeptOverviewGrid + DeptOpsBody data loads" },
  { sha: "7c5efca", subject: "feat(dashboard): Phase 4 STEP 2 · 5 oficinas gerenciales" },
  { sha: "4acfca1", subject: "feat(dashboard): Phase 4 STEP 1 · cleanup + 3 new tables + archive filter" },
  { sha: "5ca1d8f", subject: "canon(dashboard): remove Xavier Pérez from team-members · canon correction 2026-05-17" },
  { sha: "54377db", subject: "fix(dashboard): OpsKpiGrid Cell as client component" },
  { sha: "c2b9e9b", subject: "fix(dashboard): OpsKpiGrid direct Supabase access" },
  { sha: "f40135f", subject: "feat(dashboard): Lumen v3 Phase 3 · layout + KPIs + Cowork chat" },
  { sha: "7e07133", subject: "fix(dashboard): radial sentinel forward as HUD overlay" },
]

export default function SystemRoadmapTab() {
  return (
    <div className="flex flex-col gap-6">
      <span className="eyebrow-chip">
        <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
        Roadmap · Now / Next / Backlog / Done · last 7 days
      </span>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {LANES.map((lane) => (
          <div
            key={lane.label}
            className="surface-card rim-instr p-5"
            data-rim={lane.hue}
          >
            <div className="relative z-[2]">
              <h3
                className="font-display text-base font-semibold"
                style={{ color: `hsl(var(--hue-${lane.hue}))` }}
              >
                {lane.label}
              </h3>
              <ul className="mt-3 space-y-2">
                {lane.items.map((it) => (
                  <li
                    key={it.title}
                    className="rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-medium">{it.title}</p>
                      <span
                        className="num text-[9px] uppercase tracking-[0.18em]"
                        style={{
                          color:
                            it.status === "done"
                              ? "hsl(var(--success))"
                              : it.status === "active"
                                ? "hsl(var(--accent))"
                                : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {it.status}
                      </span>
                    </div>
                    <p className="num mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                      {it.meta}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Recent commits */}
      <section className="surface-card rim-instr p-5" data-rim="violet">
        <div className="relative z-[2]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Recent dashboard commits · branch `dashboard-lumen-v3`
            </h2>
            <a
              href="https://github.com/emilacho/zero-risk-dashboard/commits/dashboard-lumen-v3"
              target="_blank"
              rel="noreferrer"
              className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
            >
              full history ↗
            </a>
          </div>
          <ul className="space-y-1">
            {recentCommits.map((c) => (
              <li
                key={c.sha}
                className="flex items-center justify-between rounded-md px-3 py-1.5 hover:bg-[hsl(var(--primary-glow)/0.06)]"
              >
                <span className="font-mono text-[11px] text-[hsl(var(--accent))]">
                  {c.sha}
                </span>
                <span className="ml-3 flex-1 truncate text-[12px] text-[hsl(var(--muted-foreground))]">
                  {c.subject}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
