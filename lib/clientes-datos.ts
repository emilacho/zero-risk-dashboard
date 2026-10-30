/**
 * CLIENTES · lectura (servidor, solo lectura). Un error de la base nunca se lee como «0»: la lectura lanza y la pantalla lo dice.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { DIAS_DEL_GASTO, esDeBaja, esDePractica, fasesDelPlan, gastoReal, ordenarClientes, type FasesDelPlan, type ResumenDeCliente } from "@/lib/clientes"
import { desde } from "@/lib/oficinas"
import { leerGasto } from "@/lib/gasto-datos"
import { estadoDeLaPiezaLegible, tituloDePieza } from "@/lib/lenguaje"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
type C = PromiseLike<{ count: number | null; error: { message: string } | null }>

async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
async function una(q: R, que: string): Promise<Fila | null> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? null) as Fila | null }
async function contar(q: C, que: string): Promise<number> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return r.count ?? 0 }

const por = (f: Fila[], col: string): Map<string, Fila[]> => { const m = new Map<string, Fila[]>(); for (const x of f) { const k = String(x[col] ?? ""); if (k) m.set(k, [...(m.get(k) ?? []), x]) } return m }

export async function listarClientes(supa: SupabaseClient, ahora: Date = new Date()): Promise<ResumenDeCliente[]> {
  const clientes = await filas(supa.from("clients").select("id, name, industry, status, archived_at").limit(200), "clients")
  const pend = await filas(supa.from("hitl_queue").select("client_id").eq("status", "pending").eq("type", "content_piece_review").limit(1000), "hitl_queue")
  const gastoTotal = new Map((await leerGasto(supa, ahora)).resumen.por_cliente.map((x) => [x.clave, x.total]))
  const trozos = await filas(supa.from("cerebro_fichas").select("client_id").is("retirada_en", null).limit(10000), "cerebro_fichas")
  const campanas = await filas(supa.from("cadena_campanas").select("client_id, estado, seco").order("creada_en", { ascending: false }).limit(200), "cadena_campanas")
  const pPend = por(pend, "client_id"), pTrozos = por(trozos, "client_id"), pCamp = por(campanas.filter((c) => c.seco !== true), "client_id")
  return ordenarClientes(clientes.map((c) => {
    const id = String(c.id)
    return { id, nombre: String(c.name), rubro: c.industry ? String(c.industry) : null, estado: String(c.status ?? ""), piezas_por_aprobar: pPend.get(id)?.length ?? 0, gasto_30d: gastoTotal.get(id) ?? 0, trozos_del_cerebro: pTrozos.get(id)?.length ?? 0, campana: pCamp.get(id)?.[0] ? String(pCamp.get(id)![0].estado) : null, de_baja: esDeBaja({ estado: String(c.status ?? ""), archivado: c.archived_at != null, nombre: String(c.name) }), de_practica: esDePractica({ rubro: c.industry ? String(c.industry) : null, nombre: String(c.name) }) }
  }))
}

export interface FilaDelCalendario { id: string; fecha: string; red: string; formato: string; tema: string; estado: string }
export interface EsperaDelPlan { id: string; motivo: string; vence_en: string | null }

export interface FichaDeCliente {
  cliente: { id: string; nombre: string; rubro: string | null; estado: string; mercado: string | null; sitio: string | null; creado: string | null }
  piezas: Array<{ id: string; titulo: string; estado: string; pendiente: boolean; creada: string }>
  plan: null | { campana_id: string; calendario: FilaDelCalendario[]; esperas: EsperaDelPlan[]; campana_estado: string; desde: string | null; hasta: string | null; presupuesto: number | null; version_estrategia: number | null; fases: FasesDelPlan[]; filas_del_calendario: number }
  gasto: { total_30d: number; agentes_30d: number; piezas_30d: number; llamadas_30d: number }
  cerebro: { fichas_vigentes: number; trozos: number }
  manual: null | { version: number | null; proposito: string | null; eslogan: string | null; voz: string | null; auto_generated: boolean; human_validated: boolean; gate: string | null }
  perfiles_de_cliente_ideal: number
}

export async function cargarFicha(supa: SupabaseClient, id: string, ahora: Date = new Date()): Promise<FichaDeCliente | null> {
  const c = await una(supa.from("clients").select("id, name, industry, status, market, website_url, created_at").eq("id", id).maybeSingle(), "clients")
  if (!c) return null
  const piezas = await filas(supa.from("hitl_queue").select("id, title, status, created_at, metadata").eq("client_id", id).eq("type", "content_piece_review").order("created_at", { ascending: false }).limit(20), "hitl_queue")
  const camp = await una(supa.from("cadena_campanas").select("id, estado, fecha_inicio, fecha_fin, presupuesto_planificacion_usd").eq("client_id", id).eq("seco", false).order("creada_en", { ascending: false }).limit(1).maybeSingle(), "cadena_campanas")
  let plan: FichaDeCliente["plan"] = null
  if (camp) {
    const est = await una(supa.from("cadena_estrategias").select("version, contenido").eq("campana_id", camp.id).eq("seco", false).order("version", { ascending: false }).limit(1).maybeSingle(), "cadena_estrategias")
    const nFilas = await contar(supa.from("cadena_calendario_filas").select("*", { count: "exact", head: true }).eq("campana_id", camp.id).eq("seco", false), "cadena_calendario_filas")
    const cal = await filas(supa.from("cadena_calendario_filas").select("id, fecha, red, formato, tema, estado").eq("campana_id", camp.id).eq("seco", false).order("fecha", { ascending: true }).limit(200), "cadena_calendario_filas")
    const esp = await filas(supa.from("cadena_esperas").select("id, motivo, vence_en").eq("campana_id", camp.id).eq("estado", "viva").eq("seco", false).order("vence_en", { ascending: true }).limit(50), "cadena_esperas")
    plan = { campana_id: String(camp.id), calendario: cal.map((x) => ({ id: String(x.id), fecha: String(x.fecha ?? ""), red: String(x.red ?? ""), formato: String(x.formato ?? ""), tema: String(x.tema ?? ""), estado: String(x.estado ?? "") })), esperas: esp.map((x) => ({ id: String(x.id), motivo: String(x.motivo ?? ""), vence_en: x.vence_en ? String(x.vence_en) : null })), campana_estado: String(camp.estado), desde: camp.fecha_inicio ? String(camp.fecha_inicio) : null, hasta: camp.fecha_fin ? String(camp.fecha_fin) : null, presupuesto: camp.presupuesto_planificacion_usd == null ? null : Number(camp.presupuesto_planificacion_usd), version_estrategia: est ? Number(est.version) : null, fases: fasesDelPlan(est?.contenido), filas_del_calendario: nFilas }
  }
  const inv = await filas(supa.from("agent_invocations").select("cost_usd").eq("client_id", id).gte("created_at", desde(DIAS_DEL_GASTO, ahora)).limit(10000), "agent_invocations")
  const enc = await filas(supa.from("oficina_encargos").select("gasto_usd, dry_run").eq("client_id", id).gte("creado_en", desde(DIAS_DEL_GASTO, ahora)).limit(1000), "oficina_encargos")
  const fichas = await contar(supa.from("cerebro_fichas").select("*", { count: "exact", head: true }).eq("client_id", id).is("retirada_en", null), "cerebro_fichas")
  const trozos = await contar(supa.from("client_brain_chunks").select("*", { count: "exact", head: true }).eq("client_id", id), "client_brain_chunks")
  const b = await una(supa.from("client_brand_books").select("version, brand_purpose, tagline, voice_description, auto_generated, human_validated, gate_outcome").eq("client_id", id).order("version", { ascending: false }).limit(1).maybeSingle(), "client_brand_books")
  const icp = await contar(supa.from("client_icp_documents").select("*", { count: "exact", head: true }).eq("client_id", id), "client_icp_documents")
  const g = await leerGasto(supa, ahora)
  const totalGasto = g.resumen.por_cliente.find((x) => x.clave === id)?.total ?? 0
  const estado = (s: unknown) => (s === "pending" ? "por aprobar" : s === "approved" ? "aprobada" : s === "rejected" ? "rechazada" : s === "edited" ? "con cambios pedidos" : estadoDeLaPiezaLegible(s))
  return {
    cliente: { id: String(c.id), nombre: String(c.name), rubro: c.industry ? String(c.industry) : null, estado: String(c.status ?? ""), mercado: c.market ? String(c.market) : null, sitio: c.website_url ? String(c.website_url) : null, creado: c.created_at ? String(c.created_at) : null },
    piezas: piezas.map((p) => ({ id: String(p.id), titulo: tituloDePieza({ familia: (p.metadata as Record<string, unknown> | null)?.familia, tituloCrudo: p.title, cliente: null, creada: String(p.created_at) }), estado: estado(p.status), pendiente: p.status === "pending", creada: String(p.created_at) })),
    plan,
    gasto: { total_30d: totalGasto, agentes_30d: gastoReal(inv, "cost_usd"), piezas_30d: gastoReal(enc, "gasto_usd"), llamadas_30d: inv.length },
    cerebro: { fichas_vigentes: fichas, trozos },
    manual: b ? { version: b.version == null ? null : Number(b.version), proposito: b.brand_purpose ? String(b.brand_purpose) : null, eslogan: b.tagline ? String(b.tagline) : null, voz: b.voice_description ? String(b.voice_description) : null, auto_generated: b.auto_generated === true, human_validated: b.human_validated === true, gate: b.gate_outcome ? String(b.gate_outcome) : null } : null,
    perfiles_de_cliente_ideal: icp,
  }
}

/** los clientes que se pueden elegir en un formulario (reales, en servicio o nuevos): sin dados de baja ni prácticas */
export async function clientesParaElegir(supa: SupabaseClient): Promise<Array<{ id: string; nombre: string }>> {
  const c = await filas(supa.from("clients").select("id, name, industry, status, archived_at").limit(200), "clients")
  return c
    .filter((x) => !esDeBaja({ estado: String(x.status ?? ""), archivado: x.archived_at != null, nombre: String(x.name) }) && !esDePractica({ rubro: x.industry ? String(x.industry) : null, nombre: String(x.name) }))
    .map((x) => ({ id: String(x.id), nombre: String(x.name) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
}
