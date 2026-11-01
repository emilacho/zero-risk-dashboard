/**
 * INFORMES · lectura (servidor, SOLO LECTURA · sprint 6.9). Fuente: `client_reports` (los informes que arma la oficina para el cliente).
 * Un error de la base lanza; nunca se lee como «sin informes». Elige el cliente igual que el cerebro: el pedido, o el primero de la lista.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { clientesParaElegir } from "@/lib/clientes-datos"
import { analisisDesdeFila, informeDesdeFila, ordenarAnalisis, ordenarInformes, type Informe, type InformeDeAnalisis } from "@/lib/informes"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
async function una(q: R, que: string): Promise<Fila | null> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? null) as Fila | null }

export interface InformesDelCliente {
  clientes: Array<{ id: string; nombre: string }>
  cliente: { id: string; nombre: string } | null
  /** del más reciente al más viejo */
  informes: Informe[]
  /** los informes de la mesa de análisis (fichas `informe_de_analisis` vigentes del cerebro), del más reciente al más viejo */
  analisis: InformeDeAnalisis[]
  leido_en: string
}

export async function leerInformesDelCliente(supa: SupabaseClient, o: { cliente?: string | null; ahora?: Date } = {}): Promise<InformesDelCliente> {
  const ahora = o.ahora ?? new Date()
  const clientes = await clientesParaElegir(supa)
  let elegido: { id: string; nombre: string } | null = (o.cliente && clientes.find((c) => c.id === o.cliente)) || null
  if (!elegido && o.cliente) {
    const c = await una(supa.from("clients").select("id, name").eq("id", o.cliente).maybeSingle(), "clients")
    if (c) elegido = { id: String(c.id), nombre: String(c.name) }
  }
  if (!elegido) elegido = clientes[0] ?? null
  const base = { clientes, leido_en: ahora.toISOString() }
  if (!elegido) return { ...base, cliente: null, informes: [], analisis: [] }
  const [xs, fichas] = await Promise.all([
    filas(supa.from("client_reports").select("id, client_id, period_start, period_end, kind, summary, pdf_url, delivered_to, delivered_at, status, created_at").eq("client_id", elegido.id).order("period_end", { ascending: false }).limit(200), "client_reports"),
    // la mesa de análisis archiva sus informes en el cerebro: una ficha vigente (sin retirar ni descartar) por cliente y tipo
    filas(supa.from("cerebro_fichas").select("id, titulo, contenido, observado_en, creado_en, provenance_tag").eq("client_id", elegido.id).eq("clase", "informe_de_analisis").is("retirada_en", null).eq("descartada", false).order("creado_en", { ascending: false }).limit(50), "cerebro_fichas"),
  ])
  return { ...base, cliente: elegido, informes: ordenarInformes(xs.map(informeDesdeFila)), analisis: ordenarAnalisis(fichas.map(analisisDesdeFila)) }
}
