/**
 * /api/flujo · el botón «Flujo de la campaña» del Centro de campaña. Solo un administrador con sesión (un `client_viewer` recibe 403).
 *   · GET  ?cliente=<id>                      → `{ ok, campana_id, flujo, campanas }` (el botón leído de la campaña real; `campanas` = las vivas del cliente con su nombre y su botón, 19-nov)
 *   · POST `{ campana_id, quiero: "parar" | "reanudar" }` → lo aplica la plataforma como decisión humana (`lib/flujo-de-campana.ts`)
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { campanasVivas, leerFlujo, tocarFlujo } from "@/lib/flujo-de-campana"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// 19-nov · G1c «límites técnicos al máximo» (Lenovo 22:06Z · CC5): 800 s, el máximo del plan de Vercel; reenvía a la plataforma y no debe cortarla antes (antes 60)
export const maxDuration = 800

const sinPuerta = (status: number) => NextResponse.json({ ok: false, error: status === 401 ? "sin_sesion" : "sin_permiso" }, { status })

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return sinPuerta(puerta.status)
  const cliente = new URL(req.url).searchParams.get("cliente")
  if (!cliente || !/^[0-9a-f-]{36}$/i.test(cliente)) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  try {
    const sb = getServiceRoleClient()
    // 19-nov · `campanas` se SUMA: `campana_id` y `flujo` siguen siendo los de siempre (el botón de hoy los lee)
    const [ultima, campanas] = await Promise.all([leerFlujo(sb, cliente), campanasVivas(sb, cliente)])
    return NextResponse.json({ ok: true, ...ultima, campanas }, { headers: { "Cache-Control": "no-store" } })
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
