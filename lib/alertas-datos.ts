/**
 * LAS ALERTAS · lectura y marca «ya lo vi» (servidor). Un error de la base es excepción, nunca «no hay alertas».
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { claveValida, cruzarVistas, deCerebro, deCostos, deOficina, VENTANA_OFICINA_DIAS, type Alerta } from "@/lib/alertas"

type Fila = Record<string, unknown>

async function leer(q: PromiseLike<{ data: unknown; error: { message: string } | null }>, que: string): Promise<Fila[]> {
  const r = await q
  if (r.error) throw new Error(`${que}: ${r.error.message}`)
  return (r.data ?? []) as Fila[]
}

export interface LecturaDeAlertas { nuevas: Alerta[]; vistas: Alerta[]; leido_en: string }

export async function leerAlertas(supa: SupabaseClient, ahora: Date = new Date()): Promise<LecturaDeAlertas> {
  const desde = new Date(ahora.getTime() - VENTANA_OFICINA_DIAS * 86_400_000).toISOString()
  const [cerebro, costos, encargos, marcas] = await Promise.all([
    leer(supa.from("cerebro_alertas").select("clave, titulo, ultimo_detalle, repeticiones, abierto_en, ultima_en, cerrado_en").order("ultima_en", { ascending: false }).limit(200), "cerebro_alertas"),
    leer(supa.from("cost_alerts_state").select("threshold_key, last_fired_at, last_value_usd, threshold_usd").limit(200), "cost_alerts_state"),
    leer(supa.from("oficina_encargos").select("id, brief_id, familia, version_encargo, estado, con_desacuerdo, gasto_usd, tope_usd, dry_run, prueba, creado_en, cerrado_en").gte("creado_en", desde).order("creado_en", { ascending: false }).limit(200), "oficina_encargos"),
    leer(supa.from("alertas_vistas").select("clave, visto_en").limit(2000), "alertas_vistas"),
  ])
  const vistas: Record<string, string> = {}
  for (const m of marcas) vistas[String(m.clave)] = String(m.visto_en)
  return { ...cruzarVistas([...deCerebro(cerebro), ...deCostos(costos), ...deOficina(encargos, ahora)], vistas), leido_en: ahora.toISOString() }
}

export type ResultadoMarca = { status: 200; cuerpo: { ok: true; clave: string } } | { status: 400 | 500; cuerpo: { ok: false; error: string } }

/** guarda «ya lo vi» para una alerta (o actualiza el instante si ya estaba) */
export async function marcarVista(supa: SupabaseClient, cuerpo: unknown, quien: string, ahora: Date = new Date()): Promise<ResultadoMarca> {
  const clave = (cuerpo as { clave?: unknown } | null)?.clave
  if (!claveValida(clave)) return { status: 400, cuerpo: { ok: false, error: "clave_invalida" } }
  const { error } = await supa.from("alertas_vistas").upsert({ clave, visto_en: ahora.toISOString(), visto_por: quien }, { onConflict: "clave" })
  if (error) return { status: 500, cuerpo: { ok: false, error: "no_se_pudo_guardar" } }
  return { status: 200, cuerpo: { ok: true, clave } }
}
