/**
 * GET /api/direccion/organizacion · Tu oficina (6.28-B): el organigrama vivo de toda la empresa. Solo administrador. SOLO LECTURA: departamentos, empleados,
 * equipos de marketing, directorio y quién trabaja en las últimas 24 h.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { leerOrganizacion } from "@/lib/direccion-organizacion"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  try {
    const org = await leerOrganizacion(getServiceRoleClient())
    return NextResponse.json({ ok: true, ...org }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "lectura_fallida" }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
