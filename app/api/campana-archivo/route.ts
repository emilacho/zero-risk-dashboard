/**
 * /api/campana-archivo · «Archivar» y «Eliminar» una campaña desde los lugares de campaña (26-nov · GO de Lenovo 11:57Z). Solo un administrador con sesión.
 *   · POST `{ campana_id, accion: "archivar" | "eliminar" }` → lo aplica la plataforma (`lib/archivo-de-campana.ts`)
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { tocarArchivo } from "@/lib/archivo-de-campana"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// reenvía a la plataforma, que puede tardar (eliminar borra en una sola operación): el máximo del plan
export const maxDuration = 800

export async function POST(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const cuerpo = await req.json().catch(() => ({}))
  const r = await tocarArchivo(cuerpo, { supabase: getServiceRoleClient() })
  return NextResponse.json(r.cuerpo, { status: r.status })
}
