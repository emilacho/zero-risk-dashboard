/**
 * PLAN DE 90 DÍAS · lectura (servidor, SOLO LECTURA · sprint 6.5). Un error de la base lanza; nunca se lee como «sin plan».
 * Fuentes: `clients` (elegibles) · `cadena_campanas` (la campaña viva del cliente) · `client_historical_outputs` (el documento del plan al que apunta la campaña,
 * o el último) · `cadena_estrategias` (la última versión) · `cadena_calendario_filas` (cuántas publicaciones) · `cadena_esperas` (las vivas) · `hitl_queue`
 * (la última revisión del plan). La interpretación es de `lib/plan.ts`.
 * CICLO DEL PLAN (CC6 · 01-nov · contrato CC1 §2): el documento que se muestra es el VIGENTE (la última fila `campaign_plan_90d` del cliente que no esté
 * rechazada ni reemplazada; si no hay ninguna así, el que señala la campaña); con él se leen su compuerta (`plan_aprobaciones`) y su pedido de cambios abierto
 * (`plan_cambios`). Si esas dos tablas todavía no existen en la plataforma (antes de la «ventana» de CC1) el ciclo se marca «no disponible»: no se esconde ni se
 * inventa; cualquier OTRO error de la base sigue lanzando.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { clientesParaElegir } from "@/lib/clientes-datos"
import { faseActiva, hoyEnEcuador, type FaseActiva } from "@/lib/pizarron"
import { agruparEsperas, decisionDelPlanLegible, estrategiaDelContenido, marcasDelChequeo, planDelTexto, puntosDeLoNoBuscado, puntosDelAviso, versionDelTag, type CicloDelPlan, type EstrategiaLeida, type GrupoDeEsperas, type MarcaDelChequeo, type PlanLeido } from "@/lib/plan"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
type C = PromiseLike<{ count: number | null; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
async function una(q: R, que: string): Promise<Fila | null> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? null) as Fila | null }
async function contar(q: C, que: string): Promise<number> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return r.count ?? 0 }
const t = (v: unknown): string | null => (typeof v === "string" && v ? v : null)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

const ESTADOS_VIVOS = ["abierta", "estrategia", "calendario", "activa", "pausada", "necesita_humano"]

export interface PlanDelCliente {
  clientes: Array<{ id: string; nombre: string; con_campana: boolean }>
  cliente: { id: string; nombre: string } | null
  hoy: string
  campana: null | {
    id: string; estado: string; estado_motivo: string | null; desde: string | null; hasta: string | null; sedes: string[]
    /** lo máximo que gasta la PLANEACIÓN de esta campaña (no es pauta ni presupuesto del cliente) */
    tope_planeacion_usd: number | null
    /** si la oficina produce las piezas sola cuando el calendario las pide */
    autoproducir: boolean
    publicaciones: number; version_calendario: number | null; creada_en: string | null; actualizada_en: string | null
  }
  estrategia: null | ({ version: number | null; estado: string; creada_en: string | null; costo_usd: number | null; texto_md: string | null } & EstrategiaLeida)
  fase_activa: FaseActiva
  documento: null | {
    id: string; titulo: string; creado_en: string | null; actualizado_en: string | null; status: string | null
    estado_del_plan: string | null; marcas: MarcaDelChequeo[]; aviso_del_chequeo: string[]; no_se_busco: string[]
    jefatura: { resultado: string | null; marcado_en: string | null } | null
    plan: PlanLeido | null; prosa: string | null; caracteres: number
  }
  /** la última revisión del plan en la bandeja (pendiente o ya decidida) */
  revision: null | { id: string; titulo: string; creada_en: string; status: string; decision: string | null; vence_en: string | null }
  esperas: { vivas: number; grupos: GrupoDeEsperas[] }
  /** el ciclo del plan sobre la versión vigente (null sin documento) */
  ciclo: CicloDelPlan | null
  leido_en: string
}

/** una tabla que puede no existir todavía (las del ciclo, antes de la «ventana»): falta = true; cualquier otro error lanza */
const TABLA_QUE_FALTA = /schema cache|does not exist|PGRST20[45]|42P01/i
async function opcional(q: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>, que: string): Promise<{ falta: boolean; fila: Fila | null }> {
  const r = await q
  if (r.error) { if (TABLA_QUE_FALTA.test(`${r.error.code ?? ""} ${r.error.message}`)) return { falta: true, fila: null }; throw new Error(`${que}: ${r.error.message}`) }
  return { falta: false, fila: (r.data ?? null) as Fila | null }
}
const detalleCorto = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null
  const o = obj(v)
  const m = t(o.motivo) ?? t(o.error) ?? t(o.mensaje)
  return m ?? (Object.keys(o).length ? JSON.stringify(o).slice(0, 160) : null)
}
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null)

async function leerCiclo(supa: SupabaseClient, d: Fila | null, versiones: Fila[]): Promise<CicloDelPlan | null> {
  if (!d) return null
  const id = String(d.id)
  const tag = versionDelTag(d.provenance_tag)
  const [ap, pc] = await Promise.all([
    opcional(supa.from("plan_aprobaciones").select("*").eq("plan_id", id).limit(1).maybeSingle(), "plan_aprobaciones"),
    opcional(supa.from("plan_cambios").select("*").eq("plan_id", id).in("estado", ["pendiente", "en_reescritura"]).limit(1).maybeSingle(), "plan_cambios"),
  ])
  return {
    disponible: !ap.falta && !pc.falta,
    version: tag.version,
    con_compuerta: tag.con_compuerta,
    historial: versiones.filter((v) => String(v.id) !== id).map((v) => { const x = versionDelTag(v.provenance_tag); return { id: String(v.id), version: x.version, creado_en: t(v.created_at), status: t(v.status), reemplaza_a: x.reemplaza_a, superseded_por: x.superseded_por } }),
    compuerta: ap.fila ? { estado: String(ap.fila.estado ?? ""), decidido_por: t(ap.fila.decidido_por), decidido_en: t(ap.fila.decidido_en), despertado: bool(ap.fila.despertado), despertar_detalle: detalleCorto(ap.fila.despertar_detalle) } : null,
    pedido: pc.fila ? { id: String(pc.fila.id), estado: String(pc.fila.estado ?? ""), texto: String(pc.fila.texto ?? ""), vuelta: pc.fila.vuelta == null ? null : Number(pc.fila.vuelta), despertado: bool(pc.fila.despertado), despertar_detalle: detalleCorto(pc.fila.despertar_detalle) } : null,
  }
}

export async function leerPlanDelCliente(supa: SupabaseClient, o: { cliente?: string | null; ahora?: Date } = {}): Promise<PlanDelCliente> {
  const ahora = o.ahora ?? new Date()
  const hoy = hoyEnEcuador(ahora)
  const [elegibles, campanas] = await Promise.all([
    clientesParaElegir(supa),
    filas(supa.from("cadena_campanas").select("id, client_id, estado, seco, creada_en").eq("seco", false).order("creada_en", { ascending: false }).limit(200), "cadena_campanas"),
  ])
  const conCampana = new Set(campanas.filter((c) => ESTADOS_VIVOS.includes(String(c.estado))).map((c) => String(c.client_id)))
  const clientes = elegibles.map((c) => ({ ...c, con_campana: conCampana.has(c.id) }))
  let elegido: { id: string; nombre: string } | null = (o.cliente && clientes.find((c) => c.id === o.cliente)) || null
  if (!elegido && o.cliente) {
    // pedido a propósito y fuera de la lista (ficha de práctica o dada de baja): se lee igual, sin agregarla a la lista
    const c = await una(supa.from("clients").select("id, name").eq("id", o.cliente).maybeSingle(), "clients")
    if (c) elegido = { id: String(c.id), nombre: String(c.name) }
  }
  if (!elegido) elegido = clientes.find((c) => c.con_campana) || clientes[0] || null
  const base = { clientes, hoy, leido_en: ahora.toISOString() }
  const vacio = (cliente: PlanDelCliente["cliente"]): PlanDelCliente => ({ ...base, cliente, campana: null, estrategia: null, fase_activa: faseActiva([], null, hoy), documento: null, revision: null, esperas: { vivas: 0, grupos: [] }, ciclo: null })
  if (!elegido) return vacio(null)
  const cliente = { id: elegido.id, nombre: elegido.nombre }

  const [camp, rev] = await Promise.all([
    una(supa.from("cadena_campanas").select("id, plan_id, estado, estado_motivo, fecha_inicio, fecha_fin, sedes, presupuesto_planificacion_usd, autoproducir, creada_en, actualizada_en").eq("client_id", cliente.id).eq("seco", false).order("creada_en", { ascending: false }).limit(1).maybeSingle(), "cadena_campanas"),
    una(supa.from("hitl_queue").select("id, title, status, decision, created_at, expires_at").eq("client_id", cliente.id).eq("type", "plan_con_pendientes").order("created_at", { ascending: false }).limit(1).maybeSingle(), "hitl_queue"),
  ])
  const revision: PlanDelCliente["revision"] = rev ? { id: String(rev.id), titulo: String(rev.title ?? ""), creada_en: String(rev.created_at ?? ""), status: String(rev.status ?? ""), decision: decisionDelPlanLegible(rev.status, rev.decision), vence_en: t(rev.expires_at) } : null

  // el documento: el VIGENTE del ciclo (contrato CC1 §2); si ninguna versión lo es, el que señala la campaña o, sin campaña, el último del cliente
  const versionesP = filas(supa.from("client_historical_outputs").select("id, status, created_at, provenance_tag").eq("client_id", cliente.id).eq("output_type", "campaign_plan_90d").order("created_at", { ascending: false }).limit(40), "client_historical_outputs")
  const docP = versionesP.then((versiones) => {
    const vigente = versiones.find((v) => v.status !== "rejected" && versionDelTag(v.provenance_tag).vigente)
    const planId = vigente ? String(vigente.id) : camp ? t(camp.plan_id) : null
    let qDoc = supa.from("client_historical_outputs").select("id, title, status, content_text, content, provenance_tag, created_at, updated_at").eq("client_id", cliente.id).eq("output_type", "campaign_plan_90d")
    qDoc = planId ? qDoc.eq("id", planId) : qDoc.order("created_at", { ascending: false })
    return una(qDoc.limit(1).maybeSingle(), "client_historical_outputs")
  })
  const cicloP = Promise.all([docP, versionesP]).then(([d, versiones]) => leerCiclo(supa, d, versiones))

  if (!camp) {
    const [d, ciclo] = await Promise.all([docP, cicloP])
    return { ...vacio(cliente), documento: documentoLeido(d), revision, ciclo }
  }
  const campId = String(camp.id)
  const [d, est, nFilas, ultimaVersion, esperas, ciclo] = await Promise.all([
    docP,
    una(supa.from("cadena_estrategias").select("version, estado, contenido, texto_md, costo_usd, creada_en").eq("campana_id", campId).eq("seco", false).order("version", { ascending: false }).limit(1).maybeSingle(), "cadena_estrategias"),
    contar(supa.from("cadena_calendario_filas").select("*", { count: "exact", head: true }).eq("campana_id", campId).eq("seco", false), "cadena_calendario_filas"),
    una(supa.from("cadena_calendario_filas").select("calendario_version").eq("campana_id", campId).eq("seco", false).order("calendario_version", { ascending: false }).limit(1).maybeSingle(), "cadena_calendario_filas"),
    filas(supa.from("cadena_esperas").select("objeto_tipo, motivo, vence_en, estado").eq("campana_id", campId).eq("estado", "viva").eq("seco", false).order("vence_en", { ascending: true }).limit(300), "cadena_esperas"),
    cicloP,
  ])
  const estrategia = est ? { version: est.version == null ? null : Number(est.version), estado: String(est.estado ?? ""), creada_en: t(est.creada_en), costo_usd: est.costo_usd == null ? null : Number(est.costo_usd), texto_md: t(est.texto_md), ...estrategiaDelContenido(est.contenido) } : null
  const desde = t(camp.fecha_inicio)
  const vivas = esperas.map((e) => ({ objeto_tipo: String(e.objeto_tipo ?? ""), motivo: t(e.motivo), vence_en: t(e.vence_en), estado: String(e.estado ?? "") }))
  return {
    ...base, cliente,
    campana: {
      id: campId, estado: String(camp.estado ?? ""), estado_motivo: t(camp.estado_motivo), desde, hasta: t(camp.fecha_fin),
      sedes: Array.isArray(camp.sedes) ? camp.sedes.map(String) : [],
      tope_planeacion_usd: camp.presupuesto_planificacion_usd == null ? null : Number(camp.presupuesto_planificacion_usd),
      autoproducir: camp.autoproducir === true,
      publicaciones: nFilas, version_calendario: ultimaVersion ? Number(ultimaVersion.calendario_version) : null,
      creada_en: t(camp.creada_en), actualizada_en: t(camp.actualizada_en),
    },
    estrategia,
    fase_activa: faseActiva(estrategia?.fases ?? [], desde, hoy),
    documento: documentoLeido(d),
    revision,
    esperas: { vivas: vivas.length, grupos: agruparEsperas(vivas) },
    ciclo,
  }
}

function documentoLeido(d: Fila | null): PlanDelCliente["documento"] {
  if (!d) return null
  const pt = obj(d.provenance_tag)
  const jef = obj(pt.jefatura_marcas)
  const reg = obj(pt.registro_interno)
  const leido = planDelTexto(d.content_text ?? d.content)
  const texto = typeof d.content_text === "string" ? d.content_text : typeof d.content === "string" ? d.content : ""
  return {
    id: String(d.id), titulo: String(d.title ?? "Plan de 90 días"), creado_en: t(d.created_at), actualizado_en: t(d.updated_at), status: t(d.status),
    estado_del_plan: t(pt.estado_del_plan), marcas: marcasDelChequeo(pt.pendientes), aviso_del_chequeo: puntosDelAviso(reg.aviso_del_chequeo), no_se_busco: puntosDeLoNoBuscado(reg.no_se_busco_del_sistema),
    jefatura: Object.keys(jef).length ? { resultado: t(jef.resultado), marcado_en: t(jef.marcado_en) } : null,
    plan: leido.plan, prosa: leido.prosa, caracteres: texto.length,
  }
}
