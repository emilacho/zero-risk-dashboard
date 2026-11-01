/**
 * TU OFICINA · CAPA 2 · RIESGOS Y ALARMAS (6.21 · 1-nov · encargo «oficina del humano» · correcciones 6.22 del mismo día).
 * Fuente: la ruta certificada de la plataforma `GET /api/direccion/riesgos` (CC1, contrato en
 * `raw/tasks/2026-11-01-LISTO-CC1-para-certificar-rutas-de-datos-de-tu-oficina.md`), leída por el servidor del tablero con la llave interna. SOLO LECTURA.
 * Reglas del contrato: gravedad 3 = grave · 2 = atender · 1 = a la vista · `completo: false` ⇒ nunca «sin riesgos» · `sin_fuente[]` = «sin dato».
 *
 * 6.22 · correcciones de Emilio (`raw/tasks/2026-11-01-ENCARGO-LENOVO-a-CC5-correcciones-de-riesgos.md`):
 *  - el radar tiene 8 SECTORES FIJOS (dinero · credenciales y accesos · servicios · flujos y trabajos · datos y cerebro · calidad · plazos · seguridad y
 *    cumplimiento): cada riesgo cae en uno, aunque hoy la plataforma no tenga de dónde leer algunos (esos quedan vacíos y como «sin dato»);
 *  - las PAUSAS que decidió Emilio no son riesgo: salen del radar como «decisiones tuyas»;
 *  - mensajes en palabras claras: sin rutas, sin ids de flujos ni códigos; un proceso que falla se nombra (el servidor lee su nombre en n8n, solo lectura);
 *  - los avisos de gasto del día caducan a las 24 h; el aviso del portero repetido como pausa se cuenta una sola vez;
 *  - los saldos y el freno de gasto se van a la pantalla Dinero: aquí solo cuentan como punto cuando la plataforma los marca como riesgo.
 */

export type CategoriaDeRiesgo = "incidente" | "falla" | "tope" | "saldo" | "pausa" | "credencial" | "servicio"
export type Sector = "dinero" | "credenciales" | "servicios" | "flujos" | "datos" | "calidad" | "plazos" | "seguridad"
export const SECTORES: readonly Sector[] = ["dinero", "credenciales", "servicios", "flujos", "datos", "calidad", "plazos", "seguridad"]
/** lo que la plataforma puede mandar: sus categorías de hoy o, desde ya, el nombre de un sector (para riesgos nuevos sin cambiar el tablero) */
export const CATEGORIAS_DE_RIESGO: readonly string[] = ["incidente", "falla", "tope", "saldo", "pausa", "credencial", "servicio", ...SECTORES]
export type Gravedad = 1 | 2 | 3

export interface Riesgo { id: string; gravedad: Gravedad; categoria: string; sector: Sector; titulo: string; detalle: string | null; client_id: string | null; cliente: string | null; desde: string | null; fuente: string | null }
export interface DecisionTuya { id: string; titulo: string; detalle: string | null; cliente: string | null; desde: string | null }
export interface Saldo { proveedor: string; plan: string | null; usado_usd: number | null; credito_usd: number | null; pct: number | null; ciclo_hasta: string | null }
export interface Tope { client_id: string | null; cliente: string | null; gastado_24h_usd: number | null; techo_usd: number | null; pct: number | null }
export interface FuenteDeRiesgos { fuente: string; estado: string; filas: number; detalle?: string }
export interface Riesgos {
  generado_en: string | null
  completo: boolean
  total: number
  por_gravedad: Record<Gravedad, number>
  por_sector: Record<Sector, number>
  riesgos: Riesgo[]
  /** pausas que decidió el dueño: fuera del radar */
  decisiones_tuyas: DecisionTuya[]
  /** avisos viejos que caducaron solos (no se muestran) */
  caducados: number
  /** se conservan para la pantalla Dinero; el panel de Riesgos ya no los muestra */
  saldos: Saldo[]
  topes: Tope[]
  fuentes: FuenteDeRiesgos[]
  sin_fuente: Array<{ que: string; motivo: string }>
}

const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** las pausas que vienen de una decisión del dueño (interruptores y campañas); la del portero del cerebro es automática y SÍ es riesgo */
const PAUSAS_DEL_DUENO = new Set(["cadena_campanas", "cadena_config", "interruptor_de_la_oficina", "finanzas_config", "jefatura_config"])
const UN_DIA = 24 * 3600_000

/** en qué sector del radar cae cada riesgo */
export function sectorDelRiesgo(r: { categoria: string; fuente: string | null; titulo: string }): Sector {
  const c = r.categoria, f = r.fuente ?? "", t = r.titulo.toLowerCase()
  if ((SECTORES as readonly string[]).includes(c)) return c as Sector
  if (c === "tope" || c === "saldo" || /gasto|saldo/.test(t)) return "dinero"
  if (c === "credencial") return "credenciales"
  if (c === "servicio") return "servicios"
  if (f.startsWith("cerebro") || f === "apify" || /cerebro|portero|raspad/.test(t)) return "datos"
  if (c === "falla") return "flujos"
  if (c === "incidente") return f === "uptime_incidents" ? "servicios" : f === "error_events" ? "flujos" : "servicios"
  return "flujos"
}

/** el nombre de un proceso de n8n, sin la marca de la casa ni su horario («Zero Risk — X (Weekly Sundays 7am)» → «X») */
export const nombreDelProceso = (n: string): string => n.replace(/^Zero Risk\s*[—–-]\s*/i, "").replace(/\s*·\s*CC-[A-Z0-9-]+\s*$/i, "").replace(/\s*\([^)]*\)\s*$/, "").trim() || n

const ID_DE_FLUJO = /\b[A-Za-z0-9]{16}\b/
/** un mensaje en palabras claras: sin marcas de color, sin rutas ni verbos técnicos, sin ids de flujos ni códigos en_minúsculas, y con plurales bien puestos */
export function limpiarMensaje(t: string | null): string | null {
  if (!t) return null
  let s = t.replace(/^[\s\p{Extended_Pictographic}️]+/u, "")
  s = s.replace(/\s*\([^)]*\b(flujo|workflow)\s+[A-Za-z0-9]{12,}[^)]*\)/gi, "")
  s = s.split(/\s+·\s+/).filter((p) => !/\/api\/|https?:\/\/|\b(POST|GET|PUT|PATCH|DELETE)\b/.test(p) && !/^[a-z]+(_[a-z]+)+$/.test(p.trim()) && !/^(dispatch|flujo):?\S*[A-Za-z0-9]{12,}/.test(p.trim())).join(" · ")
  s = s.replace(/\bflujo\s+[A-Za-z0-9]{16}\b/g, "un proceso")
  s = s.replace(/\b(\d+)((?:\s+[^\s()]+\(s\))+)/g, (_m, n: string, resto: string) => n + resto.replace(/\(s\)/g, n === "1" ? "" : "s"))
  s = s.replace(/\b([a-z]+(?:-[a-z]+)+)\b/g, (m) => `«${m.replace(/-agent$/, "").replace(/-/g, " ")}»`) // el nombre de un empleado (jefe-marketing → «jefe marketing»)
  s = s.replace(/\s{2,}/g, " ").replace(/[\s·]+$/, "").trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : null
}

/** lo que llega de la plataforma, revisado campo por campo; lo que no cumple el contrato se descarta y la lista queda incompleta. Más grave arriba. */
export function normalizarRiesgos(raw: unknown, ahora: number = Date.now()): Riesgos {
  const r = obj(raw)
  let descartados = 0, caducados = 0
  const crudos: Array<Riesgo & { proceso: string | null }> = []
  const decisiones_tuyas: DecisionTuya[] = []
  for (const x of Array.isArray(r.riesgos) ? r.riesgos : []) {
    const d = obj(x)
    const id = txt(d.id), titulo = txt(d.titulo), g = d.gravedad, categoria = CATEGORIAS_DE_RIESGO.find((c) => c === d.categoria), fuente = txt(d.fuente)
    if (!id || !titulo || !categoria || (g !== 1 && g !== 2 && g !== 3)) { descartados++; continue }
    if (categoria === "pausa" && fuente && PAUSAS_DEL_DUENO.has(fuente)) { decisiones_tuyas.push({ id, titulo: limpiarMensaje(titulo) ?? titulo, detalle: limpiarMensaje(txt(d.detalle)), cliente: txt(d.cliente), desde: txt(d.desde) }); continue }
    crudos.push({ id, titulo, categoria, gravedad: g, sector: sectorDelRiesgo({ categoria, fuente, titulo }), detalle: txt(d.detalle), client_id: txt(d.client_id), cliente: txt(d.cliente), desde: txt(d.desde), fuente, proceso: txt(d.proceso) })
  }
  // el portero pausado llega dos veces (su alerta y su pausa): queda la alerta, que dice más
  const porteroAvisado = crudos.some((x) => x.fuente === "cerebro_alertas" && /pausad/i.test(x.titulo))
  const riesgos: Riesgo[] = []
  for (const x of crudos) {
    if (porteroAvisado && x.fuente === "cerebro_portero_pausas") continue
    const t = x.desde ? Date.parse(x.desde) : NaN
    if (/gasto del d[ií]a/i.test(x.titulo) && Number.isFinite(t) && ahora - t > UN_DIA) { caducados++; continue } // un aviso de gasto del día vale ese día
    let titulo = limpiarMensaje(x.titulo) ?? x.titulo, detalle = limpiarMensaje(x.detalle)
    if (x.fuente === "n8n") {
      const fallas = titulo.match(/(\d+) ejecuci[oó]n(es)? fallida/i)?.[0] ?? null
      titulo = x.proceso ? `Falló el proceso «${nombreDelProceso(x.proceso)}»` : "Falló un proceso operativo (sin nombre todavía)"
      detalle = fallas ? `${fallas} en las últimas horas` : detalle
    }
    if (detalle && detalle === titulo) detalle = null
    if (detalle && ID_DE_FLUJO.test(detalle) && !/\s/.test(detalle)) detalle = null
    const { proceso: _p, ...limpio } = x; void _p
    riesgos.push({ ...limpio, titulo, detalle })
  }
  riesgos.sort((a, b) => b.gravedad - a.gravedad) // estable: dentro de cada gravedad, el orden de la plataforma
  const por_gravedad: Record<Gravedad, number> = { 1: 0, 2: 0, 3: 0 }
  const por_sector = Object.fromEntries(SECTORES.map((s) => [s, 0])) as Record<Sector, number>
  for (const x of riesgos) { por_gravedad[x.gravedad]++; por_sector[x.sector]++ }
  const saldos = (Array.isArray(r.saldos) ? r.saldos : []).flatMap((s) => { const o = obj(s), p = txt(o.proveedor); return p ? [{ proveedor: p, plan: txt(o.plan), usado_usd: num(o.usado_usd), credito_usd: num(o.credito_usd), pct: num(o.pct), ciclo_hasta: txt(o.ciclo_hasta) }] : [] })
  const topes = (Array.isArray(r.topes) ? r.topes : []).map((t) => { const o = obj(t); return { client_id: txt(o.client_id), cliente: txt(o.cliente), gastado_24h_usd: num(o.gastado_24h_usd), techo_usd: num(o.techo_usd), pct: num(o.pct) } })
  const fuentes = (Array.isArray(r.fuentes) ? r.fuentes : []).flatMap((f) => { const o = obj(f), fuente = txt(o.fuente), estado = txt(o.estado); return fuente && estado ? [{ fuente, estado, filas: num(o.filas) ?? 0, ...(txt(o.detalle) ? { detalle: txt(o.detalle)! } : {}) }] : [] })
  const sin_fuente = (Array.isArray(r.sin_fuente) ? r.sin_fuente : []).flatMap((s) => { const o = obj(s), que = txt(o.que); return que ? [{ que, motivo: txt(o.motivo) ?? "" }] : [] })
  return { generado_en: txt(r.generado_en), completo: r.completo === true && descartados === 0, total: riesgos.length, por_gravedad, por_sector, riesgos, decisiones_tuyas, caducados, saldos, topes, fuentes, sin_fuente }
}

/** los nombres de los procesos de n8n que fallaron (servidor, solo lectura): sin llave o sin respuesta, quedan sin nombre */
async function nombresDeProcesos(ids: string[], f: typeof fetch): Promise<Map<string, string>> {
  const base = (process.env.N8N_BASE_URL ?? "").replace(/\/+$/, ""), llave = process.env.N8N_API_KEY ?? ""
  const nombres = new Map<string, string>()
  if (!base || !llave || !ids.length) return nombres
  await Promise.all(ids.map(async (id) => {
    try {
      const r = await f(`${base}/api/v1/workflows/${encodeURIComponent(id)}`, { method: "GET", headers: { "X-N8N-API-KEY": llave }, cache: "no-store", signal: AbortSignal.timeout(4000) })
      const j = r.ok ? ((await r.json().catch(() => null)) as { name?: unknown } | null) : null
      if (typeof j?.name === "string" && j.name.trim()) nombres.set(id, j.name.trim())
    } catch { /* sin nombre */ }
  }))
  return nombres
}

/** la lectura (servidor): la ruta certificada de la plataforma con la llave interna; nunca escribe */
export async function leerRiesgos(d: { plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch; procesosImpl?: typeof fetch } = {}): Promise<{ ok: true; datos: Riesgos } | { ok: false; status: number; error: string }> {
  const base = (d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app").replace(/\/+$/, "")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { ok: false, status: 503, error: "El tablero no tiene la llave con la que lee a la plataforma." }
  try {
    const r = await (d.fetchImpl ?? fetch)(`${base}/api/direccion/riesgos`, { method: "GET", headers: { "x-api-key": llave }, cache: "no-store" })
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null
    if (!r.ok || !j || j.ok !== true) return { ok: false, status: 502, error: `La plataforma no entregó los riesgos (${r.status}).` }
    const lista = Array.isArray(j.riesgos) ? (j.riesgos as Array<Record<string, unknown>>) : []
    const idDe = (x: Record<string, unknown>) => (x.fuente === "n8n" ? `${String(x.detalle ?? "")} ${String(x.titulo ?? "")}`.match(/\bflujo\s+([A-Za-z0-9]{16})\b/)?.[1] ?? null : null)
    const ids = [...new Set(lista.map(idDe).filter((x): x is string => !!x))]
    const nombres = await nombresDeProcesos(ids, d.procesosImpl ?? fetch)
    const conNombre = lista.map((x) => { const id = idDe(x); return id && nombres.has(id) ? { ...x, proceso: nombres.get(id) } : x })
    return { ok: true, datos: normalizarRiesgos({ ...j, riesgos: conNombre }) }
  } catch {
    return { ok: false, status: 502, error: "No se pudo contactar a la plataforma." }
  }
}

/** palabras de negocio */
export const NOMBRE_DE_LA_GRAVEDAD: Record<Gravedad, { nombre: string; plural: string }> = { 3: { nombre: "Grave", plural: "graves" }, 2: { nombre: "Atender", plural: "por atender" }, 1: { nombre: "A la vista", plural: "a la vista" } }
export const NOMBRE_DEL_SECTOR: Record<Sector, { nombre: string; corto: string; que: string }> = {
  dinero: { nombre: "Dinero", corto: "Dinero", que: "topes cerca del límite, gasto anormal, saldo bajo de un proveedor" },
  credenciales: { nombre: "Credenciales y accesos", corto: "Accesos", que: "llaves y permisos caducados o por vencer" },
  servicios: { nombre: "Servicios", corto: "Servicios", que: "plataformas caídas o lentas" },
  flujos: { nombre: "Flujos y trabajos", corto: "Flujos", que: "procesos fallidos, trabajos atascados o sin entregar" },
  datos: { nombre: "Datos y cerebro", corto: "Datos", que: "portero pausado, raspados fallidos, datos de prueba" },
  calidad: { nombre: "Calidad", corto: "Calidad", que: "rechazos repetidos de la jefatura, piezas devueltas" },
  plazos: { nombre: "Plazos", corto: "Plazos", que: "aprobaciones y piezas por vencer, fechas de campaña" },
  seguridad: { nombre: "Seguridad y cumplimiento", corto: "Seguridad", que: "secretos expuestos, accesos indebidos, privacidad" },
}
/** los sectores que hoy la plataforma no tiene de dónde leer (quedan vacíos y como «sin dato» hasta que exista la fuente) */
export const SECTORES_SIN_FUENTE: readonly Sector[] = ["calidad", "plazos", "seguridad"]
/** de qué parte del sistema viene cada riesgo (la tabla de origen, en palabras de negocio) */
export const ORIGEN_DEL_RIESGO: Record<string, string> = {
  agent_dispatch_reconciliations: "Revisión de trabajos de los empleados", agent_dispatches: "Trabajos de los empleados", agent_invocations: "Libro de los empleados",
  n8n: "Procesos operativos", cerebro_alertas: "Portero del cerebro", cerebro_portero_pausas: "Portero del cerebro", cadena_campanas: "Campañas",
  cadena_config: "Interruptores de la cadena", uptime_incidents: "Monitor de servicios", error_events: "Registro de errores", apify: "Raspado de redes (Apify)",
  topes_por_cliente: "Freno de gasto por cliente", cost_monitor_runs: "Vigía de costos", finanzas_config: "Oficina financiera", jefatura_config: "Jefatura",
  interruptor_de_la_oficina: "Interruptor de la oficina", plan_cambios: "Cambios del plan", plan_aprobaciones: "Aprobaciones del plan",
}

/**
 * EL RADAR (pantalla del arco y panel): 8 sectores fijos (en el orden de `SECTORES`, desde arriba y en el sentido del reloj) y cada riesgo es un punto
 * dentro de su sector, en el anillo de su gravedad: 3 cerca del centro, 1 en el borde. Dentro de un sector los puntos se reparten para no taparse.
 * Devuelve el ángulo en grados (0 = arriba, sentido del reloj) y el radio como fracción (0-1).
 */
export const ANILLOS: Record<Gravedad, [number, number]> = { 3: [0.16, 0.38], 2: [0.44, 0.66], 1: [0.72, 0.92] }
export const GRADOS_POR_SECTOR = 360 / SECTORES.length
export function lugarEnElRadar(riesgos: readonly Pick<Riesgo, "id" | "sector" | "gravedad">[]): Map<string, { angulo: number; radio: number }> {
  const lugar = new Map<string, { angulo: number; radio: number }>()
  for (const [si, s] of SECTORES.entries()) {
    const del = riesgos.filter((x) => x.sector === s)
    del.forEach((x, k) => {
      const [r0, r1] = ANILLOS[x.gravedad]
      const t = del.length === 1 ? 0.5 : 0.14 + (0.72 * k) / (del.length - 1)
      lugar.set(x.id, { angulo: si * GRADOS_POR_SECTOR + GRADOS_POR_SECTOR * t, radio: r0 + (r1 - r0) * ((k * 0.618 + 0.5) % 1) })
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
