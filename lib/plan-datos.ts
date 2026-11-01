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
import { agruparEsperas, nombreDelTramo, separarEsperas, type TopeDelTramo, decisionDelPlanLegible, estrategiaDelContenido, marcasDelChequeo, planDelTexto, puntosDeLoNoBuscado, puntosDelAviso, avanceDelPedido, queCambioDelTexto, versionDelTag, type CicloDelPlan, type EstrategiaLeida, type GrupoDeEsperas, type MarcaDelChequeo, type PlanLeido } from "@/lib/plan"

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
    /** la campaña (su estrategia y su calendario) se armó con un plan que ya no es el vigente: el plan nuevo todavía no la reemplaza */
    del_plan_anterior?: boolean
  }
  estrategia: null | ({ version: number | null; estado: string; creada_en: string | null; costo_usd: number | null; texto_md: string | null } & EstrategiaLeida)
  fase_activa: FaseActiva
  documento: null | {
    id: string; titulo: string; creado_en: string | null; actualizado_en: string | null; status: string | null
    estado_del_plan: string | null; marcas: MarcaDelChequeo[]; aviso_del_chequeo: string[]; no_se_busco: string[]
    jefatura: { resultado: string | null; marcado_en: string | null } | null
    plan: PlanLeido | null; prosa: string | null; caracteres: number
    /** «QUÉ CAMBIÓ EN ESTA VERSIÓN» (la reescritura abre con ese apartado); null si no está */
    que_cambio: string | null
  }
  /** la última revisión del plan en la bandeja (pendiente o ya decidida) */
  revision: null | { id: string; titulo: string; creada_en: string; status: string; decision: string | null; vence_en: string | null }
  /** «la palabra del dueño manda» (CC1 · punto 8): lo que un revisor sugirió contra lo que ordenó el dueño y NO entró, o lo que ordenó y no quedó cumplido.
   *  Filas pendientes de `hitl_queue` tipo `palabra_del_dueno` del cliente (se cierran al aprobar el plan). Vacío si no hay. */
  palabra_del_dueno?: Array<{ id: string; titulo: string; detalle: string; requiere_humano: boolean; creado_en: string | null }>
  esperas: { vivas: number; grupos: GrupoDeEsperas[]; /** las vencidas, aparte (no se mezclan con las pendientes) */ vencidas: { n: number; grupos: GrupoDeEsperas[] } }
  /** los topes vigentes de cada tramo de la planeación (catálogo `plan_catalogo_topes`) */
  topes: TopeDelTramo[]
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

async function leerCiclo(supa: SupabaseClient, d: Fila | null, versiones: Fila[], ahora: Date, clienteId: string | null = null): Promise<CicloDelPlan | null> {
  if (!d) return null
  const id = String(d.id)
  const tag = versionDelTag(d.provenance_tag)
  const [ap, pc] = await Promise.all([
    opcional(supa.from("plan_aprobaciones").select("*").eq("plan_id", id).limit(1).maybeSingle(), "plan_aprobaciones"),
    // el ÚLTIMO pedido sobre esta versión (abierto, fallido o cancelado): el abierto bloquea los botones; cualquiera muestra su avance
    opcional(supa.from("plan_cambios").select("*").eq("plan_id", id).order("creado_en", { ascending: false }).limit(1).maybeSingle(), "plan_cambios"),
  ])
  const abierto = pc.fila && (pc.fila.estado === "pendiente" || pc.fila.estado === "en_reescritura") ? pc.fila : null
  // el pedido cuyo avance se muestra: el último sobre esta versión si no está aplicado; si no, el que CREÓ esta versión mientras no se decida sobre ella
  // (la versión nueva se guarda a los segundos de pedir: sin esto la barra desaparecía a mitad de la corrida · encargo de Emilio, 01-nov)
  let ult: Fila | null = pc.fila && pc.fila.estado !== "aplicado" ? pc.fila : null
  let avance_de: CicloDelPlan["avance_de"] = ult ? "esta_version" : null
  const decidida = ap.fila && ap.fila.estado !== "pendiente"
  if (!ult && tag.plan_cambio_id && !decidida) {
    const origen = await opcional(supa.from("plan_cambios").select("*").eq("id", tag.plan_cambio_id).limit(1).maybeSingle(), "plan_cambios")
    if (origen.fila) { ult = origen.fila; avance_de = "pedido_que_la_creo" }
  }
  let avance: CicloDelPlan["avance"] = null
  if (ult) {
    const wfe = t(ult.workflow_execution_id)
    const desdePedido = t(ult.creado_en)
    const [desp, invs, nueva, vivos] = await Promise.all([
      wfe ? filas(supa.from("agent_dispatches").select("status, created_at, running_at, completed_at").eq("workflow_execution_id", wfe).limit(50), "agent_dispatches") : Promise.resolve([] as Fila[]),
      wfe ? filas(supa.from("agent_invocations").select("status, created_at").eq("workflow_execution_id", wfe).limit(50), "agent_invocations") : Promise.resolve([] as Fila[]),
      una(supa.from("client_historical_outputs").select("id, created_at").eq("provenance_tag->>plan_cambio_id", String(ult.id)).order("created_at", { ascending: false }).limit(1).maybeSingle(), "client_historical_outputs"),
      // quién trabaja AHORA para este cliente desde el pedido (la reescritura y la jefatura corren con otros números de ejecución)
      clienteId && desdePedido ? filas(supa.from("agent_dispatches").select("agent_name, running_at, created_at").eq("client_id", clienteId).eq("status", "running").gte("created_at", desdePedido).limit(20), "agent_dispatches") : Promise.resolve([] as Fila[]),
    ])
    const [jef, cpn] = nueva ? await Promise.all([
      opcional(supa.from("jefatura_revisiones").select("estado, resultado, creado_en, cerrado_en").eq("artifact_id", String(nueva.id)).order("creado_en", { ascending: false }).limit(1).maybeSingle(), "jefatura_revisiones"),
      opcional(supa.from("plan_aprobaciones").select("estado, creado_en").eq("plan_id", String(nueva.id)).limit(1).maybeSingle(), "plan_aprobaciones"),
    ]) : [{ falta: false, fila: null }, { falta: false, fila: null }]
    avance = avanceDelPedido({
      pedido: { id: String(ult.id), estado: String(ult.estado ?? ""), creado_en: t(ult.creado_en), actualizado_en: t(ult.actualizado_en), despertado: bool(ult.despertado), despertar_detalle: detalleCorto(ult.despertar_detalle) },
      despachos: desp.map((x) => ({ status: String(x.status ?? ""), creado_en: t(x.created_at), empezo_en: t(x.running_at), termino_en: t(x.completed_at) })),
      invocaciones: invs.map((x) => ({ status: String(x.status ?? ""), creado_en: t(x.created_at) })),
      version_nueva: nueva ? { id: String(nueva.id), creado_en: t(nueva.created_at) } : null,
      jefatura: jef.fila ? { estado: String(jef.fila.estado ?? ""), resultado: t(jef.fila.resultado), creado_en: t(jef.fila.creado_en), cerrado_en: t(jef.fila.cerrado_en) } : null,
      compuerta_nueva: cpn.fila ? { estado: String(cpn.fila.estado ?? ""), creado_en: t(cpn.fila.creado_en) } : null,
      trabajando: vivos.map((x) => ({ agente: String(x.agent_name ?? ""), desde: t(x.running_at) ?? t(x.created_at) })),
    }, ahora)
  }
  return {
    disponible: !ap.falta && !pc.falta,
    version: tag.version,
    con_compuerta: tag.con_compuerta,
    historial: versiones.filter((v) => String(v.id) !== id).map((v) => { const x = versionDelTag(v.provenance_tag); return { id: String(v.id), version: x.version, creado_en: t(v.created_at), status: t(v.status), reemplaza_a: x.reemplaza_a, superseded_por: x.superseded_por } }),
    compuerta: ap.fila ? { estado: String(ap.fila.estado ?? ""), decidido_por: t(ap.fila.decidido_por), decidido_en: t(ap.fila.decidido_en), despertado: bool(ap.fila.despertado), despertar_detalle: detalleCorto(ap.fila.despertar_detalle) } : null,
    pedido: abierto ? { id: String(abierto.id), estado: String(abierto.estado ?? ""), texto: String(abierto.texto ?? ""), vuelta: abierto.vuelta == null ? null : Number(abierto.vuelta), despertado: bool(abierto.despertado), despertar_detalle: detalleCorto(abierto.despertar_detalle) } : null,
    avance,
    avance_de,
    comparacion_fallo: tag.comparacion_fallo,
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
  const vacio = (cliente: PlanDelCliente["cliente"]): PlanDelCliente => ({ ...base, cliente, campana: null, estrategia: null, fase_activa: faseActiva([], null, hoy), documento: null, revision: null, esperas: { vivas: 0, grupos: [], vencidas: { n: 0, grupos: [] } }, ciclo: null, topes: [] })
  if (!elegido) return vacio(null)
  const cliente = { id: elegido.id, nombre: elegido.nombre }

  const [camp, rev, palabras] = await Promise.all([
    una(supa.from("cadena_campanas").select("id, plan_id, estado, estado_motivo, fecha_inicio, fecha_fin, sedes, presupuesto_planificacion_usd, autoproducir, creada_en, actualizada_en").eq("client_id", cliente.id).eq("seco", false).order("creada_en", { ascending: false }).limit(1).maybeSingle(), "cadena_campanas"),
    una(supa.from("hitl_queue").select("id, title, status, decision, created_at, expires_at").eq("client_id", cliente.id).eq("type", "plan_con_pendientes").order("created_at", { ascending: false }).limit(1).maybeSingle(), "hitl_queue"),
    filas(supa.from("hitl_queue").select("id, title, output_preview, metadata, created_at").eq("client_id", cliente.id).eq("type", "palabra_del_dueno").eq("status", "pending").order("created_at", { ascending: false }).limit(10), "hitl_queue"),
  ])
  const palabra_del_dueno: NonNullable<PlanDelCliente["palabra_del_dueno"]> = palabras.map((x) => ({
    id: String(x.id), titulo: String(x.title ?? ""), detalle: String(x.output_preview ?? ""), creado_en: t(x.created_at),
    requiere_humano: !!(x.metadata && typeof x.metadata === "object" && (x.metadata as Record<string, unknown>).requiere_humano === true),
  }))
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
  const cicloP = Promise.all([docP, versionesP]).then(([d, versiones]) => leerCiclo(supa, d, versiones, ahora, cliente.id))
  const topesP = filas(supa.from("plan_catalogo_topes").select("tramo, usd, version, desde").eq("vigente", true).order("tramo", { ascending: true }).limit(20), "plan_catalogo_topes")
    .then((xs) => xs.map((x): TopeDelTramo => ({ tramo: String(x.tramo ?? ""), nombre: nombreDelTramo(x.tramo), usd: Number(x.usd ?? 0), version: x.version == null ? null : Number(x.version), desde: t(x.desde) })))

  if (!camp) {
    const [d, ciclo, topes] = await Promise.all([docP, cicloP, topesP])
    return { ...vacio(cliente), documento: documentoLeido(d), revision, palabra_del_dueno, ciclo, topes }
  }
  const campId = String(camp.id)
  const [d, est, nFilas, ultimaVersion, esperas, ciclo, topes, yaVencidas] = await Promise.all([
    docP,
    una(supa.from("cadena_estrategias").select("version, estado, contenido, texto_md, costo_usd, creada_en").eq("campana_id", campId).eq("seco", false).order("version", { ascending: false }).limit(1).maybeSingle(), "cadena_estrategias"),
    contar(supa.from("cadena_calendario_filas").select("*", { count: "exact", head: true }).eq("campana_id", campId).eq("seco", false), "cadena_calendario_filas"),
    una(supa.from("cadena_calendario_filas").select("calendario_version").eq("campana_id", campId).eq("seco", false).order("calendario_version", { ascending: false }).limit(1).maybeSingle(), "cadena_calendario_filas"),
    filas(supa.from("cadena_esperas").select("objeto_tipo, motivo, vence_en, estado").eq("campana_id", campId).eq("estado", "viva").eq("seco", false).order("vence_en", { ascending: true }).limit(300), "cadena_esperas"),
    cicloP,
    topesP,
    filas(supa.from("cadena_esperas").select("objeto_tipo, motivo, vence_en, estado").eq("campana_id", campId).eq("estado", "vencida").eq("seco", false).order("vence_en", { ascending: false }).limit(100), "cadena_esperas"),
  ])
  const estrategia = est ? { version: est.version == null ? null : Number(est.version), estado: String(est.estado ?? ""), creada_en: t(est.creada_en), costo_usd: est.costo_usd == null ? null : Number(est.costo_usd), texto_md: t(est.texto_md), ...estrategiaDelContenido(est.contenido) } : null
  const desde = t(camp.fecha_inicio)
  const crudas = [...esperas, ...yaVencidas].map((e) => ({ objeto_tipo: String(e.objeto_tipo ?? ""), motivo: t(e.motivo), vence_en: t(e.vence_en), estado: String(e.estado ?? "") }))
  const { vigentes: vivas, vencidas } = separarEsperas(crudas, ahora.toISOString())
  return {
    ...base, cliente,
    campana: {
      id: campId, estado: String(camp.estado ?? ""), estado_motivo: t(camp.estado_motivo), desde, hasta: t(camp.fecha_fin),
      sedes: Array.isArray(camp.sedes) ? camp.sedes.map(String) : [],
      tope_planeacion_usd: camp.presupuesto_planificacion_usd == null ? null : Number(camp.presupuesto_planificacion_usd),
      autoproducir: camp.autoproducir === true,
      publicaciones: nFilas, version_calendario: ultimaVersion ? Number(ultimaVersion.calendario_version) : null,
      creada_en: t(camp.creada_en), actualizada_en: t(camp.actualizada_en),
      // la campaña apunta a un plan (`plan_id`); si el documento vigente es otro, lo que cuelga de la campaña es del plan anterior
      del_plan_anterior: !!(d && t(camp.plan_id) && String(d.id) !== t(camp.plan_id)),
    },
    estrategia,
    fase_activa: faseActiva(estrategia?.fases ?? [], desde, hoy),
    documento: documentoLeido(d),
    revision,
    palabra_del_dueno,
    esperas: { vivas: vivas.length, grupos: agruparEsperas(vivas), vencidas: { n: vencidas.length, grupos: agruparEsperas(vencidas) } },
    ciclo,
    topes,
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
    plan: leido.plan, prosa: leido.prosa, caracteres: texto.length, que_cambio: queCambioDelTexto(texto),
  }
}
