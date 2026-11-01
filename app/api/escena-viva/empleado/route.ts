/**
 * GET /api/escena-viva/empleado?agente=<slug>
 * La ficha de un empleado de la oficina (CC6 · Sprint B): su currículum con lo real de la base. Solo administrador. Solo lectura.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerFichaDelEmpleado } from "@/lib/escena-empleado-datos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const SLUG = /^[a-z0-9][a-z0-9_-]{1,79}$/i

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "unauthenticated" : "forbidden" }, { status: puerta.status })
  const agente = new URL(req.url).searchParams.get("agente") ?? ""
  if (!SLUG.test(agente)) return NextResponse.json({ ok: false, error: "agente_invalido" }, { status: 400 })
  try {
    const ficha = await leerFichaDelEmpleado(getServiceRoleClient(), agente)
    if (!ficha) return NextResponse.json({ ok: false, error: "no_existe" }, { status: 404 })
    return NextResponse.json({ ok: true, ...ficha }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
