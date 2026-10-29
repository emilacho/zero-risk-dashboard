/**
 * POST /api/piezas/{id}/decidir · Aprobar / Pedir cambios / Rechazar una pieza. Solo un administrador con sesión.
 * Cuerpo: `{ accion: "aprobar"|"cambios"|"rechazar", comentario?, laminas?: number[], casilla?: boolean, estado_visto?: string }`.
 * La lógica vive en `lib/piezas-decision.ts` (probada sin red).
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { decidirPieza } from "@/lib/piezas-decision"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  const cuerpo = await req.json().catch(() => ({}))
  const r = await decidirPieza(id, cuerpo, { supabase: getServiceRoleClient(), revisor: puerta.email ?? "emilio" })
  return NextResponse.json(r.cuerpo, { status: r.status })
}
