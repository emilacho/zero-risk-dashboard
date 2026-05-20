"use client"
/**
 * Atlas QueryClient · Sprint 2 scaffold.
 *
 * Sensible defaults para el dashboard ground-truth · staleTime 60s
 * (alineado con `revalidate = 60` en API routes) · gcTime 5min ·
 * refetchOnWindowFocus false (Atlas no necesita real-time chase).
 */
import { QueryClient } from "@tanstack/react-query"

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        retry: 1,
      },
    },
  })
}
