/**
 * GET /api/direccion/fallas-del-flujo?desde=AAAA-MM-DD&hasta=AAAA-MM-DD[&client_id=] · 6.51 · Observabilidad: los pedidos cuyo FLUJO falló
 * (se cortó la conexión, un paso pasó de su límite…) aunque los empleados hayan terminado bien. Solo administrador. SOLO LECTURA: `plan_cambios`
 * con estado «fallido» y su motivo, en hora de Ecuador.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { nombresUnificados, todas } from "@/lib/dinero-completo"
import { normalizarFallas } from "@/lib/fallas-del-flujo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIA = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** el día de Ecuador (UTC−5, sin horario de verano) empieza a las 05:00 UTC */
const inicioDelDia = (d: string) => `${d}T05:00:00.000Z`
const finDelDia = (d: string) => { const t = new Date(`${d}T05:00:00.000Z`); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString() }

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const q = new URL(req.url).searchParams
  const desde = q.get("desde") ?? "", hasta = q.get("hasta") ?? "", cliente = q.get("client_id")
  if (!DIA.test(desde) || !DIA.test(hasta) || desde > hasta || Date.parse(hasta) - Date.parse(desde) > 92 * 86400_000) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  if (cliente && !UUID.test(cliente)) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  try {
    const db = getServiceRoleClient()
    const [filas, clientes] = await Promise.all([
      todas((a, b) => {
        let x = db.from("plan_cambios").select("id, client_id, estado, documento, seccion, workflow_execution_id, creado_en, actualizado_en, despertar_detalle").eq("estado", "fallido").gte("creado_en", inicioDelDia(desde)).lt("creado_en", finDelDia(hasta))
        if (cliente) x = x.eq("client_id", cliente)
        return x.order("creado_en", { ascending: false }).range(a, b)
      }, "plan_cambios"),
      todas((a, b) => db.from("clients").select("id, name").range(a, b), "clients"),
    ])
    const unificado = nombresUnificados(clientes.map((c) => String(c.name)))
    const nombre = new Map(clientes.map((c) => [String(c.id), unificado.get(String(c.name)) ?? String(c.name)]))
    return NextResponse.json({ ok: true, desde, hasta, fallas: normalizarFallas(filas, nombre) }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
