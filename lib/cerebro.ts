/**
 * EL CEREBRO DEL CLIENTE EN EL ESTILO NUEVO (sprint 6.8 · Emilio 31-oct: «lo que veas en el dashboard anterior lo traes al nuevo mejorado con la misma idea»).
 * Lógica PURA (sin red ni base): cómo se agrupan las fichas vigentes en carpetas por tema de negocio (de macro a micro, como un explorador), cómo se dicen en
 * palabras su origen, propiedad, decisión y vigencia, y cómo se arma lo que el dueño escribe o corrige para la puerta del dueño de la plataforma
 * (`POST /api/brain/alimentar/dueno`: US$ 0, sin modelo; una respuesta nueva al mismo tema REEMPLAZA a la anterior, que queda archivada).
 * El dato del dueño es LO ÚNICO que se escribe desde aquí: el resto del cerebro lo llenan las oficinas (sitio, redes, competidores, tendencias) y se lee tal cual.
 */

export type ClaveDeCarpeta = "dueno" | "negocio" | "redes" | "dicen" | "competidores" | "mercado" | "ideal" | "otras"

export interface CarpetaDelCerebro {
  clave: ClaveDeCarpeta
  nombre: string
  /** qué guarda, en una línea */
  descripcion: string
  /** las clases de ficha que caen aquí (`competidor_*` cae en competidores por prefijo) */
  clases: readonly string[]
}

/** las carpetas, en el orden en que se ven (lo del dueño primero: es lo que él puede corregir) */
export const CARPETAS_DEL_CEREBRO: readonly CarpetaDelCerebro[] = [
  { clave: "dueno", nombre: "Lo que dijo el dueño", descripcion: "Datos confirmados por ti · mandan sobre lo demás", clases: ["dato_del_dueno"] },
  { clave: "negocio", nombre: "Su negocio", descripcion: "Lo que el sitio, el mapa y los precios dicen del cliente", clases: ["sitio", "precio", "horario", "mapas", "producto", "contacto", "catalogo"] },
  { clave: "redes", nombre: "Sus redes", descripcion: "Lo que publica y cómo le responde la gente", clases: ["instagram", "facebook", "tiktok", "youtube", "linkedin", "videos", "comentarios", "lo_mas_gustado_propio", "metrica", "cuenta"] },
  { clave: "dicen", nombre: "Lo que dicen de él", descripcion: "Reseñas, menciones y artículos de terceros", clases: ["resenas", "mencion", "articulo", "lo_mas_gustado"] },
  { clave: "competidores", nombre: "Competidores", descripcion: "A quién vigilamos y qué hace", clases: ["competidor_evaluacion", "competidor_vigilado", "competidor_mapas", "competidor_anuncios", "competidor_instagram", "competidor_cuenta", "competidor_analisis"] },
  { clave: "mercado", nombre: "Mercado y tendencias", descripcion: "Qué le gusta al público y dónde está parado el cliente", clases: ["tendencia_del_publico", "tendencia", "mercado_posicion", "resumen_vivo"] },
  { clave: "ideal", nombre: "Cliente ideal", descripcion: "A quién le hablamos: segmentos, metas, dolores", clases: ["perfil_ideal"] },
  { clave: "otras", nombre: "Otras fichas", descripcion: "Lo que no cae en ninguna carpeta", clases: [] },
] as const

export function carpetaDeLaClase(clase: unknown): ClaveDeCarpeta {
  const c = String(clase ?? "").trim().toLowerCase()
  if (!c) return "otras"
  for (const k of CARPETAS_DEL_CEREBRO) if (k.clases.includes(c)) return k.clave
  if (c.startsWith("competidor")) return "competidores"
  if (c.startsWith("tendencia")) return "mercado"
  return "otras"
}

/** una ficha vigente del cerebro, ya en la forma que dibuja el panel */
export interface FichaDelCerebro {
  id: string
  clase: string
  carpeta: ClaveDeCarpeta
  titulo: string
  que_es: string | null
  contenido: string | null
  origen: string | null
  propiedad: string | null
  sede: string | null
  atributo: string | null
  alcance: string | null
  fuente_url: string | null
  observado_en: string | null
  vigente_hasta: string | null
  decision: string | null
  razon_de_decision: string | null
  porque: string | null
  creado_en: string | null
  /** solo en los datos del dueño: el tema con el que se registró, el canal, la pregunta que lo originó y la respuesta LITERAL (el `contenido` es la cita armada por el cerebro) */
  tema: string | null
  canal: string | null
  pregunta: string | null
  respuesta: string | null
}

type Fila = Record<string, unknown>
const txt = (v: unknown): string | null => { if (v == null) return null; const s = String(v).trim(); return s ? s : null }

export function fichaDesdeFila(f: Fila): FichaDelCerebro {
  const pt = (f.provenance_tag && typeof f.provenance_tag === "object" ? f.provenance_tag : {}) as Fila
  const d = (pt.datos && typeof pt.datos === "object" ? pt.datos : {}) as Fila
  const clase = String(f.clase ?? "").trim() || "sin_clase"
  return {
    id: String(f.id), clase, carpeta: carpetaDeLaClase(clase),
    titulo: txt(f.titulo) ?? claseLegible(clase),
    que_es: txt(f.que_es), contenido: txt(f.contenido),
    origen: txt(f.origen), propiedad: txt(f.propiedad), sede: txt(f.sede), atributo: txt(f.atributo), alcance: txt(f.alcance),
    fuente_url: txt(f.fuente_url), observado_en: txt(f.observado_en), vigente_hasta: txt(f.vigente_hasta),
    decision: txt(f.decision), razon_de_decision: txt(f.razon_de_decision), porque: txt(f.porque), creado_en: txt(f.creado_en),
    tema: txt(d.tema), canal: txt(d.canal) ?? txt(pt.canal), pregunta: txt(d.pregunta), respuesta: txt(d.respuesta),
  }
}

/** las filas del análisis que no son un competidor (p. ej. `_landscape_summary`, el resumen interno de la plataforma) */
export const esCompetidorReal = (c: Fila): boolean => !!txt(c.competitor_name) && !String(c.competitor_name).trim().startsWith("_")

/** un competidor analizado por la plataforma (`client_competitive_landscape`), dicho como ficha para que viva en la misma carpeta */
export function fichaDeCompetidorAnalizado(c: Fila): FichaDelCerebro {
  const nombre = txt(c.competitor_name) ?? "Competidor"
  const dif = Array.isArray(c.key_differentiators) ? c.key_differentiators.map(String).filter(Boolean) : []
  const deb = Array.isArray(c.weaknesses) ? c.weaknesses.map(String).filter(Boolean) : []
  const partes = [txt(c.value_proposition) ? `Propuesta: ${txt(c.value_proposition)}` : null, dif.length ? `Se diferencia por: ${dif.join(" · ")}` : null, deb.length ? `Flancos: ${deb.join(" · ")}` : null].filter(Boolean)
  return {
    id: `competidor-analizado:${String(c.id)}`, clase: "competidor_analisis", carpeta: "competidores",
    titulo: `Análisis · ${nombre}`, que_es: txt(c.competitor_type) ? `Competidor ${competidorTipoLegible(c.competitor_type)}` : "Competidor analizado",
    contenido: partes.length ? partes.join("\n") : txt(c.content_text), origen: "plataforma", propiedad: "ajena", sede: null, atributo: null, alcance: "competidor",
    fuente_url: null, observado_en: txt(c.last_analyzed_at) ?? txt(c.created_at), vigente_hasta: null, decision: null, razon_de_decision: null,
    porque: txt(c.analysis_source) ? `Analizado por ${String(c.analysis_source)}` : null, creado_en: txt(c.created_at), tema: null, canal: null, pregunta: null, respuesta: null,
  }
}

function competidorTipoLegible(t: unknown): string {
  const s = String(t ?? "").toLowerCase()
  return s === "direct" || s === "directo" ? "directo" : s === "indirect" || s === "indirecto" ? "indirecto" : s === "aspirational" ? "aspiracional" : s === "alternative" || s === "substitute" ? "alternativo" : s || "sin tipo"
}

/** un segmento del perfil del cliente ideal (`client_icp_documents`) */
export interface PerfilIdeal {
  id: string
  segmento: string
  prioridad: number | null
  geografia: string | null
  metas: string[]
  dolores: string[]
  tareas: string[]
  objeciones: string[]
  canales: string[]
  presupuesto: string | null
  criterios: string[]
  compra: string | null
  contenido: string | null
}
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : typeof v === "string" && v.trim() ? [v.trim()] : [])
export function perfilDesdeFila(f: Fila): PerfilIdeal {
  const pr = Number(f.segment_priority)
  return {
    id: String(f.id), segmento: txt(f.audience_segment) ?? "Segmento", prioridad: Number.isFinite(pr) ? pr : null, geografia: txt(f.geography),
    metas: lista(f.goals), dolores: lista(f.pain_points), tareas: lista(f.jobs_to_be_done), objeciones: lista(f.objections), canales: lista(f.preferred_channels),
    presupuesto: txt(f.budget_range), criterios: lista(f.decision_criteria), compra: txt(f.buying_process), contenido: txt(f.content_preferences),
  }
}

/** una pregunta que una oficina le hizo al dueño y sigue sin respuesta */
export interface PreguntaPendiente { id: string; tema: string; pregunta: string; oficina: string | null; agente: string | null; canal: string | null; desde: string | null; sede_clave: string | null }
export function preguntaDesdeFila(p: Fila): PreguntaPendiente {
  return { id: String(p.id), tema: txt(p.tema) ?? "sin tema", pregunta: txt(p.pregunta) ?? "", oficina: txt(p.preguntado_por_oficina), agente: txt(p.preguntado_por_agente), canal: txt(p.canal), desde: txt(p.creado_en), sede_clave: txt(p.sede_clave) }
}

// ─── palabras ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function origenLegible(o: unknown): string {
  switch (String(o ?? "").toLowerCase()) {
    case "dueno": return "Lo dijo el dueño"
    case "su_fuente": return "De sus propias fuentes"
    case "tercero": return "De terceros"
    case "plataforma": return "Lo dedujo el sistema"
    case "": return "Origen sin anotar"
    default: return String(o)
  }
}
export function propiedadLegible(p: unknown): string {
  switch (String(p ?? "").toLowerCase()) {
    case "propia": return "Del cliente"
    case "ajena": return "De otro"
    case "incierta": return "No se sabe de quién"
    case "": return "Sin anotar"
    default: return String(p)
  }
}
export function decisionLegible(d: unknown): string {
  switch (String(d ?? "").toLowerCase()) {
    case "reemplaza": return "Reemplazó a una ficha anterior"
    case "suma": return "Se sumó a lo que había"
    case "duda": return "Quedó en duda"
    case "": return "Sin decisión anotada"
    default: return String(d)
  }
}
export function alcanceLegible(a: unknown): string | null {
  switch (String(a ?? "").toLowerCase()) {
    case "cliente": return "Habla del cliente"
    case "competidor": return "Habla de un competidor"
    case "mercado": return "Habla del mercado"
    case "zona": return "Habla de la zona"
    case "industria": return "Habla del rubro"
    case "formato": return "Habla de un formato"
    case "general": return "General"
    case "": return null
    default: return String(a)
  }
}
const CLASES: Record<string, string> = {
  dato_del_dueno: "Dato del dueño", sitio: "Su sitio web", precio: "Precio", horario: "Horario", mapas: "Ficha de Mapas", producto: "Producto", instagram: "Instagram", videos: "Video",
  comentarios: "Comentarios", lo_mas_gustado_propio: "Lo que más gustó de lo suyo", lo_mas_gustado: "Lo que más gusta del rubro", metrica: "Métrica", resenas: "Reseñas", mencion: "Mención",
  articulo: "Artículo", competidor_evaluacion: "Evaluación de competidor", competidor_vigilado: "Competidor vigilado", competidor_mapas: "Competidor en Mapas", competidor_anuncios: "Anuncios de competidor",
  competidor_instagram: "Instagram de competidor", competidor_cuenta: "Cuenta de competidor", competidor_analisis: "Análisis de competidor", tendencia_del_publico: "Tendencia del público", mercado_posicion: "Posición en el mercado",
  resumen_vivo: "Resumen vivo", perfil_ideal: "Perfil del cliente ideal",
}
export function claseLegible(c: unknown): string {
  const s = String(c ?? "").trim().toLowerCase()
  if (CLASES[s]) return CLASES[s]
  const t = s.replace(/_/g, " ")
  return t ? t[0].toUpperCase() + t.slice(1) : "Ficha"
}

export type TonoDeVigencia = "verde" | "ambar" | "rojo" | "neutro"
/** cuánto le queda a la ficha: sin vencimiento (la mayoría), vence en N días (ámbar si ≤7), o ya venció y espera que la oficina la reconfirme */
export function vigenciaLegible(f: Pick<FichaDelCerebro, "vigente_hasta">, ahora: Date = new Date()): { texto: string; tono: TonoDeVigencia } {
  if (!f.vigente_hasta) return { texto: "Sin vencimiento", tono: "neutro" }
  const t = Date.parse(f.vigente_hasta)
  if (Number.isNaN(t)) return { texto: "Sin vencimiento", tono: "neutro" }
  const dias = Math.ceil((t - ahora.getTime()) / 86_400_000)
  if (dias < 0) return { texto: `Venció hace ${plural(-dias, "día", "días")} · la oficina debe reconfirmarla`, tono: "rojo" }
  if (dias === 0) return { texto: "Vence hoy", tono: "ambar" }
  if (dias <= 7) return { texto: `Vence en ${plural(dias, "día", "días")}`, tono: "ambar" }
  return { texto: `Vigente ${plural(dias, "día", "días")} más`, tono: "verde" }
}
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** las fichas más nuevas primero (lo observado manda; si no hay, cuándo se creó) */
export const fechaDeLaFicha = (f: Pick<FichaDelCerebro, "observado_en" | "creado_en">): string => f.observado_en ?? f.creado_en ?? ""
export function ordenarFichas<T extends Pick<FichaDelCerebro, "observado_en" | "creado_en">>(fichas: T[]): T[] {
  return [...fichas].sort((a, b) => (fechaDeLaFicha(b) < fechaDeLaFicha(a) ? -1 : fechaDeLaFicha(b) > fechaDeLaFicha(a) ? 1 : 0))
}

// ─── el árbol (macro → micro) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface CarpetaArmada extends CarpetaDelCerebro {
  fichas: FichaDelCerebro[]
  /** cuántas cosas hay dentro (fichas; en «Cliente ideal», los segmentos) */
  total: number
  /** fichas que vencen en ≤7 días o ya vencieron */
  por_vencer: number
  /** en «Lo que dijo el dueño»: preguntas de las oficinas que esperan tu respuesta */
  preguntas: number
  /** una línea que acompaña al nombre en el cuadro */
  detalle: string
}

export function arbolDelCerebro(fichas: FichaDelCerebro[], o: { perfiles?: number; preguntas?: number; ahora?: Date } = {}): CarpetaArmada[] {
  const ahora = o.ahora ?? new Date()
  const ordenadas = ordenarFichas(fichas)
  return CARPETAS_DEL_CEREBRO.map((k) => {
    const propias = ordenadas.filter((f) => f.carpeta === k.clave)
    const total = k.clave === "ideal" ? o.perfiles ?? 0 : propias.length
    const por_vencer = propias.filter((f) => vigenciaLegible(f, ahora).tono !== "neutro" && vigenciaLegible(f, ahora).tono !== "verde").length
    const preguntas = k.clave === "dueno" ? o.preguntas ?? 0 : 0
    const cosa = k.clave === "dueno" ? plural(total, "dato", "datos") : plural(total, "ficha", "fichas")
    const detalle = k.clave === "ideal" ? plural(total, "segmento", "segmentos") : preguntas ? `${cosa} · ${plural(preguntas, "pregunta espera", "preguntas esperan")} tu respuesta` : por_vencer ? `${cosa} · ${por_vencer} por reconfirmar` : cosa
    return { ...k, fichas: propias, total, por_vencer, preguntas, detalle }
  }).filter((k) => k.clave !== "otras" || k.total > 0)
}

/** las fichas de la carpeta, agrupadas por sede cuando el cliente tiene más de una (las sin sede, primero) */
export function porSede(fichas: FichaDelCerebro[]): Array<{ sede: string | null; fichas: FichaDelCerebro[] }> {
  const m = new Map<string | null, FichaDelCerebro[]>()
  for (const f of fichas) m.set(f.sede, [...(m.get(f.sede) ?? []), f])
  return [...m.entries()].sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : a.localeCompare(b, "es"))).map(([sede, fs]) => ({ sede, fichas: fs }))
}

// ─── lo que el dueño escribe ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const MAX_TEMA = 80
export const MAX_PREGUNTA = 600
export const MAX_RESPUESTA = 2000
export const MIN_RESPUESTA = 3
/** cómo se presenta el dashboard ante la puerta del dueño (el precedente es el manual: `dashboard · manual`) */
export const CANAL_DEL_CEREBRO = "dashboard · cerebro"
export const FLUJO_DEL_CEREBRO = "dashboard-cerebro"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** lo que manda el panel a `POST /api/cerebro/dueno` */
export interface DatoDelDueno {
  client_id: string
  /** de qué habla (texto libre, hasta 80): «horario de Olón», «presupuesto de pauta». Mismo tema = reemplaza al anterior */
  tema: string
  /** lo que el dueño dice, literal */
  respuesta: string
  /** la pregunta que responde (si responde a una oficina) */
  pregunta?: string | null
  /** la sede, si el dato es de una sede (clave de `client_sedes`) */
  sede_clave?: string | null
  /** la pregunta pendiente que queda respondida con esto */
  pregunta_id?: string | null
}

/** valida lo que escribió el dueño y arma el cuerpo EXACTO para la puerta de la plataforma (`dry_run: false` con flujo y ejecución del dashboard) */
export function cuerpoParaLaPuertaDelDueno(raw: unknown, ahora: Date = new Date()): { cuerpo: Record<string, unknown>; dato: DatoDelDueno } | { error: string } {
  const b = (raw && typeof raw === "object" ? raw : {}) as Fila
  const client_id = String(b.client_id ?? "")
  if (!UUID.test(client_id)) return { error: "Falta el cliente." }
  const tema = String(b.tema ?? "").trim().replace(/\s+/g, " ")
  if (!tema) return { error: "Di de qué habla el dato (el tema): por ejemplo «horario de Olón» o «presupuesto de pauta»." }
  if (tema.length > MAX_TEMA) return { error: `El tema va corto: hasta ${MAX_TEMA} letras.` }
  if (/^manual\s*·/i.test(tema)) return { error: "Los datos del manual de marca se editan en el Manual, no aquí." }
  const respuesta = String(b.respuesta ?? "").trim()
  if (respuesta.length < MIN_RESPUESTA) return { error: "Escribe el dato (al menos 3 letras)." }
  if (respuesta.length > MAX_RESPUESTA) return { error: `El dato va hasta ${MAX_RESPUESTA} letras.` }
  const preguntaDada = String(b.pregunta ?? "").trim()
  if (preguntaDada.length > MAX_PREGUNTA) return { error: `La pregunta va hasta ${MAX_PREGUNTA} letras.` }
  const sede_clave = String(b.sede_clave ?? "").trim() || null
  if (sede_clave && !/^[a-z0-9_-]{1,60}$/i.test(sede_clave)) return { error: "La sede no es válida." }
  const pregunta_id = String(b.pregunta_id ?? "").trim() || null
  if (pregunta_id && !UUID.test(pregunta_id)) return { error: "La pregunta pendiente no es válida." }
  const sello = ahora.toISOString()
  const dato: DatoDelDueno = { client_id, tema, respuesta, pregunta: preguntaDada || null, sede_clave, pregunta_id }
  return {
    dato,
    cuerpo: {
      evento: "respuesta", client_id, tema, respuesta,
      pregunta: preguntaDada || `El dueño lo escribió en el dashboard (Cerebro) · tema: ${tema}`,
      canal: CANAL_DEL_CEREBRO, respondido_en: sello, preguntado_por: { oficina: "dashboard", agente: "emilio" },
      ...(sede_clave ? { sede_clave } : {}), ...(pregunta_id ? { pregunta_id } : {}),
      mensaje_ref: `cerebro:${client_id}:${sello}`,
      dry_run: false, workflow_id: FLUJO_DEL_CEREBRO, workflow_execution_id: `dashboard:cerebro:${client_id}:${sello}`,
    },
  }
}

/** lo que se le dice a Emilio después de guardar (con lo que contestó la puerta) */
export function textoTrasGuardar(j: Record<string, unknown>): string {
  const reemplaza = Array.isArray(j.reemplaza) ? j.reemplaza.length : j.reemplaza ? 1 : 0
  const sede = typeof j.sede === "string" && j.sede ? ` · sede ${j.sede}` : ""
  const base = reemplaza ? `Guardado en el cerebro${sede} · reemplazó ${plural(reemplaza, "dato anterior", "datos anteriores")} del mismo tema` : `Guardado en el cerebro${sede} · dato nuevo`
  const errores = Array.isArray(j.errores) ? j.errores.length : 0
  return errores ? `${base} · con ${plural(errores, "aviso", "avisos")} del sistema` : `${base} · el siguiente empleado lo lee así`
}

/** por qué no se guardó, en palabras */
export function errorTrasGuardar(status: number, j: Record<string, unknown>): string {
  const d = typeof j.detalle === "string" ? j.detalle : typeof j.detail === "string" ? j.detail : ""
  if (status === 401) return "Tu sesión venció: entra de nuevo."
  if (status === 403) return "Solo el administrador puede escribir en el cerebro."
  if (status === 400) return d ? `No se guardó: ${d}` : "No se guardó: revisa el tema y el dato."
  if (status === 404) return "Ese cliente no existe en la plataforma: no se guardó nada."
  if (status === 501) return "La plataforma todavía no tiene la puerta del dueño: no se guardó nada."
  if (status === 503) return j.error === "puerta_apagada" ? "La puerta del dueño está apagada en la plataforma: no se guardó nada." : d || "El tablero no tiene la llave con la que habla con la plataforma."
  if (status === 502) return `La plataforma no lo guardó: ${d || "sin detalle"}`
  return `No se pudo (${status})${d ? `: ${d}` : ""}`
}
