/**
 * GET /api/escena-viva
 * La escena viva de la oficina de marketing (CC6 · Sprint 1): quién trabaja ahora en cada mesa, quién falló hace poco y el equipo de cada mesa. Solo administrador. Solo lectura.
 * El navegador la pide cada pocos segundos; la respuesta ya trae `leido_en` y `fuente` para que la ficha diga de dónde sale cada dato.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerEscenaViva } from "@/lib/escena-avatares-datos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "unauthenticated" : "forbidden" }, { status: puerta.status })
  try {
    const t = await leerEscenaViva(getServiceRoleClient())
    return NextResponse.json({ ok: true, ...t })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
