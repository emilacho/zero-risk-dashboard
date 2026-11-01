import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerGranIdea } from "@/lib/gran-idea-datos"

export const dynamic = "force-dynamic"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** DASHBOARD NUEVO · SPRINT 6.10 · la gran idea del cliente (solo lectura · solo administrador). `?cliente=<uuid>` elige el cliente · `?tarjeta=<id>` una tarjeta en particular. */
export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const sp = new URL(req.url).searchParams
  const cliente = sp.get("cliente"), tarjeta = sp.get("tarjeta")
  if (cliente && !UUID.test(cliente)) return NextResponse.json({ ok: false, error: "cliente_invalido" }, { status: 400 })
  if (tarjeta && !UUID.test(tarjeta)) return NextResponse.json({ ok: false, error: "tarjeta_invalida" }, { status: 400 })
  try {
    const g = await leerGranIdea(getServiceRoleClient(), { cliente, tarjeta })
    return NextResponse.json({ ok: true, ...g }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
