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
import { API_PUBLICAS, llaveInternaValida } from "@/lib/api-gate"

const PUBLIC_ROUTES = new Set(["/login", "/auth/callback"])
// Page prefixes (NOT api prefixes · api routes self-gate)
const ADMIN_ONLY_PREFIXES = ["/system", "/dept", "/agents", "/graph", "/workflows"]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Public routes + Next.js internals + favicon pass straight through
  if (PUBLIC_ROUTES.has(pathname) || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next()
  }

  // /api/* · DENY BY DEFAULT (29-oct · Fase 0): internal key OR admin session OR explicit allowlist
  if (pathname.startsWith("/api/")) {
    if (API_PUBLICAS.has(pathname) || llaveInternaValida(req)) return NextResponse.next()
    const resApi = NextResponse.next()
    const supaApi = getMiddlewareClient(req, resApi)
    const { data: { user: userApi } } = await supaApi.auth.getUser()
    if (!userApi) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })
    const { data: rolApi } = await supaApi.from("app_roles").select("role").eq("user_id", userApi.id).maybeSingle()
    if (rolApi?.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
    return resApi
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
