/**
 * GET /api/piezas/{id}/video · el mp4 de una pieza de video (T8 · 31-oct), servido POR el tablero y solo a un administrador con sesión.
 * Igual que la lámina: no se pide al almacén público directo. Reenvía `Range` para que el reproductor pueda adelantar y retroceder.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { direccionDelVideoDeUnaPieza } from "@/lib/piezas-datos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** las cabeceras del almacén que el reproductor necesita; ninguna otra pasa */
export const CABECERAS_QUE_PASAN = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"] as const

export function cabecerasDelVideo(h: Headers): Record<string, string> {
  const out: Record<string, string> = { "Cache-Control": "private, max-age=300" }
  for (const k of CABECERAS_QUE_PASAN) { const v = h.get(k); if (v) out[k] = v }
  if (!out["content-type"]) out["content-type"] = "video/mp4"
  return out
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "pedido_invalido" }, { status: 400 })
  const url = await direccionDelVideoDeUnaPieza(getServiceRoleClient(), id)
  if (!url) return NextResponse.json({ error: "sin_video" }, { status: 404 })
  const rango = req.headers.get("range")
  const r = await fetch(url, { cache: "no-store", headers: rango ? { Range: rango } : {} }).catch(() => null)
  if (!r || (!r.ok && r.status !== 206)) return NextResponse.json({ error: "almacen_sin_respuesta" }, { status: 502 })
  return new NextResponse(r.body, { status: r.status, headers: cabecerasDelVideo(r.headers) })
}
