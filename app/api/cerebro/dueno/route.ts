import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { guardarDatoDelDueno } from "@/lib/cerebro-dueno"

export const dynamic = "force-dynamic"

/**
 * DASHBOARD NUEVO · SPRINT 6.8 · lo que el dueño escribe o corrige en el cerebro (solo administrador). Cuerpo: `{ client_id, tema, respuesta, pregunta?, sede_clave?, pregunta_id? }`.
 * No escribe en la base: lo manda a la puerta del dueño de la plataforma (`POST /api/brain/alimentar/dueno`) con la llave interna, como hacen Slack y el manual.
 */
export async function POST(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  let cuerpo: unknown
  try { cuerpo = await req.json() } catch { return NextResponse.json({ ok: false, error: "entrada_invalida", detalle: "el cuerpo no es JSON" }, { status: 400 }) }
  const r = await guardarDatoDelDueno(cuerpo)
  return NextResponse.json(r.cuerpo, { status: r.status, headers: { "Cache-Control": "no-store" } })
}
