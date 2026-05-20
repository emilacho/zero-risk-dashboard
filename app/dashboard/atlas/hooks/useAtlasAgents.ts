"use client"
import { useQuery } from "@tanstack/react-query"
import type { AtlasAgentsResponse } from "../types"

async function fetchAgents(): Promise<AtlasAgentsResponse> {
  const res = await fetch("/api/atlas/agents", { cache: "no-store" })
  if (!res.ok) throw new Error(`Agents fetch failed · HTTP ${res.status}`)
  return (await res.json()) as AtlasAgentsResponse
}

export function useAtlasAgents() {
  return useQuery<AtlasAgentsResponse>({
    queryKey: ["atlas", "agents"],
    queryFn: fetchAgents,
  })
}
