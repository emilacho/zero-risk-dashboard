import { api } from "@/lib/api"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

interface Tile {
  slug: string
  name: string
  hue: "violet" | "cyan" | "amber" | "emerald" | "rose" | "orange" | "purple" | "teal" | "sky" | "lime"
  status: "live" | "live · billed" | "active" | "wire pending" | "build"
  primaryKpi: { label: string; value: string }
  secondaryKpis: { label: string; value: string }[]
  notes: string
  link?: string
}

async function loadPlataformaData() {
  const m = await api.metrics().catch(() => null)
  const supa = getServiceRoleClient()
  let cascadeCount = 0
  try {
    const { count } = await supa
      .from("cascade_runs")
      .select("id", { count: "exact", head: true })
    cascadeCount = count ?? 0
  } catch {
    /* empty */
  }
  return {
    metrics: m,
    cascadeCount,
  }
}

export default async function SystemPlataformasTab() {
  const { metrics } = await loadPlataformaData()

  const tiles: Tile[] = [
    {
      slug: "vercel",
      name: "Vercel",
      hue: "violet",
      status: "live · billed",
      primaryKpi: { label: "projects", value: "4" },
      secondaryKpis: [
        { label: "last deploy", value: "today" },
        { label: "team", value: "zero-risk1" },
      ],
      notes: "zero-risk-platform · zero-risk-dashboard · client-sites-template · .tmp-cc3-backup. Pro plan.",
      link: "https://vercel.com/zero-risk1",
    },
    {
      slug: "railway",
      name: "Railway",
      hue: "purple",
      status: "live · billed",
      primaryKpi: { label: "services", value: "1+" },
      secondaryKpis: [
        { label: "uptime", value: "wire pending" },
        { label: "cost", value: "~$5/mo" },
      ],
      notes: "n8n self-host · `n8n-production-72be.up.railway.app` · agent-runner service.",
      link: "https://railway.app",
    },
    {
      slug: "supabase",
      name: "Supabase",
      hue: "emerald",
      status: "live · billed",
      primaryKpi: { label: "tables", value: "11+" },
      secondaryKpis: [
        { label: "buckets", value: "3" },
        { label: "plan", value: "Pro" },
      ],
      notes: "Postgres + Storage + Auth (pending) · ground truth Tier 1.",
      link: "https://supabase.com/dashboard/project/ordaeyxvvvdqsznsecjx",
    },
    {
      slug: "anthropic",
      name: "Anthropic",
      hue: "cyan",
      status: "live",
      primaryKpi: {
        label: "spend 30d",
        value: metrics ? `$${metrics.totals.spend_usd_30d.toFixed(2)}` : "—",
      },
      secondaryKpis: [
        { label: "models", value: "Sonnet+Opus+Haiku" },
        { label: "credit balance", value: "wire pending" },
      ],
      notes:
        "Claude Sonnet/Sonnet-4-6/Opus-4-6/Haiku-4-5. Credit balance API · token pending Emilio.",
      link: "https://console.anthropic.com",
    },
    {
      slug: "openai",
      name: "OpenAI",
      hue: "teal",
      status: "live",
      primaryKpi: {
        label: "image spend 30d",
        value: metrics ? `$${metrics.totals.image_spend_usd_30d.toFixed(3)}` : "—",
      },
      secondaryKpis: [
        { label: "use", value: "GPT Image 1.5" },
        { label: "channel", value: "Vercel AI Gateway" },
      ],
      notes: "Used solo para GPT Image generation vía Vercel AI Gateway · no chat completions hoy.",
      link: "https://platform.openai.com/usage",
    },
    {
      slug: "apify",
      name: "Apify",
      hue: "amber",
      status: "live",
      primaryKpi: { label: "actors", value: "wire pending" },
      secondaryKpis: [
        { label: "spend 30d", value: "wire pending" },
        { label: "runs", value: "n8n Competitor Daily" },
      ],
      notes: "Pay-per-run scrapers · Meta/Google/TikTok Ad Library actors · console for spend audit.",
      link: "https://console.apify.com",
    },
    {
      slug: "ghl",
      name: "GoHighLevel",
      hue: "lime",
      status: "live · billed",
      primaryKpi: { label: "plan", value: "Unlimited" },
      secondaryKpis: [
        { label: "cost", value: "$297/mo" },
        { label: "API wire", value: "pending" },
      ],
      notes: "CRM + email + landing pages + WhatsApp + calendar. API proxy NOT yet wired into dashboard.",
      link: "https://app.gohighlevel.com",
    },
    {
      slug: "posthog",
      name: "PostHog",
      hue: "rose",
      status: "live",
      primaryKpi: { label: "plan", value: "Free" },
      secondaryKpis: [
        { label: "events", value: "1M/mo free tier" },
        { label: "n8n integration", value: "ready" },
      ],
      notes: "Product analytics · personal API key persisted · n8n integration prepped.",
      link: "https://us.posthog.com",
    },
    {
      slug: "meta",
      name: "Meta Ads",
      hue: "sky",
      status: "build",
      primaryKpi: { label: "Brazo 3", value: "build" },
      secondaryKpis: [
        { label: "Facebook App", value: "pending" },
        { label: "n8n daily monitor", value: "spec" },
      ],
      notes: "Facebook Developers App + System User Token pending Emilio · deep-research doc landed 2026-05-16.",
      link: "https://developers.facebook.com",
    },
    {
      slug: "github",
      name: "GitHub",
      hue: "violet",
      status: "active",
      primaryKpi: { label: "repos", value: "2 (platform + dashboard)" },
      secondaryKpis: [
        { label: "recent merges", value: "wire pending" },
        { label: "branch", value: "dashboard-lumen-v3" },
      ],
      notes: "Source of truth · CI via Vercel · gh CLI used for PR ops.",
      link: "https://github.com/emilacho",
    },
    {
      slug: "slack",
      name: "Slack",
      hue: "orange",
      status: "live",
      primaryKpi: { label: "channels", value: "#equipo + others" },
      secondaryKpis: [
        { label: "plan", value: "Free workspace" },
        { label: "webhook", value: "Cowork chat wired" },
      ],
      notes: "Inter-laptop bridge channel #equipo (C0B2QCDMV7Y) · Cowork ↔ Lenovo + HP3 + CCs.",
      link: "https://zero-risk.slack.com",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <span className="eyebrow-chip">
        <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
        11 plataformas externas · click external link to source console
      </span>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <div
            key={t.slug}
            className="surface-card rim-instr p-5"
            data-rim={t.hue}
            data-pop="true"
          >
            <div className="relative z-[2] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold">{t.name}</h3>
                <span
                  className="num rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.2em]"
                  style={{
                    color: `hsl(var(--hue-${t.hue}))`,
                    background: `hsl(var(--hue-${t.hue}) / 0.12)`,
                  }}
                >
                  {t.status}
                </span>
              </div>
              <div>
                <p className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                  {t.primaryKpi.label}
                </p>
                <p className="num font-display text-xl font-semibold tabular-nums">
                  {t.primaryKpi.value}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {t.secondaryKpis.map((k) => (
                  <div key={k.label}>
                    <p className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                      {k.label}
                    </p>
                    <p className="num text-[12px] tabular-nums">{k.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                {t.notes}
              </p>
              {t.link ? (
                <a
                  href={t.link}
                  target="_blank"
                  rel="noreferrer"
                  className="num self-start text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
                >
                  open console ↗
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
