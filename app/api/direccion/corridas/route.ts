/**
 * GET /api/direccion/corridas?dias=1|7|30&client_id=&resumen=1 · Tu oficina (6.26): la lista de corridas de los empleados (Observabilidad). Solo administrador.
 * SOLO LECTURA: el servidor lee la ruta certificada de la plataforma con la llave interna (que nunca llega al navegador). `resumen=1` no busca nombres en n8n
 * (lo usa la pantalla 9 del arco, que lee cada minuto).
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { leerCorridas } from "@/lib/direccion-corridas"
import { agruparLista, leerAgrupacion, type BaseDeLectura } from "@/lib/direccion-pedidos"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const q = new URL(req.url).searchParams
  // 6.47 · 1 a 30 días: Observabilidad pide el período elegido MÁS el anterior (mismo selector que Dinero), hasta lo que lee la plataforma
  const d = Number(q.get("dias")), dias = Number.isInteger(d) && d >= 1 && d <= 30 ? d : 7
  const cliente = q.get("client_id")
  if (cliente && !UUID.test(cliente)) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  const r = await leerCorridas({ dias, client_id: cliente, conNombres: q.get("resumen") !== "1" })
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status, headers: { "Cache-Control": "no-store" } })
  // 6.28 · una fila por pedido (como LangSmith): las ejecuciones que nacen del mismo pedido se juntan; si no se puede leer cómo se encadenan, la lista queda suelta y lo dice
  let agrupacion: Awaited<ReturnType<typeof leerAgrupacion>> = null
  try { agrupacion = await leerAgrupacion(getServiceRoleClient() as unknown as BaseDeLectura, r.datos.corridas.map((x) => x.workflow_execution_id)) } catch { agrupacion = null }
  const datos = agrupacion ? agruparLista(r.datos, agrupacion) : r.datos
  // 6.47 · cuántas ejecuciones tiene el período y cuántas llegaron (la plataforma entrega 200 por lectura): con esto la pantalla rotula «sobre las últimas N»
  return NextResponse.json({ ok: true, ...datos, agrupado: !!agrupacion, ejecuciones_total: r.datos.total, ejecuciones_leidas: r.datos.corridas.length }, { headers: { "Cache-Control": "no-store" } })
}
