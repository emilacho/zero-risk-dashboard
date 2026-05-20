"use client"
import { useQuery } from "@tanstack/react-query"
import type { AtlasSnapshotResponse } from "../types"

async function fetchSnapshot(): Promise<AtlasSnapshotResponse> {
  const res = await fetch("/api/atlas/snapshot", { cache: "no-store" })
  if (!res.ok) throw new Error(`Snapshot fetch failed · HTTP ${res.status}`)
  return (await res.json()) as AtlasSnapshotResponse
}

export function useAtlasSnapshot(initialData?: AtlasSnapshotResponse) {
  return useQuery<AtlasSnapshotResponse>({
    queryKey: ["atlas", "snapshot"],
    queryFn: fetchSnapshot,
    initialData,
  })
}
