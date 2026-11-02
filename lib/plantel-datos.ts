/**
 * EL PLANTEL · lectura (servidor, SOLO LECTURA · CC4 · 02-nov): por empleado, cuántos trabajos hizo en 30 días, desde cuándo trabaja, su modelo, si está activo y su costo frente a su promedio.
 * Un error de la base lanza; nunca se lee como «sin datos». `agent_invocations` corta en 1.000 filas por pedido: se pagina.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { nombreCanonico } from "@/lib/organigrama"
import { costoFrenteASuPromedio, VENTANA_DE_TRABAJO_DIAS, type DatosDelPlantel, type PlantelDeLaOficina } from "@/lib/plantel"

type Fila = Record<string, unknown>
const POR_PAGINA = 1000, MAX_PAGINAS = 10, VENTANA_DE_COSTO_DIAS = 90

export async function leerPlantel(supa: SupabaseClient, ahora: Date = new Date()): Promise<PlantelDeLaOficina> {
  const ag = await supa.from("agents").select("name, model, created_at, is_active").limit(2000)
  if (ag.error) throw new Error(`agents: ${ag.error.message}`)
  const desde90 = new Date(ahora.getTime() - VENTANA_DE_COSTO_DIAS * 86_400_000).toISOString()
  const desde30 = ahora.getTime() - VENTANA_DE_TRABAJO_DIAS * 86_400_000
  const trabajos: Fila[] = []
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const r = await supa.from("agent_invocations").select("agent_name, created_at, cost_usd").gte("created_at", desde90).order("created_at", { ascending: false }).range(p * POR_PAGINA, (p + 1) * POR_PAGINA - 1)
    if (r.error) throw new Error(`agent_invocations: ${r.error.message}`)
    const filas = (r.data ?? []) as Fila[]
    trabajos.push(...filas)
    if (filas.length < POR_PAGINA) break
  }
  const costo = (x: Fila) => (x.cost_usd == null || Number.isNaN(Number(x.cost_usd)) ? null : Number(x.cost_usd))
  const empleados: Record<string, DatosDelPlantel> = {}
  for (const a of (ag.data ?? []) as Fila[]) {
    const k = nombreCanonico(a.name)
    const mios = trabajos.filter((x) => nombreCanonico(x.agent_name) === k)
    const delMes = mios.filter((x) => Date.parse(String(x.created_at)) >= desde30)
    empleados[k] = {
      trabajos_30d: delMes.length,
      desde: typeof a.created_at === "string" ? a.created_at : null,
      modelo: typeof a.model === "string" && a.model ? a.model : null,
      activo: typeof a.is_active === "boolean" ? a.is_active : null,
      costo_vs_promedio_pct: costoFrenteASuPromedio(delMes.map(costo), mios.map(costo)),
    }
  }
  return { empleados, leido_en: ahora.toISOString() }
}
