/**
 * GET /api/direccion/corridas?dias=1|7|30&client_id=&resumen=1 · Tu oficina (6.26): la lista de corridas de los empleados (Observabilidad). Solo administrador.
 * SOLO LECTURA: el servidor lee la ruta certificada de la plataforma con la llave interna (que nunca llega al navegador). `resumen=1` no busca nombres en n8n
 * (lo usa la pantalla 9 del arco, que lee cada minuto).
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { leerCorridas } from "@/lib/direccion-corridas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const q = new URL(req.url).searchParams
  const dias = [1, 7, 30].includes(Number(q.get("dias"))) ? Number(q.get("dias")) : 7
  const cliente = q.get("client_id")
  if (cliente && !UUID.test(cliente)) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  const r = await leerCorridas({ dias, client_id: cliente, conNombres: q.get("resumen") !== "1" })
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status, headers: { "Cache-Control": "no-store" } })
  return NextResponse.json({ ok: true, ...r.datos }, { headers: { "Cache-Control": "no-store" } })
}
