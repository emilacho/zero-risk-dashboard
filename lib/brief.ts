/**
 * EL BRIEF DE CAMPAÑA (sprint 6.10 · encargo 01-nov · botón 4 del Centro de campaña): lo que la dirección del brief (`campaign-brief-agent`) escribe corto y con secciones
 * fijas (insight, UN mensaje, objetivo, tono, obligatorios y faltantes declarados) a partir del plan, el manual y lo que trajo el portero.
 * Fuente: `cadena_brief_creativo` (migración 202610312001 · HOY solo en la rama `feat/oficina-marketing-t3`, se publica en T9). Mientras la tabla no exista en producción,
 * la lectura lo dice (`publicado: false`) y la pantalla no inventa un brief.
 */
export interface Brief {
  id: string
  version: number
  estado: string
  texto_md: string | null
  /** lo que la cadena leyó del texto (secciones estructuradas), si lo guardó */
  leido: Record<string, unknown> | null
  devolucion_texto: string | null
  motivo: string | null
  costo_usd: number | null
  seco: boolean
  creada_en: string | null
  actualizada_en: string | null
}
type Fila = Record<string, unknown>
const texto = (v: unknown): string | null => (v == null || v === "" ? null : String(v))

export function briefDesdeFila(f: Fila): Brief {
  return {
    id: String(f.id), version: Number(f.version ?? 0), estado: String(f.estado ?? "borrador"), texto_md: texto(f.texto_md),
    leido: f.leido && typeof f.leido === "object" && !Array.isArray(f.leido) ? (f.leido as Record<string, unknown>) : null,
    devolucion_texto: texto(f.devolucion_texto), motivo: texto(f.motivo), costo_usd: f.costo_usd == null ? null : Number(f.costo_usd), seco: f.seco === true,
    creada_en: texto(f.creada_en), actualizada_en: texto(f.actualizada_en),
  }
}

export type TonoDelBrief = "neutro" | "ambar" | "verde" | "rojo" | "azul"
export function estadoDelBriefLegible(e: unknown): { texto: string; tono: TonoDelBrief } {
  switch (String(e ?? "")) {
    case "borrador": return { texto: "Borrador", tono: "neutro" }
    case "en_mesa": case "abierta": return { texto: "En la mesa del brief", tono: "ambar" }
    case "validada": case "validado": return { texto: "Validado", tono: "verde" }
    case "devuelto": case "devuelta": return { texto: "Devuelto por la dirección creativa", tono: "rojo" }
    case "reemplazada": case "reemplazado": case "retirada": return { texto: "Reemplazado por una versión nueva", tono: "azul" }
    default: return { texto: String(e ?? "sin estado") || "sin estado", tono: "neutro" }
  }
}

/** el texto del brief, partido por sus encabezados («## Insight», «## Mensaje»…) → secciones; sin encabezados, una sola sección */
export type SeccionDelBrief = { titulo: string; cuerpo: string }
export function seccionesDelBrief(md: string | null): SeccionDelBrief[] {
  if (!md || !md.trim()) return []
  const lineas = md.replace(/\r\n/g, "\n").split("\n")
  const out: SeccionDelBrief[] = []
  let actual: SeccionDelBrief | null = null
  for (const l of lineas) {
    const h = /^#{1,3}\s+(.+?)\s*$/.exec(l)
    if (h) { if (actual) out.push(actual); actual = { titulo: h[1], cuerpo: "" }; continue }
    if (!actual) actual = { titulo: "Brief", cuerpo: "" }
    actual.cuerpo += (actual.cuerpo ? "\n" : "") + l
  }
  if (actual) out.push(actual)
  return out.map((s) => ({ titulo: s.titulo, cuerpo: s.cuerpo.trim() })).filter((s) => s.cuerpo || s.titulo !== "Brief")
}

/** del más nuevo al más viejo */
export const ordenarBriefs = (xs: Brief[]): Brief[] => [...xs].sort((a, b) => b.version - a.version || (b.creada_en ?? "").localeCompare(a.creada_en ?? ""))
/** el vigente: el validado más nuevo; si no hay, el más nuevo */
export const briefVigente = (xs: Brief[]): Brief | null => { const o = ordenarBriefs(xs); return o.find((b) => /^valid/.test(b.estado)) ?? o[0] ?? null }

/** la segunda línea del cuadro «Brief de campaña» */
export function detalleDelBrief(x: { publicado: boolean; campana: unknown; briefs: Brief[] }): { texto: string; aviso: boolean } {
  if (!x.publicado) return { texto: "La cadena aún no publica el brief (llega con T9)", aviso: false }
  if (!x.campana) return { texto: "Sin campaña todavía", aviso: false }
  const v = briefVigente(x.briefs)
  if (!v) return { texto: "La mesa del brief todavía no escribió", aviso: false }
  const e = estadoDelBriefLegible(v.estado)
  return { texto: `Versión ${v.version} · ${e.texto}`, aviso: e.tono === "rojo" }
}
