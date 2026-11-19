/**
 * VARIAS CAMPAÑAS · parte C (ajuste de Emilio 22:07 Zúrich · GO de Lenovo a CC1): lo de UNA campaña para los cuadros Piezas, Equipo y Dinero del Centro.
 * SOLO LECTURA. La plataforma guarda en cada encargo su campaña (`oficina_encargos.campana_id`, #1245 · migración 202611192230).
 *
 * Qué encargos son de la campaña:
 *   · los que tienen SU `campana_id`;
 *   · y, si la campaña es la de siempre (sin llave: nació del plan), también los de ese cliente SIN campaña creados desde que nació: antes de
 *     las varias campañas, todo lo del cliente era de la campaña viva de ese momento. Una campaña con llave nunca se queda con los viejos.
 * Si la base todavía no tiene las columnas nuevas, se lee como antes: todo lo del cliente desde que nació la campaña (nunca se cae).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { MINUTOS_TRABAJANDO } from "@/lib/organigrama"

export interface LoDeLaCampana {
  campana_id: string
  client_id: string
  /** los encargos REALES (no de ensayo) de la campaña */
  encargos: string[]
  /** lo gastado por la campaña (US$): la planificación (`cadena_corridas`) + las piezas (`oficina_encargos.gasto_usd`) */
  gastado_usd: number
}

type Fila = Record<string, unknown>
const faltaColumna = (m: string | undefined, col: string) => new RegExp(col).test(m ?? "")

/** la campaña (real, no de ensayo) y si es la de siempre (sin llave) · null si no existe */
async function laCampana(supa: SupabaseClient, campanaId: string): Promise<{ id: string; client_id: string; creada_en: string; sin_llave: boolean } | null> {
  const leer = (c: string) => supa.from("cadena_campanas").select(c).eq("id", campanaId).eq("seco", false).maybeSingle()
  let r = await leer("id, client_id, creada_en, llave_de_campana")
  if (r.error && faltaColumna(r.error.message, "llave_de_campana")) r = await leer("id, client_id, creada_en")
  if (r.error) throw new Error(`leer la campaña: ${r.error.message}`)
  const c = r.data as unknown as Fila | null
  if (!c) return null
  return { id: String(c.id), client_id: String(c.client_id), creada_en: String(c.creada_en ?? ""), sin_llave: typeof c.llave_de_campana !== "string" }
}

/** lo de una campaña: sus encargos y lo gastado · null si la campaña no existe o es de ensayo · un error de la base lanza (nunca un cero inventado) */
export async function loDeLaCampana(supa: SupabaseClient, campanaId: string): Promise<LoDeLaCampana | null> {
  const c = await laCampana(supa, campanaId)
  if (!c) return null
  const base = () => supa.from("oficina_encargos").select("id, gasto_usd, campana_id").eq("client_id", c.client_id).eq("dry_run", false).limit(2000)
  const suyos = await base().eq("campana_id", c.id)
  let filas: Fila[]
  if (suyos.error && faltaColumna(suyos.error.message, "campana_id")) {
    // la base sin la columna: todo lo del cliente desde que nació la campaña (como antes)
    const r = await supa.from("oficina_encargos").select("id, gasto_usd").eq("client_id", c.client_id).eq("dry_run", false).gte("creado_en", c.creada_en).limit(2000)
    if (r.error) throw new Error(`leer los encargos: ${r.error.message}`)
    filas = (r.data ?? []) as Fila[]
  } else {
    if (suyos.error) throw new Error(`leer los encargos: ${suyos.error.message}`)
    filas = (suyos.data ?? []) as Fila[]
    if (c.sin_llave) {
      const viejos = await base().is("campana_id", null).gte("creado_en", c.creada_en)
      if (viejos.error) throw new Error(`leer los encargos: ${viejos.error.message}`)
      filas = [...filas, ...((viejos.data ?? []) as Fila[])]
    }
  }
  const corridas = await supa.from("cadena_corridas").select("costo_usd").eq("campana_id", c.id).eq("seco", false).limit(5000)
  if (corridas.error) throw new Error(`leer las corridas: ${corridas.error.message}`)
  const suma = (xs: Fila[], k: string) => xs.reduce((s, x) => s + (Number.isFinite(Number(x[k])) ? Number(x[k]) : 0), 0)
  const gastado = suma((corridas.data ?? []) as Fila[], "costo_usd") + suma(filas, "gasto_usd")
  return { campana_id: c.id, client_id: c.client_id, encargos: [...new Set(filas.map((f) => String(f.id)))], gastado_usd: Math.round(gastado * 10000) / 10000 }
}

/** quiénes trabajan AHORA en la campaña: los empleados con una corrida abierta (de los últimos MINUTOS_TRABAJANDO) sobre un encargo de la campaña */
export async function trabajandoEnLaCampana(supa: SupabaseClient, lo: LoDeLaCampana, ahora: Date = new Date()): Promise<string[]> {
  if (!lo.encargos.length) return []
  const desde = new Date(ahora.getTime() - MINUTOS_TRABAJANDO * 60_000).toISOString()
  const r = await supa.from("agent_invocations").select("agent_name, trabajo_id").eq("client_id", lo.client_id).in("trabajo_id", lo.encargos).is("ended_at", null).gte("started_at", desde).limit(500)
  if (r.error) throw new Error(`leer las corridas abiertas: ${r.error.message}`)
  return [...new Set(((r.data ?? []) as Fila[]).map((x) => String(x.agent_name ?? "")).filter(Boolean))].sort()
}
