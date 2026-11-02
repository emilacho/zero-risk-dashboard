/**
 * GET /api/direccion/corridas/resumen?desde=AAAA-MM-DD&hasta=AAAA-MM-DD[&client_id=] · 6.50 · Observabilidad: las cifras ENTERAS del período (corridas,
 * errores, por día), sin el tope de 200 ejecuciones de la lista. Solo administrador. SOLO LECTURA: lee la ruta de la plataforma (CC1 · #853) con la
 * llave interna, que nunca llega al navegador. Máximo 92 días.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { FECHA, leerResumenDeCorridas } from "@/lib/direccion-corridas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fechaValida = (d: string | null): d is string => !!d && FECHA.test(d) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const q = new URL(req.url).searchParams
  const desde = q.get("desde"), hasta = q.get("hasta"), cliente = q.get("client_id")
  if (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  if ((Date.parse(hasta) - Date.parse(desde)) / 86400_000 + 1 > 92) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  if (cliente && !UUID.test(cliente)) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  const r = await leerResumenDeCorridas({ desde, hasta, client_id: cliente })
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status, headers: { "Cache-Control": "no-store" } })
  return NextResponse.json({ ok: true, ...r.datos }, { headers: { "Cache-Control": "no-store" } })
}
