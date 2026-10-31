/**
 * GET /api/pizarron?cliente=<id>
 * El pizarrón de piezas del departamento de marketing (dashboard nuevo). Solo administrador. SOLO LECTURA: nada se decide por aquí.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerPizarron } from "@/lib/pizarron-datos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "unauthenticated" : "forbidden" }, { status: puerta.status })
  const u = new URL(req.url)
  const cliente = u.searchParams.get("cliente")
  if (cliente && !/^[0-9a-f-]{36}$/i.test(cliente)) return NextResponse.json({ ok: false, error: "cliente_invalido" }, { status: 400 })
  try {
    const p = await leerPizarron(getServiceRoleClient(), { cliente })
    return NextResponse.json({ ok: true, ...p })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
