/**
 * PLAN DE 90 DÍAS (CC5 · 31-oct · sprint 6.5 de /nuevo · Emilio: «ya no uses el dashboard viejo… así con todo»). Lógica PURA (sin red ni base).
 * El plan de un cliente vive en tres sitios reales y aquí se leen los tres sin rellenar nada:
 *  · el DOCUMENTO que escribió la oficina de planeación (`client_historical_outputs` · `output_type = campaign_plan_90d`): `content_text` es un bloque de
 *    datos dentro de una cerca ```json (meta semanal · zonas · horario · canales con peso · producción · marca · lo que no se sabe · la decisión de
 *    equilibrio) y `provenance_tag` trae el estado del plan y las marcas del chequeo (P3, P4, P9, P10b…);
 *  · la ESTRATEGIA versionada de la cadena (`cadena_estrategias.contenido`: fases · redes con rol y frecuencia · pilares · patrón semanal · pendientes ·
 *    alertas · dependencias · fechas que importan · hitos · piezas fijas · excluidos);
 *  · la CAMPAÑA (`cadena_campanas`: estado y motivo · ventana · sedes · tope de planeación) y lo que ESPERA (`cadena_esperas`).
 * La decisión sobre el plan (CC6 · 01-nov · ciclo del plan de CC1) va por las puertas `plan-cambios` (gasta, tope ≤ 8) y `plan-aprobar` (US$ 0) del tablero:
 * aquí se arman sus cuerpos, se lee el estado del ciclo y se dicen sus respuestas en palabras. La nota «plan con pendientes» de la bandeja ya no se decide aquí.
 */
import type { FasesDelPlan } from "@/lib/clientes"
import { fasesDelPlan } from "@/lib/clientes"
import { DIAS_DE_LA_SEMANA, diaDelCalendario, type FaseActiva } from "@/lib/pizarron"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "")
const numero = (v: unknown): number | null => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null }
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const lista = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)) : [])
const textos = (v: unknown): string[] => (Array.isArray(v) ? v.map(texto).filter(Boolean) : texto(v) ? [texto(v)] : [])

// ── el documento del plan ──
export interface CanalDelPlan { canal: string; peso: number | null; activo: boolean; condicion: string | null }
export interface PlanLeido {
  meta_por_semana: number | null
  /** qué se cuenta («visita al local») */
  evento: string | null
  zonas: string[]
  horario: string | null
  dias_activos_por_semana: number | null
  canales: CanalDelPlan[]
  /** fracción del esfuerzo que va a producción y a marca (0–1) */
  produccion_fraccion: number | null
  marca_fraccion: number | null
  /** lo que el plan declara que no sabe */
  no_se: string[]
  equilibrio: { decision: string | null; motivo: string | null } | null
  /** claves del bloque que esta lectura no interpreta (se dicen, no se esconden) */
  otras_claves: string[]
}
const CLAVES_LEIDAS = new Set(["meta_por_semana", "evento", "zonas", "dias_y_horarios", "canales", "produccion", "marca", "no_se", "equilibrio_respuesta"])

/** quita la cerca ```json … ``` si la hay y devuelve el JSON o null */
function jsonDeLaCerca(t: string): unknown | null {
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const cuerpo = (m ? m[1] : t).trim()
  if (!cuerpo.startsWith("{") && !cuerpo.startsWith("[")) return null
  try { return JSON.parse(cuerpo) } catch { return null }
}

/** el texto guardado del plan: un bloque de datos (lo normal) o prosa (se devuelve tal cual) */
export function planDelTexto(contenido: unknown): { plan: PlanLeido | null; prosa: string | null } {
  const t = texto(contenido)
  if (!t) return { plan: null, prosa: null }
  const j = jsonDeLaCerca(t)
  if (!j || typeof j !== "object" || Array.isArray(j)) return { plan: null, prosa: t }
  const o = j as Record<string, unknown>
  const dh = objeto(o.dias_y_horarios)
  const eq = objeto(o.equilibrio_respuesta)
  return {
    prosa: null,
    plan: {
      meta_por_semana: numero(o.meta_por_semana),
      evento: texto(o.evento) || null,
      zonas: textos(o.zonas),
      horario: texto(dh.horario) || null,
      dias_activos_por_semana: numero(dh.dias_activos_por_semana),
      canales: lista(o.canales).map((c) => ({ canal: texto(c.canal), peso: numero(c.peso), activo: c.activo !== false, condicion: texto(c.condicion) || null })).filter((c) => c.canal),
      produccion_fraccion: numero(objeto(o.produccion).fraccion),
      marca_fraccion: numero(o.marca),
      no_se: textos(o.no_se),
      equilibrio: Object.keys(eq).length ? { decision: texto(eq.decision) || null, motivo: texto(eq.motivo) || null } : null,
      otras_claves: Object.keys(o).filter((k) => !CLAVES_LEIDAS.has(k)),
    },
  }
}

/** los canales del plan (nombres internos de la planeación) en palabras */
export function canalDelPlanLegible(canal: unknown): string {
  switch (texto(canal)) {
    case "meta_ig": return "Instagram y Facebook (Meta)"
    case "busqueda_local": return "Búsqueda local (Google y mapas)"
    case "video_corto": return "Video corto (reels, TikTok, shorts)"
    case "base_propia": return "Base propia (WhatsApp y clientes que vuelven)"
    case "influencers": return "Influencers"
    case "email": return "Correo"
    case "pauta": return "Pauta pagada"
    default: { const s = texto(canal).replace(/_/g, " "); return s ? s[0].toUpperCase() + s.slice(1) : "—" }
  }
}
export const decisionDeEquilibrioLegible = (d: unknown): string => {
  switch (texto(d)) {
    case "mantengo_la_meta": return "Se mantiene la meta"
    case "subo_la_meta": return "Se sube la meta"
    case "bajo_la_meta": return "Se baja la meta"
    default: { const s = texto(d).replace(/_/g, " "); return s ? s[0].toUpperCase() + s.slice(1) : "Sin decisión declarada" }
  }
}
/** «20 %» de una fracción 0–1 (o de un porcentaje ya en 0–100) */
export function porcentaje(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—"
  const p = v <= 1 ? v * 100 : v
  return `${Math.round(p * 10) / 10 === Math.round(p) ? Math.round(p) : (Math.round(p * 10) / 10).toLocaleString("es-EC")} %`
}
/** «115 visitas al local por semana» con lo que el plan declara como evento; si no lo dice, solo la cifra */
export function textoDeLaMeta(p: Pick<PlanLeido, "meta_por_semana" | "evento">): string | null {
  if (p.meta_por_semana == null) return null
  const e = p.evento ? ` · ${p.evento}` : ""
  return `${p.meta_por_semana.toLocaleString("es-EC")} por semana${e}`
}

// ── la estrategia ──
export interface RedDeLaEstrategia { red: string; rol: string; motivo: string; formatos: string[]; feed_semana: number; historias_semana: number; anuncios_semana: number }
export interface PilarDeLaEstrategia { clave: string; nombre: string; pct: number }
export interface HitoDeLaEstrategia { clave: string; dia: number; tipo: string; cita_plan: string }
export interface DependenciaDeLaEstrategia { antes: string; despues: string; regla: string }
export interface FechaQueImporta { tipo: string; ambito: string; origen: string; motivo: string }
export interface SlotSemanal { slot: string; dia_semana: number; hora: string; red: string; formato: string; pilar: string; sede: string | null; requiere_abierto: boolean }
export interface PiezaFijaDeLaEstrategia { clave: string; semana: number; slot: string; tema: string }
export interface PendienteDeLaEstrategia { clave: string; que_falta: string; desbloquea: string[]; pedir_a: string }
export interface AlertaDeLaEstrategia { texto: string; ref: string }
export interface EstrategiaLeida {
  fases: FasesDelPlan[]
  redes: RedDeLaEstrategia[]
  excluidos: Array<{ red: string; cita_plan: string }>
  pilares: PilarDeLaEstrategia[]
  hitos: HitoDeLaEstrategia[]
  dependencias: DependenciaDeLaEstrategia[]
  fechas_que_importan: FechaQueImporta[]
  patron_semanal: SlotSemanal[]
  piezas_fijas: PiezaFijaDeLaEstrategia[]
  pendientes: PendienteDeLaEstrategia[]
  alertas: AlertaDeLaEstrategia[]
}

/** el contenido de `cadena_estrategias` leído con tolerancia: lo que falta queda vacío (y la pantalla lo dice), nada se inventa */
export function estrategiaDelContenido(contenido: unknown): EstrategiaLeida {
  const c = objeto(contenido)
  const n0 = (v: unknown) => numero(v) ?? 0
  return {
    fases: fasesDelPlan(c),
    redes: lista(c.canales).map((x) => { const f = objeto(x.frecuencia); return { red: texto(x.red), rol: texto(x.rol), motivo: texto(x.motivo), formatos: textos(x.formatos), feed_semana: n0(f.feed_semana), historias_semana: n0(f.historias_semana), anuncios_semana: n0(f.anuncios_semana) } }).filter((x) => x.red),
    excluidos: lista(c.excluidos).map((x) => ({ red: texto(x.red), cita_plan: texto(x.cita_plan) })).filter((x) => x.red),
    pilares: lista(c.pilares).map((x) => ({ clave: texto(x.clave), nombre: texto(x.nombre) || texto(x.clave), pct: n0(x.pct) })).filter((x) => x.clave),
    hitos: lista(c.hitos).map((x) => ({ clave: texto(x.clave), dia: n0(x.dia), tipo: texto(x.tipo), cita_plan: texto(x.cita_plan) })).filter((x) => x.clave),
    dependencias: lista(c.dependencias).map((x) => ({ antes: texto(x.antes), despues: texto(x.despues), regla: texto(x.regla) })).filter((x) => x.antes || x.despues),
    fechas_que_importan: lista(c.fechas_que_importan).map((x) => ({ tipo: texto(x.tipo), ambito: texto(x.ambito), origen: texto(x.origen), motivo: texto(x.motivo) })).filter((x) => x.tipo),
    patron_semanal: lista(c.patron_semanal).map((x) => ({ slot: texto(x.slot), dia_semana: n0(x.dia_semana), hora: texto(x.hora), red: texto(x.red), formato: texto(x.formato), pilar: texto(x.pilar), sede: texto(x.sede) || null, requiere_abierto: x.requiere_abierto === true })).filter((x) => x.dia_semana >= 1 && x.dia_semana <= 7).sort((a, b) => a.dia_semana - b.dia_semana || a.hora.localeCompare(b.hora)),
    piezas_fijas: lista(c.piezas_fijas).map((x) => ({ clave: texto(x.clave), semana: n0(x.semana), slot: texto(x.slot), tema: texto(x.tema) })).filter((x) => x.clave),
    pendientes: lista(c.pendientes).map((x) => ({ clave: texto(x.clave), que_falta: texto(x.que_falta), desbloquea: textos(x.desbloquea), pedir_a: texto(x.pedir_a) })).filter((x) => x.que_falta),
    alertas: lista(c.alertas).map((x) => ({ texto: texto(x.texto), ref: texto(x.ref) })).filter((x) => x.texto),
  }
}

export function rolDeLaRedLegible(rol: unknown): string {
  switch (texto(rol)) { case "principal": return "principal"; case "replica": return "réplica"; case "no": return "no se usa"; default: return texto(rol) || "—" }
}
/** a quién se le pide un dato que falta: nunca al dueño del negocio (regla de la cadena) */
export function pedirALegible(p: unknown): string {
  switch (texto(p)) { case "portero": return "lo busca el cerebro del cliente"; case "sistema": return "lo investiga el sistema con fuente"; default: return texto(p) ? texto(p).replace(/_/g, " ") : "sin asignar" }
}
export function tipoDeHitoLegible(t: unknown): string {
  switch (texto(t)) { case "revision": return "revisión de resultados"; case "lanzamiento": return "lanzamiento"; case "corte": return "corte"; default: return texto(t).replace(/_/g, " ") || "hito" }
}
export function origenDeLaFechaLegible(o: unknown): string {
  switch (texto(o)) { case "plan": return "la trae el plan"; case "estrategia": return "la puso la estrategia"; case "alta": return "firmada en el alta"; default: return texto(o) || "—" }
}
/** la referencia de una alerta («sede:uuid» · «manual:uuid») en palabras: de dónde salió */
export function fuenteDeLaAlertaLegible(ref: unknown): string {
  const r = texto(ref)
  if (/^sede:/i.test(r)) return "por una sede"
  if (/^manual:/i.test(r)) return "por el manual de marca"
  if (/^plan:/i.test(r)) return "por el plan"
  if (/^trozo:|^ficha:/i.test(r)) return "por el cerebro"
  return r ? "por una fuente del cliente" : ""
}
export const diaDeLaSemanaLegible = (n: number): string => DIAS_DE_LA_SEMANA[n - 1] ?? "—"
/** la semana del patrón, de lunes a domingo, con sus huecos (un día sin publicaciones se ve vacío, no desaparece) */
export function semanaDelPatron(slots: SlotSemanal[]): Array<{ dia: number; nombre: string; slots: SlotSemanal[] }> {
  return DIAS_DE_LA_SEMANA.map((nombre, i) => ({ dia: i + 1, nombre, slots: slots.filter((s) => s.dia_semana === i + 1) }))
}
/** cuántas publicaciones por semana suma la estrategia (feed + historias + anuncios de todas las redes) */
export function publicacionesPorSemana(redes: RedDeLaEstrategia[]): { feed: number; historias: number; anuncios: number; total: number } {
  const t = { feed: 0, historias: 0, anuncios: 0, total: 0 }
  for (const r of redes) { t.feed += r.feed_semana; t.historias += r.historias_semana; t.anuncios += r.anuncios_semana }
  t.total = t.feed + t.historias + t.anuncios
  return t
}

// ── el estado del plan, el chequeo y la jefatura (de `provenance_tag` del documento) ──
export interface MarcaDelChequeo { codigo: string; texto: string }
/** «P3 · lleva nombres internos · P4 · presupuesto incompleto (…) · P9 · …» → una marca por código; lo que no empieza por un código se pega al anterior */
export function marcasDelChequeo(pendientes: unknown): MarcaDelChequeo[] {
  const t = texto(pendientes)
  if (!t) return []
  const partes = t.split(" · ").map((s) => s.trim()).filter(Boolean)
  const out: MarcaDelChequeo[] = []
  for (const p of partes) {
    if (/^P\d+[a-z]?$/i.test(p)) out.push({ codigo: p.toUpperCase(), texto: "" })
    else if (out.length) out[out.length - 1].texto = out[out.length - 1].texto ? `${out[out.length - 1].texto} · ${p}` : p
    else out.push({ codigo: "", texto: p })
  }
  return out
}
export function estadoDelPlanLegible(e: unknown): string {
  switch (texto(e)) {
    case "con_pendientes": return "Con puntos por resolver"
    case "listo": case "limpio": return "Sin puntos por resolver"
    case "aprobado": return "Aprobado"
    case "rechazado": return "Con cambios pedidos"
    default: return texto(e) ? texto(e).replace(/_/g, " ") : "Sin estado declarado"
  }
}
export function resultadoDeJefaturaDelPlanLegible(r: unknown): string {
  switch (texto(r)) {
    case "con_desacuerdo": return "La jefatura dejó desacuerdos"
    case "limpia": case "sin_desacuerdo": return "La jefatura no objetó"
    case "pendiente": return "La jefatura todavía revisa"
    default: return texto(r) ? `Jefatura: ${texto(r).replace(/_/g, " ")}` : "Sin revisión de la jefatura"
  }
}
/** el aviso del chequeo del sistema (un bloque con encabezado «## Revisión del plan…» y una viñeta larga separada por « · ») → una lista de puntos */
export function puntosDelAviso(aviso: unknown): string[] {
  const t = texto(aviso)
  if (!t) return []
  const sinTitulos = t.split("\n").filter((l) => !/^\s*#{1,6}\s/.test(l)).join("\n")
  const sinPrefijo = sinTitulos.replace(/^\s*-\s*/gm, "").replace(/^\s*Antes de enviarlo al cliente hay que revisar:\s*/i, "").trim()
  return sinPrefijo.split(/\s·\s|\n+/).map((s) => s.trim()).filter(Boolean)
}
/** «## Lo que NO se buscó y por qué…\n- a · b · c\n- …» → una línea por punto, sin el encabezado */
export function puntosDeLoNoBuscado(bloque: unknown): string[] {
  const t = texto(bloque)
  if (!t) return []
  return t.split("\n").filter((l) => !/^\s*#{1,6}\s/.test(l)).map((l) => l.replace(/^\s*-\s*/, "").trim()).filter(Boolean)
}

// ── errores 3–5 del panel (ENCARGO Lenovo 01-nov · CC6) ──
/** 3 · los topes REALES de cada tramo de la planeación (catálogo de topes de la plataforma, solo los vigentes); nada fijo en la pantalla */
export interface TopeDelTramo { tramo: string; nombre: string; usd: number; version: number | null; desde: string | null }
export function nombreDelTramo(tramo: unknown): string {
  switch (texto(tramo)) {
    case "recoleccion": return "Recolección de datos"
    case "oficina": return "Mesa de análisis"
    case "redaccion": return "Redactor del plan"
    case "jefatura": return "Jefatura"
    case "cupo_ficha": return "Cupo por cliente"
    default: { const s = texto(tramo).replace(/_/g, " "); return s ? s[0].toUpperCase() + s.slice(1) : "—" }
  }
}
/** 5 · la fecha de inicio no se muestra firme si la campaña está detenida («inicio sujeto a reanudar»); null = usar el texto de siempre */
export function inicioSujetoAReanudar(estadoDeCampana: unknown, fase: Pick<FaseActiva, "situacion">, desde: string | null): string | null {
  if (!["pausada", "necesita_humano"].includes(texto(estadoDeCampana))) return null
  if (fase.situacion !== "antes" && fase.situacion !== "sin_fecha") return null
  return `Inicio sujeto a reanudar${desde ? ` (previsto ${diaDelCalendario(desde)})` : ""}`
}

// ── lo que espera la campaña ──
export interface EsperaCruda { objeto_tipo: string; motivo: string | null; vence_en: string | null; estado: string }
export interface GrupoDeEsperas { tipo: string; etiqueta: string; n: number; vence_primero: string | null }
export function tipoDeEsperaLegible(tipo: unknown, motivo?: string | null): string {
  switch (texto(tipo)) {
    case "espera_video": return "publicaciones que esperan el brazo de video (aún no construido)"
    case "dato_en_investigacion": return "datos de publicaciones que se investigan con fuente"
    case "aprobacion_bandeja": return "piezas que esperan tu aprobación en la bandeja"
    case "campana_pausada": return "la campaña está en pausa: se revisa en el resumen semanal"
    case "fecha_inicio_propuesta": return "la fecha de inicio queda firme el día anterior"
    case "necesita_humano": return "necesita a una persona"
    case "estrategia": return "la estrategia espera revisión"
    case "calendario": return "el calendario espera revisión"
    default: return texto(motivo) || texto(tipo).replace(/_/g, " ") || "espera"
  }
}
/** 4 · las esperas, separadas: las vigentes y las VENCIDAS (marcadas `vencida` por el reloj, o `viva` con su plazo ya pasado mientras el reloj no corre) */
export function separarEsperas(esperas: EsperaCruda[], ahoraIso: string): { vigentes: EsperaCruda[]; vencidas: EsperaCruda[] } {
  const vigentes: EsperaCruda[] = [], vencidas: EsperaCruda[] = []
  for (const e of esperas) {
    if (e.estado === "vencida" || (e.estado === "viva" && !!e.vence_en && e.vence_en < ahoraIso)) vencidas.push({ ...e, estado: "viva" })
    else if (e.estado === "viva") vigentes.push(e)
  }
  return { vigentes, vencidas }
}
/** solo las vivas, agrupadas por tipo, de más a menos; cada grupo dice cuándo vence la primera */
export function agruparEsperas(esperas: EsperaCruda[]): GrupoDeEsperas[] {
  const m = new Map<string, GrupoDeEsperas>()
  for (const e of esperas) {
    if (e.estado !== "viva") continue
    const g = m.get(e.objeto_tipo) ?? { tipo: e.objeto_tipo, etiqueta: tipoDeEsperaLegible(e.objeto_tipo, e.motivo), n: 0, vence_primero: null }
    g.n += 1
    if (e.vence_en && (!g.vence_primero || e.vence_en < g.vence_primero)) g.vence_primero = e.vence_en
    m.set(e.objeto_tipo, g)
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.etiqueta.localeCompare(b.etiqueta, "es"))
}

// ── el ciclo del plan (CC6 · 01-nov · contrato certificado de CC1: `PLAN-CC1-ciclo-del-plan-tramo-2-diseno-y-contrato.md` §2 + ADENDA 1) ──
// «Pedir cambios» → `plan-cambios` (GASTA: el jefe de marketing reescribe sobre este plan y la jefatura revisa) · «Aprobar» → `plan-aprobar` (US$ 0: pasa al PDF y al brief).
export const BOTONES_DEL_PLAN = { aprobar: "Aprobar el plan así", rechazar: "Pedir cambios al plan" } as const
/** tope por pedido de cambios (contrato: ≤ 8) y lo que suele costar (redactor ≈ 1 + jefatura 1–3) */
export const TOPE_REESCRITURA_USD = 8
export const COSTO_ESTIMADO_REESCRITURA = "US$ 1–3"
/** después de 3 reescrituras (versión 4) solo se aprueba; lo demás se decide a mano */
export const VUELTAS_MAXIMAS = 3

export interface VersionDelPlan { id: string; version: number; creado_en: string | null; status: string | null; reemplaza_a: string | null; superseded_por: string | null }
export interface CicloDelPlan {
  /** las tablas del ciclo existen en la plataforma (hasta que se abra la «ventana» de CC1, no) */
  disponible: boolean
  version: number
  /** las versiones anteriores del plan (más nuevas primero): se ven en segundo plano */
  historial: VersionDelPlan[]
  /** el plan salió con compuerta (`provenance_tag.compuerta`): mientras no haya fila de compuerta, la jefatura sigue revisando */
  con_compuerta: boolean
  compuerta: null | { estado: string; decidido_por: string | null; decidido_en: string | null; despertado: boolean | null; despertar_detalle: string | null }
  /** el pedido de cambios abierto sobre esta versión (pendiente o en reescritura) */
  pedido: null | { id: string; estado: string; texto: string; vuelta: number | null; despertado: boolean | null; despertar_detalle: string | null }
  /** el avance del último pedido sobre esta versión (abierto o fallido), paso a paso; null si no hay */
  avance: AvanceDelPedido | null
}

/** la versión de una fila del plan y si sigue vigente, de su `provenance_tag` (contrato: versión ausente = 1; vigente salvo `vigente:false` o `superseded_por`) */
export function versionDelTag(tag: unknown): { version: number; vigente: boolean; reemplaza_a: string | null; superseded_por: string | null; con_compuerta: boolean } {
  const t = objeto(tag)
  const v = numero(t.version)
  return { version: v && v >= 1 ? Math.floor(v) : 1, vigente: t.vigente !== false && !texto(t.superseded_por), reemplaza_a: texto(t.reemplaza_a) || null, superseded_por: texto(t.superseded_por) || null, con_compuerta: t.compuerta === true }
}

export type EstadoDelCiclo = "en_revision" | "reescribiendo" | "esperando_decision" | "aprobado"
export interface LecturaDelCiclo {
  estado: EstadoDelCiclo
  /** el estado en palabras (lo que se ve grande) */
  titulo: string
  detalle: string
  puede_aprobar: boolean
  puede_pedir_cambios: boolean
  /** la última llamada no logró despertar al flujo (no se gastó nada): repetir la misma puerta */
  reintentar: null | "plan-cambios" | "plan-aprobar"
  avisos: string[]
}
export function leerElCiclo(statusDelDocumento: string | null, ciclo: CicloDelPlan): LecturaDelCiclo {
  const avisos: string[] = []
  if (!ciclo.disponible) avisos.push("El ciclo del plan se abre pronto: hasta entonces los botones responden «aún no disponible». No se cambia nada ni se gasta.")
  const cp = ciclo.compuerta, pd = ciclo.pedido
  if (statusDelDocumento === "approved" || cp?.estado === "aprobado") {
    const sinDespertar = cp?.estado === "aprobado" && cp.despertado === false
    const quien = cp?.decidido_por ? ` por ${cp.decidido_por}` : ""
    const detalle = sinDespertar
      ? `Quedó aprobado, pero no se pudo avisar para seguir al PDF y al brief${cp?.despertar_detalle ? ` (${cp.despertar_detalle})` : ""}. No se gastó nada.`
      : `Versión ${ciclo.version} aprobada${quien}: sigue el PDF, la sala y el brief.`
    return { estado: "aprobado", titulo: "Aprobado → pasa al brief", detalle, puede_aprobar: false, puede_pedir_cambios: false, reintentar: sinDespertar ? "plan-aprobar" : null, avisos }
  }
  if (pd && (pd.estado === "pendiente" || pd.estado === "en_reescritura")) {
    const sinDespertar = pd.despertado === false
    const detalle = sinDespertar
      ? `Tu pedido quedó guardado, pero no se pudo avisar a la oficina de planeación${pd.despertar_detalle ? ` (${pd.despertar_detalle})` : ""}. No se gastó nada.`
      : `El jefe de marketing rehace el plan sobre la versión ${ciclo.version} con tus observaciones${pd.vuelta ? ` (vuelta ${pd.vuelta} de ${VUELTAS_MAXIMAS})` : ""}; después lo revisa la jefatura.`
    return { estado: "reescribiendo", titulo: "Reescribiendo", detalle, puede_aprobar: false, puede_pedir_cambios: false, reintentar: sinDespertar ? "plan-cambios" : null, avisos }
  }
  if (ciclo.con_compuerta && !cp) return { estado: "en_revision", titulo: "En revisión", detalle: "La jefatura está revisando esta versión: decides cuando termine.", puede_aprobar: false, puede_pedir_cambios: false, reintentar: null, avisos }
  const alTope = ciclo.version > VUELTAS_MAXIMAS
  if (alTope) avisos.push(`Ya van ${VUELTAS_MAXIMAS} reescrituras: desde aquí solo se puede aprobar; lo demás se decide a mano.`)
  if (ciclo.disponible && !ciclo.con_compuerta && !cp) avisos.push("Este plan es de antes del ciclo: aprobarlo lo deja firme sin reanudar nada (su brief ya salió). Pedir cambios crea la versión siguiente, con su revisión.")
  return { estado: "esperando_decision", titulo: "Esperando tu decisión", detalle: `Versión ${ciclo.version}: apruébala para que pase al brief, o pide cambios para que el jefe de marketing la reescriba.`, puede_aprobar: true, puede_pedir_cambios: !alTope, reintentar: null, avisos }
}


// ── el avance de un pedido de cambios (CC6 · 01-nov · ADENDA 1 de Emilio: «quiero VER que se está haciendo algo») ──
// Pasos: Recibido → El jefe de marketing está reescribiendo → Controles automáticos → La jefatura revisa → Listo para ti. Cada paso se enciende con su hora.
// Fuentes (solo lectura): la fila del pedido (`plan_cambios`), los despachos e invocaciones de su corrida (`workflow_execution_id`), la versión nueva
// (`client_historical_outputs` con `provenance_tag.plan_cambio_id`), su revisión de la jefatura (`jefatura_revisiones`) y su compuerta (`plan_aprobaciones`).
export type EstadoDelPaso = "hecho" | "en_curso" | "pendiente" | "fallo"
export interface PasoDelPedido { clave: "recibido" | "reescribiendo" | "controles" | "jefatura" | "listo"; nombre: string; estado: EstadoDelPaso; hora: string | null; detalle: string | null }
export interface AvanceCrudo {
  pedido: { id: string; estado: string; creado_en: string | null; actualizado_en: string | null; despertado: boolean | null; despertar_detalle: string | null }
  despachos: Array<{ status: string; creado_en: string | null; empezo_en: string | null; termino_en: string | null }>
  invocaciones: Array<{ status: string; creado_en: string | null }>
  version_nueva: null | { id: string; creado_en: string | null }
  jefatura: null | { estado: string; resultado: string | null; creado_en: string | null; cerrado_en: string | null }
  compuerta_nueva: null | { estado: string; creado_en: string | null }
}
export interface AvanceDelPedido { pasos: PasoDelPedido[]; minutos: number | null; estimado: string; nota: string | null; fallo: null | { texto: string; que_hacer: string } }
export const MINUTOS_ESTIMADOS = { min: 15, max: 30 } as const
const minDe = (iso: string | null) => (iso ? Date.parse(iso) : NaN)
const primera = (xs: Array<string | null>): string | null => xs.filter((x): x is string => !!x).sort()[0] ?? null
export function avanceDelPedido(a: AvanceCrudo, ahora: Date): AvanceDelPedido {
  const p = a.pedido
  const terminado = p.estado === "aplicado"
  const fallido = p.estado === "fallido" || p.estado === "cancelado"
  const sinDespertar = p.despertado === false
  const empezo = primera([...a.despachos.map((d) => d.empezo_en ?? d.creado_en), ...a.invocaciones.map((i) => i.creado_en)]) ?? (p.estado === "en_reescritura" ? p.actualizado_en : null)
  const redactorListo = a.invocaciones.some((i) => i.status === "completed") || a.despachos.some((d) => d.status === "completed") || !!a.version_nueva
  const jefaturaCerrada = !!a.jefatura?.cerrado_en || !!a.compuerta_nueva
  const listo = terminado || a.compuerta_nueva?.estado === "pendiente"
  const pasos: PasoDelPedido[] = [
    { clave: "recibido", nombre: "Recibido", estado: "hecho", hora: p.creado_en, detalle: null },
    { clave: "reescribiendo", nombre: "El jefe de marketing está reescribiendo", estado: redactorListo ? "hecho" : empezo ? "en_curso" : "pendiente", hora: empezo, detalle: null },
    { clave: "controles", nombre: "Controles automáticos", estado: a.version_nueva ? "hecho" : redactorListo ? "en_curso" : "pendiente", hora: a.version_nueva?.creado_en ?? null, detalle: null },
    { clave: "jefatura", nombre: "La jefatura revisa", estado: jefaturaCerrada ? "hecho" : a.version_nueva ? "en_curso" : "pendiente", hora: a.jefatura?.cerrado_en ?? a.jefatura?.creado_en ?? null, detalle: null },
    { clave: "listo", nombre: "Listo para ti", estado: listo ? "hecho" : "pendiente", hora: a.compuerta_nueva?.creado_en ?? (terminado ? p.actualizado_en : null), detalle: null },
  ]
  let fallo: AvanceDelPedido["fallo"] = null
  if (sinDespertar && !empezo) {
    const paso = pasos[1]
    paso.estado = "fallo"; paso.detalle = `No se pudo avisar a la oficina de planeación${p.despertar_detalle ? ` (${p.despertar_detalle})` : ""}.`
    fallo = { texto: "El pedido quedó guardado, pero la oficina de planeación no recibió el aviso. No se gastó nada.", que_hacer: "Usa «Reintentar»: repite el aviso con el mismo tope." }
  } else if (fallido) {
    const paso = pasos.find((x) => x.estado !== "hecho") ?? pasos[pasos.length - 1]
    paso.estado = "fallo"; paso.hora = p.actualizado_en; paso.detalle = p.estado === "cancelado" ? "El pedido se canceló." : "La reescritura no terminó."
    fallo = { texto: p.estado === "cancelado" ? "El pedido de cambios se canceló: el plan sigue como estaba." : "La reescritura no terminó: el plan sigue como estaba (la versión actual no cambió).", que_hacer: "Puedes pedir cambios otra vez (vuelve a gastar, con su tope) o aprobar la versión actual." }
  }
  for (let i = 1; i < pasos.length; i++) if (pasos[i].estado !== "pendiente" && pasos[i - 1].estado === "pendiente") pasos[i - 1].estado = "hecho" // nunca un paso posterior encendido con uno anterior apagado
  const minutos = p.creado_en && !Number.isNaN(minDe(p.creado_en)) ? Math.max(0, Math.round((ahora.getTime() - minDe(p.creado_en)) / 60000)) : null
  const nota = !fallo && !listo && minutos != null && minutos > 45 ? `Lleva ${minutos} min: más de lo esperado. Si no avanza, puede que la corrida se haya cortado (todavía no hay vigía que lo marque).` : null
  const estimado = listo ? "Terminó" : fallo ? "Se detuvo" : `Suele tardar ≈ ${MINUTOS_ESTIMADOS.min}–${MINUTOS_ESTIMADOS.max} min${minutos != null ? ` · van ${minutos} min` : ""}`
  return { pasos, minutos, estimado, nota, fallo }
}

/** «QUÉ CAMBIÓ EN ESTA VERSIÓN» del texto del plan (la reescritura abre con ese apartado): su contenido, sin el título; null si no está */
export function queCambioDelTexto(contenido: unknown): string | null {
  const t = texto(contenido)
  if (!t) return null
  const m = t.match(/(?:^|\n)\s*(?:#{1,6}\s*)?\**\s*QU[ÉE]\s+CAMBI[ÓO]\s+EN\s+ESTA\s+VERSI[ÓO]N\s*\**\s*:?\s*\n?([\s\S]*?)(?=\n\s*#{1,6}\s|\n\s*```|\n\s*\*\*[A-ZÁÉÍÓÚÑ ]{6,}\*\*|$)/i)
  const cuerpo = m ? m[1].trim() : ""
  return cuerpo ? cuerpo.slice(0, 3000) : null
}

/** el cuerpo de «Pedir cambios» (contrato: texto de 5 a 4.000, confirmación del gasto y tope ≤ 8) */
export function cuerpoDePedirCambios(planId: string | null, observaciones: string): { plan_id: string; texto: string; confirmo_gasto: true; tope_usd: number } | { error: string } {
  if (!planId || !UUID.test(planId)) return { error: "No hay un plan sobre el que pedir cambios" }
  const t = observaciones.trim()
  if (t.length < 5) return { error: "Cuenta qué debe cambiar (al menos 5 caracteres)" }
  if (t.length > 4000) return { error: "Máximo 4.000 caracteres" }
  return { plan_id: planId, texto: t, confirmo_gasto: true, tope_usd: TOPE_REESCRITURA_USD }
}
/** el cuerpo de «Aprobar» (contrato: comentario opcional de hasta 1.000) */
export function cuerpoDeAprobar(planId: string | null, comentario: string): { plan_id: string; comentario?: string } | { error: string } {
  if (!planId || !UUID.test(planId)) return { error: "No hay un plan que aprobar" }
  const t = comentario.trim()
  if (t.length > 1000) return { error: "Máximo 1.000 caracteres" }
  return { plan_id: planId, ...(t ? { comentario: t } : {}) }
}

/** lo que devolvió la puerta del tablero (`/api/acciones/{accion}`), dicho en palabras: nunca un código crudo */
export interface RespuestaDelCiclo { ok: boolean; texto: string; reintentar: boolean; releer: boolean; /** «info»: no es un error (el ciclo todavía no está abierto); se dice sin rojo */ tono?: "info" }
const MOTIVOS_DEL_CICLO: Record<string, string> = {
  plan_en_revision: "La jefatura todavía revisa este plan: decides cuando termine. No se cambió nada.",
  no_es_el_vigente: "Este ya no es el plan vigente: hay una versión más nueva. Vuelvo a leer.",
  plan_ya_aprobado: "Este plan ya estaba aprobado: la siguiente fase ya arrancó.",
  plan_rechazado: "Este plan está rechazado: no se decide sobre él.",
  reescritura_en_curso: "Ya hay un pedido de cambios en curso: espera la versión nueva.",
  tope_de_vueltas: `Ya van ${VUELTAS_MAXIMAS} reescrituras: desde aquí solo se puede aprobar; lo demás se decide a mano.`,
  plan_inexistente: "La plataforma no encuentra este plan. Vuelvo a leer.",
  entrada_invalida: "La plataforma no aceptó el pedido tal como iba. No se gastó nada.",
  falta_confirmar_el_gasto: "Falta confirmar el gasto. No se gastó nada.",
  falta_confirmar_gasto: "Falta confirmar el gasto. No se gastó nada.",
  falta_el_tope: "Falta el tope del gasto. No se gastó nada.",
  tope_demasiado_alto: `El tope pasa de US$ ${TOPE_REESCRITURA_USD}. No se gastó nada.`,
}
const RELEER_TRAS = ["no_es_el_vigente", "plan_ya_aprobado", "plan_inexistente", "reescritura_en_curso", "plan_en_revision"]
const NO_DISPONIBLE = "Aún no disponible: el ciclo del plan se abre pronto. No se cambió nada ni se gastó."
const PUEDE_NO_ESTAR = "No se pudo completar. El ciclo del plan puede no estar disponible todavía. No se cambió nada ni se gastó."
export function palabrasDeLaRespuesta(accion: "plan-cambios" | "plan-aprobar", status: number, cuerpo: unknown): RespuestaDelCiclo {
  const c = objeto(cuerpo)
  if (status === 200 && c.ok === true) {
    const r = objeto(c.resultado)
    const re = r.reintento === true ? "Reintento: " : ""
    const motivo = texto(r.motivo_sin_despertar) || texto(r.motivo)
    if (accion === "plan-cambios") {
      if (r.despertado === false) return { ok: false, texto: `${re}Tu pedido quedó guardado, pero no se pudo avisar a la oficina de planeación${motivo ? ` (${motivo})` : ""}. No se gastó nada: usa «Reintentar».`, reintentar: true, releer: true }
      const vuelta = numero(r.vuelta), nueva = numero(r.version_nueva), tope = numero(r.tope_usd) ?? TOPE_REESCRITURA_USD
      return { ok: true, texto: `${re}Pedido enviado${vuelta ? ` (vuelta ${vuelta} de ${VUELTAS_MAXIMAS})` : ""}: el jefe de marketing reescribe${nueva ? ` la versión ${nueva}` : " el plan"} y la jefatura la revisa · tope US$ ${tope}.`, reintentar: false, releer: true }
    }
    const v = numero(r.version)
    const cual = v ? ` (versión ${v})` : ""
    if (r.despertado === false) return { ok: false, texto: `${re}Plan aprobado${cual}, pero no se pudo avisar para seguir al PDF y al brief${motivo ? ` (${motivo})` : ""}. Usa «Reintentar».`, reintentar: true, releer: true }
    if (r.reanuda === false) return { ok: true, texto: `${re}Plan aprobado${cual}. No se reanudó nada${motivo ? `: ${motivo}` : ""}.`, reintentar: false, releer: true }
    return { ok: true, texto: `${re}Plan aprobado${cual}: pasa al PDF, a la sala y al brief.`, reintentar: false, releer: true }
  }
  if (status === 501) return { ok: false, texto: NO_DISPONIBLE, reintentar: false, releer: false, tono: "info" }
  if (status === 401) return { ok: false, texto: "Tu sesión venció: entra de nuevo. No se cambió nada.", reintentar: false, releer: false }
  if (status === 403) return { ok: false, texto: "Necesitas una sesión de administrador. No se cambió nada.", reintentar: false, releer: false }
  const plat = objeto(c.plataforma)
  const crudo = (v: unknown) => (/^[a-z_]+$/.test(texto(v)) ? texto(v) : "")
  const err = crudo(c.error)
  const codigo = texto(plat.error) || crudo(c.detalle) || (err !== "conflicto" && err !== "la_plataforma_rechazo" ? err : "")
  // 409 `campana_detenida` (CC1 · certificado por CC3, 01-nov): la campaña de ese plan está pausada, necesita a una persona o está activa. Se muestra el
  // `detalle` de la plataforma TAL CUAL y NO se ofrece reintento (el panel no tiene cómo reanudar ni cerrar una campaña)
  if (codigo === "campana_detenida") {
    const d = texto(plat.detalle) || texto(c.detalle)
    return { ok: false, texto: `La campaña de este plan está detenida${d && d !== "campana_detenida" ? `: ${d}` : ""}. No se cambió nada ni se gastó.`, reintentar: false, releer: false }
  }
  if (MOTIVOS_DEL_CICLO[codigo]) return { ok: false, texto: MOTIVOS_DEL_CICLO[codigo], reintentar: false, releer: RELEER_TRAS.includes(codigo) }
  // NOTA de CC1 (01-nov): antes de la «ventana» las dos puertas responden 500 `planes_error` (sus tablas no existen) y después ese código sería un fallo real
  // de la base: un solo texto sirve para ambos casos, y el detalle técnico NO se muestra al dueño
  const platErr = texto(c.plataforma_error)
  const detalle = texto(c.detalle)
  if (platErr === "planes_error" || detalle === "planes_error") return { ok: false, texto: PUEDE_NO_ESTAR, reintentar: false, releer: false, tono: "info" }
  // la plataforma tiene la puerta pero aún no sus tablas: igual, sin detalle técnico
  if (/schema cache|does not exist|PGRST20[45]|42P01|plan_aprobaciones|plan_cambios/i.test(detalle)) return { ok: false, texto: PUEDE_NO_ESTAR, reintentar: false, releer: false, tono: "info" }
  // un fallo de la plataforma (5xx) no se cuenta con su texto técnico; un rechazo con motivo legible, sí
  const plataformaStatus = numero(c.plataforma_status)
  if (plataformaStatus != null && plataformaStatus >= 500) return { ok: false, texto: "No se pudo completar: la plataforma tuvo un problema. No se cambió nada.", reintentar: false, releer: false }
  return { ok: false, texto: `No se pudo${detalle ? `: ${detalle}` : ` (${status})`}. No se cambió nada.`, reintentar: false, releer: false }
}

// ── la bandeja de siempre (`revision-resolver`): la usa el panel de piezas para las «otras revisiones»; el plan ya no decide por aquí ──
/** el cuerpo que valida el servidor del tablero: la revisión, la decisión y el porqué (obligatorio al rechazar, de 5 a 1.000 caracteres) */
export function cuerpoDeResolucion(hitlId: string | null, decision: "aprobar" | "rechazar", comentario: string): { hitl_id: string; decision: "aprobar" | "rechazar"; comentario?: string } | { error: string } {
  if (!hitlId || !UUID.test(hitlId)) return { error: "No hay una revisión del plan que decidir" }
  const t = comentario.trim()
  if (t.length > 1000) return { error: "Máximo 1.000 caracteres" }
  if (decision === "rechazar" && t.length < 5) return { error: "Cuenta qué debe cambiar (al menos 5 caracteres)" }
  return { hitl_id: hitlId, decision, ...(t ? { comentario: t } : {}) }
}
/** la decisión ya tomada (columna `decision` de la bandeja) en palabras */
export function decisionDelPlanLegible(status: unknown, decision: unknown): string | null {
  const s = texto(status)
  if (s === "pending" || !s) return null
  const d = objeto(decision)
  const r = texto(d.resultado)
  if (r) return r[0].toUpperCase() + r.slice(1)
  return s === "approved" ? "Aprobado" : s === "rejected" ? "Cambios pedidos" : s === "edited" ? "Con cambios" : s
}
/** las sedes y zonas de la campaña («olon» · «olon_santa_elena» · «guayaquil») en palabras: las claves conocidas con su tilde, el resto con mayúscula */
const SEDES_CONOCIDAS: Record<string, string> = { olon: "Olón", olon_santa_elena: "Olón (Santa Elena)", guayaquil: "Guayaquil", quito: "Quito", cuenca: "Cuenca", manta: "Manta", montanita: "Montañita", salinas: "Salinas" }
export const sedeLegible = (s: unknown): string => { const k = texto(s).toLowerCase(); if (SEDES_CONOCIDAS[k]) return SEDES_CONOCIDAS[k]; const t = k.replace(/_/g, " "); return t ? t[0].toUpperCase() + t.slice(1) : "—" }
