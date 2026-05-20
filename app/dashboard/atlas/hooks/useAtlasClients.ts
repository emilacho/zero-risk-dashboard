"use client"
import { useQuery } from "@tanstack/react-query"
import type { AtlasClientsResponse } from "../types"

async function fetchClients(): Promise<AtlasClientsResponse> {
  const res = await fetch("/api/atlas/clients", { cache: "no-store" })
  if (!res.ok) throw new Error(`Clients fetch failed · HTTP ${res.status}`)
  return (await res.json()) as AtlasClientsResponse
}

export function useAtlasClients() {
  return useQuery<AtlasClientsResponse>({
    queryKey: ["atlas", "clients"],
    queryFn: fetchClients,
  })
}
