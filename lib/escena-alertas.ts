/**
 * LA ANTENA AVISA LAS ALERTAS DEL DEPARTAMENTO (CC4 · 04-nov · encargo de Lenovo, Emilio 14:05Z «sí a todo»; decisiones A/B/C de Lenovo 14:20Z).
 * Lógica PURA y de solo lectura: de las filas que ya existen decide qué alertas hay HOY. Sin dato no se dibuja; ninguna alerta se cierra a mano:
 * cada una desaparece sola cuando su causa deja de ser verdad (una corrida posterior salió bien, llegó la respuesta, pasó la ventana).
 * Las que se ven: corrida fallida · algo colgado · el cerebro no corrió · pregunta sin responder · decisión de la campaña que espera tu aprobación (10-nov).
 * Gasto raro está apagado (Emilio 05-nov 00:13Z): las alertas de dinero no van en el Dpto. Marketing. La lógica queda lista para moverla a Tu oficina › Dinero si la pide.
 * Alta / manual / pedido fallidos: se suman cuando CC1/CC2 digan dónde guardan su estado (hoy solo el plan tiene estado de corrida leíble).
 * 09-nov 21:44Z (CORRECCIÓN de Lenovo · Emilio: «La antena es para los mensajes que corresponden a Dept. Marketing»): cada aviso lleva el
 * DEPARTAMENTO que sale de su dato y la antena muestra y cuenta solo los de marketing. Lo del cerebro, el portero, Apify, finanzas o toda la
 * empresa va solo a Riesgos. Un aviso sin departamento no entra (se anota para Lenovo).
 */
import { usdES } from "@/lib/lenguaje"
import type { PanelDelMarco } from "@/lib/buscador"

export type TipoDeAlerta = "fallida" | "colgada" | "gasto" | "cerebro" | "pregunta" | "decision"
/**
 * 09-nov (CORRECCIÓN de Lenovo): cada aviso abre LA PANTALLA DE DONDE SALIÓ, y si no tiene pantalla propia no lleva a ningún lado.
 * La alarma del cerebro (`cerebro_alertas`) vive en Riesgos (la plataforma la lee como «Portero del cerebro»). La corrida diaria del cerebro
 * (`cerebro_diario_corridas`) no se ve en ninguna pantalla: su aviso queda sin destino (anotado para Lenovo). Antes las tres iban a Observabilidad, que no las muestra.
 */
export const DESTINO_DEL_AVISO = {
  fallida: "envivo", colgada: "envivo", gasto: "dinero", cerebro_alarma: "riesgos", cerebro_diario: null, pregunta: "decisiones", decision: "decisiones",
} as const satisfies Record<string, PanelDelMarco | null>

export interface AlertaDeLaAntena { clave: string; tipo: TipoDeAlerta; /** la frase, en palabras simples */ texto: string; /** cuándo pasó (ISO), para poner la más reciente arriba */ cuando: string; /** el lugar donde se resuelve, si existe */ abre: PanelDelMarco | null; /** de qué departamento sale (`departments.name`), según su dato; null = el dato no lo dice */ departamento: string | null /** 10-nov (#310 ajuste 2 · Lenovo 23:46Z) · solo las decisiones: su alerta para «✓ Revisar» (la clave que arma la plataforma y su estado) */
  revisar?: AlertaRevisable
  /** 10-nov · el nombre del cliente, si la fila lo trae (boceto aprobado: «Náufrago · hace 5 min · abre Decisiones») */
  cliente?: string }
/** la alerta de una decisión (CC1 #965): «nueva», «revisada» o null (la libreta no se pudo leer) */
export interface AlertaRevisable { clave: string; estado: "nueva" | "revisada" | null; revisada_en?: string }
/**
 * 10-nov (Lenovo 23:46Z · boceto `APROBADO-alertas-un-solo-camino.png`, panel 3): la antena cuenta SOLO las Nuevas.
 * Revisada = la plataforma lo dice o la marcaste en esta visita (`aqui`). Los demás avisos (plan fallido, colgado…) no se revisan: siempre cuentan.
 * Sin dato de la libreta (estado null) cuenta como Nueva, igual que el panel de Decisiones (CC4 `esRevisada`): mejor avisar de más que callar.
 */
export const esNuevaEnLaAntena = (a: Pick<AlertaDeLaAntena, "revisar">, aqui: Record<string, string> = {}): boolean =>
  !a.revisar || (a.revisar.estado !== "revisada" && !aqui[a.revisar.clave])
export const nuevasDeLaAntena = (alertas: AlertaDeLaAntena[] | undefined, aqui: Record<string, string> = {}): AlertaDeLaAntena[] => (alertas ?? []).filter((a) => esNuevaEnLaAntena(a, aqui))

/** la antena es del Dept. Marketing: solo entran los avisos cuyo dato dice este departamento (`departments.name`) */
export const DEPARTAMENTO_DE_LA_ANTENA = "marketing"
/**
 * El departamento de cada fuente, SEGÚN SU DATO:
 * · `plan_corridas` ES el Plan de Marketing (la tabla entera es del departamento; no tiene columna propia) → marketing.
 * · `dueno_preguntas` trae su `oficina` (hoy todas «financiera») → ese valor.
 * · `cerebro_alertas` y `cerebro_diario_corridas` (cerebro, portero, Apify) no traen departamento → null: no entran (van a Riesgos).
 * · el gasto (`agent_invocations`) es dinero de toda la empresa → null.
 */
export const DEPARTAMENTO_DEL_PLAN = "marketing"
const departamentoDe = (v: string | null | undefined): string | null => { const d = String(v ?? "").trim().toLowerCase(); return d || null }
/** el filtro de la antena: solo lo del departamento (nunca por tipo de aviso) */
export const delDepartamento = (a: AlertaDeLaAntena): boolean => a.departamento === DEPARTAMENTO_DE_LA_ANTENA
/** tipos de aviso que hoy llegan sin departamento (para la nota a Lenovo); no entran a la antena */
export const sinDepartamento = (alertas: AlertaDeLaAntena[]): TipoDeAlerta[] => [...new Set(alertas.filter((a) => a.departamento == null).map((a) => a.tipo))]

/** las preguntas más viejas que esto no avisan (decisión C) */
export const DIAS_DE_UNA_PREGUNTA = 7
/** corrida fallida: se mira hasta esta antigüedad (si siguió una buena, ya no avisa) */
export const DIAS_DE_UNA_FALLA = 7
/** gasto raro (decisión A): más de 3 veces la mediana de su tipo Y por encima de este monto; se mira el último día */
export const VECES_LA_MEDIANA = 3
export const PISO_DE_GASTO_USD = 1
export const MUESTRA_MINIMA_DE_GASTO = 5
export const HORAS_DEL_GASTO = 24
/** apagado por Emilio 05-nov: la antena del Dpto. Marketing no avisa de dinero */
export const GASTO_RARO_EN_LA_ANTENA = false
export const MAXIMO_DE_ALERTAS = 6
const HORAS_SIN_AVANZAR = 3

export interface FilaDePlan { id: string; client_id: string | null; estado: string | null; creado_en: string | null; actualizado_en: string | null; vence_en: string | null; motivo: string | null; dry_run: boolean | null }
export interface FilaDeCerebroDiario { client_id: string | null; dia: string | null; estado: string | null; prueba: boolean | null }
export interface FilaDeAlarmaDelCerebro { clave: string; ultima_en: string | null }
export interface FilaDePregunta { id: string; client_id: string | null; pregunta: string | null; estado: string | null; creado_en: string | null; /** la oficina que pregunta (`dueno_preguntas.oficina`): su departamento */ oficina: string | null }
export interface CorridaConGasto { ejecucion: string; flujo: string | null; client_id: string | null; costo: number; inicio: string }
export interface EntradaDeAlertas { cliente: string | null; ahora: Date; plan: FilaDePlan[]; cerebroDiario: FilaDeCerebroDiario[]; alarmasDelCerebro: FilaDeAlarmaDelCerebro[]; preguntas: FilaDePregunta[]; corridas: CorridaConGasto[]; /** 10-nov · lo que espera tu aprobación (lista de la plataforma) */ decisiones?: DecisionPendiente[] }

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
    return [{ clave: `fallida:${p.id}`, tipo: "fallida", texto: `El plan falló a las ${horaEC(cuando!)}${porQue(p.motivo)}`, cuando: cuando!, abre: DESTINO_DEL_AVISO.fallida, departamento: DEPARTAMENTO_DEL_PLAN }]
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
    return [{ clave: `colgada:${p.id}`, tipo: "colgada", texto: `El plan sigue en marcha desde las ${horaEC(p.creado_en ?? cuando)} y ya pasó su tiempo normal`, cuando, abre: DESTINO_DEL_AVISO.colgada, departamento: DEPARTAMENTO_DEL_PLAN }]
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
    return [{ clave: `gasto:${c.ejecucion}`, tipo: "gasto", texto: `Una corrida costó ${usdES(c.costo)}, más de ${VECES_LA_MEDIANA} veces lo normal de su tipo (${usdES(normal)})`, cuando: c.inicio, abre: DESTINO_DEL_AVISO.gasto, departamento: null }]
  })
}

/** 4 · el cerebro no corrió (decisión B): solo avisa si YA corrió alguna vez y falta el día de ayer o el último quedó mal; más sus alarmas abiertas. Sin historial no dice nada */
export function cerebroNoCorrio(e: EntradaDeAlertas): AlertaDeLaAntena[] {
  const t = e.ahora.getTime(), out: AlertaDeLaAntena[] = []
  const reales = e.cerebroDiario.filter((c) => c.prueba !== true && delCliente(c.client_id, e.cliente) && c.dia)
  if (reales.length) {
    const ultimo = reales.map((c) => c.dia!).sort().at(-1)!, filaUltima = reales.filter((c) => c.dia === ultimo)
    const ayer = diaEC(t - DIA)
    if (ultimo < ayer) out.push({ clave: "cerebro:sin-corrida", tipo: "cerebro", texto: `El cerebro no hizo su corrida diaria desde el ${ultimo.split("-").reverse().slice(0, 2).join("/")}`, cuando: `${ultimo}T12:00:00Z`, abre: DESTINO_DEL_AVISO.cerebro_diario, departamento: null })
    else if (filaUltima.every((c) => /fall|error|cort/i.test(c.estado ?? ""))) out.push({ clave: "cerebro:fallo", tipo: "cerebro", texto: "La última corrida diaria del cerebro salió mal", cuando: `${ultimo}T12:00:00Z`, abre: DESTINO_DEL_AVISO.cerebro_diario, departamento: null })
  }
  for (const a of e.alarmasDelCerebro) out.push({ clave: `cerebro:alarma:${a.clave}`, tipo: "cerebro", texto: "El cerebro tiene una alarma abierta", cuando: a.ultima_en ?? e.ahora.toISOString(), abre: DESTINO_DEL_AVISO.cerebro_alarma, departamento: null })
  return out
}

/** 5 · pregunta sin responder (decisión C): solo las de los últimos 7 días */
export function preguntasSinResponder(e: EntradaDeAlertas): AlertaDeLaAntena[] {
  const t = e.ahora.getTime()
  return e.preguntas.filter((p) => p.estado === "pendiente" && delCliente(p.client_id, e.cliente)).flatMap((p): AlertaDeLaAntena[] => {
    const c = ms(p.creado_en)
    if (c == null || t - c > DIAS_DE_UNA_PREGUNTA * DIA) return []
    const q = String(p.pregunta ?? "").replace(/\s+/g, " ").trim()
    return [{ clave: `pregunta:${p.id}`, tipo: "pregunta", texto: q ? `Te preguntaron algo y sigue sin respuesta: ${q.length > 90 ? `${q.slice(0, 89).replace(/\s+\S*$/, "")}…` : q}` : "Te preguntaron algo y sigue sin respuesta", cuando: p.creado_en!, abre: DESTINO_DEL_AVISO.pregunta, departamento: departamentoDe(p.oficina) }]
  })
}

/**
 * 6 · decisión que espera tu aprobación (CC5 · 10-nov · GO de Lenovo, Emilio: «Esa decisión debería salir en la antena y no la veo»).
 * Sale de la lista de decisiones de la plataforma (`GET /api/direccion/decisiones`, la misma que lee Tu oficina › Decisiones).
 * El departamento sale del dato de cada decisión, nunca de su tipo:
 * · la ficha dice `departamento.oficina = marketing` → marketing (si la plataforma un día lo escribe así, manda);
 * · si no, su FUENTE: la bandeja de revisión de la campaña (`hitl_queue`), las aprobaciones del plan (`plan_aprobaciones`) y la campaña
 *   (`cadena_campanas`) son tablas enteras del Dept. Marketing, como `plan_corridas` → marketing;
 * · lo demás lleva la oficina de su ficha (las firmas de finanzas: «financiera») o nada (lo del cerebro) → no entra.
 * Las preguntas al dueño (`dueno_preguntas`) no se repiten aquí: ya avisan como «pregunta» (5).
 */
export const FUENTES_DEL_DEPARTAMENTO: readonly string[] = ["hitl_queue", "plan_aprobaciones", "cadena_campanas"]
export interface DecisionPendiente { id: string; tipo: string; fuente: string | null; client_id: string | null; desde: string | null; /** `ficha.departamento.oficina`, si la plataforma lo manda */ oficina: string | null; cliente?: string | null; /** CC1 #965 */ alerta?: AlertaRevisable | null }
export function departamentoDeLaDecision(d: Pick<DecisionPendiente, "fuente" | "oficina">): string | null {
  if (d.fuente && FUENTES_DEL_DEPARTAMENTO.includes(d.fuente)) return DEPARTAMENTO_DE_LA_ANTENA
  return departamentoDe(d.oficina)
}
/** la frase del aviso, en palabras de negocio */
const QUE_ESPERA: Record<string, string> = { gran_idea: "Gran idea de la Campaña de Marketing", pieza: "Pieza de la Campaña de Marketing", revision: "Revisión de la Campaña de Marketing", plan: "Plan de Marketing" }
export function decisionesPendientes(e: EntradaDeAlertas): AlertaDeLaAntena[] {
  return (e.decisiones ?? []).filter((d) => d.fuente !== "dueno_preguntas" && delCliente(d.client_id, e.cliente)).map((d): AlertaDeLaAntena => ({
    clave: `decision:${d.id}`, tipo: "decision", texto: `${QUE_ESPERA[d.tipo] ?? "Una decisión"} espera tu aprobación`,
    cuando: d.desde ?? e.ahora.toISOString(), abre: DESTINO_DEL_AVISO.decision, departamento: departamentoDeLaDecision(d),
    ...(d.alerta ? { revisar: d.alerta } : {}), ...(d.cliente ? { cliente: d.cliente } : {}),
  }))
}

/** las alertas de hoy DEL DEPARTAMENTO, la más reciente arriba; sin ninguna, la antena queda apagada y sin número */
export function armarAlertas(e: EntradaDeAlertas): AlertaDeLaAntena[] {
  return [...fallidas(e), ...colgadas(e), ...(GASTO_RARO_EN_LA_ANTENA ? gastosRaros(e) : []), ...cerebroNoCorrio(e), ...preguntasSinResponder(e), ...decisionesPendientes(e)]
    // 10-nov · las Nuevas primero (una revisada nunca deja fuera del tope a una nueva); dentro de cada grupo, la más reciente arriba
    .filter(delDepartamento).sort((a, b) => Number(esNuevaEnLaAntena(b)) - Number(esNuevaEnLaAntena(a)) || (ms(b.cuando) ?? 0) - (ms(a.cuando) ?? 0)).slice(0, MAXIMO_DE_ALERTAS)
}

/** dónde está la antena en la foto de 2560 px (la parabólica de la plataforma de arriba a la izquierda) */
/** el borde de la plataforma de la antena (frente), recorrido en sentido del reloj: de la derecha, por abajo, a la izquierda; la luz corre por aquí */
export const BORDE_DE_LA_ANTENA = "M643 470 L443 563 L282 472"
export const ANTENA = { plato: { x: 464, y: 316, rx: 66, ry: 56, giro: -28 }, punta1: { x: 369, y: 342 }, punta2: { x: 505, y: 257 }, rotulo: { x: 600, y: 300 } } as const
