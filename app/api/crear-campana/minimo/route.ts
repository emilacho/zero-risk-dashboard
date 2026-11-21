/**
 * GET /api/crear-campana/minimo?cliente=…&inicio=…&fin=… · el mínimo del tope de una campaña nueva, para la pregunta «Tope» del formulario «Crear Campaña»
 * (20-nov · GO Lenovo 22:05 Zúrich). Solo un administrador con sesión. Lo calcula la plataforma (solo lectura); el tablero no lo inventa.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { fechasDelMinimo, leerMinimo } from "@/lib/crear-campana"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const q = new URL(req.url).searchParams
  // el mínimo depende de las fechas: se mandan las dos (bien escritas) o ninguna
  const r = await leerMinimo(q.get("cliente") ?? "", {}, fechasDelMinimo(q.get("inicio"), q.get("fin")))
  return NextResponse.json(r.cuerpo, { status: r.status, headers: { "cache-control": "no-store" } })
}
