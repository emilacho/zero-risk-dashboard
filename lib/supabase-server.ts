/**
 * Supabase server-only client · service role · NEVER expose to browser.
 *
 * Used by /api/cowork/* routes to write/read cowork_messages bypassing
 * RLS. Loaded lazily so the bundle doesn't pull supabase-js into client
 * components by accident.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let cached: SupabaseClient | null = null

export function getServiceRoleClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Supabase env missing · need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY",
    )
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
