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
}
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
  desde: string | null
  hasta: string | null
  hace: string
  participantes: ParticipanteDeLaSala[]
  fases: FaseDeLaSala[]
  /** los que no caben en las 8 sillas */
  de_mas: number
}
export interface SalaDeReuniones {
  reunion: ReunionDeLaSala | null
  /** la última reunión de la ventana leída, cuando la sala está vacía */
  ultima: { titulo: string; cliente: string | null; hasta: string | null; hace: string } | null
  /** otras reuniones en curso a la vez (se dicen, no se sientan) */
  otras_en_curso: number
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
  const reuniones = todas.filter((g) => sentables(g).length >= MINIMO_DE_PARTICIPANTES).map((g) => ({ principal: g, jefatura: [] as Grupo[] }))
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
    ultima: ultimaR ? { titulo: ultimaR.titulo, cliente: ultimaR.cliente, hasta: ultimaR.hasta, hace: ultimaR.hace } : null,
    otras_en_curso: Math.max(enCurso.length - 1, 0),
    fuente,
  }
}

function armarReunion(g: Grupo, jefatura: Grupo[], e: EntradaDeLaSala, abiertos: Despacho[], nombre: (a: string) => string, clientes: Map<string, string>): ReunionDeLaSala {
  const t = e.ahora.getTime()
  const raices = new Set([g.raiz, ...jefatura.map((j) => j.raiz)])
  const filas = [...g.filas, ...jefatura.flatMap((j) => j.filas)].filter((i) => seSienta(i.agent_name, e)).sort((a, b) => ms(cuando(a)) - ms(cuando(b)))
  const abiertosAqui = abiertos.filter((d) => raices.has(raizDe(d.workflow_execution_id) ?? "") && seSienta(d.agent_name, e))
  const esDeJefatura = (exec: string | null) => jefatura.some((j) => j.raiz === raizDe(exec))

  // quién dirige: rol del directorio → el que corre la raíz → el primero
  const presentes = [...new Map([...filas.map((i) => [nombreCanonico(i.agent_name), i.agent_name] as const), ...abiertosAqui.map((d) => [nombreCanonico(d.agent_name), d.agent_name] as const)]).values()]
  const porRol = presentes.find((a) => e.directorio.some((d) => nombreCanonico(d.agente) === nombreCanonico(a) && d.rol === "direccion"))
  const porRaiz = [...filas.filter((i) => !esDeJefatura(i.workflow_execution_id)).map((i) => ({ a: i.agent_name, x: i.workflow_execution_id })), ...abiertosAqui.filter((d) => !esDeJefatura(d.workflow_execution_id)).map((d) => ({ a: d.agent_name, x: d.workflow_execution_id }))].find((p) => p.x === g.raiz)?.a
  const dirige = porRol ?? porRaiz ?? presentes[0] ?? ""

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
    const estado: EstadoEnLaSala = habla ? "hablando" : ultimaFila ? (esFallo(ultimaFila.status) ? "fallo" : "hablo") : "espera"
    const m = e.mesaDelAgente(a, e.directorio)
    const equipo = esRevisorDeLaJefatura(a) ? (m ? `Jefatura · ${e.nombreDeLaMesa(m.mesa)}` : "Jefatura") : m ? e.nombreDeLaMesa(m.mesa) : "sin mesa conocida"
    return { agente: a, nombre: nombre(a), mesa: m?.mesa ?? null, equipo, cabecera: k === 0, fase: faseDelAgente.get(nombreCanonico(a)) ?? "sin paso registrado", estado, ultima, hace: ultima ? haceCuanto(ultima, e.ahora) : habla ? "hablando ahora" : "sin fila", silla: SILLAS_DE_LA_SALA[k] ?? null }
  })

  const hasta = Math.max(g.hasta, ...jefatura.map((j) => j.hasta))
  const ultimaFila = filas.length ? ms(cuando(filas[filas.length - 1])) : NaN
  const enCurso = abiertosAqui.length > 0 || (Number.isFinite(ultimaFila) && t - ultimaFila < MINUTOS_PAUSA * 60_000)
  const flujo = e.nombreDelFlujo(g.flujo)
  const cliente = g.cliente ? clientes.get(g.cliente) ?? "cliente sin nombre" : null
  const md = e.mesaDelAgente(dirige, e.directorio)
  const hastaIso = Number.isFinite(hasta) ? new Date(Math.min(hasta, t)).toISOString() : null
  return {
    corridas: [...raices], titulo: `${flujo}${cliente ? ` · ${cliente}` : ""}`, flujo, cliente,
    equipo: md ? e.nombreDeLaMesa(md.mesa) : participantes[0]?.equipo ?? "sin equipo", dirige: nombre(dirige),
    estado: enCurso ? "en_curso" : "terminada",
    desde: Number.isFinite(g.desde) ? new Date(g.desde).toISOString() : null, hasta: hastaIso, hace: hastaIso ? haceCuanto(hastaIso, e.ahora) : "sin dato",
    participantes, fases, de_mas: Math.max(participantes.length - SILLAS_DE_LA_SALA.length, 0),
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
  if (!r) return ["SALA DE REUNIONES", s.ultima ? `sala vacía · la última, ${s.ultima.titulo}, terminó ${s.ultima.hace}` : "sala vacía · ninguna reunión en las últimas 24 h"]
  const enFase = r.fases.find((f) => f.estado === "en_curso")?.nombre
  const estado = r.estado === "en_curso" ? `en curso${enFase ? ` · ${enFase}` : ""}` : `terminó ${r.hace}`
  return ["SALA DE REUNIONES", r.titulo, `dirige ${r.dirige} (${r.equipo}) · ${r.participantes.length} en la mesa · ${estado}${s.otras_en_curso ? ` · +${s.otras_en_curso} reunión(es) más en curso` : ""}`]
}
