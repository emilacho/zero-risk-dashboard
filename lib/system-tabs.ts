/**
 * /system Capa B · 8 tab canonical config.
 *
 * Each tab is its own page under `/system/{slug}` (NOT a query-string
 * tab) so it's individually bookmarkable + Vercel-cacheable. The shared
 * layout at `/system/layout.tsx` reads this config to render the
 * horizontal tab nav. Sidebar reads it for the System sub-tree.
 */
export interface SystemTab {
  slug: string
  label: string
  hue: "violet" | "cyan" | "amber" | "emerald" | "rose" | "orange" | "purple" | "teal" | "sky" | "lime"
  description: string
}

export const SYSTEM_TABS: SystemTab[] = [
  {
    slug: "agents",
    label: "Agents",
    hue: "cyan",
    description: "59 agents · model · invocations · cost · drill-down",
  },
  {
    slug: "workflows",
    label: "Workflows",
    hue: "amber",
    description: "58 n8n workflows · active/inactive · trigger · last exec",
  },
  {
    slug: "brazos",
    label: "Brazos",
    hue: "orange",
    description: "6 brazos operativos · GPT Image · Apify · Meta · Meshy · cascade · Camino III",
  },
  {
    slug: "plataformas",
    label: "Plataformas",
    hue: "violet",
    description: "11 external services · Vercel · Anthropic · OpenAI · Apify · GitHub · …",
  },
  {
    slug: "storage",
    label: "Storage",
    hue: "teal",
    description: "Supabase tables row counts + 3 buckets usage",
  },
  {
    slug: "memoria",
    label: "Memoria",
    hue: "lime",
    description: "Vault docs + memory graph + skills canonical",
  },
  {
    slug: "inbox",
    label: "Inbox",
    hue: "rose",
    description: "HITL queue + Cowork messages + Slack + Sentry + UptimeRobot",
  },
  {
    slug: "roadmap",
    label: "Roadmap",
    hue: "sky",
    description: "Current sprint · backlog · recent PRs + deploys",
  },
]

export const SYSTEM_TABS_BY_SLUG: Record<string, SystemTab> = Object.fromEntries(
  SYSTEM_TABS.map((t) => [t.slug, t]),
)
