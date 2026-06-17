"use client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export interface LandingRow {
  id: string
  slug: string
  client_id: string | null
  title: string
  hero_headline: string
  hero_subhead: string | null
  hero_image_url: string | null
  cta_text: string
  cta_url: string
  sections: unknown[]
  meta_description: string | null
  meta_og_image_url: string | null
  is_active: boolean
  vertical: string | null
  created_at: string
  updated_at: string
}

export function useLandings() {
  return useQuery<{ rows: LandingRow[]; total: number }>({
    queryKey: ["sprint4", "landings"],
    queryFn: async () => {
      const res = await fetch("/api/landings", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { ok: boolean; rows: LandingRow[]; total: number; error?: string }
      if (!json.ok) throw new Error(json.error ?? "landings fetch failed")
      return { rows: json.rows, total: json.total }
    },
  })
}

export function useUpdateLanding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ slug, patch }: { slug: string; patch: Partial<LandingRow> }) => {
      const res = await fetch(`/api/landings/${slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      })
      const json = (await res.json()) as { ok: boolean; landing?: LandingRow; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error ?? "update failed")
      return json.landing!
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint4", "landings"] })
    },
  })
}
