"use client"
import { useQuery } from "@tanstack/react-query"
import type { AtlasIntegrationsHealthResponse } from "../types"

async function fetchIntegrationsHealth(): Promise<AtlasIntegrationsHealthResponse> {
  const res = await fetch("/api/atlas/integrations-health", { cache: "no-store" })
  if (!res.ok) throw new Error(`Integrations health fetch failed · HTTP ${res.status}`)
  return (await res.json()) as AtlasIntegrationsHealthResponse
}

export function useAtlasIntegrationsHealth() {
  return useQuery<AtlasIntegrationsHealthResponse>({
    queryKey: ["atlas", "integrations-health"],
    queryFn: fetchIntegrationsHealth,
    staleTime: 120_000,
  })
}
