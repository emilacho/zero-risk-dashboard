/**
 * GET /api/direccion/corridas/{ejecución} · Tu oficina (6.26): el árbol de pasos de UNA corrida (Observabilidad). Solo administrador. SOLO LECTURA.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { leerCorrida } from "@/lib/direccion-corridas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const { id } = await ctx.params
  let ejecucion: string
  try { ejecucion = decodeURIComponent(id) } catch { return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 }) }
  const r = await leerCorrida(ejecucion)
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status, headers: { "Cache-Control": "no-store" } })
  return NextResponse.json({ ok: true, ...r.datos }, { headers: { "Cache-Control": "no-store" } })
}
