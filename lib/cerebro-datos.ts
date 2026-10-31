/**
 * CEREBRO · lectura (servidor, SOLO LECTURA · sprint 6.8). Un error de la base lanza; nunca se lee como «cerebro vacío».
 * Fuentes: `cerebro_fichas` (las vigentes = `retirada_en IS NULL`, sin las descartadas) · `client_competitive_landscape` (competidores analizados) ·
 * `client_icp_documents` (cliente ideal) · `cerebro_dueno_preguntas` (lo que las oficinas esperan del dueño) · `client_sedes` · `client_brain_chunks` (cuántos trozos ya busca el sistema).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { clientesParaElegir } from "@/lib/clientes-datos"
import { esCompetidorReal, fichaDeCompetidorAnalizado, fichaDesdeFila, ordenarFichas, perfilDesdeFila, preguntaDesdeFila, type FichaDelCerebro, type PerfilIdeal, type PreguntaPendiente } from "@/lib/cerebro"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
type C = PromiseLike<{ count: number | null; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
async function una(q: R, que: string): Promise<Fila | null> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? null) as Fila | null }
async function contar(q: C, que: string): Promise<number> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return r.count ?? 0 }

const COLUMNAS_DE_FICHA = "id, clase, titulo, que_es, contenido, origen, propiedad, sede, atributo, alcance, fuente_url, observado_en, vigente_hasta, decision, razon_de_decision, porque, creado_en, descartada, provenance_tag"

export interface CerebroDelCliente {
  clientes: Array<{ id: string; nombre: string }>
  cliente: { id: string; nombre: string } | null
  /** las fichas vigentes (sin descartadas) + los competidores analizados, de la más nueva a la más vieja */
  fichas: FichaDelCerebro[]
  perfiles: PerfilIdeal[]
  preguntas: PreguntaPendiente[]
  sedes: Array<{ clave: string; ciudad: string | null }>
  /** trozos del índice de búsqueda que las oficinas consultan */
  trozos: number
  /** fichas retiradas (archivadas por reemplazo u otro motivo) y descartadas (vigentes pero juzgadas sin valor) */
  retiradas: number
  descartadas: number
  leido_en: string
}

export async function leerCerebroDelCliente(supa: SupabaseClient, o: { cliente?: string | null; ahora?: Date } = {}): Promise<CerebroDelCliente> {
  const ahora = o.ahora ?? new Date()
  const clientes = await clientesParaElegir(supa)
  let elegido: { id: string; nombre: string } | null = (o.cliente && clientes.find((c) => c.id === o.cliente)) || null
  if (!elegido && o.cliente) {
    // pedido a propósito y fuera de la lista (ficha de práctica o dada de baja): se lee igual, sin agregarla a la lista
    const c = await una(supa.from("clients").select("id, name").eq("id", o.cliente).maybeSingle(), "clients")
    if (c) elegido = { id: String(c.id), nombre: String(c.name) }
  }
  if (!elegido) elegido = clientes[0] ?? null
  const base = { clientes, leido_en: ahora.toISOString() }
  if (!elegido) return { ...base, cliente: null, fichas: [], perfiles: [], preguntas: [], sedes: [], trozos: 0, retiradas: 0, descartadas: 0 }
  const id = elegido.id

  const [vigentes, competidores, perfiles, preguntas, sedes, trozos, retiradas] = await Promise.all([
    filas(supa.from("cerebro_fichas").select(COLUMNAS_DE_FICHA).eq("client_id", id).is("retirada_en", null).order("observado_en", { ascending: false, nullsFirst: false }).limit(3000), "cerebro_fichas"),
    filas(supa.from("client_competitive_landscape").select("id, competitor_name, competitor_type, value_proposition, key_differentiators, weaknesses, last_analyzed_at, analysis_source, content_text, created_at").eq("client_id", id).limit(200), "client_competitive_landscape"),
    filas(supa.from("client_icp_documents").select("*").eq("client_id", id).order("segment_priority", { ascending: true, nullsFirst: false }).limit(50), "client_icp_documents"),
    filas(supa.from("cerebro_dueno_preguntas").select("id, tema, pregunta, canal, preguntado_por_oficina, preguntado_por_agente, creado_en, sede_clave").eq("client_id", id).eq("estado", "pendiente").order("creado_en", { ascending: false }).limit(100), "cerebro_dueno_preguntas"),
    filas(supa.from("client_sedes").select("clave, ciudad").eq("client_id", id).limit(50), "client_sedes"),
    contar(supa.from("client_brain_chunks").select("id", { count: "exact", head: true }).eq("client_id", id), "client_brain_chunks"),
    contar(supa.from("cerebro_fichas").select("id", { count: "exact", head: true }).eq("client_id", id).not("retirada_en", "is", null), "cerebro_fichas retiradas"),
  ])
  const descartadas = vigentes.filter((f) => f.descartada === true).length
  const fichas = ordenarFichas([...vigentes.filter((f) => f.descartada !== true).map(fichaDesdeFila), ...competidores.filter(esCompetidorReal).map(fichaDeCompetidorAnalizado)])
  return {
    ...base, cliente: elegido, fichas,
    perfiles: perfiles.map(perfilDesdeFila),
    preguntas: preguntas.map(preguntaDesdeFila),
    sedes: sedes.map((s) => ({ clave: String(s.clave), ciudad: s.ciudad ? String(s.ciudad) : null })).sort((a, b) => a.clave.localeCompare(b.clave, "es")),
    trozos, retiradas, descartadas,
  }
}
