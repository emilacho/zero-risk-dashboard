/**
 * GET /api/direccion/clientes · el selector «Seleccionar cliente» de la barra superior (6.42): los clientes de verdad (sin pruebas, fichas archivadas ni dados de baja · 6.43,
 * repetidos juntados por nombre) con la ruta de su vista financiera. Solo administrador. SOLO LECTURA (tabla `clients`).
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { clientesDelSelector, esDadoDeBaja } from "@/lib/cliente-financiero"
import { grupoDeCliente, nombresUnificados } from "@/lib/dinero-completo"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const r = await getServiceRoleClient().from("clients").select("id, name, status").limit(1000)
  if (r.error) return NextResponse.json({ ok: false, error: r.error.message }, { status: 502, headers: { "Cache-Control": "no-store" } })
  // 6.43 · Emilio: los clientes dados de baja (churned) no van en la lista
  const filas = ((r.data ?? []) as Array<{ id: string; name: string | null; status: string | null }>).filter((c) => !esDadoDeBaja(c.status))
  const unificado = nombresUnificados(filas.map((c) => String(c.name ?? "")))
  const nombres = filas.map((c) => grupoDeCliente(unificado.get(String(c.name ?? "")) ?? c.name, c.id).cliente)
  return NextResponse.json({ ok: true, clientes: clientesDelSelector(nombres) }, { headers: { "Cache-Control": "no-store" } })
}
