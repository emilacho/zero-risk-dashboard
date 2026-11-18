/**
 * /api/flujo · el botón «Flujo de la campaña» del Centro de campaña. Solo un administrador con sesión (un `client_viewer` recibe 403).
 *   · GET  ?cliente=<id>                      → `{ ok, campana_id, flujo }` (el botón leído de la campaña real)
 *   · POST `{ campana_id, quiero: "parar" | "reanudar" }` → lo aplica la plataforma como decisión humana (`lib/flujo-de-campana.ts`)
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerFlujo, tocarFlujo } from "@/lib/flujo-de-campana"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const sinPuerta = (status: number) => NextResponse.json({ ok: false, error: status === 401 ? "sin_sesion" : "sin_permiso" }, { status })

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return sinPuerta(puerta.status)
  const cliente = new URL(req.url).searchParams.get("cliente")
  if (!cliente || !/^[0-9a-f-]{36}$/i.test(cliente)) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, ...(await leerFlujo(getServiceRoleClient(), cliente)) }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "base_no_responde", detalle: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return sinPuerta(puerta.status)
  const cuerpo = await req.json().catch(() => ({}))
  const r = await tocarFlujo(cuerpo, { supabase: getServiceRoleClient() })
  return NextResponse.json(r.cuerpo, { status: r.status })
}
