"use client"
/**
 * AtlasDashboard · client island.
 *
 * Sprint 2 · Equipo B closeout · composes the 12 v2 sobrio components
 * onto the page in canonical order. Server component prefetches the
 * snapshot via `/api/atlas/snapshot` and hydrates it as `initialData`
 * to the TanStack Query cache (zero waterfall on first paint).
 */
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { AtlasSnapshotResponse } from "./types"
import { AtlasHeader } from "./components/AtlasHeader"
import { AtlasDriftAlert } from "./components/AtlasDriftAlert"
import { AtlasKpiGrid } from "./components/AtlasKpiGrid"
import { AtlasUtilizationBars } from "./components/AtlasUtilizationBars"
import { AtlasBrazosTable } from "./components/AtlasBrazosTable"
import { AtlasClientsTable } from "./components/AtlasClientsTable"
import { AtlasStackGrid } from "./components/AtlasStackGrid"
import { AtlasEndpointsSummary } from "./components/AtlasEndpointsSummary"
import { AtlasDriftList } from "./components/AtlasDriftList"
import { AtlasGitActivity } from "./components/AtlasGitActivity"
import { AtlasIntegrationsHealth } from "./components/AtlasIntegrationsHealth"
import { AtlasFooter } from "./components/AtlasFooter"

interface AtlasDashboardProps {
  initialSnapshot: AtlasSnapshotResponse | null
}

export function AtlasDashboard({ initialSnapshot }: AtlasDashboardProps) {
  const queryClient = useQueryClient()

  // Seed the snapshot + its sub-streams into the TanStack cache so the
  // 12 child components hit warm data on first render · no waterfall.
  useEffect(() => {
    if (!initialSnapshot) return
    queryClient.setQueryData(["atlas", "snapshot"], initialSnapshot)
    if (initialSnapshot.agents) {
      queryClient.setQueryData(["atlas", "agents"], initialSnapshot.agents)
    }
    if (initialSnapshot.workflows) {
      queryClient.setQueryData(["atlas", "workflows"], initialSnapshot.workflows)
    }
    if (initialSnapshot.clients) {
      queryClient.setQueryData(["atlas", "clients"], initialSnapshot.clients)
    }
    if (initialSnapshot.drift) {
      queryClient.setQueryData(["atlas", "drift"], initialSnapshot.drift)
    }
    if (initialSnapshot.git) {
      queryClient.setQueryData(["atlas", "git"], initialSnapshot.git)
    }
    if (initialSnapshot.integrations) {
      queryClient.setQueryData(
        ["atlas", "integrations-health"],
        initialSnapshot.integrations,
      )
    }
  }, [initialSnapshot, queryClient])

  return (
    <div className="flex flex-col gap-6">
      <AtlasHeader />
      <AtlasDriftAlert />
      <AtlasKpiGrid />
      <AtlasUtilizationBars />
      <AtlasBrazosTable />
      <AtlasClientsTable />
      <AtlasStackGrid />
      <AtlasEndpointsSummary />
      <AtlasDriftList />
      <AtlasGitActivity />
      <AtlasIntegrationsHealth />
      <AtlasFooter />
    </div>
  )
}
