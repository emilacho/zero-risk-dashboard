"use client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { JourneyState, PipelineResponse } from "../types"

async function fetchPipeline(): Promise<PipelineResponse> {
  const res = await fetch("/api/pipeline/journeys", { cache: "no-store" })
  if (!res.ok) throw new Error(`Pipeline fetch failed · HTTP ${res.status}`)
  return (await res.json()) as PipelineResponse
}

export function usePipelineJourneys() {
  return useQuery<PipelineResponse>({
    queryKey: ["pipeline", "journeys"],
    queryFn: fetchPipeline,
  })
}

export function useMoveJourney() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; to_state: JourneyState; stage?: string }) => {
      const res = await fetch(`/api/pipeline/journeys/${vars.id}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to_state: vars.to_state, stage: vars.stage }),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "move failed")
      return data
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["pipeline", "journeys"] })
      const prev = qc.getQueryData<PipelineResponse>(["pipeline", "journeys"])
      if (prev) {
        const next: PipelineResponse = {
          ...prev,
          columns: { ...prev.columns },
        }
        // Find + remove from old column · push into new
        for (const k of Object.keys(next.columns) as JourneyState[]) {
          const list = next.columns[k]
          const idx = list.findIndex((c) => c.id === vars.id)
          if (idx >= 0) {
            const [card] = list.splice(idx, 1)
            next.columns[vars.to_state] = [
              { ...card, journey_state: vars.to_state },
              ...(next.columns[vars.to_state] ?? []),
            ]
            break
          }
        }
        qc.setQueryData(["pipeline", "journeys"], next)
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pipeline", "journeys"], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["pipeline", "journeys"] })
    },
  })
}
