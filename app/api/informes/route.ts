import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerInformesDelCliente } from "@/lib/informes-datos"

export const dynamic = "force-dynamic"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** DASHBOARD NUEVO · SPRINT 6.9 · los informes del cliente (solo lectura · solo administrador). `?cliente=<uuid>` elige el cliente. */
export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const cliente = new URL(req.url).searchParams.get("cliente")
  if (cliente && !UUID.test(cliente)) return NextResponse.json({ ok: false, error: "cliente_invalido" }, { status: 400 })
  try {
    const informes = await leerInformesDelCliente(getServiceRoleClient(), { cliente })
    return NextResponse.json({ ok: true, ...informes }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
