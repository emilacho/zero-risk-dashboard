import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let serverClient: SupabaseClient | null = null

/**
 * Server-side Supabase client · service-role key · NEVER expose to browser.
 * Reads same prod project as the rest of the Zero Risk platform (shared
 * `zero-risk-platform` Supabase Pro project · NOT a separate database).
 *
 * Phase 1 endpoints will use this for: agents stats · clients list ·
 * cascade outputs · agent_invocations rollups · etc.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (serverClient) return serverClient
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
  }
  serverClient = createClient(url, key, { auth: { persistSession: false } })
  return serverClient
}

/**
 * Anon-key client · safe for browser if needed for read-only RLS-protected
 * queries. Phase 1 will favor server components reading via admin.
 */
export function getSupabaseAnon(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}
