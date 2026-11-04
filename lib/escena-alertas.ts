/**
 * LA ANTENA AVISA LAS ALERTAS DEL DEPARTAMENTO (CC4 · 04-nov · encargo de Lenovo, Emilio 14:05Z «sí a todo»; decisiones A/B/C de Lenovo 14:20Z).
 * Lógica PURA y de solo lectura: de las filas que ya existen decide qué alertas hay HOY. Sin dato no se dibuja; ninguna alerta se cierra a mano:
 * cada una desaparece sola cuando su causa deja de ser verdad (una corrida posterior salió bien, llegó la respuesta, pasó la ventana).
 * Las cinco: 1 corrida fallida · 2 algo colgado · 3 gasto raro · 4 el cerebro no corrió · 5 pregunta sin responder.
 * Alta / manual / pedido fallidos: se suman cuando CC1/CC2 digan dónde guardan su estado (hoy solo el plan tiene estado de corrida leíble).
 */
import { usdES } from "@/lib/lenguaje"
import type { PanelDelMarco } from "@/lib/buscador"

export type TipoDeAlerta = "fallida" | "colgada" | "gasto" | "cerebro" | "pregunta"
export interface AlertaDeLaAntena { clave: string; tipo: TipoDeAlerta; /** la frase, en palabras simples */ texto: string; /** cuándo pasó (ISO), para poner la más reciente arriba */ cuando: string; /** el lugar donde se resuelve, si existe */ abre: PanelDelMarco | null }

/** las preguntas más viejas que esto no avisan (decisión C) */
export const DIAS_DE_UNA_PREGUNTA = 7
/** corrida fallida: se mira hasta esta antigüedad (si siguió una buena, ya no avisa) */
export const DIAS_DE_UNA_FALLA = 7
/** gasto raro (decisión A): más de 3 veces la mediana de su tipo Y por encima de este monto; se mira el último día */
export const VECES_LA_MEDIANA = 3
export const PISO_DE_GASTO_USD = 1
export const MUESTRA_MINIMA_DE_GASTO = 5
export const HORAS_DEL_GASTO = 24
export const MAXIMO_DE_ALERTAS = 6
const HORAS_SIN_AVANZAR = 3

export interface FilaDePlan { id: string; client_id: string | null; estado: string | null; creado_en: string | null; actualizado_en: string | null; vence_en: string | null; motivo: string | null; dry_run: boolean | null }
export interface FilaDeCerebroDiario { client_id: string | null; dia: string | null; estado: string | null; prueba: boolean | null }
export interface FilaDeAlarmaDelCerebro { clave: string; ultima_en: string | null }
export interface FilaDePregunta { id: string; client_id: string | null; pregunta: string | null; estado: string | null; creado_en: string | null }
export interface CorridaConGasto { ejecucion: string; flujo: string | null; client_id: string | null; costo: number; inicio: string }
export interface EntradaDeAlertas { cliente: string | null; ahora: Date; plan: FilaDePlan[]; cerebroDiario: FilaDeCerebroDiario[]; alarmasDelCerebro: FilaDeAlarmaDelCerebro[]; preguntas: FilaDePregunta[]; corridas: CorridaConGasto[] }

const ms = (iso: string | null | undefined) => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? t : null }
const DIA = 86_400_000
/** hora de Ecuador (UTC-5, sin cambio de hora) como «HH:MM» */
export const horaEC = (iso: string): string => { const t = ms(iso); if (t == null) return "sin hora"; const d = new Date(t - 5 * 3_600_000); return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}` }
const diaEC = (t: number): string => new Date(t - 5 * 3_600_000).toISOString().slice(0, 10)
const mediana = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }
const delCliente = (c: string | null, cliente: string | null) => !cliente || !c || c === cliente

/** el porqué en palabras simples: nunca el texto técnico del motivo */
const porQue = (motivo: string | null): string => (/redactor/i.test(motivo ?? "") ? " esperando al redactor" : /plazo|vence|sin cierre/i.test(motivo ?? "") ? " por pasarse del plazo" : "")

/** 1 · corrida fallida (plan): se apaga sola cuando una corrida POSTERIOR del mismo cliente quedó «hecha» */
export function fallidas(e: EntradaDeAlertas): AlertaDeLaAntena[] {
  const t = e.ahora.getTime()
  const reales = e.plan.filter((p) => p.dry_run !== true && delCliente(p.client_id, e.cliente))
  return reales.filter((p) => p.estado === "fallida").flatMap((p): AlertaDeLaAntena[] => {
    const cuando = p.actualizado_en ?? p.creado_en, tc = ms(cuando), ini = ms(p.creado_en)
    if (tc == null || ini == null || t - tc > DIAS_DE_UNA_FALLA * DIA) return []
    if (reales.some((q) => q.estado === "hecha" && q.client_id === p.client_id && (ms(q.creado_en) ?? 0) > ini)) return []
    return [{ clave: `fallida:${p.id}`, tipo: "fallida", texto: `El plan falló a las ${horaEC(cuando!)}${porQue(p.motivo)}`, cuando: cuando!, abre: "envivo" }]
  })
}

/** 2 · algo colgado: sigue «corriendo» y ya pasó su plazo (o no se movió en HORAS_SIN_AVANZAR horas si no tiene plazo) */
export function colgadas(e: EntradaDeAlertas): AlertaDeLaAntena[] {
  const t = e.ahora.getTime()
  return e.plan.filter((p) => p.dry_run !== true && delCliente(p.client_id, e.cliente) && p.estado !== "hecha" && p.estado !== "fallida").flatMap((p): AlertaDeLaAntena[] => {
    const vence = ms(p.vence_en), mov = ms(p.actualizado_en ?? p.creado_en)
    const pasado = vence != null ? vence < t : mov != null && t - mov > HORAS_SIN_AVANZAR * 3_600_000
    if (!pasado) return []
    const cuando = (vence != null ? p.vence_en : p.actualizado_en ?? p.creado_en)!
    return [{ clave: `colgada:${p.id}`, tipo: "colgada", texto: `El plan sigue en marcha desde las ${horaEC(p.creado_en ?? cuando)} y ya pasó su tiempo normal`, cuando, abre: "envivo" }]
  })
}

/** 3 · gasto raro: la corrida del último día que costó más de 3 veces la mediana de su tipo (con muestra suficiente) y más de US$ 1 */
export function gastosRaros(e: EntradaDeAlertas): AlertaDeLaAntena[] {
  const t = e.ahora.getTime()
  const propias = e.corridas.filter((c) => delCliente(c.client_id, e.cliente))
  return propias.filter((c) => { const i = ms(c.inicio); return i != null && t - i <= HORAS_DEL_GASTO * 3_600_000 }).flatMap((c): AlertaDeLaAntena[] => {
    // algunas llamadas guardan como «flujo» el id de la propia ejecución: ese tipo tendría 1 corrida y nunca avisaría; sin tipo fiable se compara con el conjunto entero
    const conTipo = !!c.flujo && c.flujo !== c.ejecucion
    const hermanas = (conTipo ? e.corridas.filter((x) => x.flujo === c.flujo) : e.corridas).map((x) => x.costo)
    if (hermanas.length < MUESTRA_MINIMA_DE_GASTO) return []
    const normal = mediana(hermanas)
    if (!(c.costo > VECES_LA_MEDIANA * normal && c.costo > PISO_DE_GASTO_USD)) return []
    return [{ clave: `gasto:${c.ejecucion}`, tipo: "gasto", texto: `Una corrida costó ${usdES(c.costo)}, más de ${VECES_LA_MEDIANA} veces lo normal de su tipo (${usdES(normal)})`, cuando: c.inicio, abre: "dinero" }]
  })
}

/** 4 · el cerebro no corrió (decisión B): solo avisa si YA corrió alguna vez y falta el día de ayer o el último quedó mal; más sus alarmas abiertas. Sin historial no dice nada */
export function cerebroNoCorrio(e: EntradaDeAlertas): AlertaDeLaAntena[] {
  const t = e.ahora.getTime(), out: AlertaDeLaAntena[] = []
  const reales = e.cerebroDiario.filter((c) => c.prueba !== true && delCliente(c.client_id, e.cliente) && c.dia)
  if (reales.length) {
    const ultimo = reales.map((c) => c.dia!).sort().at(-1)!, filaUltima = reales.filter((c) => c.dia === ultimo)
    const ayer = diaEC(t - DIA)
    if (ultimo < ayer) out.push({ clave: "cerebro:sin-corrida", tipo: "cerebro", texto: `El cerebro no hizo su corrida diaria desde el ${ultimo.split("-").reverse().slice(0, 2).join("/")}`, cuando: `${ultimo}T12:00:00Z`, abre: "observabilidad" })
    else if (filaUltima.every((c) => /fall|error|cort/i.test(c.estado ?? ""))) out.push({ clave: "cerebro:fallo", tipo: "cerebro", texto: "La última corrida diaria del cerebro salió mal", cuando: `${ultimo}T12:00:00Z`, abre: "observabilidad" })
  }
  for (const a of e.alarmasDelCerebro) out.push({ clave: `cerebro:alarma:${a.clave}`, tipo: "cerebro", texto: "El cerebro tiene una alarma abierta", cuando: a.ultima_en ?? e.ahora.toISOString(), abre: "observabilidad" })
  return out
}

/** 5 · pregunta sin responder (decisión C): solo las de los últimos 7 días */
export function preguntasSinResponder(e: EntradaDeAlertas): AlertaDeLaAntena[] {
  const t = e.ahora.getTime()
  return e.preguntas.filter((p) => p.estado === "pendiente" && delCliente(p.client_id, e.cliente)).flatMap((p): AlertaDeLaAntena[] => {
    const c = ms(p.creado_en)
    if (c == null || t - c > DIAS_DE_UNA_PREGUNTA * DIA) return []
    const q = String(p.pregunta ?? "").replace(/\s+/g, " ").trim()
    return [{ clave: `pregunta:${p.id}`, tipo: "pregunta", texto: q ? `Te preguntaron algo y sigue sin respuesta: ${q.length > 90 ? `${q.slice(0, 89).replace(/\s+\S*$/, "")}…` : q}` : "Te preguntaron algo y sigue sin respuesta", cuando: p.creado_en!, abre: "decisiones" }]
  })
}

/** todas las alertas de hoy, la más reciente arriba; sin ninguna, la antena queda apagada */
export function armarAlertas(e: EntradaDeAlertas): AlertaDeLaAntena[] {
  return [...fallidas(e), ...colgadas(e), ...gastosRaros(e), ...cerebroNoCorrio(e), ...preguntasSinResponder(e)]
    .sort((a, b) => (ms(b.cuando) ?? 0) - (ms(a.cuando) ?? 0)).slice(0, MAXIMO_DE_ALERTAS)
}

/** dónde está la antena en la foto de 2560 px (la parabólica de la plataforma de arriba a la izquierda) */
/** el borde de la plataforma de la antena (frente), recorrido en sentido del reloj: de la derecha, por abajo, a la izquierda; la luz corre por aquí */
export const BORDE_DE_LA_ANTENA = "M643 470 L443 563 L282 472"
export const ANTENA = { plato: { x: 464, y: 316, rx: 66, ry: 56, giro: -28 }, punta1: { x: 366, y: 344 }, punta2: { x: 508, y: 256 }, rotulo: { x: 600, y: 300 } } as const
