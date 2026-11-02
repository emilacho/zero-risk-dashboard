/**
 * GET /api/direccion/dinero · Tu oficina › Dinero (6.36): todo el gasto de la agencia. Solo administrador. SOLO LECTURA: movimientos de gasto de 62 días
 * (empleados y Apify) + saldos y freno de 24 h de la ruta certificada de riesgos. Si los riesgos no se pueden leer, Dinero igual abre y lo dice.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { leerDinero } from "@/lib/dinero-completo"
import { leerRiesgos } from "@/lib/direccion-riesgos"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  try {
    const r = await leerRiesgos().catch(() => null)
    const extra = r?.ok ? { saldos: r.datos.saldos, topes: r.datos.topes } : { faltan: ["Saldos de proveedores y freno de 24 h (no se pudo leer la ruta de riesgos)"] }
    const datos = await leerDinero(getServiceRoleClient(), extra)
    return NextResponse.json({ ok: true, ...datos }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "lectura_fallida" }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
