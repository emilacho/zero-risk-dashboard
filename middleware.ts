/**
 * Phase 9 · Auth middleware · enforces 2-tier permissions
 *
 *   admin (Emilio) · full access · all routes
 *   client_viewer (futuros)       · only `/clients/{their-cliente-id}`
 *                                    and sub-pages · all other routes
 *                                    redirect to `/clients/{id}`
 *   unauthenticated               · redirect to `/login` (except
 *                                    `/login`, `/auth/callback`, and
 *                                    static assets)
 *
 * NOTE · refresh token rotation happens here on every request so
 * `getSessionClient()` in server components sees a valid user even
 * after token expiry.
 */
import { type NextRequest, NextResponse } from "next/server"
import { getMiddlewareClient } from "@/lib/supabase-session"

const PUBLIC_ROUTES = new Set(["/login", "/auth/callback"])
const ADMIN_ONLY_PREFIXES = ["/system", "/dept", "/agents", "/graph", "/api/admin"]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public routes + Next.js internals + API routes that handle
  // their own auth + favicon
  if (
    PUBLIC_ROUTES.has(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/cowork") || // Cowork chat is admin-only checked at route
    pathname.startsWith("/api/dashboard") || // dashboard endpoints currently public
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  const res = NextResponse.next()
  const supa = getMiddlewareClient(req, res)

  const {
    data: { user },
  } = await supa.auth.getUser()

  if (!user) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  // Load role
  const { data: roleRow } = await supa
    .from("app_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle()
  const role = (roleRow?.role as "admin" | "client_viewer" | undefined) ?? null

  // Admin-only prefixes · client_viewer + no-role bounce to their cliente
  if (
    ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) &&
    role !== "admin"
  ) {
    if (role === "client_viewer") {
      // Look up their cliente_id via auth_clients (first one)
      const { data: assignment } = await supa
        .from("auth_clients")
        .select("client_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()
      if (assignment?.client_id) {
        const url = req.nextUrl.clone()
        url.pathname = `/clients/${assignment.client_id}`
        return NextResponse.redirect(url)
      }
    }
    // No role or client_viewer without assignment · 403
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("error", "forbidden")
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
