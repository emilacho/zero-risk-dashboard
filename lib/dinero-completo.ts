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
}
export interface Dinero {
  movimientos: Movimiento[]
  saldos: Saldo[]
  topes: Tope[]
  cache: { leido: number; entrada: number } | null
  desde: string
  leido_en: string
  /** lo que no se pudo leer (se muestra «sin dato todavía», nunca un cero inventado) */
  faltan: string[]
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

export interface Tarjetas { hoy: number; normal: number; semana: number; semana_anterior: number; variacion_pct: number | null; mes: number; dias_del_mes: number; dia_del_mes: number; proyeccion: number; mes_anterior: number }
export function tarjetas(movs: Movimiento[], hoy: string): Tarjetas {
  const t = totalesPorDia(movs)
  const rango = (a: string, b: string) => [...t.entries()].filter(([d]) => d >= a && d <= b).reduce((s, [, v]) => s + v, 0)
  const semana = rango(sumarDias(hoy, -6), hoy), anterior = rango(sumarDias(hoy, -13), sumarDias(hoy, -7))
  const inicio = `${hoy.slice(0, 8)}01`
  const dia = Number(hoy.slice(8, 10))
  const [y, mo] = hoy.slice(0, 7).split("-").map(Number)
  const diasDelMes = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const mes = rango(inicio, hoy)
  const iniAnt = sumarDias(inicio, -1).slice(0, 8) + "01"
  return {
    hoy: r2(t.get(hoy) ?? 0), normal: diaNormal(movs, hoy), semana: r2(semana), semana_anterior: r2(anterior),
    variacion_pct: anterior > 0 ? Math.round(((semana - anterior) / anterior) * 100) : null,
    mes: r2(mes), dias_del_mes: diasDelMes, dia_del_mes: dia, proyeccion: r2(dia > 0 ? (mes / dia) * diasDelMes : 0), mes_anterior: r2(rango(iniAnt, sumarDias(inicio, -1))),
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
export interface FilaDeDesglose { clave: string; nombre: string; usd: number; pct: number; anterior: number; variacion_pct: number | null; llamadas: number; client_id?: string | null; dia?: string; detalle?: string; corrida?: string | null }
/** el desglose de Ramp (cliente · equipo · empleado · modelo · proveedor · corrida) en un período, comparado con el período anterior del mismo largo */
export function desglose(movs: Movimiento[], vista: Vista, o: { desde: string; hasta: string }): FilaDeDesglose[] {
  const largo = diasEntre(o.desde, o.hasta).length
  const antDesde = sumarDias(o.desde, -largo), antHasta = sumarDias(o.desde, -1)
  const clave = (x: Movimiento): string | null => vista === "corrida" ? x.corrida : vista === "equipo" ? (x.equipo ?? "Sin dato") : vista === "cliente" ? (x.client_id ?? "sin-cliente") : x[vista]
  const ahora = new Map<string, Movimiento[]>(), antes = new Map<string, number>()
  for (const x of movs) {
    const k = clave(x); if (!k) continue
    if (x.d >= o.desde && x.d <= o.hasta) ahora.set(k, [...(ahora.get(k) ?? []), x])
    else if (x.d >= antDesde && x.d <= antHasta) antes.set(k, (antes.get(k) ?? 0) + x.usd)
  }
  const total = [...ahora.values()].reduce((s, xs) => s + suma(xs), 0)
  const filas = [...ahora.entries()].map(([k, xs]): FilaDeDesglose => {
    const usd = r2(suma(xs)), ant = r2(antes.get(k) ?? 0)
    const base: FilaDeDesglose = { clave: k, nombre: vista === "cliente" ? xs[0].cliente : k, usd, pct: total > 0 ? Math.round((suma(xs) / total) * 1000) / 10 : 0, anterior: ant, variacion_pct: ant > 0 ? Math.round(((usd - ant) / ant) * 100) : null, llamadas: xs.length, client_id: vista === "cliente" ? xs[0].client_id : undefined }
    if (vista === "corrida") { const c = xs.find((x) => x.client_id)?.cliente; return { ...base, nombre: [...new Set(xs.map((x) => x.empleado))].slice(0, 3).join(" · "), dia: xs[0].d, detalle: c ?? "Sin cliente", corrida: k } }
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

export interface Cambio { tipo: "mayor" | "pico" | "ahorro"; texto: string; corrida?: string | null }
/** «Lo que cambió esta semana» (como el resumen semanal de Ramp): el mayor cambio, el pico inusual y dónde ahorrar, en lenguaje claro */
export function loQueCambio(movs: Movimiento[], hoy: string, cache: Dinero["cache"]): Cambio[] {
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
  const [inv, costos, clientes, agentes, rollup] = await Promise.all([
    todas((a, b) => db.from("agent_invocations").select("agent_name, model, client_id, cost_usd, created_at, started_at, workflow_execution_id, status, metadata->cost_is_upper_bound").gte("created_at", desde).order("created_at", { ascending: true }).range(a, b), "agent_invocations"),
    todas((a, b) => db.from("costs").select("service, amount_usd, amount_usd_exact, date, description").gte("date", desde.slice(0, 10)).order("date", { ascending: true }).range(a, b), "costs").catch(() => { faltan.push("Gasto de Apify (libreta de costos)"); return [] as Fila[] }),
    todas((a, b) => db.from("clients").select("id, name").range(a, b), "clients"),
    todas((a, b) => db.from("agents").select("name, display_name").range(a, b), "agents"),
    todas((a, b) => db.from("agent_invocations_daily_rollup").select("day, total_tokens_input, total_tokens_cache_read").gte("day", new Date(ahora.getTime() - 30 * 86400_000).toISOString().slice(0, 10)).range(a, b), "rollup").catch(() => null),
  ])
  // 6.37 · el equipo de cada empleado sale del organigrama vivo (si no se puede leer, el desglose por equipo lo dice)
  const org = await leerOrganizacion(db, { ahora }).catch(() => { faltan.push("Departamento y equipo de cada empleado (no se pudo leer la organización)"); return null })
  const equipoDe = (slug: string): string => {
    const p = org?.personas[slug]; if (!p) return "Sin equipo asignado"
    const d = org!.departamentos.find((x) => x.clave === p.departamento)
    const e = d?.equipos.find((x) => x.clave === p.equipo)
    return p.departamento === "direccion_general" ? "Dirección general" : `${d?.nombre ?? "Sin departamento"}${e && e.clave !== "todos" ? ` · ${e.nombre}` : ""}`
  }
  const nombreCliente = new Map(clientes.map((c) => [String(c.id), String(c.name)]))
  const nombreAgente = new Map(agentes.map((a) => [String(a.name), txt(a.display_name)]))
  const movimientos: Movimiento[] = []
  for (const x of inv) {
    const usd = Number(x.cost_usd ?? 0); if (!(usd > 0)) continue
    const t = String(x.started_at ?? x.created_at), cid = txt(x.client_id), emp = String(x.agent_name ?? "sin empleado")
    movimientos.push({ t, d: diaLocal(t), proveedor: proveedorDelModelo(txt(x.model)), modelo: txt(x.model) ?? "sin modelo", empleado: nombreAgente.get(emp) ?? legible(emp), equipo: org ? equipoDe(emp) : undefined, cliente: cid ? nombreCliente.get(cid) ?? "Cliente sin ficha" : "Sin cliente", client_id: cid, corrida: txt(x.workflow_execution_id), usd, ok: !/error|fail|timeout|cancel/i.test(String(x.status ?? "")), cota: x.cost_is_upper_bound === true || x.cost_is_upper_bound === "true" })
  }
  for (const c of costos) {
    const usd = Number(c.amount_usd_exact ?? c.amount_usd ?? 0); if (!(usd > 0)) continue
    const servicio = String(c.service ?? "")
    if (!servicio.toLowerCase().startsWith("apify")) continue
    const funcion = servicio.includes(":") ? servicio.split(":").slice(1).join(":") : "conciliación del día"
    const d = String(c.date).slice(0, 10)
    movimientos.push({ t: `${d}T17:00:00.000Z`, d, proveedor: "Apify", modelo: `Apify · ${funcion}`, empleado: "Apify (raspados)", equipo: "Proveedor externo · Apify", cliente: "Sin cliente", client_id: null, corrida: null, usd, ok: true, cota: false })
  }
  movimientos.sort((a, b) => a.t.localeCompare(b.t))
  const cache: Dinero["cache"] = rollup ? rollup.reduce<{ leido: number; entrada: number }>((s, r) => ({ leido: s.leido + Number(r.total_tokens_cache_read ?? 0), entrada: s.entrada + Number(r.total_tokens_input ?? 0) }), { leido: 0, entrada: 0 }) : null
  if (!rollup) faltan.push("Uso del caché de los modelos")
  return { movimientos, saldos: extra.saldos ?? [], topes: extra.topes ?? [], cache, desde, leido_en: ahora.toISOString(), faltan }
}
