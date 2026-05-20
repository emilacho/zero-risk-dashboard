"use client"
import { useQuery } from "@tanstack/react-query"
import type { AtlasDriftResponse } from "../types"

async function fetchDrift(): Promise<AtlasDriftResponse> {
  const res = await fetch("/api/atlas/drift", { cache: "no-store" })
  if (!res.ok) throw new Error(`Drift fetch failed · HTTP ${res.status}`)
  return (await res.json()) as AtlasDriftResponse
}

export function useAtlasDrift() {
  return useQuery<AtlasDriftResponse>({
    queryKey: ["atlas", "drift"],
    queryFn: fetchDrift,
  })
}
