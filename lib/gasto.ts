/**
 * EL GASTO (CC#2 · 29-oct · ADENDA 4): lógica PURA de la pantalla «¿cuánto llevamos gastado?».
 * UNA sola cifra de verdad, la MISMA que usan los vigías (scripts/ops/vigia-prueba.mjs): lo que cobran los empleados AI (libro `agent_invocations.cost_usd`)
 * + lo que cobra Apify (detalle de llamadas de la libreta `costs`, `description.tipo = "llamada"`).
 * La libreta `costs` además trae filas «del día» (`tipo = "costo"`) que REPITEN lo que ya cuentan las llamadas: no se suman cuando ese día hay llamadas.
 * Antes del 5-sep (cuando nació el detalle de llamadas) solo existe la fila del día: ahí ES el dato del día.
 * Los días se cuentan en hora de Ecuador (UTC-5, sin horario de verano).
 */
import { usdES, usdFinoES } from "@/lib/lenguaje"

export const DIAS_DE_GASTO = 30
const DESFASE_ECUADOR_MS = 5 * 3_600_000

export const redondea = (n: number): number => Math.round(n * 1e6) / 1e6
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

/** el día (aaaa-mm-dd) en que cae un instante, contado en Ecuador */
export const diaEnEcuador = (iso: string | Date): string => new Date(new Date(iso).getTime() - DESFASE_ECUADOR_MS).toISOString().slice(0, 10)

/** los últimos `n` días terminando en `hoy` (el más viejo primero) */
export function ultimosDias(n: number, ahora: Date): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(diaEnEcuador(new Date(ahora.getTime() - i * 86_400_000)))
  return out
}

export type Proveedor = "Anthropic" | "OpenAI" | "Otros" | "Sin modelo"
export function proveedorDe(modelo: unknown): Proveedor {
  const m = String(modelo ?? "").toLowerCase().trim()
  if (!m) return "Sin modelo"
  if (m.startsWith("claude") || m.includes("anthropic")) return "Anthropic"
  if (m.startsWith("gpt") || m.startsWith("o1") || m.startsWith("o3") || m.includes("openai") || m.includes("dall")) return "OpenAI"
  return "Otros"
}

export interface Invocacion { created_at: string; cost_usd: number | string | null; model?: string | null; client_id?: string | null }
export interface FilaDeCostos { date: string; amount_usd: number | string | null; amount_usd_exact?: number | string | null; description?: unknown }

const tipoDe = (d: unknown): string => {
  try { const j = typeof d === "string" ? JSON.parse(d) : d; return j && typeof j === "object" ? String((j as Record<string, unknown>).tipo ?? "") : "" } catch { return "" }
}
const clienteDe = (d: unknown): string | null => {
  try { const j = typeof d === "string" ? JSON.parse(d) : d; const c = j && typeof j === "object" ? (j as Record<string, unknown>).client_id : null; return typeof c === "string" && c ? c : null } catch { return null }
}
const importe = (f: FilaDeCostos): number => num(f.amount_usd_exact ?? f.amount_usd)

/** lo de Apify por día: las llamadas si ese día las hay; si no, la fila del día (aaaa-mm-dd → US$) */
export function apifyPorDia(costos: FilaDeCostos[]): Record<string, number> {
  const llamadas: Record<string, number> = {}
  const delDia: Record<string, number> = {}
  for (const f of costos) {
    const dia = String(f.date ?? "").slice(0, 10)
    if (!dia) continue
    const t = tipoDe(f.description)
    if (t === "llamada") llamadas[dia] = (llamadas[dia] ?? 0) + importe(f)
    else if (t === "costo") delDia[dia] = (delDia[dia] ?? 0) + importe(f)
  }
  const out: Record<string, number> = {}
  for (const d of new Set([...Object.keys(llamadas), ...Object.keys(delDia)])) out[d] = redondea(d in llamadas ? llamadas[d] : delDia[d])
  return out
}

export interface DiaDeGasto { dia: string; agentes: number; apify: number; total: number }
export interface Reparto { clave: string; nombre: string; total: number; llamadas: number }
export interface PiezaConGasto { client_id?: string | null; cliente?: string | null; hitl_queue_id?: string | null; id: string; brief_id: string; familia: string; version: number; estado: string; gasto_usd: number; tope_usd: number; dry_run: boolean; creado_en: string }

export interface ResumenDeGasto {
  hoy: DiaDeGasto
  mes: { etiqueta: string; agentes: number; apify: number; total: number }
  ultimos: { dias: DiaDeGasto[]; agentes: number; apify: number; total: number; promedio_por_dia: number }
  por_cliente: Reparto[]
  por_proveedor: Reparto[]
  apify_sin_cliente_usd: number
  piezas: PiezaConGasto[]
  sin_cliente_agentes_usd: number
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

export function resumirGasto(p: { invocaciones: Invocacion[]; costos: FilaDeCostos[]; clientes: Record<string, string>; piezas: PiezaConGasto[]; ahora: Date }): ResumenDeGasto {
  const { ahora } = p
  const dias = ultimosDias(DIAS_DE_GASTO, ahora)
  const hoyDia = dias[dias.length - 1]
  const mesPrefijo = hoyDia.slice(0, 7)
  const agentesPorDia: Record<string, number> = {}
  const porCliente: Record<string, { total: number; llamadas: number }> = {}
  const porProveedor: Record<string, { total: number; llamadas: number }> = {}
  let sinCliente = 0
  for (const i of p.invocaciones) {
    const c = num(i.cost_usd)
    const dia = diaEnEcuador(i.created_at)
    agentesPorDia[dia] = (agentesPorDia[dia] ?? 0) + c
    if (dias.includes(dia)) {
      const k = i.client_id ?? ""
      if (!k) sinCliente += c
      porCliente[k] = { total: (porCliente[k]?.total ?? 0) + c, llamadas: (porCliente[k]?.llamadas ?? 0) + 1 }
      const pv = proveedorDe(i.model)
      porProveedor[pv] = { total: (porProveedor[pv]?.total ?? 0) + c, llamadas: (porProveedor[pv]?.llamadas ?? 0) + 1 }
    }
  }
  const apify = apifyPorDia(p.costos)
  // Apify por cliente: solo las llamadas traen cliente
  let apifySinCliente = 0
  for (const f of p.costos) {
    if (tipoDe(f.description) !== "llamada") continue
    const dia = String(f.date ?? "").slice(0, 10)
    if (!dias.includes(dia)) continue
    const k = clienteDe(f.description) ?? ""
    if (!k) apifySinCliente += importe(f)
    porCliente[k] = { total: (porCliente[k]?.total ?? 0) + importe(f), llamadas: (porCliente[k]?.llamadas ?? 0) + 1 }
  }
  const apifyTotal30 = dias.reduce((s, d) => s + (apify[d] ?? 0), 0)
  if (apifyTotal30 > 0) porProveedor["Apify"] = { total: apifyTotal30, llamadas: p.costos.filter((f) => tipoDe(f.description) === "llamada" && dias.includes(String(f.date).slice(0, 10))).length }

  const fila = (dia: string): DiaDeGasto => { const a = redondea(agentesPorDia[dia] ?? 0), x = redondea(apify[dia] ?? 0); return { dia, agentes: a, apify: x, total: redondea(a + x) } }
  const serie = dias.map(fila)
  const delMes = [...new Set([...Object.keys(agentesPorDia), ...Object.keys(apify)])].filter((d) => d.startsWith(mesPrefijo))
  const mA = redondea(delMes.reduce((s, d) => s + (agentesPorDia[d] ?? 0), 0))
  const mX = redondea(delMes.reduce((s, d) => s + (apify[d] ?? 0), 0))
  const tA = redondea(serie.reduce((s, d) => s + d.agentes, 0)), tX = redondea(serie.reduce((s, d) => s + d.apify, 0))
  const nombre = (k: string) => (k ? p.clientes[k] ?? `cliente ${k.slice(0, 8)}` : "Sin cliente (gasto de la agencia)")
  const reparto = (m: Record<string, { total: number; llamadas: number }>, nom: (k: string) => string): Reparto[] =>
    Object.entries(m).map(([clave, v]) => ({ clave, nombre: nom(clave), total: redondea(v.total), llamadas: v.llamadas })).sort((a, b) => b.total - a.total)
  return {
    hoy: fila(hoyDia),
    mes: { etiqueta: `${MESES[Number(mesPrefijo.slice(5, 7)) - 1]} ${mesPrefijo.slice(0, 4)}`, agentes: mA, apify: mX, total: redondea(mA + mX) },
    ultimos: { dias: serie, agentes: tA, apify: tX, total: redondea(tA + tX), promedio_por_dia: redondea((tA + tX) / DIAS_DE_GASTO) },
    por_cliente: reparto(porCliente, nombre),
    por_proveedor: reparto(porProveedor, (k) => k),
    apify_sin_cliente_usd: redondea(apifySinCliente),
    sin_cliente_agentes_usd: redondea(sinCliente),
    piezas: p.piezas,
  }
}

export const usd2 = (n: number): string => usdES(n)
/** el costo de una pieza se ve con 2 decimales, pero lo muy pequeño no se redondea a cero */
export const usdFino = (n: number): string => usdFinoES(n)
