/**
 * POST /api/acciones/{accion} · lo que Emilio hace desde el tablero (rehacer una pieza, aprobar un plan, encender una oficina…). Solo un administrador con sesión.
 * El tablero no escribe la base: la acción se valida aquí y la hace la plataforma (que deja el rastro en `eventos_de_emilio`). La lógica vive en `lib/tablero-acciones.ts`.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { ejecutarAccion } from "@/lib/tablero-acciones"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(req: Request, ctx: { params: Promise<{ accion: string }> }) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const { accion } = await ctx.params
  const cuerpo = await req.json().catch(() => ({}))
  const r = await ejecutarAccion(accion, cuerpo, { revisor: puerta.email ?? "emilio" })
  return NextResponse.json(r.cuerpo, { status: r.status })
}
