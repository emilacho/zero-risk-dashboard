/**
 * TU OFICINA · CAPA 2 · RIESGOS Y ALARMAS (6.21 · 1-nov · encargo «oficina del humano»): incidentes abiertos, fallas, topes cerca del límite, saldos,
 * pausas, credenciales rechazadas y servicios caídos. Fuente: la ruta certificada de la plataforma `GET /api/direccion/riesgos` (CC1, contrato en
 * `raw/tasks/2026-11-01-LISTO-CC1-para-certificar-rutas-de-datos-de-tu-oficina.md`), leída por el servidor del tablero con la llave interna. SOLO LECTURA.
 * Reglas del contrato: gravedad 3 = grave · 2 = atender · 1 = a la vista · `completo: false` ⇒ nunca «sin riesgos» · `sin_fuente[]` = «sin dato».
 * El RADAR: cada categoría es un sector del círculo y cada riesgo un punto; cuanto más grave, más cerca del centro.
 */

export type CategoriaDeRiesgo = "incidente" | "falla" | "tope" | "saldo" | "pausa" | "credencial" | "servicio"
export const CATEGORIAS_DE_RIESGO: readonly CategoriaDeRiesgo[] = ["incidente", "falla", "tope", "saldo", "pausa", "credencial", "servicio"]
export type Gravedad = 1 | 2 | 3

export interface Riesgo { id: string; gravedad: Gravedad; categoria: CategoriaDeRiesgo; titulo: string; detalle: string | null; client_id: string | null; cliente: string | null; desde: string | null; fuente: string | null }
export interface Saldo { proveedor: string; plan: string | null; usado_usd: number | null; credito_usd: number | null; pct: number | null; ciclo_hasta: string | null }
export interface Tope { client_id: string | null; cliente: string | null; gastado_24h_usd: number | null; techo_usd: number | null; pct: number | null }
export interface FuenteDeRiesgos { fuente: string; estado: string; filas: number; detalle?: string }
export interface Riesgos {
  generado_en: string | null
  completo: boolean
  total: number
  por_gravedad: Record<Gravedad, number>
  riesgos: Riesgo[]
  saldos: Saldo[]
  topes: Tope[]
  fuentes: FuenteDeRiesgos[]
  sin_fuente: Array<{ que: string; motivo: string }>
}

const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** lo que llega de la plataforma, revisado campo por campo; lo que no cumple el contrato se descarta y la lista queda incompleta. Más grave arriba. */
export function normalizarRiesgos(raw: unknown): Riesgos {
  const r = obj(raw)
  let descartados = 0
  const riesgos: Riesgo[] = []
  for (const x of Array.isArray(r.riesgos) ? r.riesgos : []) {
    const d = obj(x)
    const id = txt(d.id), titulo = txt(d.titulo), g = d.gravedad, categoria = CATEGORIAS_DE_RIESGO.find((c) => c === d.categoria)
    if (!id || !titulo || !categoria || (g !== 1 && g !== 2 && g !== 3)) { descartados++; continue }
    riesgos.push({ id, titulo, categoria, gravedad: g, detalle: txt(d.detalle), client_id: txt(d.client_id), cliente: txt(d.cliente), desde: txt(d.desde), fuente: txt(d.fuente) })
  }
  riesgos.sort((a, b) => b.gravedad - a.gravedad) // estable: dentro de cada gravedad, el orden de la plataforma
  const por_gravedad: Record<Gravedad, number> = { 1: 0, 2: 0, 3: 0 }
  for (const x of riesgos) por_gravedad[x.gravedad]++
  const saldos = (Array.isArray(r.saldos) ? r.saldos : []).flatMap((s) => { const o = obj(s), p = txt(o.proveedor); return p ? [{ proveedor: p, plan: txt(o.plan), usado_usd: num(o.usado_usd), credito_usd: num(o.credito_usd), pct: num(o.pct), ciclo_hasta: txt(o.ciclo_hasta) }] : [] })
  const topes = (Array.isArray(r.topes) ? r.topes : []).map((t) => { const o = obj(t); return { client_id: txt(o.client_id), cliente: txt(o.cliente), gastado_24h_usd: num(o.gastado_24h_usd), techo_usd: num(o.techo_usd), pct: num(o.pct) } })
  const fuentes = (Array.isArray(r.fuentes) ? r.fuentes : []).flatMap((f) => { const o = obj(f), fuente = txt(o.fuente), estado = txt(o.estado); return fuente && estado ? [{ fuente, estado, filas: num(o.filas) ?? 0, ...(txt(o.detalle) ? { detalle: txt(o.detalle)! } : {}) }] : [] })
  const sin_fuente = (Array.isArray(r.sin_fuente) ? r.sin_fuente : []).flatMap((s) => { const o = obj(s), que = txt(o.que); return que ? [{ que, motivo: txt(o.motivo) ?? "" }] : [] })
  return { generado_en: txt(r.generado_en), completo: r.completo === true && descartados === 0, total: riesgos.length, por_gravedad, riesgos, saldos, topes, fuentes, sin_fuente }
}

/** la lectura (servidor): la ruta certificada de la plataforma con la llave interna; nunca escribe */
export async function leerRiesgos(d: { plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch } = {}): Promise<{ ok: true; datos: Riesgos } | { ok: false; status: number; error: string }> {
  const base = (d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app").replace(/\/+$/, "")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { ok: false, status: 503, error: "El tablero no tiene la llave con la que lee a la plataforma." }
  try {
    const r = await (d.fetchImpl ?? fetch)(`${base}/api/direccion/riesgos`, { method: "GET", headers: { "x-api-key": llave }, cache: "no-store" })
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null
    if (!r.ok || !j || j.ok !== true) return { ok: false, status: 502, error: `La plataforma no entregó los riesgos (${r.status}).` }
    return { ok: true, datos: normalizarRiesgos(j) }
  } catch {
    return { ok: false, status: 502, error: "No se pudo contactar a la plataforma." }
  }
}

/** palabras de negocio */
export const NOMBRE_DE_LA_GRAVEDAD: Record<Gravedad, { nombre: string; plural: string }> = { 3: { nombre: "Grave", plural: "graves" }, 2: { nombre: "Atender", plural: "por atender" }, 1: { nombre: "A la vista", plural: "a la vista" } }
export const NOMBRE_DE_LA_CATEGORIA: Record<CategoriaDeRiesgo, string> = { incidente: "Incidentes", falla: "Fallas", tope: "Topes", saldo: "Saldos", pausa: "Pausas", credencial: "Credenciales", servicio: "Servicios" }
/** de qué parte del sistema viene cada riesgo (la tabla de origen, en palabras de negocio) */
export const ORIGEN_DEL_RIESGO: Record<string, string> = {
  agent_dispatch_reconciliations: "Revisión de trabajos de los empleados", agent_dispatches: "Trabajos de los empleados", agent_invocations: "Libro de los empleados",
  n8n: "Procesos operativos", cerebro_alertas: "Portero del cerebro", cerebro_portero_pausas: "Portero del cerebro", cadena_campanas: "Campañas",
  cadena_config: "Interruptores de la cadena", uptime_incidents: "Monitor de servicios", error_events: "Registro de errores", apify: "Raspado de redes (Apify)",
  topes_por_cliente: "Freno de gasto por cliente", cost_monitor_runs: "Vigía de costos", finanzas_config: "Oficina financiera", jefatura_config: "Jefatura",
  interruptor_de_la_oficina: "Interruptor de la oficina", plan_cambios: "Cambios del plan", plan_aprobaciones: "Aprobaciones del plan",
}

/**
 * EL RADAR (pantalla del arco y panel): cada categoría ocupa un sector del círculo (en el orden de `CATEGORIAS_DE_RIESGO`, desde arriba y en el sentido del
 * reloj) y cada riesgo es un punto dentro de su sector, en el anillo de su gravedad: 3 cerca del centro, 1 en el borde. Dentro de un sector los puntos se
 * reparten para no taparse. Devuelve el ángulo en grados (0 = arriba, sentido del reloj) y el radio como fracción (0-1).
 */
export const ANILLOS: Record<Gravedad, [number, number]> = { 3: [0.16, 0.38], 2: [0.44, 0.66], 1: [0.72, 0.92] }
export function lugarEnElRadar(riesgos: readonly Pick<Riesgo, "id" | "categoria" | "gravedad">[]): Map<string, { angulo: number; radio: number }> {
  const sector = 360 / CATEGORIAS_DE_RIESGO.length
  const lugar = new Map<string, { angulo: number; radio: number }>()
  for (const [ci, c] of CATEGORIAS_DE_RIESGO.entries()) {
    const del = riesgos.filter((x) => x.categoria === c)
    del.forEach((x, k) => {
      const [r0, r1] = ANILLOS[x.gravedad]
      const t = del.length === 1 ? 0.5 : 0.12 + (0.76 * k) / (del.length - 1)
      lugar.set(x.id, { angulo: ci * sector + sector * t, radio: r0 + (r1 - r0) * ((k * 0.618 + 0.5) % 1) })
    })
  }
  return lugar
}
/** de ángulo (0 = arriba, sentido del reloj) y radio a un punto del plano */
export function alPlano(cx: number, cy: number, r: number, angulo: number, radio: number): [number, number] {
  const a = ((angulo - 90) * Math.PI) / 180
  return [cx + Math.cos(a) * r * radio, cy + Math.sin(a) * r * radio]
}

/** lo que necesita la pantalla del arco: los puntos y las cuentas */
export interface ResumenDeRiesgos { total: number; graves: number; completo: boolean; puntos: Array<{ id: string; gravedad: Gravedad; angulo: number; radio: number }> }
export function resumenDeRiesgos(d: Riesgos): ResumenDeRiesgos {
  const lugar = lugarEnElRadar(d.riesgos)
  return { total: d.total, graves: d.por_gravedad[3], completo: d.completo, puntos: d.riesgos.map((x) => ({ id: x.id, gravedad: x.gravedad, ...lugar.get(x.id)! })) }
}

/** el título limpio (la base trae marcas como «🟠» o «🟡» al inicio) */
export const tituloDelRiesgo = (t: string): string => t.replace(/^[\s\p{Extended_Pictographic}️]+/u, "").trim()
