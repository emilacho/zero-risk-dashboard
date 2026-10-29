/**
 * GET /api/piezas/{id}/lamina/{n} · la lámina `n` (1…) de una pieza, servida POR el tablero y solo a un administrador con sesión.
 * Así las imágenes ya no se piden al almacén público directo y el cubo `oficina-creativos` se podrá pasar a privado sin tocar la ventana.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { direccionDeLaLaminaDeUnaPieza } from "@/lib/piezas-datos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; n: string }> }) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const { id, n } = await ctx.params
  const num = Number(n)
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(num) || num < 1 || num > 60) return NextResponse.json({ error: "pedido_invalido" }, { status: 400 })
  const url = await direccionDeLaLaminaDeUnaPieza(getServiceRoleClient(), id, num)
  if (!url) return NextResponse.json({ error: "sin_lamina" }, { status: 404 })
  const r = await fetch(url, { cache: "no-store" }).catch(() => null)
  if (!r || !r.ok) return NextResponse.json({ error: "almacen_sin_respuesta" }, { status: 502 })
  return new NextResponse(r.body, { status: 200, headers: { "Content-Type": r.headers.get("content-type") ?? "image/png", "Cache-Control": "private, max-age=300" } })
}
