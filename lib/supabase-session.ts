/**
 * Server-component / route-handler / middleware Supabase clients ·
 * cookie-session aware. Use these to read the LOGGED-IN user's role
 * + scope. For service-role ops (write anywhere) keep using
 * `lib/supabase-server.ts`.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"

/**
 * For server components + route handlers · reads cookies via
 * `next/headers`. Suitable for `await supa.auth.getUser()` to identify
 * the logged-in user.
 */
export async function getSessionClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // server-component context · ignore (middleware refresh handles it)
          }
        },
      },
    },
  )
}

/**
 * For middleware · attaches cookie writes to the outgoing response.
 */
export function getMiddlewareClient(req: NextRequest, res: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
            res.cookies.set(name, value, options),
          )
        },
      },
    },
  )
}

export async function getCurrentRole(): Promise<{
  userId: string | null
  email: string | null
  role: "admin" | "client_viewer" | null
}> {
  const supa = await getSessionClient()
  const { data: userRes } = await supa.auth.getUser()
  if (!userRes?.user) return { userId: null, email: null, role: null }
  const { data: roleRow } = await supa
    .from("app_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .maybeSingle()
  return {
    userId: userRes.user.id,
    email: userRes.user.email ?? null,
    role: (roleRow?.role as "admin" | "client_viewer" | undefined) ?? null,
  }
}
