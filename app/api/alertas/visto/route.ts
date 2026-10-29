/**
 * POST /api/alertas/visto · «ya lo vi» de una alerta. Solo un administrador con sesión. Cuerpo: `{ clave }`.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { marcarVista } from "@/lib/alertas-datos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const cuerpo = await req.json().catch(() => null)
  const r = await marcarVista(getServiceRoleClient(), cuerpo, puerta.email ?? "emilio")
  return NextResponse.json(r.cuerpo, { status: r.status })
}
