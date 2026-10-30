/**
 * GET /api/agents/recent-feed?limite=8&desde=<ISO>
 * El panel «trabajo en tiempo real» del Inicio. Solo administrador. `desde` trae únicamente lo posterior (el navegador lo pide cada pocos segundos).
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerTrabajoEnVivo } from "@/lib/trabajo-en-vivo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "unauthenticated" : "forbidden" }, { status: puerta.status })
  const u = new URL(req.url)
  try {
    const t = await leerTrabajoEnVivo(getServiceRoleClient(), { limite: parseInt(u.searchParams.get("limite") ?? "8", 10) || 8, desde: u.searchParams.get("desde") })
    return NextResponse.json({ ok: true, ...t })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
