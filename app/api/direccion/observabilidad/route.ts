/**
 * GET /api/direccion/observabilidad?desde=AAAA-MM-DD&hasta=AAAA-MM-DD · Observabilidad fácil de leer (6.47): los empleados que más fallan y más tardan.
 * Solo administrador. SOLO LECTURA: lee el libro de los empleados (`agent_invocations`) COMPLETO del período (sin el tope de 200 de la lista de corridas),
 * en hora de Ecuador como Dinero. El costo es la misma columna que suma Dinero.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { legible, todas } from "@/lib/dinero-completo"
import { nombreDeLaCorrida } from "@/lib/direccion-corridas"
import { empleadosDe, type FilaDeInvocacion } from "@/lib/observabilidad"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIA = /^\d{4}-\d{2}-\d{2}$/
/** el día de Ecuador (UTC−5, sin horario de verano) empieza a las 05:00 UTC */
const inicioDelDia = (d: string) => `${d}T05:00:00.000Z`
const finDelDia = (d: string) => { const t = new Date(`${d}T05:00:00.000Z`); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString() }

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const q = new URL(req.url).searchParams
  const desde = q.get("desde") ?? "", hasta = q.get("hasta") ?? ""
  if (!DIA.test(desde) || !DIA.test(hasta) || desde > hasta || Date.parse(hasta) - Date.parse(desde) > 62 * 86400_000) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  try {
    const db = getServiceRoleClient()
    const [filas, agentes] = await Promise.all([
      todas((a, b) => db.from("agent_invocations").select("agent_name, status, duration_ms, cost_usd, workflow_id, workflow_execution_id").gte("started_at", inicioDelDia(desde)).lt("started_at", finDelDia(hasta)).order("started_at", { ascending: true }).range(a, b), "agent_invocations"),
      todas((a, b) => db.from("agents").select("name, display_name").range(a, b), "agents"),
    ])
    const nombre = new Map(agentes.map((x) => [String(x.name), x.display_name ? String(x.display_name) : null]))
    const r = empleadosDe(filas as unknown as FilaDeInvocacion[], (s) => nombre.get(s) ?? legible(s), (w) => (w ? nombreDeLaCorrida(w, "") : ""))
    return NextResponse.json({ ok: true, desde, hasta, llamadas: filas.length, ...r }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
