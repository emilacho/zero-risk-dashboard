/**
 * EL PERIODO DEL PLAN · una sola fuente para fechas y días (CC6 · 03-nov · auditoría n.º 6, firma de Emilio 17:43Z).
 * Antes la cabecera decía las fechas de la CAMPAÑA (2 nov → 30 ene) mientras el PLAN escribía otras (2 de noviembre – 24 de enero); el título
 * decía «90 días» fijo y en otro lado salían 84. Ahora todo sale de aquí y del propio plan, en este orden:
 *   1. las fechas que escribe el documento del plan (su bajada: «2 de noviembre de 2026 – 24 de enero de 2027») → los días salen de ellas;
 *   2. si el documento no las escribe: el día 1 = el arranque de la campaña, y los días = hasta dónde llegan las fases de su estrategia
 *      o, sin fases, el horizonte que declara el plan;
 *   3. si nada de eso existe: lo que dura la campaña.
 * Sin días conocidos no se inventa un número: no hay periodo (el título dice «Plan» a secas).
 */
import type { PlanDelCliente } from "@/lib/plan-datos"
import { datosClave, seccionesDelPlan } from "@/lib/plan-documento"

const DIA_MS = 86_400_000
const fecha = (f: string) => new Date(`${f}T00:00:00Z`)
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
/** «2026-11-02» → «2 nov» */
export const diaCorto = (f: string) => { const d = fecha(f); return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}` }
const sumarDias = (f: string, n: number) => new Date(fecha(f).getTime() + n * DIA_MS).toISOString().slice(0, 10)
const diasEntre = (a: string, b: string) => Math.round((fecha(b).getTime() - fecha(a).getTime()) / DIA_MS) + 1
const esFecha = (f: unknown): f is string => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(fecha(f).getTime())
const iso = (a: number, m: number, d: number) => `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`

/**
 * «2 de noviembre de 2026 – 24 de enero de 2027» (o «2 nov – 24 ene 2027») → las dos fechas. Si al inicio le falta el año, se toma el del final
 * (un mes posterior al del final = el año anterior). Sin ningún año, o fechas imposibles, o el fin antes del inicio: null.
 */
export function fechasDelTexto(t: string | null | undefined): { desde: string; hasta: string } | null {
  if (!t) return null
  const re = /(\d{1,2})\s*(?:de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-záéíóú]*\.?(?:\s*(?:de|del)?\s*(\d{4}))?/gi
  const m = [...t.matchAll(re)].slice(0, 2)
  if (m.length < 2) return null
  const mes = (x: string) => { const k = x.toLowerCase().slice(0, 3); return k === "set" ? 8 : MESES.indexOf(k) }
  const [d1, m1, d2, m2] = [Number(m[0][1]), mes(m[0][2]), Number(m[1][1]), mes(m[1][2])]
  const a2 = m[1][3] ? Number(m[1][3]) : m[0][3] ? Number(m[0][3]) + (m2 < m1 ? 1 : 0) : NaN
  const a1 = m[0][3] ? Number(m[0][3]) : a2 - (m1 > m2 ? 1 : 0)
  if (!Number.isFinite(a1) || !Number.isFinite(a2)) return null
  const desde = iso(a1, m1, d1), hasta = iso(a2, m2, d2)
  const ok = (f: string, d: number) => esFecha(f) && fecha(f).getUTCDate() === d
  if (!ok(desde, d1) || !ok(hasta, d2) || hasta < desde) return null
  return { desde, hasta }
}

export interface PeriodoDelPlan {
  desde: string | null
  hasta: string | null
  dias: number
  /** de dónde salen: las fechas del documento, las fases de la estrategia, el horizonte del plan o lo que dura la campaña */
  fuente: "documento" | "fases" | "horizonte" | "campana"
}

export function periodoDelPlan(p: Pick<PlanDelCliente, "campana" | "estrategia" | "documento">): PeriodoDelPlan | null {
  // 1 · las fechas que escribe el plan
  const d = p.documento
  const delDoc = d?.prosa ? fechasDelTexto(datosClave(seccionesDelPlan(d.prosa)).find((x) => x.clave === "fechas")?.valor) : null
  if (delDoc) return { ...delDoc, dias: diasEntre(delDoc.desde, delDoc.hasta), fuente: "documento" }
  // 2 · el arranque de la campaña + lo que dura el plan (sus fases o su horizonte)
  const c = p.campana
  const desde = c && esFecha(c.desde) ? c.desde : null
  const fases = p.estrategia?.fases ?? []
  const finDeFases = fases.length ? Math.max(...fases.map((f) => Number(f.dia_hasta) || 0)) : 0
  const horizonte = Number(d?.plan?.horizonte_dias) || 0
  // 3 · lo que dura la campaña
  const deLaCampana = desde && c && esFecha(c.hasta) ? diasEntre(desde, c.hasta) : 0
  const [dias, fuente]: [number, PeriodoDelPlan["fuente"]] = finDeFases > 0 ? [finDeFases, "fases"] : horizonte > 0 ? [horizonte, "horizonte"] : [deLaCampana, "campana"]
  if (!(dias > 0)) return null
  return { desde, hasta: desde ? sumarDias(desde, dias - 1) : null, dias, fuente }
}

/** «2 nov → 24 ene · 84 días» (sin inicio: «84 días») */
export function textoDelPeriodo(x: PeriodoDelPlan): string {
  return x.desde && x.hasta ? `${diaCorto(x.desde)} → ${diaCorto(x.hasta)} · ${x.dias} días` : `${x.dias} días`
}

/** el título del panel: el número sale de las fechas reales; sin ellas, sin número */
export const tituloDelPlan = (x: PeriodoDelPlan | null): string => (x ? `Plan de ${x.dias} días` : "Plan")
