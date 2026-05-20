import { headers } from "next/headers"
import { AtlasQueryProvider } from "./hooks/AtlasQueryProvider"
import { AtlasDashboard } from "./AtlasDashboard"
import type { AtlasSnapshotResponse } from "./types"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function fetchInitialSnapshot(): Promise<AtlasSnapshotResponse | null> {
  try {
    const h = await headers()
    const host = h.get("host") ?? "localhost:3000"
    const protocol = host.startsWith("localhost") ? "http" : "https"
    const res = await fetch(`${protocol}://${host}/api/atlas/snapshot`, {
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as AtlasSnapshotResponse
  } catch {
    return null
  }
}

export default async function AtlasPage() {
  const snapshot = await fetchInitialSnapshot()
  return (
    <AtlasQueryProvider>
      <AtlasDashboard initialSnapshot={snapshot} />
    </AtlasQueryProvider>
  )
}
