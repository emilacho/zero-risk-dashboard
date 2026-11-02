/**
 * GET /api/plantel
 * Lo que el plantel de cada equipo necesita además del rendimiento (CC4 · 02-nov): trabajos en 30 días, desde cuándo trabaja, modelo, activo, costo frente a su promedio (en %). Solo administrador. Solo lectura.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerPlantel } from "@/lib/plantel-datos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "unauthenticated" : "forbidden" }, { status: puerta.status })
  try {
    const r = await leerPlantel(getServiceRoleClient())
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
