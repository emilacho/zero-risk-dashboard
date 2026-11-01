/**
 * TU OFICINA · PANTALLA 9 · OBSERVABILIDAD (6.26 · 1-nov · encargo `2026-11-01-ENCARGO-LENOVO-a-CC5-pantalla-observabilidad.md`).
 * Regla de Emilio: copiar la ESTRUCTURA de LangSmith (lista de corridas → árbol de pasos con cascada de tiempos → detalle con pestañas) y solo cambiar la fachada.
 * Fuente: las rutas certificadas de la plataforma `GET /api/direccion/corridas` (lista) y `/api/direccion/corridas/{ejecución}` (árbol), que agrupan
 * `agent_invocations` + `agent_dispatches` por ejecución. SOLO LECTURA. La plataforma NO guarda la entrada ni la salida de cada llamada: eso se dice, no se inventa.
 * El costo se muestra como DATO de la corrida (como LangSmith), nunca como aviso.
 */
import { nombresDeProcesos } from "@/lib/direccion-riesgos"

export type EstadoCorrida = "completa" | "fallida" | "en_curso" | "atascada" | "sin_cierre"
export const ESTADOS: readonly EstadoCorrida[] = ["completa", "fallida", "en_curso", "atascada", "sin_cierre"]
export const NOMBRE_DEL_ESTADO: Record<EstadoCorrida, string> = { completa: "Bien", fallida: "Con error", en_curso: "En curso", atascada: "Atascada", sin_cierre: "Sin cierre" }
export const COLOR_DEL_ESTADO: Record<EstadoCorrida, string> = { completa: "#8fd19e", fallida: "#ff5a36", en_curso: "#f5a524", atascada: "#ff8a3d", sin_cierre: "#a1a1aa" }

export interface Corrida {
  workflow_execution_id: string; workflow_id: string | null; nombre: string; nombre_tecnico: string | null; interno: boolean; client_id: string | null; cliente: string | null
  inicio: string | null; fin: string | null; duracion_ms: number | null; costo_usd: number; tokens: number
  pasos: number; despachos: number; fallos: number; ramas: string[]; estado: EstadoCorrida
}
export interface Tokens { entrada: number; salida: number; cache_lectura: number; cache_escritura: number }
export interface Paso {
  id: string; origen: "invocacion" | "despacho"; agente: string | null; modelo: string | null; inicio: string | null; fin: string | null
  duracion_ms: number | null; costo_usd: number; tokens: Tokens; tokens_total: number; turnos: number | null; estado: string; error: string | null; despacho: string | null
  /** 6.27 · lo que entró y lo que salió del empleado (la base guarda los primeros 2.000 caracteres de cada lado) */
  entrada: string | null; entrada_recortada: boolean; salida: string | null; salida_total: number | null
}
export interface Rama { rama: string | null; costo_usd: number; pasos: Paso[] }
export interface ListaDeCorridas { generado_en: string | null; completo: boolean; dias: number; total: number; corridas: Corrida[]; sin_enlace_a_trazas: string | null }
export interface DetalleDeCorrida { generado_en: string | null; completo: boolean; corrida: Corrida; arbol: Rama[]; sin_enlace_a_trazas: string | null }

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** los procesos de n8n tienen un identificador de 16 letras y números; su nombre se lee en n8n */
export const ES_PROCESO_N8N = /^[A-Za-z0-9]{16}$/

export const mayuscula = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase("es") + s.slice(1) : s)
/** «Zero Risk — Cerebro · mantenimiento diario del portero (que ALIMENTA) · CC-CEREBRO» → «Cerebro · mantenimiento diario del portero» (sin firmas de equipo ni paréntesis) */
export function nombreLimpio(n: string): string {
  const limpio = n.replace(/â€”/g, "—").replace(/^Zero Risk\s*[—–-]\s*/i, "").replace(/\s*\([^)]*\)/g, "").replace(/\s*[·|]\s*CC[\s#-]*[\w-]*\s*$/i, "").replace(/\s+/g, " ").trim()
  return mayuscula(limpio || n)
}
/** 6.27 · nombres de oficina de los procesos conocidos (Emilio: «nombres claros; el técnico solo en Metadatos») */
export const NOMBRE_DE_OFICINA: Readonly<Record<string, string>> = {
  X9F0zp6LQ2xGEYVS: "Planeación del plan de 90 días",
  ogfq56oIEoHufFPM: "Cerebro · mantenimiento del portero",
  EZXAFQvKZsJlvGNO: "Cerebro · ponerse al día",
  "cc-cerebro-guardar-todo-2#etiquetar": "Cerebro · guardar y etiquetar fotos",
  "cc-cerebro-fallas-y-retencion": "Cerebro · fallas y retención",
  "cc-cerebro-cerrar-huecos": "Cerebro · cerrar huecos",
  "cc-cerebro-tendencias": "Cerebro · tendencias",
  o8qaF7bI0PKv2XGZ: "Jefatura · un turno",
  bTbWL9lUvQCfStAz: "Oficina · un turno",
  tVWeaqTTpqPUQl7Z: "Portero · atender un pedido",
  vCBDSlQ1UUN1LHtn: "Portero · recibir (prueba)",
  "7xdPwYhrf50h4zC8": "Portero · etiquetar fotos (prueba)",
  wLgDCPGA65OlR0zu: "Finanzas · conversación",
  LyVoKcrypS5uLyuu: "Alta de un cliente nuevo",
  y6H7nG3FGrmCGccP: "Prueba de un empleado",
  BNXqlaX1oHSfZIpF: "Cadena · piezas por filas",
  cR22ztH1p2ihTIwD: "Cadena · calendario",
  ZnoFdGfACA36c3qE: "Cadena · estrategia",
  lVCLzxQCKNkd3uS0: "Pieza · el productor",
  pLp0vo7mye8lGM74: "Ensayo del plan (temporal)",
  qkxIhqcW22tFkuCf: "Ensayo del plan (temporal)",
  "api:revisor-externo": "Revisor externo",
  "api:images-generate": "Generar imágenes",
  "api:video-generate": "Generar video",
}
/** el nombre de una corrida: el de oficina si se conoce; si no, el de n8n limpio; si no, su etiqueta en palabras; si no hay nada, el número de ejecución */
export function nombreDeLaCorrida(workflowId: string | null, ejecucion: string, nombres: Map<string, string> = new Map()): string {
  if (workflowId && NOMBRE_DE_OFICINA[workflowId]) return NOMBRE_DE_OFICINA[workflowId]
  if (workflowId && nombres.has(workflowId)) return nombreLimpio(nombres.get(workflowId) as string)
  if (workflowId && /^cc-cerebro-/i.test(workflowId)) return `Cerebro · ${palabras(workflowId.replace(/^cc-cerebro-/i, "").replace(/#.*$/, ""))}`
  if (workflowId && /^api:/i.test(workflowId)) return mayuscula(palabras(workflowId.slice(4)))
  if (workflowId && !UUID.test(workflowId) && !ES_PROCESO_N8N.test(workflowId) && !/^\d+$/.test(workflowId)) return mayuscula(palabras(workflowId))
  return /^\d+$/.test(ejecucion) ? `Ejecución ${ejecucion}` : "Corrida sin nombre de proceso"
}
/** el nombre técnico (solo para Metadatos): el de n8n tal cual, o la etiqueta del proceso */
export const nombreTecnico = (workflowId: string | null, nombres: Map<string, string> = new Map()): string | null => (workflowId ? nombres.get(workflowId) ?? workflowId : null)
/** 6.27 · el mantenimiento del cerebro es trabajo interno, aunque lo haga sobre el cerebro de un cliente */
export const esInterno = (workflowId: string | null, nombre: string): boolean => (!!workflowId && /^cc-cerebro-/i.test(workflowId)) || /^Cerebro ·/.test(nombre)
/** el cliente que se muestra: el real, o «Interno · cerebro de X» si es mantenimiento interno */
export const clienteVisible = (c: Pick<Corrida, "interno" | "cliente">): string | null => (c.interno ? (c.cliente ? `Interno · cerebro de ${c.cliente}` : "Interno") : c.cliente)
/** «jefe-marketing» → «jefe marketing» · «market_research_analyst» → «market research analyst» · «competitive-intelligence-agent» → «competitive intelligence» */
export const palabras = (s: string): string => s.replace(/[-_]agent$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim()
/** el nombre de una rama: «analisis-voz_del_publico» → «analisis · voz del publico» · «voz:DfFd2» → «voz · DfFd2» */
export function nombreDeLaRama(r: string): string {
  const i = r.search(/[-:]/)
  return i < 0 ? palabras(r) : `${palabras(r.slice(0, i))} · ${r.slice(i + 1).replace(/_/g, " ")}`
}

function corrida(v: unknown, nombres: Map<string, string>): Corrida | null {
  const o = obj(v), id = txt(o.workflow_execution_id)
  if (!id) return null
  const estado = ESTADOS.includes(o.estado as EstadoCorrida) ? (o.estado as EstadoCorrida) : "sin_cierre"
  const workflow_id = txt(o.workflow_id)
  const nombre = nombreDeLaCorrida(workflow_id, id, nombres)
  return {
    workflow_execution_id: id, workflow_id, nombre, nombre_tecnico: nombreTecnico(workflow_id, nombres), interno: esInterno(workflow_id, nombre), client_id: txt(o.client_id), cliente: txt(o.cliente),
    inicio: txt(o.inicio), fin: txt(o.fin), duracion_ms: num(o.duracion_ms), costo_usd: num(o.costo_usd) ?? 0, tokens: num(o.tokens) ?? 0,
    pasos: num(o.pasos) ?? 0, despachos: num(o.despachos) ?? 0, fallos: num(o.fallos) ?? 0, ramas: (Array.isArray(o.ramas) ? o.ramas : []).flatMap((x) => (txt(x) ? [txt(x) as string] : [])), estado,
  }
}
function paso(v: unknown): Paso | null {
  const o = obj(v), id = txt(o.id)
  if (!id) return null
  const t = obj(o.tokens)
  return {
    id, origen: o.origen === "despacho" ? "despacho" : "invocacion", agente: txt(o.agente), modelo: txt(o.modelo), inicio: txt(o.inicio), fin: txt(o.fin),
    duracion_ms: num(o.duracion_ms), costo_usd: num(o.costo_usd) ?? 0, tokens: { entrada: num(t.entrada) ?? 0, salida: num(t.salida) ?? 0, cache_lectura: num(t.cache_lectura) ?? 0, cache_escritura: num(t.cache_escritura) ?? 0 },
    tokens_total: num(o.tokens_total) ?? 0, turnos: num(o.turnos), estado: txt(o.estado) ?? "sin dato", error: txt(o.error), despacho: txt(o.despacho),
    entrada: typeof o.entrada === "string" && o.entrada ? o.entrada : null, entrada_recortada: o.entrada_recortada === true, salida: typeof o.salida === "string" && o.salida ? o.salida : null, salida_total: num(o.salida_total),
  }
}
const sinEnlace = (j: Record<string, unknown>) => { const b = obj(j.braintrust); return txt(b.enlace) ? null : txt(b.motivo) }

export function normalizarLista(j: unknown, nombres: Map<string, string> = new Map()): ListaDeCorridas {
  const o = obj(j)
  const corridas = (Array.isArray(o.corridas) ? o.corridas : []).flatMap((c) => { const x = corrida(c, nombres); return x ? [x] : [] })
  return { generado_en: txt(o.generado_en), completo: o.completo === true, dias: num(o.dias) ?? 7, total: num(o.total) ?? corridas.length, corridas, sin_enlace_a_trazas: sinEnlace(o) }
}
export function normalizarDetalle(j: unknown, nombres: Map<string, string> = new Map()): DetalleDeCorrida | null {
  const o = obj(j), c = corrida(o.corrida, nombres)
  if (!c) return null
  const arbol = (Array.isArray(o.arbol) ? o.arbol : []).map((r) => { const x = obj(r); return { rama: txt(x.rama), costo_usd: num(x.costo_usd) ?? 0, pasos: (Array.isArray(x.pasos) ? x.pasos : []).flatMap((p) => { const q = paso(p); return q ? [q] : [] }) } })
  return { generado_en: txt(o.generado_en), completo: o.completo === true, corrida: c, arbol, sin_enlace_a_trazas: sinEnlace(o) }
}

/** ─── el árbol de la corrida, como en LangSmith: la corrida arriba y sus pasos en orden de inicio; una rama con varios pasos es un nodo propio ─── */
export interface Nodo { clave: string; tipo: "corrida" | "rama" | "paso"; nombre: string; sub: string | null; nivel: number; inicio: string | null; fin: string | null; duracion_ms: number | null; tokens: number; costo_usd: number; estado: EstadoCorrida; error: string | null; paso: Paso | null; rama: string | null }
const FALLO = /error|fail|timeout|cancel/i
export const estadoDelPaso = (p: Paso): EstadoCorrida => (FALLO.test(p.estado) || !!p.error ? "fallida" : p.estado === "atascado" ? "atascada" : p.estado === "running" || p.estado === "accepted" ? "en_curso" : p.estado === "sin_cierre" ? "sin_cierre" : "completa")
const finDe = (p: Paso): string | null => p.fin ?? (p.inicio && p.duracion_ms != null ? new Date(Date.parse(p.inicio) + p.duracion_ms).toISOString() : null)
const durDe = (p: Paso): number | null => p.duracion_ms ?? (p.inicio && p.fin ? Math.max(0, Date.parse(p.fin) - Date.parse(p.inicio)) : null)

export function arbolDeNodos(d: DetalleDeCorrida): Nodo[] {
  const c = d.corrida
  const raiz: Nodo = { clave: "corrida", tipo: "corrida", nombre: c.nombre, sub: c.cliente, nivel: 0, inicio: c.inicio, fin: c.fin, duracion_ms: c.duracion_ms, tokens: c.tokens, costo_usd: c.costo_usd, estado: c.estado, error: null, paso: null, rama: null }
  const deUnPaso = (p: Paso, nivel: number, rama: string | null): Nodo => ({ clave: `p:${p.id}`, tipo: "paso", nombre: p.agente ? mayuscula(palabras(p.agente)) : "Empleado sin nombre", sub: rama && nivel === 1 ? nombreDeLaRama(rama) : null, nivel, inicio: p.inicio, fin: finDe(p), duracion_ms: durDe(p), tokens: p.tokens_total, costo_usd: p.costo_usd, estado: estadoDelPaso(p), error: p.error, paso: p, rama })
  type Bloque = { inicio: string; nodos: Nodo[] }
  const bloques: Bloque[] = []
  for (const r of d.arbol) {
    if (r.rama === null || r.pasos.length === 1) { for (const p of r.pasos) bloques.push({ inicio: p.inicio ?? "", nodos: [deUnPaso(p, 1, r.rama)] }); continue }
    const hijos = r.pasos.map((p) => deUnPaso(p, 2, r.rama))
    const ini = hijos.map((h) => h.inicio).filter((x): x is string => !!x).sort()[0] ?? null
    const fines = hijos.map((h) => h.fin).filter((x): x is string => !!x).sort()
    const fin = fines[fines.length - 1] ?? null
    const estado: EstadoCorrida = hijos.some((h) => h.estado === "fallida") ? "fallida" : hijos.some((h) => h.estado === "atascada") ? "atascada" : hijos.some((h) => h.estado === "en_curso") ? "en_curso" : hijos.some((h) => h.estado === "sin_cierre") ? "sin_cierre" : "completa"
    bloques.push({ inicio: ini ?? "", nodos: [{ clave: `r:${r.rama}`, tipo: "rama", nombre: nombreDeLaRama(r.rama as string), sub: `${hijos.length} pasos`, nivel: 1, inicio: ini, fin, duracion_ms: ini && fin ? Date.parse(fin) - Date.parse(ini) : null, tokens: hijos.reduce((s, h) => s + h.tokens, 0), costo_usd: r.costo_usd, estado, error: null, paso: null, rama: r.rama }, ...hijos] })
  }
  bloques.sort((a, b) => a.inicio.localeCompare(b.inicio))
  return [raiz, ...bloques.flatMap((b) => b.nodos)]
}

/** la cascada de tiempos: dónde empieza y cuánto ocupa cada barra, en % de la línea de tiempo de la corrida */
export function lineaDeTiempo(nodos: Nodo[], ahora: number = Date.now()): { t0: number; total: number; barra: (n: Nodo) => { izq: number; ancho: number } | null } {
  const ini = nodos.map((n) => (n.inicio ? Date.parse(n.inicio) : NaN)).filter(Number.isFinite)
  const fin = nodos.map((n) => (n.fin ? Date.parse(n.fin) : n.inicio ? ahora : NaN)).filter(Number.isFinite)
  const t0 = ini.length ? Math.min(...ini) : 0
  const total = Math.max(1, (fin.length ? Math.max(...fin) : t0) - t0)
  return {
    t0, total,
    barra: (n) => {
      if (!n.inicio) return null
      const a = Date.parse(n.inicio), b = n.fin ? Date.parse(n.fin) : n.estado === "en_curso" || n.estado === "atascada" ? ahora : a
      const izq = ((a - t0) / total) * 100
      return { izq: Math.max(0, Math.min(100, izq)), ancho: Math.max(0.6, Math.min(100 - izq, ((b - a) / total) * 100)) }
    },
  }
}

/** ─── formatos (datos, no avisos) ─── */
export function duracion(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 1000) return `${Math.round(ms)} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1).replace(".", ",")} s`
  const m = Math.floor(s / 60), r = Math.round(s % 60)
  return m < 60 ? `${m} min ${r} s` : `${Math.floor(m / 60)} h ${m % 60} min`
}
export const miles = (n: number): string => Math.round(n).toLocaleString("es-EC")
export const costoComoDato = (n: number): string => (n === 0 ? "US$ 0" : n < 0.01 ? `US$ ${n.toFixed(4)}` : `US$ ${n.toFixed(2)}`)
/** 6.27 · la hora va en la zona del navegador de quien mira (Emilio: su «20:34» salía «14:34», en hora de Ecuador sin decirlo). `zona` solo para pruebas */
export function cuando(iso: string | null, zona?: string): string {
  if (!iso) return "—"
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) ? "—" : t.toLocaleString("es-EC", { timeZone: zona, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
}

/** ─── 6.27 · ENTRADA Y SALIDA DE CADA PASO · `agent_invocations.input_summary` / `output_summary` (los primeros 2.000 caracteres) ─── */
export const TOPE_DEL_TEXTO = 2000
export interface TextoDePaso { entrada: string | null; entrada_recortada: boolean; salida: string | null; salida_total: number | null }
/** nunca se muestra una llave aunque haya quedado en un pedido */
export const sinLlaves = (s: string): string => s
  .replace(/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, "[llave oculta]")
  .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[llave oculta]")
  .replace(/\b[A-Fa-f0-9]{40,}\b/g, "[llave oculta]")
const recortado = (s: string) => s.length > TOPE_DEL_TEXTO || /…$/.test(s)
const sinPuntos = (s: string) => (recortado(s) ? s.replace(/…$/, "") : s)
export function textoDeFila(f: Record<string, unknown>): TextoDePaso {
  const ent = typeof f.input_summary === "string" && f.input_summary.trim() ? f.input_summary : null
  const sal = typeof f.output_summary === "string" && f.output_summary.trim() ? f.output_summary : null
  const total = num(f.response_length) ?? num(f.response_length_real)
  return {
    entrada: ent ? sinLlaves(sinPuntos(ent)) : null, entrada_recortada: !!ent && recortado(ent),
    salida: sal ? sinLlaves(sinPuntos(sal)) : null, salida_total: sal ? (total ?? (recortado(sal) ? null : sal.length)) : null,
  }
}
/** pega a cada paso su texto (los pasos que son solo un encargo no tienen fila en el libro) */
export function conTextos(d: DetalleDeCorrida, textos: Map<string, TextoDePaso>): DetalleDeCorrida {
  return { ...d, arbol: d.arbol.map((r) => ({ ...r, pasos: r.pasos.map((p) => { const t = textos.get(p.id); return t ? { ...p, ...t } : p }) })) }
}
type ConsultaDeTextos = { from: (t: string) => { select: (c: string) => { in: (k: string, v: string[]) => PromiseLike<{ data: unknown[] | null; error: unknown }> } } }
/** lee del libro de los empleados SOLO las columnas de texto de los pasos de esta corrida (solo lectura) */
export async function leerTextosDePasos(db: ConsultaDeTextos, ids: string[]): Promise<Map<string, TextoDePaso> | null> {
  const validos = [...new Set(ids.filter((x) => UUID.test(x)))]
  const m = new Map<string, TextoDePaso>()
  if (!validos.length) return m
  try {
    const { data, error } = await db.from("agent_invocations").select("id, input_summary, output_summary, response_length:metadata->>response_length, response_length_real:metadata->>response_length_real").in("id", validos.slice(0, 500))
    if (error || !Array.isArray(data)) return null
    for (const f of data) { const o = obj(f); if (typeof o.id === "string") m.set(o.id, textoDeFila(o)) }
    return m
  } catch { return null }
}

/** ─── la pantalla 9 del arco: lo que dice el vidrio ─── */
export interface ResumenDeCorridas { total: number; en_curso: number; con_error: number; completo: boolean }
export const resumenDeCorridas = (l: Pick<ListaDeCorridas, "corridas" | "completo" | "total">): ResumenDeCorridas => ({
  total: l.total, en_curso: l.corridas.filter((c) => c.estado === "en_curso" || c.estado === "atascada").length, con_error: l.corridas.filter((c) => c.estado === "fallida").length, completo: l.completo,
})

/** ─── servidor: lee la plataforma con la llave interna (nunca llega al navegador) ─── */
type Lectura<T> = { ok: true; datos: T } | { ok: false; status: number; error: string }
const conexion = (d: { plataformaUrl?: string; llave?: string }) => ({
  base: (d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app").replace(/\/+$/, ""),
  llave: d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || ""),
})
async function nombresDe(ids: (string | null)[], f: typeof fetch) {
  return nombresDeProcesos([...new Set(ids.filter((x): x is string => !!x && ES_PROCESO_N8N.test(x)))], f)
}

export async function leerCorridas(o: { dias?: number; client_id?: string | null; conNombres?: boolean } = {}, d: { plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch; procesosImpl?: typeof fetch } = {}): Promise<Lectura<ListaDeCorridas>> {
  const { base, llave } = conexion(d)
  if (!llave) return { ok: false, status: 503, error: "El tablero no tiene la llave con la que lee a la plataforma." }
  const q = new URLSearchParams({ dias: String(o.dias ?? 7), limite: "200" })
  if (o.client_id) q.set("client_id", o.client_id)
  try {
    const r = await (d.fetchImpl ?? fetch)(`${base}/api/direccion/corridas?${q}`, { method: "GET", headers: { "x-api-key": llave }, cache: "no-store" })
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null
    if (!r.ok || !j || j.ok !== true) return { ok: false, status: 502, error: `La plataforma no entregó las corridas (${r.status}).` }
    const nombres = o.conNombres === false ? new Map<string, string>() : await nombresDe((Array.isArray(j.corridas) ? j.corridas : []).map((c) => txt(obj(c).workflow_id)), d.procesosImpl ?? fetch)
    return { ok: true, datos: normalizarLista(j, nombres) }
  } catch {
    return { ok: false, status: 502, error: "No se pudo contactar a la plataforma." }
  }
}

export const ID_DE_EJECUCION = /^[A-Za-z0-9_.-]{1,120}(:[A-Za-z0-9_.-]{1,120})?$/
export async function leerCorrida(id: string, d: { plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch; procesosImpl?: typeof fetch } = {}): Promise<Lectura<DetalleDeCorrida>> {
  if (!ID_DE_EJECUCION.test(id)) return { ok: false, status: 400, error: "El identificador de la corrida no es válido." }
  const { base, llave } = conexion(d)
  if (!llave) return { ok: false, status: 503, error: "El tablero no tiene la llave con la que lee a la plataforma." }
  try {
    const r = await (d.fetchImpl ?? fetch)(`${base}/api/direccion/corridas/${encodeURIComponent(id)}`, { method: "GET", headers: { "x-api-key": llave }, cache: "no-store" })
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null
    if (r.status === 404) return { ok: false, status: 404, error: "Esa corrida no existe." }
    if (!r.ok || !j || j.ok !== true) return { ok: false, status: 502, error: `La plataforma no entregó la corrida (${r.status}).` }
    const nombres = await nombresDe([txt(obj(j.corrida).workflow_id)], d.procesosImpl ?? fetch)
    const det = normalizarDetalle(j, nombres)
    return det ? { ok: true, datos: det } : { ok: false, status: 502, error: "La plataforma entregó una corrida sin forma." }
  } catch {
    return { ok: false, status: 502, error: "No se pudo contactar a la plataforma." }
  }
}
