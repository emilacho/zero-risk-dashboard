/**
 * GET /api/direccion/corridas/{ejecución} · Tu oficina (6.26): el árbol de pasos de UNA corrida (Observabilidad). Solo administrador. SOLO LECTURA.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { conTextos, leerCorrida, leerTextosDePasos } from "@/lib/direccion-corridas"
import { getServiceRoleClient } from "@/lib/supabase-server"

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
  // 6.27 · la entrada y la salida de cada paso se leen del libro de los empleados (la plataforma no las entrega en su ruta)
  const ids = r.datos.arbol.flatMap((x) => x.pasos.filter((p) => p.origen === "invocacion").map((p) => p.id))
  let textos: Awaited<ReturnType<typeof leerTextosDePasos>> = null
  try { textos = await leerTextosDePasos(getServiceRoleClient() as unknown as Parameters<typeof leerTextosDePasos>[0], ids) } catch { textos = null }
  const datos = textos ? conTextos(r.datos, textos) : r.datos
  return NextResponse.json({ ok: true, ...datos, textos: textos ? "leidos" : "sin_lectura" }, { headers: { "Cache-Control": "no-store" } })
}
