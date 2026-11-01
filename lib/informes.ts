/**
 * INFORMES (sprint 6.9 · Emilio 1-nov: «en vez de cerebro poner informes»): la lógica pura del cuadro «Informes» del Dept. Marketing.
 * Fuente real: la tabla `client_reports` de la plataforma (la escribe el generador de informes semanales de la oficina · `POST /api/client-reports`).
 * Cada fila: un período (`period_start`..`period_end`), un tipo (`kind`: weekly · monthly · quarterly · ad_hoc), un estado (`status`: draft · awaiting_review ·
 * approved · delivered · failed), un `summary` JSON libre (kpis, narrativa, puntos altos…), un `pdf_url` opcional y a quién/cuándo se entregó.
 * HOY (1-nov) la tabla está VACÍA para todos los clientes: la pantalla lo dice tal cual, no inventa informes.
 */
import { diaCorto } from "@/lib/lenguaje"

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
/** las fechas de período son DÍAS (columnas DATE, sin hora): se muestran tal cual, sin pasar por la hora de Ecuador (que las correría un día) */
export function diaDePeriodo(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  if (!m) return diaCorto(d)
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? m[2]}`
}

export type TipoDeInforme = "weekly" | "monthly" | "quarterly" | "ad_hoc"
export type EstadoDeInforme = "draft" | "awaiting_review" | "approved" | "delivered" | "failed"

export interface Informe {
  id: string
  tipo: TipoDeInforme | string
  desde: string
  hasta: string
  estado: EstadoDeInforme | string
  /** el resumen tal cual lo guardó la oficina (JSON libre) */
  resumen: Record<string, unknown>
  pdf_url: string | null
  entregado_a: string[]
  entregado_en: string | null
  creado_en: string | null
}

type Fila = Record<string, unknown>
const texto = (v: unknown): string | null => (v == null || v === "" ? null : String(v))

export function informeDesdeFila(f: Fila): Informe {
  const resumen = f.summary && typeof f.summary === "object" && !Array.isArray(f.summary) ? (f.summary as Record<string, unknown>) : f.summary != null ? { texto: String(f.summary) } : {}
  const entregado = Array.isArray(f.delivered_to) ? (f.delivered_to as unknown[]).map((x) => (typeof x === "string" ? x : JSON.stringify(x))) : []
  return {
    id: String(f.id), tipo: String(f.kind ?? "weekly"), desde: String(f.period_start ?? ""), hasta: String(f.period_end ?? ""), estado: String(f.status ?? "draft"),
    resumen, pdf_url: texto(f.pdf_url), entregado_a: entregado, entregado_en: texto(f.delivered_at), creado_en: texto(f.created_at),
  }
}

/** ─── los informes de la mesa de análisis (01-nov · punto 7 de Emilio): viven en el cerebro, no en `client_reports` ───
 * Cada uno es una ficha de clase `informe_de_analisis` (una vigente por cliente y tipo; la puerta `/api/brain/alimentar/informe` retira la anterior). Son PROPUESTAS de la
 * mesa de análisis: se muestran rotuladas, nunca como dato confirmado del cliente. */
export interface InformeDeAnalisis { id: string; tipo: string; titulo: string; texto: string; /** hasta qué día llega la información (ISO) */ corte: string | null; creado_en: string | null; citas: number }
export function tipoDeAnalisisLegible(t: unknown): string {
  switch (String(t ?? "")) {
    case "mercado": return "Mercado"
    case "competencia": return "Competencia"
    case "voz_del_publico": return "Voz del público"
    case "tendencias": return "Tendencias"
    case "": return "Análisis"
    default: { const s = String(t).replace(/[_-]+/g, " ").trim(); return s.charAt(0).toUpperCase() + s.slice(1) }
  }
}
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
export function analisisDesdeFila(f: Fila): InformeDeAnalisis {
  const datos = objeto(objeto(f.provenance_tag).datos)
  const deltitulo = /Informe\s*·\s*([^·]+?)\s*·/.exec(String(f.titulo ?? ""))?.[1]
  const tipo = texto(datos.tipo) ?? (deltitulo ? deltitulo.trim() : "")
  return {
    id: String(f.id), tipo, titulo: `Informe de ${tipoDeAnalisisLegible(tipo).toLowerCase()}`,
    // la ficha abre con un rótulo de sistema «[informe de análisis · tipo · PROPUESTA: …]»: se quita, la pantalla lo dice con sus palabras
    texto: String(f.contenido ?? "").replace(/^\[informe de an[aá]lisis[^\]]*\]\s*/i, "").trim(),
    corte: texto(datos.fecha_de_corte) ?? texto(f.observado_en), creado_en: texto(f.creado_en),
    citas: Array.isArray(datos.citas) ? datos.citas.length : 0,
  }
}
export const ordenarAnalisis = (xs: InformeDeAnalisis[]): InformeDeAnalisis[] => [...xs].sort((a, b) => (b.creado_en ?? "").localeCompare(a.creado_en ?? ""))

export function tipoLegible(t: unknown): string {
  switch (String(t)) {
    case "weekly": return "Semanal"
    case "monthly": return "Mensual"
    case "quarterly": return "Trimestral"
    case "ad_hoc": return "Especial"
    default: return String(t ?? "Informe")
  }
}

export type TonoDeEstado = "neutro" | "ambar" | "verde" | "rojo" | "azul"
export function estadoLegible(e: unknown): { texto: string; tono: TonoDeEstado } {
  switch (String(e)) {
    case "draft": return { texto: "Borrador", tono: "neutro" }
    case "awaiting_review": return { texto: "Espera tu revisión", tono: "ambar" }
    case "approved": return { texto: "Aprobado", tono: "verde" }
    case "delivered": return { texto: "Entregado", tono: "azul" }
    case "failed": return { texto: "Falló al armarse", tono: "rojo" }
    default: return { texto: String(e ?? "sin estado"), tono: "neutro" }
  }
}

/** «3 al 9 de nov. de 2026» · «nov. 2026» para un mes entero */
export function periodoLegible(desde: string, hasta: string): string {
  if (!desde || !hasta) return desde || hasta || "sin período"
  const a = diaDePeriodo(desde), b = diaDePeriodo(hasta)
  return a === b ? a : `${a} → ${b}`
}

/** el título de un informe: «Informe semanal · 3 nov → 9 nov» */
export const tituloDelInforme = (i: Informe) => `Informe ${tipoLegible(i.tipo).toLowerCase()} · ${periodoLegible(i.desde, i.hasta)}`

/** el resumen JSON libre, aplanado en bloques legibles: cada clave de primer nivel es un bloque; listas → viñetas; objetos → pares clave/valor; textos → párrafo */
export type BloqueDelResumen = { clave: string; titulo: string; parrafo?: string; vinetas?: string[]; pares?: Array<{ clave: string; valor: string }> }
const TITULOS: Record<string, string> = {
  narrative: "Lo que pasó", narrativa: "Lo que pasó", summary: "Resumen", resumen: "Resumen", texto: "Resumen", highlights: "Puntos altos", kpis: "Indicadores", metrics: "Indicadores", metricas: "Indicadores",
  next_week_focus: "En qué se enfoca la próxima semana", next_steps: "Próximos pasos", blockers: "Lo que frena", recommendations: "Recomendaciones", charts: "Gráficos", title: "Título",
}
const legible = (k: string) => TITULOS[k] ?? k.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase())
const valor = (v: unknown): string => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v))
export function bloquesDelResumen(resumen: Record<string, unknown>): BloqueDelResumen[] {
  const out: BloqueDelResumen[] = []
  for (const [k, v] of Object.entries(resumen)) {
    if (v == null || v === "") continue
    if (Array.isArray(v)) { if (v.length) out.push({ clave: k, titulo: legible(k), vinetas: v.map(valor) }); continue }
    if (typeof v === "object") { const pares = Object.entries(v as Record<string, unknown>).map(([ck, cv]) => ({ clave: legible(ck), valor: valor(cv) })); if (pares.length) out.push({ clave: k, titulo: legible(k), pares }); continue }
    out.push({ clave: k, titulo: legible(k), parrafo: String(v) })
  }
  return out
}

/** del más reciente al más viejo (por fin de período, luego creación) */
export function ordenarInformes(xs: Informe[]): Informe[] {
  return [...xs].sort((a, b) => (b.hasta || "").localeCompare(a.hasta || "") || (b.creado_en ?? "").localeCompare(a.creado_en ?? ""))
}

/** agrupados por tipo, en el orden semanal · mensual · trimestral · especial (solo los tipos que tienen algo) */
export const ORDEN_DE_TIPOS: TipoDeInforme[] = ["weekly", "monthly", "quarterly", "ad_hoc"]
export function porTipo(xs: Informe[]): Array<{ tipo: string; nombre: string; informes: Informe[]; esperan: number }> {
  const tipos = [...ORDEN_DE_TIPOS.filter((t) => xs.some((x) => x.tipo === t)), ...[...new Set(xs.map((x) => x.tipo))].filter((t) => !(ORDEN_DE_TIPOS as string[]).includes(t))]
  return tipos.map((t) => { const inf = ordenarInformes(xs.filter((x) => x.tipo === t)); return { tipo: t, nombre: tipoLegible(t), informes: inf, esperan: inf.filter((x) => x.estado === "awaiting_review").length } })
}

/** la segunda línea del cuadro «Informes» en la pantalla de aplicaciones */
export function detalleDeInformes(xs: Informe[], analisis: InformeDeAnalisis[] = []): { texto: string; aviso: boolean } {
  if (!xs.length && !analisis.length) return { texto: "Todavía no hay informes de este cliente", aviso: false }
  const deAnalisis = analisis.length ? `${analisis.length} ${analisis.length === 1 ? "informe de análisis" : "informes de análisis"}` : ""
  if (!xs.length) { const u = ordenarAnalisis(analisis)[0]; return { texto: `${deAnalisis}${u.corte ? ` · al ${diaDePeriodo(u.corte.slice(0, 10))}` : ""}`, aviso: false } }
  const esperan = xs.filter((x) => x.estado === "awaiting_review").length
  const resto = deAnalisis ? ` · ${deAnalisis}` : ""
  if (esperan) return { texto: `${esperan} ${esperan === 1 ? "informe espera" : "informes esperan"} tu revisión${resto}`, aviso: true }
  const ultimo = ordenarInformes(xs)[0]
  return { texto: `${xs.length} ${xs.length === 1 ? "informe" : "informes"} · último ${periodoLegible(ultimo.desde, ultimo.hasta)}${resto}`, aviso: false }
}
