import { getServiceRoleClient } from "@/lib/supabase-server"
import { Image, Globe, MousePointerClick, Box, GitBranch, ShieldCheck } from "lucide-react"

export const dynamic = "force-dynamic"

interface BrazoCard {
  slug: string
  label: string
  icon: React.ReactNode
  status: "live" | "build" | "manual" | "wire pending"
  hue: "violet" | "cyan" | "amber" | "emerald" | "orange" | "teal" | "rose"
  kpis: { label: string; value: string; sub?: string }[]
  notes: string
}

function pillStatus(status: BrazoCard["status"]): string {
  return status
}

async function loadBrazoData() {
  const supa = getServiceRoleClient()
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // GPT Image · agent_image_generations table
  const [imgsAll, imgs30d, imgs24h] = await Promise.all([
    supa
      .from("agent_image_generations")
      .select("cost_usd, created_at", { count: "exact" })
      .limit(1),
    supa
      .from("agent_image_generations")
      .select("cost_usd")
      .gte("created_at", since30),
    supa
      .from("agent_image_generations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since24),
  ])

  const cost30d = (imgs30d.data ?? []).reduce(
    (s, r) => s + Number(r.cost_usd ?? 0),
    0,
  )

  // Cascade runs · count + recent
  const [cascadeAll, cascade24h] = await Promise.all([
    supa.from("cascade_runs").select("id", { count: "exact", head: true }),
    supa
      .from("cascade_runs")
      .select("id", { count: "exact", head: true })
      .gte("started_at", since24),
  ])

  // Camino III · invocations by reviewer agents
  const reviewers = ["editor-en-jefe", "editor_en_jefe", "style-consistency-reviewer", "spell-check-corrector"]
  const { count: reviewsInv } = await supa
    .from("agent_invocations")
    .select("id", { count: "exact", head: true })
    .in("agent_name", reviewers)
    .gte("started_at", since30)

  return {
    imageTotal: imgsAll.count ?? 0,
    image30d: (imgs30d.data ?? []).length,
    image30dCost: cost30d,
    image24h: imgs24h.count ?? 0,
    cascadeTotal: cascadeAll.count ?? 0,
    cascade24h: cascade24h.count ?? 0,
    reviewsCount30d: reviewsInv ?? 0,
  }
}

export default async function SystemBrazosTab() {
  const data = await loadBrazoData().catch(() => ({
    imageTotal: 0,
    image30d: 0,
    image30dCost: 0,
    image24h: 0,
    cascadeTotal: 0,
    cascade24h: 0,
    reviewsCount30d: 0,
  }))

  const cards: BrazoCard[] = [
    {
      slug: "gpt-image",
      label: "B1 · GPT Image 1.5",
      icon: <Image strokeWidth={1.5} className="h-5 w-5" aria-label="GPT Image" />,
      status: "live",
      hue: "violet",
      kpis: [
        { label: "Total images", value: data.imageTotal.toString() },
        { label: "30d images", value: data.image30d.toString(), sub: `$${data.image30dCost.toFixed(3)} 30d` },
        { label: "24h images", value: data.image24h.toString() },
      ],
      notes:
        "OpenAI vía Vercel AI Gateway · #1 LMArena · default image provider · Náufrago brand assets generated via this brazo.",
    },
    {
      slug: "apify",
      label: "B2 · Apify scrapers",
      icon: <Globe strokeWidth={1.5} className="h-5 w-5" />,
      status: "live",
      hue: "amber",
      kpis: [
        { label: "Runs 24h", value: "—", sub: "wire pending Apify API" },
        { label: "Cost 30d", value: "—", sub: "wire pending" },
        { label: "Active actors", value: "—" },
      ],
      notes:
        "n8n workflow `Competitor Daily Monitor (6am)` triggers scrapes daily · pay-per-run · Apify console for spend audit.",
    },
    {
      slug: "meta-ads",
      label: "B3 · Meta Ads",
      icon: <MousePointerClick strokeWidth={1.5} className="h-5 w-5" />,
      status: "build",
      hue: "cyan",
      kpis: [
        { label: "Campaigns", value: "—", sub: "Facebook Developers App pending" },
        { label: "Daily monitor", value: "—", sub: "n8n workflow inactive" },
        { label: "campaign-creator", value: "spec ready" },
      ],
      notes:
        "Brazo 3 en build phase · research deep-research complete (`2026-05-16-meta-ads-agentic-agencies-deep-research.md`) · spec n8n flow listo · Facebook App + System User Token pendientes.",
    },
    {
      slug: "meshy",
      label: "Meshy 3D",
      icon: <Box strokeWidth={1.5} className="h-5 w-5" />,
      status: "manual",
      hue: "teal",
      kpis: [
        { label: "Models 30d", value: "4+", sub: "Náufrago island + character + sign + surfboard" },
        { label: "Storage", value: "client-websites/naufrago/3d-models/" },
        { label: "Cost", value: "$0", sub: "manual gen via UI" },
      ],
      notes:
        "Manual generation cliente piloto Náufrago · 10 GLBs uploaded a Supabase Storage · agent runtime integration pending.",
    },
    {
      slug: "cascade",
      label: "Cascade engine",
      icon: <GitBranch strokeWidth={1.5} className="h-5 w-5" />,
      status: data.cascadeTotal > 0 ? "live" : "wire pending",
      hue: "rose",
      kpis: [
        { label: "Total runs", value: data.cascadeTotal.toString(), sub: "cascade_runs table" },
        { label: "24h runs", value: data.cascade24h.toString() },
        { label: "Stage tracking", value: "ready", sub: "cascade_stages migrated" },
      ],
      notes:
        "Sprint 6 cascade refactor live · 7-stage cascade brand-strategist → market-research → creative-director → web-designer → content-creator → spell-check → editor-en-jefe. Tabla `cascade_runs` migrada · runtime emisión pending (writes desde cascade-runner.ts).",
    },
    {
      slug: "camino-iii",
      label: "Camino III · 3-of-N voting",
      icon: <ShieldCheck strokeWidth={1.5} className="h-5 w-5" />,
      status: "live",
      hue: "emerald",
      kpis: [
        { label: "Reviewer invs 30d", value: data.reviewsCount30d.toString() },
        { label: "Verdict rollup", value: "wire pending", sub: "metadata.review_verdict materialized view" },
        { label: "Reviewers", value: "3", sub: "editor + style + spell" },
      ],
      notes:
        "Quality refactor live producción desde 2026-05-15 · verdicts persistidos en agent_invocations.metadata · aggregate view pending.",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <span className="eyebrow-chip">
        <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
        6 brazos operativos · 4 live · 1 manual · 1 build
      </span>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <div
            key={c.slug}
            className="surface-card rim-instr p-5"
            data-rim={c.hue}
            data-pop="true"
          >
            <div className="relative z-[2]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border-[0.5px]"
                    style={{
                      borderColor: `hsl(var(--hue-${c.hue}) / 0.4)`,
                      background: `hsl(var(--hue-${c.hue}) / 0.12)`,
                      color: `hsl(var(--hue-${c.hue}))`,
                    }}
                  >
                    {c.icon}
                  </span>
                  <h3 className="font-display text-base font-semibold">{c.label}</h3>
                </div>
                <span
                  className="num rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.2em]"
                  style={{
                    color: `hsl(var(--hue-${c.hue}))`,
                    background: `hsl(var(--hue-${c.hue}) / 0.12)`,
                  }}
                >
                  {pillStatus(c.status)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {c.kpis.map((k) => (
                  <div key={k.label}>
                    <p className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                      {k.label}
                    </p>
                    <p className="num mt-1 text-sm font-semibold tabular-nums">
                      {k.value}
                    </p>
                    {k.sub ? (
                      <p className="num text-[9px] text-[hsl(var(--muted-foreground))]">
                        {k.sub}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                {c.notes}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
