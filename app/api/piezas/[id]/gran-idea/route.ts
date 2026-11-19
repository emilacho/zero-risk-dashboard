/**
 * POST /api/piezas/{id}/gran-idea · Aprobar / Pedir cambios sobre la tarjeta «Gran idea» de la cadena (T4). Solo un administrador con sesión.
 * Cuerpo: `{ accion: "aprobar"|"cambios", nota?, apunta_a?: "concepto"|"brief", estado_visto?: string }`.
 * La lógica vive en `lib/concepto-decision.ts` (probada sin red); la decisión la aplica la plataforma.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { decidirConcepto } from "@/lib/concepto-decision"

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
  const r = await decidirConcepto(id, cuerpo, { supabase: getServiceRoleClient(), revisor: puerta.email ?? "emilio" })
  return NextResponse.json(r.cuerpo, { status: r.status })
}
