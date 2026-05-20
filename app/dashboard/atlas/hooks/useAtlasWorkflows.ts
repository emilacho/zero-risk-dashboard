"use client"
import { useQuery } from "@tanstack/react-query"
import type { AtlasWorkflowsResponse } from "../types"

async function fetchWorkflows(): Promise<AtlasWorkflowsResponse> {
  const res = await fetch("/api/atlas/workflows", { cache: "no-store" })
  if (!res.ok) throw new Error(`Workflows fetch failed · HTTP ${res.status}`)
  return (await res.json()) as AtlasWorkflowsResponse
}

export function useAtlasWorkflows() {
  return useQuery<AtlasWorkflowsResponse>({
    queryKey: ["atlas", "workflows"],
    queryFn: fetchWorkflows,
  })
}
