/**
 * POST /api/piezas/{id}/gran-idea/banco · el banco de ideas de la gran idea APROBADA: editar en tanda o retirar una idea (17-nov · GO Lenovo «construir»).
 * Cuerpo: `{ accion: "editar", version, cambios: [{ idea_id, campos: { idea?, mensaje?, gancho?, protagonista? } }] }` o `{ accion: "retirar", version, idea_id }`.
 * Solo un administrador con sesión. La lógica vive en `lib/banco-de-ideas.ts` (probada sin red); la escritura la hace la plataforma.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { pedirAlBanco } from "@/lib/banco-de-ideas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// 19-nov · G1c «límites técnicos al máximo» (Lenovo 22:06Z · CC5): 800 s, el máximo del plan de Vercel; reenvía a la plataforma y no debe cortarla antes (antes 60)
export const maxDuration = 800

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  const cuerpo = await req.json().catch(() => ({}))
  const r = await pedirAlBanco(id, cuerpo, { supabase: getServiceRoleClient(), revisor: puerta.email ?? "emilio" })
  return NextResponse.json(r.cuerpo, { status: r.status })
}
