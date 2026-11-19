import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerCentro } from "@/lib/centro-datos"
import { elegirCampana } from "@/lib/campana-elegida"
import { loDeLaCampana, trabajandoEnLaCampana } from "@/lib/campana-datos"

export const dynamic = "force-dynamic"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** DASHBOARD NUEVO · SPRINT 6.10 · la segunda línea de los cuadros del Centro de campaña (solo lectura · solo administrador). `?cliente=<uuid>` · 19-nov `?campana=<uuid>` elige la campaña (`campana-elegida.ts`). */
export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const sp = new URL(req.url).searchParams
  const cliente = sp.get("cliente"), campana = sp.get("campana")
  if (cliente && !UUID.test(cliente)) return NextResponse.json({ ok: false, error: "cliente_invalido" }, { status: 400 })
  if (campana && !UUID.test(campana)) return NextResponse.json({ ok: false, error: "campana_invalida" }, { status: 400 })
  try {
    const sb = getServiceRoleClient()
    const centro = await leerCentro(sb, { cliente, campana })
    // 19-nov · varias campañas (parte C · CC1): Equipo y Dinero de la MISMA campaña que eligió la regla común (la pedida, o la primera viva);
    // `de_la_campana` se SUMA, lo demás sigue igual · sin cliente o sin campaña: null
    const elegida = centro.cliente ? await elegirCampana(sb, centro.cliente, campana) : null
    const lo = elegida ? await loDeLaCampana(sb, String(elegida.id)) : null
    const de_la_campana = lo && lo.client_id === centro.cliente ? { campana_id: lo.campana_id, gastado_usd: lo.gastado_usd, trabajando: await trabajandoEnLaCampana(sb, lo) } : null
    return NextResponse.json({ ok: true, ...centro, de_la_campana }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
