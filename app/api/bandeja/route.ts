import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerBandeja } from "@/lib/bandeja-datos"

export const dynamic = "force-dynamic"

/** DASHBOARD NUEVO · SPRINT 6.6 · la bandeja de piezas (solo lectura · solo administrador). `?estado=pendiente|todas` (por omisión, pendiente) · `?campana=<uuid>` (19-nov). */
export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const url = new URL(req.url)
  const estado = url.searchParams.get("estado") === "todas" ? "todas" : "pendiente"
  // 19-nov · varias campañas: `?campana=<uuid>` filtra las piezas por la campaña elegida en el Centro
  const campana = url.searchParams.get("campana")
  if (campana && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campana)) return NextResponse.json({ ok: false, error: "campana_invalida" }, { status: 400 })
  try {
    const bandeja = await leerBandeja(getServiceRoleClient(), { estado, ...(campana ? { campana } : {}) })
    return NextResponse.json({ ok: true, ...bandeja }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
