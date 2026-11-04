/**
 * POST /api/direccion/decisiones/contestar · Tu oficina › Decisiones (04-nov): Emilio responde, descarta o firma en el mismo lugar. Solo administrador.
 * Cuerpo: `{ id, accion: "responder"|"descartar"|"aceptar", respuesta?, motivo? }`. El tablero no escribe la base: lo hace la puerta de la plataforma
 * de cada fuente (ver `lib/decisiones-contestar.ts`). US$ 0.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { contestarDecision } from "@/lib/decisiones-contestar"
import { vaciarCache } from "@/lib/cache-corta"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 800 // la ruta de la pausa puede soltar el plan en el mismo pedido (la suya también es 800)

export async function POST(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const cuerpo = await req.json().catch(() => null)
  const r = await contestarDecision(cuerpo, { revisor: puerta.email ?? "emilio" })
  vaciarCache() // la próxima lectura (la antena, la oficina) ya ve el cambio
  return NextResponse.json(r.cuerpo, { status: r.status, headers: { "Cache-Control": "no-store" } })
}
