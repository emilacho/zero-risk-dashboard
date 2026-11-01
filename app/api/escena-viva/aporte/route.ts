/**
 * GET /api/escena-viva/aporte?corrida=210273:analisis-mercado&agente=market_research_analyst
 * S4 · el aporte completo de un participante de la sala de reuniones (CC6). Solo administrador. Solo lectura.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerAporteCompleto } from "@/lib/escena-aporte-datos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const valido = (v: string | null, max: number) => !!v && v.length <= max && /^[\w:.\-]+$/.test(v)

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "unauthenticated" : "forbidden" }, { status: puerta.status })
  const u = new URL(req.url)
  const corrida = u.searchParams.get("corrida"), agente = u.searchParams.get("agente")
  if (!valido(corrida, 200) || !valido(agente, 120)) return NextResponse.json({ ok: false, error: "corrida_o_agente_invalido" }, { status: 400 })
  try {
    const a = await leerAporteCompleto(getServiceRoleClient(), corrida!, agente!)
    if (!a) return NextResponse.json({ ok: false, error: "sin_aporte" }, { status: 404 })
    return NextResponse.json({ ok: true, ...a })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
