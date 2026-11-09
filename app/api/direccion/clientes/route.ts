/**
 * GET /api/direccion/clientes · el selector de cliente de la barra superior (6.42 · 06-nov selector único): los clientes de verdad (sin pruebas, fichas
 * archivadas ni dados de baja · 6.43, repetidos juntados por nombre) con su id (el de los paneles), la ruta de su vista financiera y el estado de su
 * última campaña (lo mismo que dice el panel). Solo administrador. SOLO LECTURA (tablas `clients` y `cadena_campanas`).
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { clientesDelSelector, conIdYCampana, esDadoDeBaja } from "@/lib/cliente-financiero"
import { grupoDeCliente, nombresUnificados } from "@/lib/dinero-completo"
import { ESTADOS_VIVOS } from "@/lib/pizarron-datos"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const supa = getServiceRoleClient()
  const [r, camp] = await Promise.all([
    supa.from("clients").select("id, name, status").limit(1000),
    supa.from("cadena_campanas").select("client_id, estado, seco, creada_en").eq("seco", false).order("creada_en", { ascending: false }).limit(200),
  ])
  if (r.error) return NextResponse.json({ ok: false, error: r.error.message }, { status: 502, headers: { "Cache-Control": "no-store" } })
  // 6.43 · Emilio: los clientes dados de baja (churned) no van en la lista
  const filas = ((r.data ?? []) as Array<{ id: string; name: string | null; status: string | null }>).filter((c) => !esDadoDeBaja(c.status))
  const unificado = nombresUnificados(filas.map((c) => String(c.name ?? "")))
  const nombres = filas.map((c) => grupoDeCliente(unificado.get(String(c.name ?? "")) ?? c.name, c.id).cliente)
  // si las campañas no se leen, la lista sale igual, sin estado (nunca un estado inventado)
  const campanas = camp.error ? null : ((camp.data ?? []) as Array<{ client_id: unknown; estado: unknown }>)
  return NextResponse.json({ ok: true, clientes: conIdYCampana(clientesDelSelector(nombres), filas, nombres, campanas, ESTADOS_VIVOS) }, { headers: { "Cache-Control": "no-store" } })
}
