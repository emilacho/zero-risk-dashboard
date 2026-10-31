import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerBandeja } from "@/lib/bandeja-datos"

export const dynamic = "force-dynamic"

/** DASHBOARD NUEVO · SPRINT 6.6 · la bandeja de piezas (solo lectura · solo administrador). `?estado=pendiente|todas` (por omisión, pendiente). */
export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const estado = new URL(req.url).searchParams.get("estado") === "todas" ? "todas" : "pendiente"
  try {
    const bandeja = await leerBandeja(getServiceRoleClient(), { estado })
    return NextResponse.json({ ok: true, ...bandeja }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
