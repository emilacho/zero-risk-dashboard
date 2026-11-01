/**
 * GET /api/direccion/riesgos · Tu oficina (6.21): riesgos y alarmas de toda la empresa (incidentes, fallas, topes, saldos, pausas). Solo administrador. SOLO LECTURA:
 * el servidor lee la ruta certificada de la plataforma con la llave interna (que nunca llega al navegador) y devuelve la lista revisada.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { leerRiesgos } from "@/lib/direccion-riesgos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const r = await leerRiesgos()
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status, headers: { "Cache-Control": "no-store" } })
  return NextResponse.json({ ok: true, ...r.datos }, { headers: { "Cache-Control": "no-store" } })
}
