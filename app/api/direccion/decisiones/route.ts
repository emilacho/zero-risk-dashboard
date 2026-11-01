/**
 * GET /api/direccion/decisiones · Tu oficina (6.20): todo lo que espera la firma de Emilio, de cualquier departamento. Solo administrador. SOLO LECTURA:
 * el servidor lee la ruta certificada de la plataforma con la llave interna (que nunca llega al navegador) y devuelve la lista revisada.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { leerDecisiones } from "@/lib/direccion-decisiones"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const r = await leerDecisiones()
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status, headers: { "Cache-Control": "no-store" } })
  return NextResponse.json({ ok: true, ...r.datos }, { headers: { "Cache-Control": "no-store" } })
}
