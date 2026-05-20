import { headers } from "next/headers"
import { ReportsDashboard, type ReportsSnapshot } from "./ReportsDashboard"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function loadInitial(): Promise<ReportsSnapshot | null> {
  try {
    const h = await headers()
    const host = h.get("host") ?? "localhost:3000"
    const protocol = host.startsWith("localhost") ? "http" : "https"
    const [posthogRes, atlasRes] = await Promise.all([
      fetch(`${protocol}://${host}/api/reports/posthog-summary`, {
        cache: "no-store",
      }),
      fetch(`${protocol}://${host}/api/atlas/snapshot`, { cache: "no-store" }),
    ])
    const posthog = posthogRes.ok ? await posthogRes.json() : null
    const atlas = atlasRes.ok ? await atlasRes.json() : null
    return { posthog, atlas } as ReportsSnapshot
  } catch {
    return null
  }
}

export default async function ReportsPage() {
  const initial = await loadInitial()
  return <ReportsDashboard initial={initial} />
}
