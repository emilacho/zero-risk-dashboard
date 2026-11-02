/**
 * EL CLIENTE POR OMISIÓN (CC6 · 02-nov · correcciones de Lenovo aprobadas por Emilio: «nunca un cliente fijo»). Una sola regla para el Centro de campaña,
 * los paneles y la escena: campaña EN MARCHA → plan más reciente (el que espera decisión, sin contar los rechazados) → campaña en pausa → el primero.
 * El navegador manda antes al cliente que Emilio eligió (`lib/cliente-de-trabajo.ts`); esto es solo cuando no hay ninguno.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

type Fila = Record<string, unknown>
/** las campañas que de verdad están trabajando (sin la pausada) */
export const ESTADOS_EN_MARCHA = ["abierta", "estrategia", "calendario", "activa", "necesita_humano"]

export async function clientePorOmision<C extends { id: string; con_campana: boolean }>(supa: SupabaseClient, clientes: C[], campanas: Fila[]): Promise<C | null> {
  const enMarcha = new Set(campanas.filter((c) => ESTADOS_EN_MARCHA.includes(String(c.estado))).map((c) => String(c.client_id)))
  const porCampana = clientes.find((c) => enMarcha.has(c.id))
  if (porCampana) return porCampana
  const r = await supa.from("client_historical_outputs").select("client_id, status, created_at").eq("output_type", "campaign_plan_90d").order("created_at", { ascending: false }).limit(30)
  if (r.error) throw new Error(`client_historical_outputs: ${r.error.message}`)
  const planes = (r.data ?? []) as Fila[]
  const delPlan = planes.find((p) => p.status !== "rejected" && clientes.some((c) => c.id === String(p.client_id)))
  return (delPlan && clientes.find((c) => c.id === String(delPlan.client_id))) || clientes.find((c) => c.con_campana) || clientes[0] || null
}
