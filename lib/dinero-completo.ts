/**
 * TU OFICINA · DINERO COMPLETO (sprint 6.36 · encargo 02-nov «dinero completo» + ADENDA 1 · boceto aprobado por Emilio con 3 ajustes).
 * Estructura copiada de Ramp · AI Token Spend Management (resumen «lo que cambió», tarjetas con variación y proyección, gasto en el tiempo conmutable,
 * desglose por proveedor · modelo · empleado · cliente · equipo · corrida), Vercel Usage (proveedores) y PostHog LLM analytics (costo por cliente/modelo
 * pegado a cada corrida). Solo la fachada es nuestra.
 * FUENTES (SOLO LECTURA): `agent_invocations` (cada llamada de un empleado con su costo, modelo, cliente y corrida) · `costs` (Apify por día y por llamada) ·
 * `clients` y `agents` (nombres) · `agent_invocations_daily_rollup` (tokens leídos del caché) · la ruta certificada de riesgos (saldos y freno de 24 h).
 * El servidor entrega MOVIMIENTOS normalizados; los cálculos (tarjetas, series, picos, desgloses) son funciones puras que corren en el navegador.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Saldo, Tope } from "@/lib/direccion-riesgos"
import { leerOrganizacion } from "@/lib/direccion-organizacion"
import { nombreDeLaCorrida } from "@/lib/direccion-corridas"

export interface Movimiento {
  /** instante (ISO) */
  t: string
  /** día en Ecuador (AAAA-MM-DD) */
  d: string
  proveedor: string
  modelo: string
  empleado: string
  /** 6.37 · departamento y equipo del empleado (organigrama vivo), p. ej. «Marketing · Creativo» */
  equipo?: string
  cliente: string
  client_id: string | null
  corrida: string | null
  usd: number
  ok: boolean
  /** el costo es una cota (la corrida se cortó por tope), no una medición */
  cota: boolean
  /** 6.39 · el nombre limpio de la ficha cuando el cliente cae en «Pruebas y fichas viejas» */
  ficha?: string | null
  /** 6.38 · el proceso de la corrida en palabras de oficina («Planeación del plan de 90 días»), si se sabe */
  proceso?: string | null
}
/** 6.38 · una pieza que pasó por la bandeja de revisión: su estado y lo que costó hacerla (si quedó anotado) */
export interface PiezaRevisada { d: string; estado: string; usd: number | null; /** 6.42 · de qué cliente es la pieza (vista del cliente) */ client_id?: string | null }
/** 6.38 · uso del caché por empleado y modelo en 30 días (tabla resumen diaria) */
export interface CacheDeEmpleado { empleado: string; modelo: string; entrada: number; leido: number; usd: number; /** 6.40 · día (para seguir al período elegido) */ d?: string }
export interface Dinero {
  movimientos: Movimiento[]
  saldos: Saldo[]
  topes: Tope[]
  cache: { leido: number; entrada: number } | null
  desde: string
  leido_en: string
  /** lo que no se pudo leer (se muestra «sin dato todavía», nunca un cero inventado) */
  faltan: string[]
  /** 6.38 · piezas de la bandeja de revisión (null = no se pudo leer) */
  piezas?: PiezaRevisada[] | null
  /** 6.38 · días en que se guardó una versión del manual (null = no se pudo leer) */
  manuales?: string[] | null
  /** 6.38 · caché por empleado y modelo (null = no se pudo leer) */
  cache_por_empleado?: CacheDeEmpleado[] | null
  /** 6.42 · días de versión del manual con su cliente (vista del cliente; null = no se pudo leer) */
  manuales_de?: Array<{ d: string; client_id: string | null }> | null
}

export const DIAS_LEIDOS = 62
const ZONA = "America/Guayaquil"
export const diaLocal = (iso: string): string => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONA })
export const horaLocal = (iso: string): number => Number(new Date(iso).toLocaleString("en-US", { timeZone: ZONA, hour: "2-digit", hour12: false })) % 24

/** proveedor de cada modelo: Claude → Anthropic · GPT, Whisper e imágenes de OpenAI → GPT (OpenAI) */
export function proveedorDelModelo(modelo: string | null): string {
  const m = String(modelo ?? "").toLowerCase()
  if (!m) return "Sin proveedor"
  if (m.startsWith("claude") || m.includes("anthropic")) return "Anthropic"
  if (m.startsWith("gpt") || m.startsWith("whisper") || m.startsWith("o1") || m.startsWith("o3") || m.includes("openai") || m.startsWith("dall")) return "GPT (OpenAI)"
  if (m.includes("higgsfield") || m.includes("veo")) return "Higgsfield"
  if (m.includes("seedance") || m.includes("bytedance")) return "Video · Seedance"
  return modelo ?? "Sin proveedor"
}
export const legible = (slug: string): string => { const s = slug.replace(/[-_]+/g, " ").trim(); return s ? s[0].toUpperCase() + s.slice(1) : slug }

/* ─── cálculos (puros) ─── */
const suma = (xs: Movimiento[]) => xs.reduce((s, x) => s + x.usd, 0)
const r2 = (n: number) => Math.round(n * 100) / 100
const mediana = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
export const sumarDias = (d: string, n: number): string => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
export const diasEntre = (a: string, b: string): string[] => { const out: string[] = []; for (let d = a; d <= b; d = sumarDias(d, 1)) out.push(d); return out }

export function totalesPorDia(movs: Movimiento[]): Map<string, number> {
  const m = new Map<string, number>(); for (const x of movs) m.set(x.d, (m.get(x.d) ?? 0) + x.usd); return m
}
/** el día normal: la mediana de los días con gasto de los 30 anteriores a `hoy` */
export function diaNormal(movs: Movimiento[], hoy: string): number {
  const t = totalesPorDia(movs); const desde = sumarDias(hoy, -30)
  return r2(mediana([...t.entries()].filter(([d, v]) => d >= desde && d < hoy && v > 0).map(([, v]) => v)))
}

export interface Tarjetas { hoy: number; normal: number; semana: number; semana_anterior: number; variacion_pct: number | null; mes: number; dias_del_mes: number; dia_del_mes: number; proyeccion: number; mes_anterior: number; ritmo_diario: number; poco_dato_del_mes: boolean }
export function tarjetas(movs: Movimiento[], hoy: string): Tarjetas {
  const t = totalesPorDia(movs)
  const rango = (a: string, b: string) => [...t.entries()].filter(([d]) => d >= a && d <= b).reduce((s, [, v]) => s + v, 0)
  const semana = rango(sumarDias(hoy, -6), hoy), anterior = rango(sumarDias(hoy, -13), sumarDias(hoy, -7))
  const inicio = `${hoy.slice(0, 8)}01`
  const dia = Number(hoy.slice(8, 10))
  const [y, mo] = hoy.slice(0, 7).split("-").map(Number)
  const diasDelMes = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const mes = rango(inicio, hoy)
  // 6.39 · la proyección usa el ritmo de los últimos 30 días (no los pocos días del mes, que con un pico disparan la cifra): lo gastado + ritmo × días que faltan
  const ritmo = rango(sumarDias(hoy, -29), hoy) / 30
  const iniAnt = sumarDias(inicio, -1).slice(0, 8) + "01"
  return {
    hoy: r2(t.get(hoy) ?? 0), normal: diaNormal(movs, hoy), semana: r2(semana), semana_anterior: r2(anterior),
    variacion_pct: anterior > 0 ? Math.round(((semana - anterior) / anterior) * 100) : null,
    mes: r2(mes), dias_del_mes: diasDelMes, dia_del_mes: dia, proyeccion: r2(mes + ritmo * (diasDelMes - dia)), mes_anterior: r2(rango(iniAnt, sumarDias(inicio, -1))), ritmo_diario: r2(ritmo), poco_dato_del_mes: dia < 7,
  }
}

export type Dimension = "proveedor" | "cliente" | "modelo" | "empleado"
export const NOMBRE_DE_DIMENSION: Record<Dimension, string> = { proveedor: "Proveedor", cliente: "Cliente", modelo: "Modelo", empleado: "Empleado" }
/** colores claramente distintos (ajuste 1 de Emilio); el ámbar de la casa es siempre el primero */
export const PALETA = ["#e8731a", "#4fa3ff", "#7fc99a", "#c58cff", "#ffd166", "#ff6b8b", "#3dd6c6", "#a3e635", "#e2e8f0"]
export const COLOR_OTROS = "#8a8580"
const COLOR_FIJO: Record<string, string> = { Anthropic: "#e8731a", "GPT (OpenAI)": "#4fa3ff", Apify: "#7fc99a", Higgsfield: "#c58cff", Railway: "#ffd166", Vercel: "#ff6b8b", Supabase: "#3dd6c6" }
export const OTROS = "Otros"

export interface Serie { rotulos: string[]; claves: string[]; colores: Record<string, string>; valores: Array<Record<string, number>>; totales: number[]; normal: number }
/** barras apiladas: por día (o por hora si el período es «hoy»), con las 9 claves más grandes y el resto en «Otros» */
export function serie(movs: Movimiento[], dim: Dimension, o: { desde: string; hasta: string; porHora?: boolean; normal?: number }): Serie {
  const dentro = movs.filter((x) => x.d >= o.desde && x.d <= o.hasta)
  const porClave = new Map<string, number>(); for (const x of dentro) porClave.set(x[dim], (porClave.get(x[dim]) ?? 0) + x.usd)
  const orden = [...porClave.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k)
  const top = orden.slice(0, orden.length > PALETA.length ? PALETA.length - 1 : PALETA.length)
  const claves = orden.length > top.length ? [...top, OTROS] : top
  const colores: Record<string, string> = {}
  let i = 0
  for (const k of claves) colores[k] = k === OTROS ? COLOR_OTROS : dim === "proveedor" && COLOR_FIJO[k] ? COLOR_FIJO[k] : PALETA[i++ % PALETA.length]
  if (dim === "proveedor") { const usados = new Set(Object.values(colores)); let j = 0; for (const k of claves) if (k !== OTROS && !COLOR_FIJO[k]) { while (usados.has(PALETA[j % PALETA.length])) j++; colores[k] = PALETA[j++ % PALETA.length] } }
  const rotulos = o.porHora ? Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")) : diasEntre(o.desde, o.hasta)
  const valores = rotulos.map(() => ({} as Record<string, number>))
  for (const x of dentro) {
    const idx = o.porHora ? horaLocal(x.t) : rotulos.indexOf(x.d)
    if (idx < 0) continue
    const k = top.includes(x[dim]) ? x[dim] : OTROS
    valores[idx][k] = (valores[idx][k] ?? 0) + x.usd
  }
  return { rotulos, claves, colores, valores, totales: valores.map((v) => Object.values(v).reduce((s, n) => s + n, 0)), normal: o.normal ?? 0 }
}

export interface Pico { d: string; usd: number; veces: number; explicacion: string; corrida: string | null }
/** un día que gasta 3× o más el día normal de hoy (la misma línea del gráfico) y al menos US$ 1; se explica por su corrida más cara y, si pesa, por Apify */
export function picos(movs: Movimiento[], hoy: string, o: { veces?: number; minimo?: number } = {}): Pico[] {
  const veces = o.veces ?? 3, minimo = o.minimo ?? 1
  const t = totalesPorDia(movs), normal = diaNormal(movs, hoy), out: Pico[] = []
  if (normal <= 0) return out
  for (const [d, v] of t) {
    if (d > hoy || v < minimo || v < veces * normal) continue
    const delDia = movs.filter((x) => x.d === d)
    const conCorrida = delDia.filter((x) => x.corrida)
    const porCorrida = new Map<string, Movimiento[]>(); for (const x of conCorrida) porCorrida.set(x.corrida!, [...(porCorrida.get(x.corrida!) ?? []), x])
    const top = [...porCorrida.entries()].sort((a, b) => suma(b[1]) - suma(a[1]))[0]
    const partes: string[] = []
    if (top) { const xs = top[1]; const cliente = xs.find((x) => x.client_id)?.cliente; const quien = [...new Set(xs.map((x) => x.empleado))].slice(0, 2).map(legible).join(" y "); partes.push(`${cliente ? `${cliente} · ` : ""}${quien} (${usdCorto(suma(xs))})`) }
    const apify = suma(delDia.filter((x) => x.proveedor === "Apify"))
    if (apify >= 0.3 * v || !top) partes.push(`Apify ${usdCorto(apify)}`)
    out.push({ d, usd: r2(v), veces: Math.round((v / normal) * 10) / 10, explicacion: partes.join(" · "), corrida: top?.[0] ?? null })
  }
  return out.sort((a, b) => b.d.localeCompare(a.d))
}

export const veces = (n: number): string => `${n.toLocaleString("es-EC", { maximumFractionDigits: 1 })}×`
export type Vista = "cliente" | "equipo" | "empleado" | "modelo" | "proveedor" | "corrida"
export const NOMBRE_DE_VISTA: Record<Vista, string> = { cliente: "Cliente", equipo: "Equipo y departamento", empleado: "Empleado", modelo: "Modelo", proveedor: "Proveedor", corrida: "Corrida" }
export interface FilaDeDesglose { clave: string; nombre: string; usd: number; pct: number; anterior: number; variacion_pct: number | null; llamadas: number; client_id?: string | null; ids?: string[]; fichas?: Array<{ nombre: string; usd: number }>; dia?: string; detalle?: string; corrida?: string | null }
/** el desglose de Ramp (cliente · equipo · empleado · modelo · proveedor · corrida) en un período, comparado con el período anterior del mismo largo */
export function desglose(movs: Movimiento[], vista: Vista, o: { desde: string; hasta: string }, ant?: { desde: string; hasta: string }): FilaDeDesglose[] {
  const largo = diasEntre(o.desde, o.hasta).length
  const antDesde = ant?.desde ?? sumarDias(o.desde, -largo), antHasta = ant?.hasta ?? sumarDias(o.desde, -1)
  const clave = (x: Movimiento): string | null => vista === "corrida" ? (x.corrida ? x.corrida.split(":")[0] : null) : vista === "equipo" ? (x.equipo ?? "Sin dato") : vista === "cliente" ? x.cliente : x[vista]
  const ahora = new Map<string, Movimiento[]>(), antes = new Map<string, number>()
  for (const x of movs) {
    const k = clave(x); if (!k) continue
    if (x.d >= o.desde && x.d <= o.hasta) ahora.set(k, [...(ahora.get(k) ?? []), x])
    else if (x.d >= antDesde && x.d <= antHasta) antes.set(k, (antes.get(k) ?? 0) + x.usd)
  }
  const total = [...ahora.values()].reduce((s, xs) => s + suma(xs), 0)
  const filas = [...ahora.entries()].map(([k, xs]): FilaDeDesglose => {
    const usd = r2(suma(xs)), ant = r2(antes.get(k) ?? 0)
    const base: FilaDeDesglose = { clave: k, nombre: vista === "cliente" ? xs[0].cliente : k, usd, pct: total > 0 ? Math.round((suma(xs) / total) * 1000) / 10 : 0, anterior: ant, variacion_pct: ant > 0 ? Math.round(((usd - ant) / ant) * 100) : null, llamadas: xs.length, client_id: vista === "cliente" ? xs[0].client_id : undefined, ...(vista === "cliente" ? { ids: [...new Set(xs.map((x) => x.client_id).filter((v): v is string => !!v))], ...(k === PRUEBAS_Y_FICHAS_VIEJAS ? { fichas: [...xs.reduce((m, x) => m.set(x.ficha ?? "Sin nombre", (m.get(x.ficha ?? "Sin nombre") ?? 0) + x.usd), new Map<string, number>())].map(([nombre, usd]) => ({ nombre, usd: r2(usd) })).sort((a, b) => b.usd - a.usd) } : {}) } : {}) }
    if (vista === "corrida") { const c = xs.find((x) => x.client_id)?.cliente; return { ...base, nombre: [...new Set(xs.map((x) => x.empleado))].slice(0, 3).join(" · "), dia: xs[0].d, detalle: c ?? "Trabajo interno", corrida: k } }
    return base
  })
  return filas.sort((a, b) => b.usd - a.usd)
}
/** tope suave sugerido por la tendencia (como Ramp): lo que llevaría al mes a este ritmo, con 20 % de holgura, redondeado hacia arriba a US$ 5 */
export function topeSugerido(movs: Movimiento[], filtro: (x: Movimiento) => boolean, hoy: string): number | null {
  const desde = sumarDias(hoy, -29), xs = movs.filter((x) => x.d >= desde && x.d <= hoy && filtro(x))
  if (!xs.length) return null
  return Math.max(5, Math.ceil((suma(xs) * 1.2) / 5) * 5)
}
export function aCsv(filas: Array<Record<string, string | number | null | undefined>>): string {
  if (!filas.length) return ""
  const cols = Object.keys(filas[0])
  const celda = (v: unknown) => { const t = v == null ? "" : String(v); return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
  return [cols.join(","), ...filas.map((f) => cols.map((c) => celda(f[c])).join(","))].join("\n")
}

export interface Cambio { tipo: "mayor" | "pico" | "ahorro"; texto: string; corrida?: string | null; /** 6.41 · la tarjeta: un número grande y una línea corta (el texto queda para «ver más») */ numero?: string; linea?: string }
/** «Lo que cambió esta semana» (como el resumen semanal de Ramp): el mayor cambio, el pico inusual y dónde ahorrar, en lenguaje claro */
export function loQueCambio(movs: Movimiento[], hoy: string, cache: Dinero["cache"], per?: { r: { desde: string; hasta: string }; ant: { desde: string; hasta: string; nombre: string } }): Cambio[] {
  if (per) return loQueCambioDelPeriodo(movs, hoy, cache, per.r, per.ant)
  const k = tarjetas(movs, hoy), out: Cambio[] = []
  const ini = sumarDias(hoy, -6), iniAnt = sumarDias(hoy, -13), finAnt = sumarDias(hoy, -7)
  if (k.variacion_pct != null || k.semana > 0) {
    const delta = new Map<string, number>()
    for (const x of movs) { if (x.d >= ini && x.d <= hoy) delta.set(x.cliente, (delta.get(x.cliente) ?? 0) + x.usd); else if (x.d >= iniAnt && x.d <= finAnt) delta.set(x.cliente, (delta.get(x.cliente) ?? 0) - x.usd) }
    const [quien, cuanto] = [...delta.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0] ?? ["", 0]
    const sube = (k.variacion_pct ?? 0) >= 0
    out.push({ tipo: "mayor", texto: `${k.variacion_pct == null ? `Esta semana se gastaron ${usdCorto(k.semana)}` : `El gasto ${sube ? "subió" : "bajó"} ${Math.abs(k.variacion_pct)} % frente a la semana pasada (${usdCorto(k.semana)} contra ${usdCorto(k.semana_anterior)})`}${quien && Math.abs(cuanto) >= 0.01 ? `; lo que más movió: ${quien} (${cuanto >= 0 ? "+" : "−"}${usdCorto(Math.abs(cuanto))})` : ""}.` })
  } else out.push({ tipo: "mayor", texto: "Sin gasto registrado en las dos últimas semanas." })
  const p = picos(movs, hoy).find((x) => x.d >= ini)
  out.push(p ? { tipo: "pico", texto: `${fechaCorta(p.d)}: ${usdCorto(p.usd)} en un día, ${veces(p.veces)} tu día normal · ${p.explicacion}.`, corrida: p.corrida } : { tipo: "pico", texto: "Ningún día de esta semana se salió de lo normal." })
  if (cache && cache.entrada + cache.leido > 0) { const pct = Math.round((cache.leido / (cache.entrada + cache.leido)) * 100); out.push({ tipo: "ahorro", texto: `En 30 días, el ${pct} % de lo que leyeron los modelos salió del caché (más barato y sin bajar calidad).` }) }
  else out.push({ tipo: "ahorro", texto: "Uso del caché de los modelos: sin dato todavía." })
  return out
}

export const usdCorto = (n: number): string => `US$ ${n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const fechaCorta = (d: string): string => new Date(`${d}T12:00:00Z`).toLocaleDateString("es-EC", { timeZone: "UTC", day: "numeric", month: "short" }).replace(".", "")

/* ─── lectura (servidor, SOLO LECTURA) ─── */
type Fila = Record<string, unknown>
const txt = (v: unknown) => (v == null || v === "" ? null : String(v))
async function todas(q: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>, que: string, tope = 20000): Promise<Fila[]> {
  const out: Fila[] = []
  for (let i = 0; i < tope; i += 1000) {
    const r = await q(i, i + 999)
    if (r.error) throw new Error(`${que}: ${r.error.message}`)
    const xs = (r.data ?? []) as Fila[]; out.push(...xs)
    if (xs.length < 1000) break
  }
  return out
}

export async function leerDinero(db: SupabaseClient, extra: { saldos?: Saldo[]; topes?: Tope[]; faltan?: string[] } = {}, o: { ahora?: Date } = {}): Promise<Dinero> {
  const ahora = o.ahora ?? new Date()
  const desde = new Date(ahora.getTime() - DIAS_LEIDOS * 86400_000).toISOString()
  const faltan = [...(extra.faltan ?? [])]
  const [inv, costos, clientes, agentes, rollup, revisadas, versiones] = await Promise.all([
    todas((a, b) => db.from("agent_invocations").select("agent_name, model, client_id, cost_usd, created_at, started_at, workflow_id, workflow_execution_id, status, metadata->cost_is_upper_bound").gte("created_at", desde).order("created_at", { ascending: true }).range(a, b), "agent_invocations"),
    todas((a, b) => db.from("costs").select("service, amount_usd, amount_usd_exact, date, description").gte("date", desde.slice(0, 10)).order("date", { ascending: true }).range(a, b), "costs").catch(() => { faltan.push("Gasto de Apify (libreta de costos)"); return [] as Fila[] }),
    todas((a, b) => db.from("clients").select("id, name").range(a, b), "clients"),
    todas((a, b) => db.from("agents").select("name, display_name").range(a, b), "agents"),
    todas((a, b) => db.from("agent_invocations_daily_rollup").select("day, agent_id, model, total_tokens_input, total_tokens_cache_read, total_cost_usd").gte("day", new Date(ahora.getTime() - DIAS_LEIDOS * 86400_000).toISOString().slice(0, 10)).range(a, b), "rollup").catch(() => null),
    todas((a, b) => db.from("hitl_queue").select("status, created_at, client_id, metadata->costo_usd").eq("type", "content_piece_review").gte("created_at", desde).range(a, b), "hitl_queue").catch(() => null),
    todas((a, b) => db.from("client_brand_books").select("created_at, client_id").gte("created_at", desde).range(a, b), "client_brand_books").catch(() => null),
  ])
  // 6.37 · el equipo de cada empleado sale del organigrama vivo (si no se puede leer, el desglose por equipo lo dice)
  const org = await leerOrganizacion(db, { ahora }).catch(() => { faltan.push("Departamento y equipo de cada empleado (no se pudo leer la organización)"); return null })
  const equipoDe = (slug: string): string => {
    const p = org?.personas[slug]; if (!p) return "Sin equipo asignado"
    const d = org!.departamentos.find((x) => x.clave === p.departamento)
    const e = d?.equipos.find((x) => x.clave === p.equipo)
    return p.departamento === "direccion_general" ? "Dirección general" : `${d?.nombre ?? "Sin departamento"}${e && e.clave !== "todos" ? ` · ${e.nombre}` : ""}`
  }
  const unificado = nombresUnificados(clientes.map((c) => String(c.name)))
  const nombreCliente = new Map(clientes.map((c) => [String(c.id), unificado.get(String(c.name)) ?? String(c.name)]))
  const nombreAgente = new Map(agentes.map((a) => [String(a.name), txt(a.display_name)]))
  const movimientos: Movimiento[] = []
  for (const x of inv) {
    const usd = Number(x.cost_usd ?? 0); if (!(usd > 0)) continue
    const t = String(x.started_at ?? x.created_at), cid = txt(x.client_id), emp = String(x.agent_name ?? "sin empleado")
    movimientos.push({ t, d: diaLocal(t), proveedor: proveedorDelModelo(txt(x.model)), modelo: txt(x.model) ?? "sin modelo", empleado: nombreAgente.get(emp) ?? legible(emp), equipo: org ? equipoDe(emp) : undefined, ...grupoDeCliente(cid ? nombreCliente.get(cid) ?? null : null, cid), client_id: cid, corrida: txt(x.workflow_execution_id), usd, ok: !/error|fail|timeout|cancel/i.test(String(x.status ?? "")), cota: x.cost_is_upper_bound === true || x.cost_is_upper_bound === "true", proceso: x.workflow_id ? nombreDeLaCorrida(String(x.workflow_id), "") : null })
  }
  for (const c of costos) {
    const usd = Number(c.amount_usd_exact ?? c.amount_usd ?? 0); if (!(usd > 0)) continue
    const servicio = String(c.service ?? "")
    if (!servicio.toLowerCase().startsWith("apify")) continue
    const funcion = servicio.includes(":") ? servicio.split(":").slice(1).join(":") : "conciliación del día"
    const d = String(c.date).slice(0, 10)
    movimientos.push({ t: `${d}T17:00:00.000Z`, d, proveedor: "Apify", modelo: `Apify · ${funcion}`, empleado: "Apify (raspados)", equipo: "Proveedor externo · Apify", cliente: TRABAJO_INTERNO, client_id: null, corrida: null, usd, ok: true, cota: false })
  }
  movimientos.sort((a, b) => a.t.localeCompare(b.t))
  const hace30 = new Date(ahora.getTime() - 30 * 86400_000).toISOString().slice(0, 10)
  const cache: Dinero["cache"] = rollup ? rollup.filter((r) => String(r.day) >= hace30).reduce<{ leido: number; entrada: number }>((s, r) => ({ leido: s.leido + Number(r.total_tokens_cache_read ?? 0), entrada: s.entrada + Number(r.total_tokens_input ?? 0) }), { leido: 0, entrada: 0 }) : null
  if (!rollup) faltan.push("Uso del caché de los modelos")
  const porEmp = new Map<string, CacheDeEmpleado>()
  for (const r of rollup ?? []) { const emp = String(r.agent_id ?? "sin empleado"), mod = String(r.model ?? "sin modelo"), dia = String(r.day).slice(0, 10), k = `${emp}|${mod}|${dia}`; const c = porEmp.get(k) ?? { empleado: nombreAgente.get(emp) ?? legible(emp), modelo: mod, entrada: 0, leido: 0, usd: 0, d: dia }; c.entrada += Number(r.total_tokens_input ?? 0); c.leido += Number(r.total_tokens_cache_read ?? 0); c.usd += Number(r.total_cost_usd ?? 0); porEmp.set(k, c) }
  if (!revisadas) faltan.push("Piezas de la bandeja de revisión (costo por pieza aprobada)")
  if (!versiones) faltan.push("Versiones del manual")
  const piezas = revisadas ? revisadas.map((r) => ({ d: diaLocal(String(r.created_at)), estado: String(r.status ?? ""), usd: r.costo_usd == null ? null : Number(r.costo_usd), client_id: txt(r.client_id) })) : null
  return { movimientos, saldos: extra.saldos ?? [], topes: extra.topes ?? [], cache, desde, leido_en: ahora.toISOString(), faltan, piezas, manuales: versiones ? versiones.map((v) => diaLocal(String(v.created_at))) : null, cache_por_empleado: rollup ? [...porEmp.values()] : null, manuales_de: versiones ? versiones.map((v) => ({ d: diaLocal(String(v.created_at)), client_id: txt(v.client_id) })) : null }
}

/* ───────────── 6.38 · parte 3: costo por resultado, costo de rehacer, anomalías y ahorro ───────────── */
export const PROCESO_DEL_PLAN = "Planeación del plan de 90 días"
export const PROCESO_DEL_ALTA = "Alta de un cliente nuevo"
const ES_PRUEBA = /prueba|ensayo/i
const enRango = (x: { d: string }, r: { desde: string; hasta: string }) => x.d >= r.desde && x.d <= r.hasta
/** «209744:analisis-mercado» → «209744»: las ramas de una corrida son la misma corrida */
export const raizDeCorrida = (id: string): string => id.split(":")[0]
const porCorrida = (xs: Movimiento[]) => { const m = new Map<string, Movimiento[]>(); for (const x of xs) if (x.corrida) { const k = raizDeCorrida(x.corrida); m.set(k, [...(m.get(k) ?? []), x]) } return m }
/** una corrida del alta arma el manual: la del proceso de alta o la que hace trabajar al especialista de alta o a los jefes que revisan el manual */
const ES_DEL_MANUAL = (x: Movimiento) => x.proceso === PROCESO_DEL_ALTA || /onboarding|bb lens|faithfulness/i.test(x.empleado)

export interface Resultado { clave: "plan" | "manual" | "pieza"; nombre: string; por_unidad: number | null; cuantos: number; total: number; nota: string }
/** costo de un plan, de un manual y de una pieza aprobada en el período. Plan y manual: lo que costó cada corrida de su proceso; pieza: lo anotado en la bandeja. */
export function costoPorResultado(d: Dinero, r: { desde: string; hasta: string }): Resultado[] {
  const movs = d.movimientos.filter((x) => enRango(x, r))
  const delProceso = (p: string) => { const c = porCorrida(movs.filter((x) => (p === PROCESO_DEL_ALTA ? ES_DEL_MANUAL(x) : x.proceso === p))); const total = r2([...c.values()].reduce((s, xs) => s + suma(xs), 0)); return { cuantos: c.size, total, por_unidad: c.size ? r2(total / c.size) : null } }
  const plan = delProceso(PROCESO_DEL_PLAN), alta = delProceso(PROCESO_DEL_ALTA)
  const versiones = d.manuales == null ? null : d.manuales.filter((x) => x >= r.desde && x <= r.hasta).length
  const out: Resultado[] = [
    { clave: "plan", nombre: "Un plan de 90 días", ...plan, nota: plan.cuantos ? `${plan.cuantos} ${plan.cuantos === 1 ? "plan hecho" : "planes hechos"} en el período` : "ningún plan en el período" },
    { clave: "manual", nombre: "Un manual de marca (alta de cliente)", ...alta, nota: `${alta.cuantos} ${alta.cuantos === 1 ? "alta" : "altas"}${versiones == null ? "" : ` · ${versiones} ${versiones === 1 ? "versión guardada" : "versiones guardadas"} del manual`}` },
  ]
  if (d.piezas == null) out.push({ clave: "pieza", nombre: "Una pieza aprobada", por_unidad: null, cuantos: 0, total: 0, nota: "sin dato todavía" })
  else {
    const ps = d.piezas.filter((x) => enRango(x, r)), ok = ps.filter((x) => x.estado === "approved" || x.estado === "edited"), conCosto = ok.filter((x) => x.usd != null)
    const total = r2(conCosto.reduce((s, x) => s + (x.usd ?? 0), 0))
    out.push({ clave: "pieza", nombre: "Una pieza aprobada", por_unidad: conCosto.length ? r2(total / conCosto.length) : null, cuantos: ok.length, total, nota: `${ok.length} ${ok.length === 1 ? "aprobada" : "aprobadas"} de ${ps.length} ${ps.length === 1 ? "revisada" : "revisadas"}` })
  }
  return out
}

export interface Rehacer { clave: "cambios" | "fallidas" | "tope" | "pruebas"; nombre: string; usd: number | null; cuantos: number; nota: string }
/** lo que costó rehacer: piezas devueltas con «Pedir cambios» o rechazadas, llamadas fallidas, cortadas por tope y pruebas/ensayos */
export function costoDeRehacer(d: Dinero, r: { desde: string; hasta: string }): Rehacer[] {
  const movs = d.movimientos.filter((x) => enRango(x, r))
  const fallidas = movs.filter((x) => !x.ok), tope = movs.filter((x) => x.cota), pruebas = movs.filter((x) => x.proceso && ES_PRUEBA.test(x.proceso))
  const devueltas = d.piezas == null ? null : d.piezas.filter((x) => enRango(x, r) && x.estado === "rejected")
  return [
    { clave: "cambios", nombre: "Piezas devueltas o rechazadas", usd: devueltas == null ? null : r2(devueltas.reduce((s, x) => s + (x.usd ?? 0), 0)), cuantos: devueltas?.length ?? 0, nota: devueltas == null ? "sin dato todavía" : `${devueltas.length} en el período${devueltas.some((x) => x.usd == null) ? " · algunas sin costo anotado" : ""}` },
    { clave: "fallidas", nombre: "Llamadas fallidas", usd: r2(suma(fallidas)), cuantos: fallidas.length, nota: `${porCorrida(fallidas).size} corridas afectadas` },
    { clave: "tope", nombre: "Cortadas por tope", usd: r2(suma(tope)), cuantos: tope.length, nota: "costo máximo posible (no medido exacto)" },
    { clave: "pruebas", nombre: "Pruebas y ensayos", usd: r2(suma(pruebas)), cuantos: porCorrida(pruebas).size, nota: "corridas de prueba de empleados y ensayos" },
  ]
}

export interface Anomalia { tipo: "dia" | "corrida"; d: string; usd: number; veces: number; texto: string; corrida: string | null }
/** días 3× su normal (como los picos del gráfico) y corridas 3× la mediana de su mismo proceso (con al menos 3 corridas y US$ 0,50), las más recientes primero */
export function anomalias(d: Dinero, hoy: string, r: { desde: string; hasta: string }, o: { veces?: number } = {}): Anomalia[] {
  const k = o.veces ?? 3
  const dias: Anomalia[] = picos(d.movimientos, hoy, { veces: k }).filter((p) => enRango(p, r)).map((p) => ({ tipo: "dia", d: p.d, usd: p.usd, veces: p.veces, texto: `El día gastó ${veces(p.veces)} lo normal · ${p.explicacion}`, corrida: p.corrida }))
  const grupos = new Map<string, Array<{ id: string; xs: Movimiento[]; usd: number }>>()
  for (const [id, xs] of porCorrida(d.movimientos)) { const p = xs[0].proceso ?? legible(xs[0].empleado); grupos.set(p, [...(grupos.get(p) ?? []), { id, xs, usd: suma(xs) }]) }
  const corridas: Anomalia[] = []
  for (const [p, cs] of grupos) {
    if (cs.length < 3) continue
    const med = mediana(cs.map((c) => c.usd)); if (med <= 0) continue
    for (const c of cs) {
      const dia = c.xs[0].d
      if (dia < r.desde || dia > r.hasta || c.usd < 0.5 || c.usd < k * med) continue
      const v = Math.round((c.usd / med) * 10) / 10, cliente = c.xs.find((x) => x.client_id)?.cliente
      corridas.push({ tipo: "corrida", d: dia, usd: r2(c.usd), veces: v, texto: `${p}${cliente ? ` · ${cliente}` : ""} costó ${veces(v)} lo habitual de ese proceso (${usdCorto(med)})`, corrida: c.id })
    }
  }
  return [...dias, ...corridas].sort((a, b) => b.d.localeCompare(a.d) || b.usd - a.usd).slice(0, 25)
}

/** precio de entrada por millón de tokens (la lectura de caché cuesta 10 %); solo para ESTIMAR lo ahorrado */
const PRECIO_ENTRADA: Array<[RegExp, number]> = [[/opus/i, 5], [/sonnet/i, 3], [/haiku/i, 1]]
const precioDe = (modelo: string): number | null => PRECIO_ENTRADA.find(([re]) => re.test(modelo))?.[1] ?? null
export interface Oportunidad { texto: string; usd: number | null }
export interface Ahorro { pct_cache: number | null; ahorrado_usd: number | null; oportunidades: Oportunidad[] }
/** el caché que ya ahorra (30 días) y oportunidades que NO bajan la calidad (nunca se propone pasar a un modelo más barato) */
export function ahorro(d: Dinero, r: { desde: string; hasta: string }): Ahorro {
  const c0 = cacheDelRango(d, r) ?? d.cache
  const pct = c0 && c0.leido + c0.entrada > 0 ? Math.round((c0.leido / (c0.leido + c0.entrada)) * 100) : null
  const filasCache = (d.cache_por_empleado ?? []).filter((c) => !c.d || (c.d >= r.desde && c.d <= r.hasta))
  const ahorrado = d.cache_por_empleado ? r2(filasCache.reduce((s, c) => { const p = precioDe(c.modelo); return p ? s + (c.leido / 1e6) * p * 0.9 : s }, 0)) : null
  const op: Oportunidad[] = []
  const porEmpleado = new Map<string, CacheDeEmpleado>()
  for (const c of filasCache) { const k = `${c.empleado}|${c.modelo}`, a = porEmpleado.get(k) ?? { ...c, entrada: 0, leido: 0, usd: 0 }; a.entrada += c.entrada; a.leido += c.leido; a.usd += c.usd; porEmpleado.set(k, a) }
  const sinCache = [...porEmpleado.values()].filter((c) => c.entrada >= 200_000 && c.leido / (c.entrada + c.leido) < 0.1 && precioDe(c.modelo) != null).sort((a, b) => b.entrada - a.entrada).slice(0, 3)
  for (const c of sinCache) op.push({ texto: `${c.empleado}: caché en sus instrucciones fijas (${Math.round(c.entrada / 1000).toLocaleString("es-EC")} mil tokens sin caché)`, usd: r2((c.entrada / 1e6) * precioDe(c.modelo)! * 0.5) })
  const rh = costoDeRehacer(d, r), de = (k: Rehacer["clave"]) => rh.find((x) => x.clave === k)!.usd ?? 0
  if (de("fallidas") >= 0.5) op.push({ texto: "Arreglar las llamadas fallidas", usd: de("fallidas") })
  if (de("tope") >= 0.5) op.push({ texto: "Ajustar los topes que cortan corridas sin entregar", usd: de("tope") })
  if (de("pruebas") >= 1) op.push({ texto: "Reusar respuestas guardadas en pruebas y ensayos", usd: de("pruebas") })
  return { pct_cache: pct, ahorrado_usd: ahorrado, oportunidades: op }
}

/* ───────────── 6.39 · tabla por cliente ordenada ───────────── */
/** el gasto sin cliente es trabajo interno: mantenimiento del cerebro, raspados de Apify aún sin cliente y tareas de la agencia */
export const TRABAJO_INTERNO = "Trabajo interno · mantenimiento y cerebro"
export const EXPLICACION_INTERNO = "Mantenimiento del cerebro, raspados de Apify todavía sin cliente asignado y tareas de la propia agencia."
/** pruebas, fichas archivadas y gasto con una ficha que ya no existe: una sola fila, desplegable */
export const PRUEBAS_Y_FICHAS_VIEJAS = "Pruebas y fichas viejas"
const ES_FICHA_DE_PRUEBA = /archivada|prueba|práctica|practica|^zz\b|^test\b|demo|sint[eé]tic/i
/** «ARCHIVADA 2026-10-11 · ficha de prueba del tramo 1 (96864e88)» → «Ficha de prueba del tramo 1» · «zz prueba puerta 21:22» → «Prueba puerta» (sin códigos, fechas ni horas) */
export function nombreSinCodigos(n: string): string {
  const limpio = n
    .replace(/^\s*archivada\s+[0-9-]+\s*·\s*/i, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/^\s*zz\s+/i, "")
    .replace(/\s+[0-9]{1,2}:[0-9]{2}\s*$/, "")
    .replace(/\s+[0-9]{3,}\s*$/, "")
    .replace(/\s+/g, " ").trim()
  const t = limpio || "Ficha sin nombre"
  return t.charAt(0).toLocaleUpperCase("es") + t.slice(1).toLocaleLowerCase("es")
}
/** el nombre con que un cliente aparece en Dinero: los repetidos se juntan por nombre (sin importar mayúsculas), las pruebas van a una sola fila */
export function grupoDeCliente(nombre: string | null, clientId: string | null): { cliente: string; ficha: string | null } {
  if (!clientId) return { cliente: TRABAJO_INTERNO, ficha: null }
  if (!nombre) return { cliente: PRUEBAS_Y_FICHAS_VIEJAS, ficha: "Gasto con una ficha que ya no existe" }
  if (ES_FICHA_DE_PRUEBA.test(nombre)) return { cliente: PRUEBAS_Y_FICHAS_VIEJAS, ficha: nombreSinCodigos(nombre) }
  return { cliente: nombre.trim(), ficha: null }
}
/** entre variantes del mismo nombre («GoEuropeAdventure» y «GOEUROPEADVENTURE») se queda la que no está toda en mayúsculas */
export function nombresUnificados(nombres: string[]): Map<string, string> {
  const elegido = new Map<string, string>()
  for (const n of nombres) {
    const k = n.trim().toLocaleLowerCase("es"), actual = elegido.get(k)
    const gritado = (x: string) => x === x.toLocaleUpperCase("es") && /[a-z]/i.test(x)
    if (!actual || (gritado(actual) && !gritado(n))) elegido.set(k, n.trim())
  }
  return new Map(nombres.map((n) => [n, elegido.get(n.trim().toLocaleLowerCase("es"))!]))
}

/* ───────────── 6.40 · un solo período manda en todo (Ramp): el período elegido y su anterior igual ───────────── */
export type Periodo = "hoy" | "7" | "mes" | "30"
export const PERIODOS: Array<{ k: Periodo; t: string }> = [{ k: "hoy", t: "Hoy" }, { k: "7", t: "7 días" }, { k: "mes", t: "Este mes" }, { k: "30", t: "30 días" }]
export interface Rango { desde: string; hasta: string; porHora: boolean }
export function rangoDe(p: Periodo, hoy: string): Rango {
  if (p === "hoy") return { desde: hoy, hasta: hoy, porHora: true }
  if (p === "7") return { desde: sumarDias(hoy, -6), hasta: hoy, porHora: false }
  if (p === "mes") return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy, porHora: false }
  return { desde: sumarDias(hoy, -29), hasta: hoy, porHora: false }
}
/** el período anterior IGUAL: ayer · los 7 días anteriores · el mismo tramo del mes anterior · los 30 días anteriores */
export function anteriorDe(p: Periodo, r: Rango): { desde: string; hasta: string; nombre: string } {
  if (p === "mes") {
    const ini = sumarDias(r.desde, -1).slice(0, 8) + "01", finMes = sumarDias(r.desde, -1)
    const hasta = sumarDias(ini, Number(r.hasta.slice(8, 10)) - 1)
    return { desde: ini, hasta: hasta > finMes ? finMes : hasta, nombre: "el mismo tramo del mes anterior" }
  }
  const largo = diasEntre(r.desde, r.hasta).length
  return { desde: sumarDias(r.desde, -largo), hasta: sumarDias(r.desde, -1), nombre: p === "hoy" ? "ayer" : `los ${largo} días anteriores` }
}
export interface ResumenDelPeriodo { total: number; anterior: number; variacion_pct: number | null; llamadas: number; por_dia: number; dias: number; proyeccion: number; ritmo_diario: number; poco_dato_del_mes: boolean; mes: number; mes_anterior: number }
/** el número principal de Ramp: lo gastado en el período, su variación frente al anterior igual y la proyección del mes */
export function resumenDelPeriodo(movs: Movimiento[], r: { desde: string; hasta: string }, ant: { desde: string; hasta: string }, hoy: string): ResumenDelPeriodo {
  const del = (a: { desde: string; hasta: string }) => movs.filter((x) => x.d >= a.desde && x.d <= a.hasta)
  const xs = del(r), total = suma(xs), anterior = suma(del(ant)), dias = diasEntre(r.desde, r.hasta).length, k = tarjetas(movs, hoy)
  return { total: r2(total), anterior: r2(anterior), variacion_pct: anterior > 0 ? Math.round(((total - anterior) / anterior) * 100) : null, llamadas: xs.length, por_dia: r2(total / dias), dias, proyeccion: k.proyeccion, ritmo_diario: k.ritmo_diario, poco_dato_del_mes: k.poco_dato_del_mes, mes: k.mes, mes_anterior: k.mes_anterior }
}
/** el caché leído en un rango (desde la tabla resumen diaria); null si no hay dato por día */
export function cacheDelRango(d: Dinero, r: { desde: string; hasta: string }): { leido: number; entrada: number } | null {
  const filas = d.cache_por_empleado?.filter((c) => c.d)
  if (!filas?.length) return null
  return filas.filter((c) => c.d! >= r.desde && c.d! <= r.hasta).reduce((s, c) => ({ leido: s.leido + c.leido, entrada: s.entrada + c.entrada }), { leido: 0, entrada: 0 })
}

/** 6.40 · «lo que cambió» siguiendo al período elegido y a su anterior igual */
function loQueCambioDelPeriodo(movs: Movimiento[], hoy: string, cache: Dinero["cache"], r: { desde: string; hasta: string }, ant: { desde: string; hasta: string; nombre: string }): Cambio[] {
  const out: Cambio[] = [], k = resumenDelPeriodo(movs, r, ant, hoy)
  if (k.total > 0 || k.anterior > 0) {
    const delta = new Map<string, number>()
    for (const x of movs) { if (x.d >= r.desde && x.d <= r.hasta) delta.set(x.cliente, (delta.get(x.cliente) ?? 0) + x.usd); else if (x.d >= ant.desde && x.d <= ant.hasta) delta.set(x.cliente, (delta.get(x.cliente) ?? 0) - x.usd) }
    const [quien, cuanto] = [...delta.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0] ?? ["", 0]
    const sube = (k.variacion_pct ?? 0) >= 0
    out.push({ tipo: "mayor", numero: k.variacion_pct == null ? usdCorto(k.total) : `${sube ? "▲" : "▼"} ${Math.abs(k.variacion_pct)} %`, linea: k.variacion_pct == null ? "gastado en el período" : `${frenteA(ant.nombre)}${quien && Math.abs(cuanto) >= 0.01 ? ` · más movió ${quien}` : ""}`, texto: `${k.variacion_pct == null ? `En el período se gastaron ${usdCorto(k.total)}` : `El gasto ${sube ? "subió" : "bajó"} ${Math.abs(k.variacion_pct)} % ${frenteA(ant.nombre)} (${usdCorto(k.total)} contra ${usdCorto(k.anterior)})`}${quien && Math.abs(cuanto) >= 0.01 ? `; lo que más movió: ${quien} (${cuanto >= 0 ? "+" : "−"}${usdCorto(Math.abs(cuanto))})` : ""}.` })
  } else out.push({ tipo: "mayor", numero: usdCorto(0), linea: "sin gasto en ninguno de los dos períodos", texto: "Sin gasto registrado en este período ni en el anterior." })
  const p = picos(movs, hoy).find((x) => x.d >= r.desde && x.d <= r.hasta)
  out.push(p ? { tipo: "pico", numero: usdCorto(p.usd), linea: `${fechaCorta(p.d)} · ${veces(p.veces)} lo normal`, texto: `${fechaCorta(p.d)}: ${usdCorto(p.usd)} en un día, ${veces(p.veces)} tu día normal · ${p.explicacion}.`, corrida: p.corrida } : { tipo: "pico", numero: "Sin picos", linea: "ningún día salió de lo normal", texto: "Ningún día del período se salió de lo normal." })
  if (cache && cache.entrada + cache.leido > 0) { const pct = Math.round((cache.leido / (cache.entrada + cache.leido)) * 100); out.push({ tipo: "ahorro", numero: `${pct} %`, linea: "leído del caché, más barato", texto: `En el período, el ${pct} % de lo que leyeron los modelos salió del caché (más barato y sin bajar calidad).` }) }
  else out.push({ tipo: "ahorro", numero: "—", linea: "caché sin dato todavía", texto: "Uso del caché de los modelos: sin dato todavía." })
  return out
}

/** «frente a el mismo tramo…» → «frente al mismo tramo…» */
export const frenteA = (nombre: string): string => (nombre.startsWith("el ") ? `frente al ${nombre.slice(3)}` : `frente a ${nombre}`)
