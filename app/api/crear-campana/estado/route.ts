/**
 * GET /api/crear-campana/estado?cliente=…&llave=… · cómo va el pedido de «Crear Campaña» (en proceso · nacida · fallida), para que el formulario siga en
 * «Campaña en proceso» mientras la plataforma se arregla sola y diga «El intento falló» solo cuando de verdad falló (21-nov · GO Lenovo 10:28Z · contrato
 * de CC1 10:29Z). Solo un administrador con sesión. Solo lectura: lo sabe la plataforma; el tablero no lo inventa.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { leerEstadoDelPedido } from "@/lib/crear-campana"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const q = new URL(req.url).searchParams
  const r = await leerEstadoDelPedido(q.get("cliente") ?? "", q.get("llave") ?? "")
  return NextResponse.json(r.cuerpo, { status: r.status, headers: { "cache-control": "no-store" } })
}
