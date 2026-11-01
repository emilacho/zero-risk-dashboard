/**
 * TU OFICINA · CAPA 2 · DECISIONES (6.20 · 1-nov · encargo «oficina del humano»): todo lo que espera la firma de Emilio, de cualquier departamento.
 * Fuente: la ruta certificada de la plataforma `GET /api/direccion/decisiones` (CC1 #802, contrato en
 * `raw/tasks/2026-11-01-LISTO-CC1-para-certificar-rutas-de-datos-de-tu-oficina.md`), leída por el servidor del tablero con la llave interna.
 * SOLO LECTURA: aquí no se decide nada. Cada decisión se abre en el panel del tablero nuevo donde ya se decide (plan · gran idea · piezas y revisiones); lo que
 * todavía no tiene panel nuevo lo dice tal cual, sin botón falso y sin enlazar al tablero viejo.
 * Reglas del contrato: `completo: false` ⇒ nunca decir «nada pendiente»; `sin_fuente[]` se muestra como «sin dato».
 */

export type TipoDeDecision = "plan" | "gran_idea" | "pieza" | "revision" | "pregunta_al_dueno" | "pregunta_de_finanzas" | "firma_de_finanzas"
export const TIPOS_DE_DECISION: readonly TipoDeDecision[] = ["plan", "gran_idea", "pieza", "revision", "pregunta_al_dueno", "pregunta_de_finanzas", "firma_de_finanzas"]

export interface Decision {
  id: string
  tipo: TipoDeDecision
  subtipo: string | null
  fuente: string | null
  client_id: string | null
  cliente: string | null
  titulo: string
  desde: string | null
  vence: string | null
  vencida: boolean
  prioridad: string | null
  decidir: { ruta: string | null; accion: string | null }
  costo_usd: number | null
  costo_nota: string | null
}
export interface FuenteDeDecisiones { fuente: string; estado: "ok" | "no_existe" | "error" | "sin_credencial" | string; filas: number; truncado?: boolean; detalle?: string }
export interface Decisiones {
  generado_en: string | null
  completo: boolean
  total: number
  decisiones: Decision[]
  fuentes: FuenteDeDecisiones[]
  sin_fuente: Array<{ que: string; motivo: string }>
}

const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** lo que llega de la plataforma, revisado campo por campo: lo que no cuadra con el contrato se descarta (y la lista queda marcada incompleta) */
export function normalizarDecisiones(raw: unknown): Decisiones {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const lista = Array.isArray(r.decisiones) ? r.decisiones : []
  let descartadas = 0
  const decisiones: Decision[] = []
  for (const x of lista) {
    const d = (x && typeof x === "object" ? x : {}) as Record<string, unknown>
    const tipo = TIPOS_DE_DECISION.find((t) => t === d.tipo)
    const id = txt(d.id), titulo = txt(d.titulo)
    if (!tipo || !id || !titulo) { descartadas++; continue }
    const dec = (d.decidir && typeof d.decidir === "object" ? d.decidir : {}) as Record<string, unknown>
    decisiones.push({
      id, tipo, titulo,
      subtipo: txt(d.subtipo), fuente: txt(d.fuente), client_id: txt(d.client_id), cliente: txt(d.cliente),
      desde: txt(d.desde), vence: txt(d.vence), vencida: d.vencida === true, prioridad: txt(d.prioridad),
      decidir: { ruta: txt(dec.ruta), accion: txt(dec.accion) },
      costo_usd: num(d.costo_usd), costo_nota: txt(d.costo_nota),
    })
  }
  const fuentes = (Array.isArray(r.fuentes) ? r.fuentes : []).flatMap((f) => {
    const o = (f && typeof f === "object" ? f : {}) as Record<string, unknown>
    const fuente = txt(o.fuente), estado = txt(o.estado)
    return fuente && estado ? [{ fuente, estado, filas: num(o.filas) ?? 0, ...(o.truncado === true ? { truncado: true } : {}), ...(txt(o.detalle) ? { detalle: txt(o.detalle)! } : {}) }] : []
  })
  const sin_fuente = (Array.isArray(r.sin_fuente) ? r.sin_fuente : []).flatMap((s) => {
    const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>
    const que = txt(o.que), motivo = txt(o.motivo)
    return que ? [{ que, motivo: motivo ?? "" }] : []
  })
  return { generado_en: txt(r.generado_en), completo: r.completo === true && descartadas === 0, total: decisiones.length, decisiones, fuentes, sin_fuente }
}

/** la lectura (servidor): la ruta certificada de la plataforma con la llave interna; nunca escribe */
export async function leerDecisiones(d: { plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch } = {}): Promise<{ ok: true; datos: Decisiones } | { ok: false; status: number; error: string }> {
  const base = (d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app").replace(/\/+$/, "")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { ok: false, status: 503, error: "El tablero no tiene la llave con la que lee a la plataforma." }
  try {
    const r = await (d.fetchImpl ?? fetch)(`${base}/api/direccion/decisiones`, { method: "GET", headers: { "x-api-key": llave }, cache: "no-store" })
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null
    if (!r.ok || !j || j.ok !== true) return { ok: false, status: 502, error: `La plataforma no entregó las decisiones (${r.status}).` }
    return { ok: true, datos: normalizarDecisiones(j) }
  } catch {
    return { ok: false, status: 502, error: "No se pudo contactar a la plataforma." }
  }
}

/** cómo se llama cada tipo, en palabras de negocio, y su marca corta para la pantalla */
export const NOMBRE_DEL_TIPO: Record<TipoDeDecision, { nombre: string; plural: string }> = {
  plan: { nombre: "Plan de 90 días", plural: "Planes" },
  gran_idea: { nombre: "Gran idea", plural: "Grandes ideas" },
  pieza: { nombre: "Pieza para publicar", plural: "Piezas" },
  revision: { nombre: "Revisión", plural: "Revisiones" },
  pregunta_al_dueno: { nombre: "Pregunta para ti", plural: "Preguntas para ti" },
  pregunta_de_finanzas: { nombre: "Pregunta de finanzas", plural: "Preguntas de finanzas" },
  firma_de_finanzas: { nombre: "Firma de finanzas", plural: "Firmas de finanzas" },
}

/** dónde se toma cada decisión dentro del tablero nuevo: el panel que se abre, o por qué todavía no se decide aquí */
export type PanelDeDecision = "plan" | "gran_idea" | "piezas"
export function dondeSeDecide(d: Pick<Decision, "tipo">): { panel: PanelDeDecision; boton: string } | { panel: null; nota: string } {
  switch (d.tipo) {
    case "plan": return { panel: "plan", boton: "Abrir el plan para decidir" }
    case "gran_idea": return { panel: "gran_idea", boton: "Abrir la gran idea para decidir" }
    case "pieza": return { panel: "piezas", boton: "Abrir la pieza para decidir" }
    case "revision": return { panel: "piezas", boton: "Abrir la revisión para decidir" }
    case "firma_de_finanzas": return { panel: null, nota: "La firma del tablero financiero todavía no está en el tablero nuevo." }
    case "pregunta_de_finanzas": return { panel: null, nota: "Las preguntas de finanzas todavía no se responden desde el tablero nuevo." }
    case "pregunta_al_dueno": return { panel: null, nota: "Las preguntas para ti todavía no se responden desde el tablero." }
  }
}

/** la prioridad en palabras (la base guarda high · medium · low) */
export function prioridadLegible(p: string | null): { texto: string; nivel: 0 | 1 | 2 | 3 } {
  switch ((p ?? "").toLowerCase()) {
    case "urgent": case "critical": return { texto: "Urgente", nivel: 3 }
    case "high": return { texto: "Alta", nivel: 3 }
    case "medium": return { texto: "Media", nivel: 2 }
    case "low": return { texto: "Baja", nivel: 1 }
    default: return { texto: "Sin prioridad", nivel: 0 }
  }
}

/** «hace 3 días», «hace 5 horas»… (para la espera de cada decisión) */
export function haceCuanto(desde: string | null, ahora: number = Date.now()): string {
  if (!desde) return "sin fecha"
  const t = Date.parse(desde)
  if (!Number.isFinite(t)) return "sin fecha"
  const min = Math.max(0, Math.round((ahora - t) / 60000))
  if (min < 60) return min <= 1 ? "hace un momento" : `hace ${min} minutos`
  const h = Math.round(min / 60)
  if (h < 24) return h === 1 ? "hace una hora" : `hace ${h} horas`
  const dias = Math.round(h / 24)
  return dias === 1 ? "hace un día" : `hace ${dias} días`
}

/** lo que necesita la pantalla del arco: cuántas, si alguna apremia y si la lista está entera */
export interface ResumenDeDecisiones { total: number; apremia: boolean; completo: boolean }
export function resumenDeDecisiones(d: Decisiones): ResumenDeDecisiones {
  return { total: d.total, apremia: d.decisiones.some((x) => x.vencida || prioridadLegible(x.prioridad).nivel === 3), completo: d.completo }
}

/** el título limpio para mostrar (la base trae marcas como «⚠️» al inicio) */
export const tituloLimpio = (t: string): string => t.replace(/^[\s⚠️❗‼️]+/u, "").trim()
