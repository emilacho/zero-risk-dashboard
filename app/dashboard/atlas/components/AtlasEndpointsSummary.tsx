"use client"
/**
 * AtlasEndpointsSummary · Section 8 · 12 API endpoint groups en grid 3×4.
 *
 * Resumen canónico de qué grupos de endpoints existen across los repos
 * del sistema. Counts hardcoded · son canon V3 (revisar manual cuando
 * cambien). Cada celda · grupo · count · descripción inline.
 */

interface EndpointGroup {
  group: string
  count: number
  desc: string
}

const ENDPOINTS: EndpointGroup[] = [
  { group: "/api/atlas/*", count: 7, desc: "ZeroRiskBible streams · agents · workflows · clients · drift · git · health · snapshot" },
  { group: "/api/onboarding/*", count: 6, desc: "Onboarding orchestrator · discovery · intake · brand · approve · status · trigger" },
  { group: "/api/agents/*", count: 4, desc: "Anthropic Managed Agents · run · run-sdk · stream · list" },
  { group: "/api/clients/*", count: 5, desc: "Clients CRUD · folders · journey-state · invocations · archive" },
  { group: "/api/workflows/*", count: 3, desc: "n8n proxy · list · trigger · last-execution" },
  { group: "/api/checkout/*", count: 2, desc: "Naúfrago checkout · quote · confirm (client-sites R98)" },
  { group: "/api/courier/*", count: 3, desc: "PedidosYa Courier scaffold · quote · order · webhook (R74 deprecated · R97 in progress)" },
  { group: "/api/cascade/*", count: 2, desc: "Cascade ops · persist-outputs · status (post n8n migration 2026-05-16)" },
  { group: "/api/images/*", count: 1, desc: "GPT Image 1.5 vía Vercel AI Gateway · generate" },
  { group: "/api/admin/*", count: 3, desc: "Admin · sync-identity · reset · audit (ADMIN_SECRET gated)" },
  { group: "/api/cron/*", count: 2, desc: "Vercel cron · refresh-mv · prune-stale" },
  { group: "/api/health", count: 1, desc: "Platform liveness probe · used by UptimeRobot + integrations-health" },
]

export function AtlasEndpointsSummary() {
  return (
    <section
      className="surface-card rim-instr p-5"
      data-rim="cyan"
      aria-label="API endpoints summary"
    >
      <div className="relative z-[2] flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            API endpoints
          </h2>
          <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            {ENDPOINTS.length} grupos · {ENDPOINTS.reduce((s, e) => s + e.count, 0)} routes
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ENDPOINTS.map((e) => (
            <div
              key={e.group}
              className="flex flex-col gap-1 rounded-md border border-[hsl(var(--border))] p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <code className="num text-[11px] font-medium tabular-nums">
                  {e.group}
                </code>
                <span className="num text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">
                  ×{e.count}
                </span>
              </div>
              <p className="text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">
                {e.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
