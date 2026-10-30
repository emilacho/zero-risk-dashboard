/**
 * GET /api/en-vivo?limite=12&desde=<ISO>
 * La vista «En vivo» del dashboard nuevo. Solo administrador. `desde` trae únicamente lo registrado después (el navegador lo pide cada 5 s).
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerEnVivo } from "@/lib/en-vivo-datos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "unauthenticated" : "forbidden" }, { status: puerta.status })
  const u = new URL(req.url)
  try {
    const t = await leerEnVivo(getServiceRoleClient(), { limite: parseInt(u.searchParams.get("limite") ?? "12", 10) || 12, desde: u.searchParams.get("desde") })
    return NextResponse.json({ ok: true, ...t })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
