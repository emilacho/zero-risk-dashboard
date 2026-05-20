"use client"
/**
 * AtlasQueryProvider · client-only QueryClientProvider wrapper.
 *
 * Uses lazy-init pattern via useState to ensure a single QueryClient
 * instance per browser session (Next 15 server-component compatible ·
 * caller wraps `<AtlasDashboard>` client island en este provider).
 */
import { useState, type ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { makeQueryClient } from "./query-client"

export function AtlasQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => makeQueryClient())
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
