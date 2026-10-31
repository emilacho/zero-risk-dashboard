/**
 * GET /api/piezas/{id} · el detalle de una pieza (láminas, textos, pie, avisos, jefatura, mesa) para el panel nuevo. Solo un administrador con sesión.
 * La lectura es la de siempre (`cargarPieza`); decidir sigue en `POST /api/piezas/{id}/decidir` y la lámina en `/lamina/{n}`.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { cargarPieza } from "@/lib/piezas-datos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  try {
    const pieza = await cargarPieza(getServiceRoleClient(), id)
    if (!pieza) return NextResponse.json({ ok: false, error: "no_existe" }, { status: 404 })
    return NextResponse.json({ ok: true, pieza }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
