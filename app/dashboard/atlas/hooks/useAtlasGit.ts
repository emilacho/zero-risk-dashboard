"use client"
import { useQuery } from "@tanstack/react-query"
import type { AtlasGitResponse } from "../types"

async function fetchGit(): Promise<AtlasGitResponse> {
  const res = await fetch("/api/atlas/git", { cache: "no-store" })
  if (!res.ok) throw new Error(`Git fetch failed · HTTP ${res.status}`)
  return (await res.json()) as AtlasGitResponse
}

export function useAtlasGit() {
  return useQuery<AtlasGitResponse>({
    queryKey: ["atlas", "git"],
    queryFn: fetchGit,
  })
}
