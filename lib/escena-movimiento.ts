/**
 * LA ESCENA VIVA · LOS AGENTES EN SUS ESCRITORIOS (CC4 · 02-nov · SPRINT 1 del encargo de Lenovo firmado por Emilio: «ese montón de muñecos se ve mal… siluetas holográficas»).
 * Referencia estructural: AI Town (a16z, código abierto); la fachada es la nuestra (luz ámbar). Todo aquí es PURO (sin red ni reloj).
 * Reglas (Emilio): solo se ven los que trabajan AHORA · UNA silla por escritorio (el que escribe se sienta; los que aportan se paran alrededor de esa computadora).
 * Sprint 2 (abajo): caminar a la sala de reuniones y volver. La entrega al pizarrón y el clic en el agente son los sprints 3 y 4: NO están aquí.
 */
import { U, V, type MesaViva, type Punto, type Sentado } from "@/lib/escena-avatares"
import { nombreCanonico } from "@/lib/organigrama"
import { SILLAS_DE_LA_SALA } from "@/lib/escena-sala"

export type Postura = "sentado" | "de_pie"
/** dónde esperan de pie los que llegan mientras otro trabaja sentado (en los ejes del escritorio, desde su centro): 1.º el extremo derecho, 2.º el frente, 3.º el frente izquierdo; del 4.º en adelante, alrededor del cuadro de líneas del piso
 *  (frente-izquierda y detrás-izquierda), sin salir de la celda del escritorio ni agrandarla. Cada lugar es FIJO: no se amontonan. */
export const DE_PIE: Array<[number, number]> = [[64, 38], [-2, 84], [-92, 66], [-120, 22], [-60, -60]]
export const MAXIMO_EN_LA_MESA = 1 + DE_PIE.length // 1 sentado + los de pie; el resto se dice «+N»

export interface PuestoDeAgente { s: Sentado; pos: Punto; postura: Postura }

const aqui = (c: Punto, u: number, v: number): Punto => ({ x: Math.round(c.x + u * U.x + v * V.x), y: Math.round(c.y + u * U.y + v * V.y) })
/** dónde va la etiqueta «+N»: sobre el borde del escritorio, junto a su monitor (pegada a su mesa, no suelta en el piso) */
export const puntoDelMas = (m: Pick<MesaViva, "centro">): Punto => aqui(m.centro, 66, -50)

/**
 * EL ESCRITORIO ES DEL DEPARTAMENTO (04-nov · encargo de Lenovo, adenda 2: Emilio aprobó el video de turnos): una sola silla. Quien empezó primero su llamada se sienta; los demás esperan
 * de pie en un lugar fijo (DE_PIE), por orden de inicio; cuando el sentado termina, se sienta quien espera hace más tiempo y los de la fila avanzan un lugar. El orden sale de la hora
 * de inicio de la llamada (`Sentado.desde`); a igual hora, por nombre; sin hora, al final. Máximo MAXIMO_EN_LA_MESA a la vista; el resto va en `deMas`.
 */
export function repartirEnLaMesa(m: Pick<MesaViva, "sentados" | "silla" | "centro">): { puestos: PuestoDeAgente[]; deMas: number } {
  const t = (s: Sentado) => (s.desde ? Date.parse(s.desde) : NaN)
  const orden = [...m.sentados].sort((a, b) => {
    const ta = t(a), tb = t(b)
    if (Number.isFinite(ta) !== Number.isFinite(tb)) return Number.isFinite(ta) ? -1 : 1
    if (Number.isFinite(ta) && ta !== tb) return ta - tb
    return nombreCanonico(a.agente).localeCompare(nombreCanonico(b.agente), "es")
  })
  const visibles = orden.slice(0, MAXIMO_EN_LA_MESA)
  const puestos = visibles.map((s, i): PuestoDeAgente => i === 0
    ? { s, pos: { x: m.silla.x, y: m.silla.y }, postura: "sentado" }
    : { s, pos: aqui(m.centro, DE_PIE[i - 1][0], DE_PIE[i - 1][1]), postura: "de_pie" })
  return { puestos, deMas: Math.max(0, orden.length - visibles.length) }
}

// ── SPRINT 2 · caminar a la sala de reuniones y volver ──
/** los lugares de la oficina, en píxeles de `marketing-2560` (medidos sobre la foto, 02-nov: la puerta es el hueco de cristal de la pared del frente de la sala) */
export const LUGARES = {
  /** el piso frente a la puerta de la sala de vidrio: ahí termina el camino desde un escritorio (y de ahí empieza el de vuelta) */
  sala: { x: 1335, y: 628 },
  /** la puerta de cristal, sobre la pared del frente de la sala */
  puerta: { x: 1367, y: 598 },
  /** adentro, junto a la puerta */
  dentro: { x: 1385, y: 568 },
} as const satisfies Record<string, Punto>
/** por dónde se rodea la mesa redonda para llegar a cada silla (índice de `SILLAS_DE_LA_SALA`): las del frente van directo; la cabecera y las del fondo, por el lado izquierdo; la de la derecha, por el frente */
const RODEOS: Record<number, Punto[]> = {
  0: [{ x: 1318, y: 540 }], 1: [{ x: 1318, y: 540 }, { x: 1314, y: 450 }], 2: [{ x: 1318, y: 540 }, { x: 1314, y: 450 }, { x: 1350, y: 418 }], 3: [{ x: 1318, y: 540 }, { x: 1314, y: 450 }, { x: 1350, y: 418 }, { x: 1400, y: 414 }],
  4: [{ x: 1452, y: 536 }], 5: [], 6: [], 7: [],
}
const mismo = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y) <= 1
/** une tramos por las líneas del piso en un solo recorrido */
export function rutaPorVarios(puntos: Punto[]): Punto[] {
  const out: Punto[] = []
  for (let i = 1; i < puntos.length; i++) for (const p of rutaPorLasLineas(puntos[i - 1], puntos[i])) if (!out.length || !mismo(out[out.length - 1], p)) out.push(p)
  return out.length ? out : [puntos[0]]
}
/** la silla de la sala (índice) más cercana a un punto */
export const sillaMasCercana = (silla: Punto): number => SILLAS_DE_LA_SALA.reduce((mejor, s, i) => (Math.hypot(s.x - silla.x, s.y - silla.y) < Math.hypot(SILLAS_DE_LA_SALA[mejor].x - silla.x, SILLAS_DE_LA_SALA[mejor].y - silla.y) ? i : mejor), 0)
/** del piso frente a la puerta hasta la silla: puerta → adentro → rodeo de la mesa → silla (de pie) */
export function rutaDeLaPuertaALaSilla(silla: Punto): Punto[] {
  return rutaPorVarios([LUGARES.sala, LUGARES.puerta, LUGARES.dentro, ...RODEOS[sillaMasCercana(silla)], silla])
}
/** de la silla a la calle: el mismo camino al revés */
export const rutaDeLaSillaALaPuerta = (silla: Punto): Punto[] => [...rutaDeLaPuertaALaSilla(silla)].reverse()

/** de A a B por las líneas de luz del piso: primero a lo largo de un eje de la vista isométrica y luego del otro (nunca en diagonal por el aire) */
export function rutaPorLasLineas(a: Punto, b: Punto): Punto[] {
  const dx = b.x - a.x, dy = b.y - a.y
  const s = dx / V.x, u = (s - 2 * dy) / 2 // dx = V.x (u+v) · dy = (v-u)/2 con U.y=-.5 y V.y=.5
  const via = { x: Math.round(a.x + u * U.x), y: Math.round(a.y + u * U.y) }
  return [a, via, b].filter((p, i, l) => i === 0 || Math.hypot(p.x - l[i - 1].x, p.y - l[i - 1].y) > 1)
}
export const largoDeLaRuta = (r: Punto[]): number => r.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - r[i].x, p.y - r[i].y), 0)
/** el punto a la fracción `f` (0..1) del recorrido de la ruta */
export function puntoEnLaRuta(r: Punto[], f: number): Punto {
  if (r.length === 1) return r[0]
  const total = largoDeLaRuta(r)
  let resto = Math.min(Math.max(f, 0), 1) * total
  for (let i = 1; i < r.length; i++) {
    const tramo = Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y)
    if (resto <= tramo || i === r.length - 1) { const k = tramo ? Math.min(resto / tramo, 1) : 1; return { x: r[i - 1].x + (r[i].x - r[i - 1].x) * k, y: r[i - 1].y + (r[i].y - r[i - 1].y) * k } }
    resto -= tramo
  }
  return r[r.length - 1]
}
/** lo que tarda un recorrido: paso de oficina creíble (px de la foto por segundo; 04-nov: antes 260, se veía correr), mínimo 0,8 s */
export const VELOCIDAD_PX_S = 150
export const duracionDelRecorrido = (r: Punto[], tope = 4000): number => Math.min(Math.max((largoDeLaRuta(r) / VELOCIDAD_PX_S) * 1000, 800), tope)

/** qué debe hacer cada empleado cuando llega una lectura nueva: comparar lo que se veía con lo que dicen los datos ahora */
export type Intencion =
  | { tipo: "aparece"; hasta: Punto; postura: Postura }
  | { tipo: "camina"; hasta: Punto; postura: Postura }
  | { tipo: "va_a_la_sala" } // camina a la entrada de la sala y desaparece (ahí lo sienta la sala)
  | { tipo: "llega_de_la_sala"; hasta: Punto; postura: Postura } // sale de la entrada de la sala y camina a su puesto
  | { tipo: "se_va" } // deja de trabajar: se desvanece donde está
  | { tipo: "queda" }
export interface Visto { pos: Punto; postura: Postura }
/** lo que ESTABA a la vista y lo que PASA ahora (por clave canónica del empleado) → qué hace */
export function decidirMovimiento(antes: Visto | undefined, ahora: PuestoDeAgente | undefined, o: { enLaSala: boolean; veniaDeLaSala: boolean }): Intencion {
  if (ahora) {
    if (!antes) return o.veniaDeLaSala ? { tipo: "llega_de_la_sala", hasta: ahora.pos, postura: ahora.postura } : { tipo: "aparece", hasta: ahora.pos, postura: ahora.postura }
    if (antes.pos.x !== ahora.pos.x || antes.pos.y !== ahora.pos.y || antes.postura !== ahora.postura) return { tipo: "camina", hasta: ahora.pos, postura: ahora.postura }
    return { tipo: "queda" }
  }
  if (!antes) return { tipo: "queda" }
  return o.enLaSala ? { tipo: "va_a_la_sala" } : { tipo: "se_va" }
}
