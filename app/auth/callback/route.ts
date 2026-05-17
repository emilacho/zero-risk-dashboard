/**
 * GET /auth/callback?code=...&next=/...
 *
 * Magic-link OTP callback · exchanges the code for a session cookie
 * via Supabase Auth, then redirects to `next` (defaults to "/").
 */
import { NextResponse, type NextRequest } from "next/server"
import { getMiddlewareClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") ?? "/"

  const res = NextResponse.redirect(new URL(next, url.origin))
  if (code) {
    const supa = getMiddlewareClient(req, res)
    await supa.auth.exchangeCodeForSession(code)
  }
  return res
}
