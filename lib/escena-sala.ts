/**
 * LA SALA DE REUNIONES (CC6 · S3 · encargo `2026-11-01-ENCARGO-LENOVO-a-CC6-sala-de-reuniones-y-aportes.md`): cada sesión REAL de varios empleados (la planeación de
 * Náufrago: mesa de análisis → jefe-marketing → jefatura; el brief; la gran idea) se sienta alrededor de la mesa redonda de la sala de vidrio, con el que dirige a la
 * cabecera, el nombre de la reunión, su equipo y su cliente. Sin sesión, la sala queda vacía y lo dice. Lógica PURA (sin red ni reloj: `ahora` se pasa).
 *
 * Qué es una reunión (sonda 01-nov, solo lectura):
 * - Una corrida de n8n deja sus filas en `agent_invocations` con `workflow_execution_id` = «210273» (quien dirige) o «210273:analisis-mercado» (cada paso). La RAÍZ
 *   (lo de antes de «:») junta la sesión. Es reunión si se sientan al menos MINIMO_DE_PARTICIPANTES empleados de la oficina (los de la biblioteca, como el portero
 *   o el etiquetador del cerebro, no se sientan: no son de una mesa).
 * - La revisión de la jefatura llega como otra corrida (otro flujo) del mismo cliente, sola: si empieza a menos de MINUTOS_ENLACE del final de la reunión y quienes
 *   la hacen son los revisores de la jefatura, es la última fase de ESA reunión (así se ve 210273 → 210300).
 * - Quién dirige: el que el directorio marca `rol = direccion`; si nadie, el que corre la raíz (sin «:paso»); si no, el primero que habló.
 * - En curso: hay un despacho abierto de la reunión (dentro del tope de 20 min) o la última fila es de hace menos de MINUTOS_PAUSA. Terminada: hasta MINUTOS_CIERRE
 *   después; luego la sala queda vacía y solo se nombra la última reunión.
 */
import { equipoDelAgente, nombreCanonico, puestosDelAgente } from "@/lib/organigrama"
import { haceCuanto } from "@/lib/oficinas"
import { nombreLegible } from "@/lib/trabajo-en-vivo"
import type { ClaveDeMesa, Despacho, InvocacionViva, NombreDeAgente, Punto, TarjetaDelDirectorio } from "@/lib/escena-avatares"

export const MINIMO_DE_PARTICIPANTES = 2
export const MINUTOS_ENLACE = 10
export const MINUTOS_PAUSA = 5
export const MINUTOS_CIERRE = 15
const MINUTOS_TOPE_DESPACHO = 20

/** la mesa redonda de la sala de vidrio en la foto (`marketing-2560.jpg`, regenerada el 01-nov), medida sobre la rejilla `sala-rejilla` */
export const SALA = { mesa: { x: 1399, y: 475 }, rotulo: { x: 1400, y: 300 } } as const
/** las 8 sillas de la foto, en orden: la cabecera (lado izquierdo, mirando a la oficina) y luego alrededor de la mesa */
export const SILLAS_DE_LA_SALA: Punto[] = [
  { x: 1308, y: 478 }, // cabecera
  { x: 1350, y: 432 }, { x: 1385, y: 424 }, { x: 1422, y: 428 }, { x: 1476, y: 472 },
  { x: 1420, y: 530 }, { x: 1378, y: 536 }, { x: 1338, y: 525 },
]

export type EstadoEnLaSala = "hablando" | "hablo" | "fallo" | "espera"
export interface ParticipanteDeLaSala {
  agente: string
  nombre: string
  /** su mesa en la oficina (si tiene) y el nombre de su equipo */
  mesa: ClaveDeMesa | null
  equipo: string
  cabecera: boolean
  fase: string
  estado: EstadoEnLaSala
  /** su última fila (ISO) y cuándo, en palabras */
  ultima: string | null
  hace: string
  silla: Punto | null
  /** su última corrida (`workflow_execution_id`, p. ej. «210273:analisis-mercado»): para pedir el aporte completo */
  corrida: string | null
  /** S4 · su aporte (lo llena el lector con `conAportes`; sin lector, null) */
  aporte?: AporteEnLaSala | null
}
/** S4 · qué pasó con el aporte al cerrar: el de quien dirige es el RESULTADO; un informe que entró al cerebro se USÓ (de ahí lo recibe quien dirige);
 *  uno que no entró se APAGA; la jefatura REVISA; para el resto no hay dato de si se usó (no se inventa) */
export type UsoDelAporte = "resultado" | "usado" | "apagado" | "revision" | "sin_dato"
export interface AporteEnLaSala { resumen: string | null; recortado: boolean; uso: UsoDelAporte; motivo: string }
export interface ResultadoDeLaReunion { titulo: string | null; usados: number; informes: number; revision: string | null }
export interface FaseDeLaSala { nombre: string; agentes: string[]; estado: "hecha" | "en_curso" | "fallo"; desde: string | null; hasta: string | null }
export interface ReunionDeLaSala {
  /** las raíces de corrida que la forman (la primera es la principal) */
  corridas: string[]
  titulo: string
  flujo: string
  cliente: string | null
  /** el equipo del que dirige */
  equipo: string
  dirige: string
  estado: "en_curso" | "terminada"
  /** 03-nov · terminó con fallo: alguna de sus fases falló y ya no hay nadie hablando */
  fallo?: boolean
  desde: string | null
  hasta: string | null
  hace: string
  participantes: ParticipanteDeLaSala[]
  fases: FaseDeLaSala[]
  /** los que no caben en las 8 sillas */
  de_mas: number
  cliente_id: string | null
  /** S4 · lo que quedó al centro de la mesa (lo llena `conAportes`) */
  resultado?: ResultadoDeLaReunion | null
}
export interface SalaDeReuniones {
  reunion: ReunionDeLaSala | null
  /** la última reunión de la ventana leída, cuando la sala está vacía */
  ultima: { titulo: string; cliente: string | null; hasta: string | null; hace: string; fallo?: boolean } | null
  /** otras reuniones en curso a la vez (se dicen, no se sientan) */
  otras_en_curso: number
  /** 04-nov · los títulos de esas otras reuniones en curso (para decir cuáles son al tocar «y 1 reunión más») */
  otras?: string[]
  fuente: string
}

export interface EntradaDeLaSala {
  invocaciones: InvocacionViva[]
  despachos: Despacho[]
  directorio: Array<TarjetaDelDirectorio & { rol?: string | null }>
  agentes: NombreDeAgente[]
  clientes: Array<{ id: string; nombre: string }>
  /** nombre del flujo y mesa de un agente: los de la escena (se pasan para no duplicar reglas) */
  nombreDelFlujo: (id: string | null | undefined) => string
  mesaDelAgente: (agente: string, directorio: TarjetaDelDirectorio[]) => { mesa: ClaveDeMesa; origen: "directorio" | "mapa" } | null
  nombreDeLaMesa: (clave: ClaveDeMesa) => string
  ahora: Date
}

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN)
const raizDe = (exec: string | null | undefined): string | null => { const s = (exec ?? "").trim(); return s ? s.split(":")[0] : null }
const pasoCrudo = (exec: string | null | undefined): string | null => { const s = exec ?? ""; return s.includes(":") ? s.slice(s.indexOf(":") + 1) : null }
const esFallo = (status: unknown) => /error|fail|timeout|cancel/i.test(String(status ?? ""))
const cuando = (i: InvocacionViva) => i.ended_at ?? i.started_at
/** REGLA C (Emilio 04-nov 10:54Z; mapa de pasos de CC2 + nombres reales de `step_name`): SOLO los pasos que CONSOLIDAN abren la sala: la re-síntesis del estratega (`bba-resintesis-cN`), la integración del creador (`bb-equipo-integracion`) y el ajuste y el cierre del plan.
 *  Todo lo demás (lentes, investigación, redacción de una sección, jueces) es trabajo en el escritorio. Sin paso de consolidación con agente, no hay reunión */
export const esPasoDeConsolidacion = (exec: string | null | undefined, step: string | null | undefined): boolean => /(^|[-_:])(resintesis|integracion|ajuste|cierre)(?![a-z])/i.test(`${pasoCrudo(exec) ?? ""} ${step ?? ""}`)
/** los revisores de la jefatura (ADR-020: los 3 jefes) según el mapa firmado */
export const esRevisorDeLaJefatura = (agente: string): boolean => puestosDelAgente(agente).some((p) => p.area === "revisores")
/** se sienta en la sala si es de la oficina: tiene mesa, es de la jefatura o de la dirección; los de la biblioteca del cerebro y los proveedores no */
function seSienta(agente: string, e: EntradaDeLaSala): boolean {
  const t = e.directorio.find((d) => nombreCanonico(d.agente) === nombreCanonico(agente))
  if (t && !t.equipo && t.rol === "portero") return false
  if (e.mesaDelAgente(agente, e.directorio)) return true
  if (esRevisorDeLaJefatura(agente)) return true
  const eq = equipoDelAgente(agente)
  return eq !== "proveedores" && eq !== "otros"
}
/** el nombre de la fase de una fila: «analisis-mercado» → mesa de análisis; la raíz sin paso → lo escribe quien dirige; la jefatura aparte */
function faseDe(i: InvocacionViva, dirige: string, esJefatura: boolean): string {
  if (esJefatura) return "revisión de la jefatura"
  if (esPasoDeConsolidacion(i.workflow_execution_id, i.step_name)) return "redacción" // el paso que consolida se nombra en palabras simples, nunca con su clave interna
  const p = pasoCrudo(i.workflow_execution_id) ?? i.step_name ?? ""
  if (/^an[aá]lisis/i.test(p)) return "mesa de análisis"
  if (p) return p.replace(/[-_]+/g, " ").trim()
  return nombreCanonico(i.agent_name) === nombreCanonico(dirige) ? "redacción" : "sin paso registrado"
}

interface Grupo { raiz: string; filas: InvocacionViva[]; flujo: string | null; cliente: string | null; desde: number; hasta: number }

export function armarSala(e: EntradaDeLaSala): SalaDeReuniones {
  const t = e.ahora.getTime()
  const fuente = `agent_invocations + agent_dispatches (corridas por raíz de workflow_execution_id) · leído ${e.ahora.toISOString().slice(11, 16)}Z`
  const nombres = new Map(e.agentes.map((a) => [nombreCanonico(a.name), a.display_name || nombreLegible(a.name)]))
  const nombre = (a: string) => nombres.get(nombreCanonico(a)) ?? nombreLegible(a)
  const clientes = new Map(e.clientes.map((c) => [c.id, c.nombre]))

  // 1 · agrupar por raíz de corrida
  const grupos = new Map<string, Grupo>()
  for (const i of e.invocaciones) {
    const r = raizDe(i.workflow_execution_id), c = ms(cuando(i))
    if (!r || !Number.isFinite(c)) continue
    const g = grupos.get(r) ?? { raiz: r, filas: [], flujo: i.workflow_id, cliente: i.client_id, desde: c, hasta: c }
    g.filas.push(i); g.desde = Math.min(g.desde, ms(i.started_at ?? cuando(i)) || c); g.hasta = Math.max(g.hasta, c)
    if (!g.cliente && i.client_id) g.cliente = i.client_id
    grupos.set(r, g)
  }
  // los despachos abiertos (dentro del tope) también abren o alargan una corrida: quien está hablando todavía no dejó fila
  const abiertos = e.despachos.filter((d) => String(d.status ?? "").toLowerCase() === "running" && t - ms(d.running_at ?? d.created_at) <= MINUTOS_TOPE_DESPACHO * 60_000
    && !e.invocaciones.some((i) => nombreCanonico(i.agent_name) === nombreCanonico(d.agent_name) && i.workflow_execution_id && d.workflow_execution_id && (i.workflow_execution_id === d.workflow_execution_id || i.workflow_execution_id.startsWith(d.workflow_execution_id + ":")) && ms(cuando(i)) >= ms(d.running_at ?? d.created_at) - 1000))
  for (const d of abiertos) {
    const r = raizDe(d.workflow_execution_id), c = ms(d.running_at ?? d.created_at)
    if (!r || !Number.isFinite(c)) continue
    const g = grupos.get(r) ?? { raiz: r, filas: [], flujo: d.workflow_id, cliente: d.client_id, desde: c, hasta: c }
    g.desde = Math.min(g.desde, c); g.hasta = Math.max(g.hasta, t)
    if (!g.cliente && d.client_id) g.cliente = d.client_id
    grupos.set(r, g)
  }
  const sentables = (g: Grupo) => [...new Set([...g.filas.map((i) => i.agent_name), ...abiertos.filter((d) => raizDe(d.workflow_execution_id) === g.raiz).map((d) => d.agent_name)].filter((a) => seSienta(a, e)).map(nombreCanonico))]

  // 2 · las reuniones (≥ 2 que se sientan) y la jefatura que las sigue
  const todas = [...grupos.values()].sort((a, b) => a.desde - b.desde)
  // regla C: una corrida solo abre sala si tiene un paso que consolida con alguien que se sienta (quien dirige basta; sin dato de quién aportó, se sienta solo él)
  const consolida = (g: Grupo) => g.filas.some((i) => esPasoDeConsolidacion(i.workflow_execution_id, i.step_name) && seSienta(i.agent_name, e)) || abiertos.some((d) => raizDe(d.workflow_execution_id) === g.raiz && esPasoDeConsolidacion(d.workflow_execution_id, null) && seSienta(d.agent_name, e))
  const reuniones = todas.filter(consolida).map((g) => ({ principal: g, jefatura: [] as Grupo[] }))
  for (const g of todas) {
    const ags = sentables(g)
    if (!ags.length || !ags.every(esRevisorDeLaJefatura)) continue
    const madre = reuniones.filter((r) => r.principal !== g && r.principal.cliente && r.principal.cliente === g.cliente && g.desde >= r.principal.desde && g.desde - r.principal.hasta <= MINUTOS_ENLACE * 60_000).at(-1)
    if (madre) madre.jefatura.push(g)
  }
  const armadas = reuniones.map((r) => armarReunion(r.principal, r.jefatura, e, abiertos, nombre, clientes))
  const enCurso = armadas.filter((r) => r.estado === "en_curso").sort((a, b) => ms(b.hasta) - ms(a.hasta))
  const recientes = armadas.filter((r) => r.estado === "terminada" && t - ms(r.hasta) <= MINUTOS_CIERRE * 60_000).sort((a, b) => ms(b.hasta) - ms(a.hasta))
  const reunion = enCurso[0] ?? recientes[0] ?? null
  const ultimaR = reunion ? null : armadas.sort((a, b) => ms(b.hasta) - ms(a.hasta))[0] ?? null
  return {
    reunion,
    ultima: ultimaR ? { titulo: ultimaR.titulo, cliente: ultimaR.cliente, hasta: ultimaR.hasta, hace: ultimaR.hace, fallo: ultimaR.fallo === true } : null,
    otras_en_curso: Math.max(enCurso.length - 1, 0),
    otras: enCurso.slice(1).map((r) => r.titulo),
    fuente,
  }
}

function armarReunion(g: Grupo, jefatura: Grupo[], e: EntradaDeLaSala, abiertos: Despacho[], nombre: (a: string) => string, clientes: Map<string, string>): ReunionDeLaSala {
  const t = e.ahora.getTime()
  const raices = new Set([g.raiz, ...jefatura.map((j) => j.raiz)])
  const filasTodas = [...g.filas, ...jefatura.flatMap((j) => j.filas)].filter((i) => seSienta(i.agent_name, e)).sort((a, b) => ms(cuando(a)) - ms(cuando(b)))
  const abiertosTodos = abiertos.filter((d) => raices.has(raizDe(d.workflow_execution_id) ?? "") && seSienta(d.agent_name, e))
  // regla C: la reunión es la ÚLTIMA consolidación de la corrida. Se sientan quien la dirige y los que aportaron (llamadas ya terminadas ANTES de que ella empezara); las demás llamadas siguen en su escritorio
  const esC = (i: InvocacionViva) => esPasoDeConsolidacion(i.workflow_execution_id, i.step_name)
  const consolAbiertas = abiertosTodos.filter((d) => esPasoDeConsolidacion(d.workflow_execution_id, null))
  const inicioDe = (i: InvocacionViva) => ms(i.started_at ?? cuando(i))
  const ultimaC = filasTodas.filter(esC).sort((a, b) => inicioDe(b) - inicioDe(a))[0]
  const inicioAbierta = Math.max(-Infinity, ...consolAbiertas.map((d) => ms(d.running_at ?? d.created_at)).filter(Number.isFinite))
  const abiertaMasNueva = consolAbiertas.length > 0 && (!ultimaC || inicioAbierta >= inicioDe(ultimaC))
  const inicioC = abiertaMasNueva ? inicioAbierta : ultimaC ? inicioDe(ultimaC) : Infinity
  const filas = filasTodas.filter((i) => (esC(i) ? !abiertaMasNueva && ultimaC != null && inicioDe(i) === inicioDe(ultimaC) : ms(cuando(i)) <= inicioC))
  const abiertosAqui = abiertaMasNueva ? consolAbiertas.filter((d) => ms(d.running_at ?? d.created_at) === inicioAbierta) : []
  const esDeJefatura = (exec: string | null) => jefatura.some((j) => j.raiz === raizDe(exec))

  // quién dirige: rol del directorio → el que corre la raíz → el primero
  const presentes = [...new Map([...filas.map((i) => [nombreCanonico(i.agent_name), i.agent_name] as const), ...abiertosAqui.map((d) => [nombreCanonico(d.agent_name), d.agent_name] as const)]).values()]
  const porRol = presentes.find((a) => e.directorio.some((d) => nombreCanonico(d.agente) === nombreCanonico(a) && d.rol === "direccion"))
  const porRaiz = [...filas.filter((i) => !esDeJefatura(i.workflow_execution_id)).map((i) => ({ a: i.agent_name, x: i.workflow_execution_id })), ...abiertosAqui.filter((d) => !esDeJefatura(d.workflow_execution_id)).map((d) => ({ a: d.agent_name, x: d.workflow_execution_id }))].find((p) => p.x === g.raiz)?.a
  // quien consolida dirige (regla C); si no se sabe, los criterios de antes
  const dirigeC = abiertosAqui[0]?.agent_name ?? (ultimaC && !abiertaMasNueva ? ultimaC.agent_name : undefined)
  const dirige = dirigeC ?? porRol ?? porRaiz ?? presentes[0] ?? ""

  // las fases, en el orden en que pasaron
  const fases: FaseDeLaSala[] = []
  const faseDelAgente = new Map<string, string>()
  const agregar = (f: string, agente: string, desde: string | null, hasta: string | null, estado: FaseDeLaSala["estado"]) => {
    let x = fases.find((y) => y.nombre === f)
    if (!x) { x = { nombre: f, agentes: [], estado: "hecha", desde, hasta }; fases.push(x) }
    if (!x.agentes.includes(agente)) x.agentes.push(agente)
    if (desde && (!x.desde || desde < x.desde)) x.desde = desde
    if (hasta && (!x.hasta || hasta > x.hasta)) x.hasta = hasta
    if (estado === "en_curso") x.estado = "en_curso"
    else if (estado === "fallo" && x.estado !== "en_curso") x.estado = "fallo"
    faseDelAgente.set(nombreCanonico(agente), f)
  }
  for (const i of filas) agregar(faseDe(i, dirige, esDeJefatura(i.workflow_execution_id)), i.agent_name, i.started_at ?? cuando(i), cuando(i), esFallo(i.status) ? "fallo" : "hecha")
  for (const d of abiertosAqui) {
    const falsa: InvocacionViva = { agent_name: d.agent_name, client_id: d.client_id, workflow_id: d.workflow_id, workflow_execution_id: d.workflow_execution_id, status: "running", started_at: d.running_at ?? d.created_at, ended_at: null, cost_usd: null, step_name: null, task_text: null }
    agregar(faseDe(falsa, dirige, esDeJefatura(d.workflow_execution_id)), d.agent_name, d.running_at ?? d.created_at, null, "en_curso")
  }

  // cada participante: la cabecera primero, luego en el orden en que hablaron
  const orden = [dirige, ...presentes.filter((a) => nombreCanonico(a) !== nombreCanonico(dirige))].filter(Boolean)
  const participantes: ParticipanteDeLaSala[] = orden.map((a, k) => {
    const mias = filas.filter((i) => nombreCanonico(i.agent_name) === nombreCanonico(a))
    const ultima = mias.map(cuando).filter((x): x is string => !!x).sort().at(-1) ?? null
    const habla = abiertosAqui.some((d) => nombreCanonico(d.agent_name) === nombreCanonico(a))
    const ultimaFila = [...mias].sort((x, y) => ms(cuando(y)) - ms(cuando(x)))[0]
    const corrida = ultimaFila?.workflow_execution_id ?? abiertosAqui.find((d) => nombreCanonico(d.agent_name) === nombreCanonico(a))?.workflow_execution_id ?? null
    const estado: EstadoEnLaSala = habla ? "hablando" : ultimaFila ? (esFallo(ultimaFila.status) ? "fallo" : "hablo") : "espera"
    const m = e.mesaDelAgente(a, e.directorio)
    const equipo = esRevisorDeLaJefatura(a) ? (m ? `Jefatura · ${e.nombreDeLaMesa(m.mesa)}` : "Jefatura") : m ? e.nombreDeLaMesa(m.mesa) : "sin mesa conocida"
    return { agente: a, nombre: nombre(a), mesa: m?.mesa ?? null, equipo, cabecera: k === 0, fase: faseDelAgente.get(nombreCanonico(a)) ?? "sin paso registrado", estado, ultima, hace: ultima ? haceCuanto(ultima, e.ahora) : habla ? "hablando ahora" : "sin fila", silla: SILLAS_DE_LA_SALA[k] ?? null, corrida }
  })

  // regla C: la reunión dura lo que dura el paso que consolida; al terminar, vuelven a sus escritorios (sin pausa de espera)
  const hasta = Math.max(...filas.map((i) => ms(cuando(i))), ...abiertosAqui.map(() => t))
  const enCurso = abiertosAqui.length > 0 || (ultimaC != null && !abiertaMasNueva && !ultimaC.ended_at)
  const flujo0 = e.nombreDelFlujo(g.flujo)
  // 04-nov · si el flujo no trae nombre, el título sale del pedido en curso («Reescritura del manual»), no de «un trabajo sin nombre registrado»
  const flujo = /^un trabajo en curso$/i.test(flujo0) ? tituloPorElPedido(filas.map((f) => f.task_text)) : flujo0
  const cliente = g.cliente ? clientes.get(g.cliente) ?? "cliente sin nombre" : null
  const md = e.mesaDelAgente(dirige, e.directorio)
  const hastaIso = Number.isFinite(hasta) ? new Date(Math.min(hasta, t)).toISOString() : null
  return {
    corridas: [...raices], titulo: `${flujo}${cliente ? ` · ${cliente}` : ""}`, flujo, cliente,
    equipo: md ? e.nombreDeLaMesa(md.mesa) : participantes[0]?.equipo ?? "sin equipo", dirige: nombre(dirige),
    estado: enCurso ? "en_curso" : "terminada", fallo: !enCurso && fases.some((f) => f.estado === "fallo"),
    desde: Number.isFinite(g.desde) ? new Date(g.desde).toISOString() : null, hasta: hastaIso, hace: hastaIso ? haceCuanto(hastaIso, e.ahora) : "sin dato",
    participantes, fases, de_mas: Math.max(participantes.length - SILLAS_DE_LA_SALA.length, 0), cliente_id: g.cliente,
  }
}

/** quien está en una reunión EN CURSO está en la sala: no se sienta además en su mesa (su mesa lo nombra «en la sala de reuniones») */
export function agentesEnLaSala(s: SalaDeReuniones | null | undefined): Set<string> {
  return new Set(s?.reunion?.estado === "en_curso" ? s.reunion.participantes.map((p) => nombreCanonico(p.agente)) : [])
}

/** las líneas del rótulo de la sala, en este orden; nunca se rellena */
export function lineasDeLaSala(s: SalaDeReuniones | null | undefined): string[] {
  if (!s) return ["SALA DE REUNIONES", "leyendo…"]
  const r = s.reunion
  if (!r) return ["SALA DE REUNIONES", s.ultima ? `sala vacía · la última, ${s.ultima.titulo}, ${s.ultima.fallo ? "falló" : "terminó"} ${s.ultima.hace}` : "sala vacía · ninguna reunión en las últimas 24 h"]
  const enFase = r.fases.find((f) => f.estado === "en_curso")?.nombre
  const estado = r.estado === "en_curso" ? `en curso${enFase ? ` · ${enFase}` : ""}` : `${r.fallo ? "falló" : "terminó"} ${r.hace}`
  return ["SALA DE REUNIONES", r.titulo, `dirige ${r.dirige} (${r.equipo}) · ${r.participantes.length} en la mesa · ${estado}${s.otras_en_curso ? ` · ${masReuniones(s.otras_en_curso)}` : ""}`]
}

// ── S4 · los aportes ──
/** el paso de la mesa de análisis de una corrida: «210273:analisis-voz_del_publico» → «voz_del_publico» */
export const pasoDeAnalisis = (corrida: string | null | undefined): string | null => { const p = pasoCrudo(corrida); const m = p?.match(/^an[aá]lisis[-_](.+)$/i); return m ? m[1] : null }
/** el aporte en pocas palabras: sin el encabezado «[informe de análisis · … · PROPUESTA…]», sin marcas de formato, recortado */
export function resumenDelAporte(texto: string | null | undefined, n = 220): string | null {
  let t = String(texto ?? "").replace(/^\s*```(?:json)?/i, "").replace(/^\s*\[informe de an[aá]lisis[^\]]*\]\s*/i, "")
  // la revisión de la jefatura llega como JSON de observaciones («fichas»): se dice cuántas y la primera, nunca el JSON crudo
  if (/^\s*\{\s*"fichas"\s*:/.test(t)) {
    const ques = [...t.matchAll(/"que"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, "\""))
    const bloquean = (t.match(/"gravedad"\s*:\s*"bloquea"/g) ?? []).length
    const enteras = String(texto ?? "").length < LARGO_GUARDADO
    if (!ques.length) return enteras ? "sin observaciones" : "observaciones (el texto guardado está recortado)"
    t = `${enteras ? "" : "al menos "}${ques.length} ${ques.length === 1 ? "observación" : "observaciones"}${bloquean ? `, ${bloquean} bloquea${bloquean === 1 ? "" : "n"}` : ""}. La primera: ${ques[0]}`
  }
  t = t.replace(/-{3,}/g, " ").replace(/[#*_>`|]+/g, " ").replace(/\[(?:ficha:)?[0-9a-f]{6,}[^\]]*\]/gi, "").replace(/\s+/g, " ").trim()
  if (!t) return null
  return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : t
}
/** «# PLAN DE CAMPAÑA 90 DÍAS · NÁUFRAGO» → el título del resultado (el primer encabezado) */
export const tituloDelResultado = (texto: string | null | undefined): string | null => String(texto ?? "").match(/^\s*#{1,3}\s*(.+)$/m)?.[1]?.trim() ?? null
/** el resumen de la revisión de la jefatura: cuántas observaciones y cuántas bloquean (de `jefatura_revisiones.estado_del_motor.fichas`) */
export function resumenDeLaRevision(estadoDelMotor: unknown): string | null {
  const f = (estadoDelMotor as { fichas?: unknown } | null)?.fichas
  if (!Array.isArray(f)) return null
  const bloquean = f.filter((x) => (x as { gravedad?: unknown })?.gravedad === "bloquea").length
  return `${f.length} ${f.length === 1 ? "observación" : "observaciones"}${bloquean ? `, ${bloquean} bloquea${bloquean === 1 ? "" : "n"}` : ""}`
}
export interface EntradaDeAportes {
  /** la salida guardada de cada corrida del participante (`agent_invocations.output_summary`, recortada a 2.000 caracteres en la base) */
  salidas: Array<{ agent_name: string; workflow_execution_id: string | null; output_summary: string | null }>
  /** los informes que entraron al cerebro del cliente durante la reunión (`cerebro_fichas.ref` «informe:<paso>:…») */
  informesEnElCerebro: string[]
  /** la última revisión de la jefatura del cliente en la ventana de la reunión */
  revision: { estado_del_motor: unknown } | null
}
export const LARGO_GUARDADO = 2000
export function conAportes(r: ReunionDeLaSala, e: EntradaDeAportes): ReunionDeLaSala {
  const salida = (p: ParticipanteDeLaSala) => e.salidas.find((x) => nombreCanonico(x.agent_name) === nombreCanonico(p.agente) && x.workflow_execution_id === p.corrida)?.output_summary ?? null
  let usados = 0, informes = 0
  const participantes = r.participantes.map((p): ParticipanteDeLaSala => {
    const texto = salida(p)
    const base = { resumen: p.estado === "hablando" ? null : resumenDelAporte(texto), recortado: (texto ?? "").length >= LARGO_GUARDADO }
    let aporte: AporteEnLaSala
    const paso = pasoDeAnalisis(p.corrida)
    if (p.cabecera) aporte = { ...base, uso: "resultado", motivo: p.estado === "hablando" ? "está escribiendo el resultado" : "su trabajo es el resultado de la reunión" }
    else if (esRevisorDeLaJefatura(p.agente)) aporte = { ...base, uso: "revision", motivo: "revisó el resultado" }
    else if (paso) {
      informes++
      const entro = e.informesEnElCerebro.some((ref) => ref.startsWith(`informe:${paso}:`))
      if (entro) usados++
      const sinDato = /^sin dato(?![a-záéíóúñ])/i.test(base.resumen ?? "")
      aporte = entro ? { ...base, uso: "usado", motivo: "su informe entró al cerebro y de ahí lo recibe quien dirige" }
        : { ...base, uso: "apagado", motivo: sinDato ? "dijo «sin dato» y su informe no entró al cerebro" : "su informe no entró al cerebro (sin motivo registrado)" }
    } else aporte = { ...base, uso: "sin_dato", motivo: "no hay dato de si su aporte se usó" }
    return { ...p, aporte }
  })
  const lider = participantes.find((p) => p.cabecera)
  return { ...r, participantes, resultado: { titulo: lider && lider.estado !== "hablando" ? tituloDelResultado(salida(lider)) : null, usados, informes, revision: e.revision ? resumenDeLaRevision(e.revision.estado_del_motor) : null } }
}
/** «y 1 reunión más» / «y 2 reuniones más» (singular o plural según toque) */
export const masReuniones = (n: number): string => `y ${n} ${n === 1 ? "reunión más" : "reuniones más"}`
/** 04-nov · el título de la reunión cuando el flujo no trae nombre: sale de lo que se pidió; si no se reconoce, «Un trabajo en curso» (nunca «sin nombre registrado») */
export function tituloPorElPedido(pedidos: Array<string | null | undefined>): string {
  const t = pedidos.filter(Boolean).join(" ").toLowerCase()
  if (/manual/.test(t)) return "Reescritura del manual"
  if (/plan de 90|plan a 90|plan de campa/.test(t)) return "Plan de 90 días"
  return "Un trabajo en curso"
}
/** 04-nov · el GLOBO de un participante: UNA línea en español claro de lo que hace (por su papel), sin nombres internos, números, inglés ni abreviaturas. El texto crudo de su aporte se lee en el panel, no aquí */
export function fraseDelGlobo(p: ParticipanteDeLaSala): string {
  if (p.estado === "hablando") return p.cabecera ? "Escribe el resultado de la reunión" : "Prepara su aporte"
  if (p.cabecera) return "Arma el resultado con lo que traen los demás"
  // el juez de fidelidad llega con fases internas tipo «bb faithfulness judge c2»: por eso también se reconoce por la fase y el paso, no solo por el puesto
  if (esRevisorDeLaJefatura(p.agente) || /faithfulness|judge|juez|jefatura|revis/i.test(`${p.fase} ${p.corrida ?? ""}`)) return "Revisa que el texto diga solo lo que está en los datos"
  if (pasoDeAnalisis(p.corrida)) return "Aporta su informe de la mesa de análisis"
  return "Aporta lo que sabe de su área"
}
/** el texto del globo de un participante (lo que se lee sin tocar) */
export function globoDe(p: ParticipanteDeLaSala): string {
  if (p.estado === "hablando") return p.cabecera ? "escribiendo el resultado…" : "preparando su aporte…"
  if (!p.aporte) return "aporte · sin leer"
  return p.aporte.resumen ?? "aporte · sin texto guardado"
}
/** las líneas del centro de la mesa al cerrar. Un resultado SIN texto (p. ej. corrida fallida: el que dirige no dejó nada) no se anuncia: no le dice nada a Emilio (04-nov, 13:43Z) */
export function lineasDelResultado(r: ReunionDeLaSala): string[] {
  const x = r.resultado
  if (!x || !x.titulo) return []
  return [`Resultado · ${x.titulo}`, ...(x.informes ? [`usó ${x.usados} de ${x.informes} informes de la mesa de análisis`] : []), ...(x.revision ? [`revisión de la jefatura · ${x.revision}`] : [])]
}
