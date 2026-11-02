/**
 * LA ESCENA VIVA · LOS AGENTES EN SUS ESCRITORIOS (CC4 · 02-nov · SPRINT 1 del encargo de Lenovo firmado por Emilio: «ese montón de muñecos se ve mal… siluetas holográficas»).
 * Referencia estructural: AI Town (a16z, código abierto); la fachada es la nuestra (luz ámbar). Todo aquí es PURO (sin red ni reloj).
 * Reglas (Emilio): solo se ven los que trabajan AHORA · UNA silla por escritorio (el que escribe se sienta; los que aportan se paran alrededor de esa computadora).
 * Sprint 2 (abajo): caminar a la sala de reuniones y volver. La entrega al pizarrón y el clic en el agente son los sprints 3 y 4: NO están aquí.
 */
import { U, V, type MesaViva, type Punto, type Sentado } from "@/lib/escena-avatares"

export const MAXIMO_EN_LA_MESA = 4 // 1 sentado + 3 de pie; el resto se dice «+N»
export type Postura = "sentado" | "de_pie"
export interface PuestoDeAgente { s: Sentado; pos: Punto; postura: Postura }

const aqui = (c: Punto, u: number, v: number): Punto => ({ x: Math.round(c.x + u * U.x + v * V.x), y: Math.round(c.y + u * U.y + v * V.y) })
/** dónde se para quien aporta, alrededor de la computadora (en los ejes del escritorio, desde su centro): el extremo derecho, el frente y el extremo izquierdo */
export const DE_PIE: Array<[number, number]> = [[64, 38], [-2, 84], [-92, 66]]

/** dónde va la etiqueta «+N»: sobre el borde del escritorio, junto a su monitor (pegada a su mesa, no suelta en el piso) */
export const puntoDelMas = (m: Pick<MesaViva, "centro">): Punto => aqui(m.centro, 66, -50)

/**
 * Una silla por escritorio: se sienta el que lleva más tiempo trabajando en esa mesa (el que escribe); los demás —los que aportan dentro de su dominio— se paran
 * alrededor de esa computadora. Máximo MAXIMO_EN_LA_MESA a la vista; el resto va en `deMas`.
 */
export function repartirEnLaMesa(m: Pick<MesaViva, "sentados" | "silla" | "centro">): { puestos: PuestoDeAgente[]; deMas: number } {
  const orden = [...m.sentados].sort((a, b) => (a.estado === b.estado ? (a.desde ?? "") < (b.desde ?? "") ? -1 : 1 : a.estado === "trabajando" ? -1 : 1))
  const visibles = orden.slice(0, MAXIMO_EN_LA_MESA)
  const puestos = visibles.map((s, i): PuestoDeAgente => i === 0
    ? { s, pos: { x: m.silla.x, y: m.silla.y }, postura: "sentado" }
    : { s, pos: aqui(m.centro, DE_PIE[i - 1][0], DE_PIE[i - 1][1]), postura: "de_pie" })
  return { puestos, deMas: Math.max(0, orden.length - visibles.length) }
}

// ── SPRINT 2 · caminar a la sala de reuniones y volver ──
/** los lugares de la oficina, en píxeles de `marketing-2560` (medidos sobre la foto) */
export const LUGARES = {
  /** la entrada de la sala de vidrio, sobre el piso frente a su pared de vidrio: ahí entra (y de ahí sale) quien va a una reunión; adentro lo sienta la sala de CC6 */
  sala: { x: 1262, y: 585 },
} as const satisfies Record<string, Punto>

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
/** lo que tarda un recorrido: velocidad pausada de oficina (px de la foto por segundo), entre 0,8 y 4 s */
export const VELOCIDAD_PX_S = 260
export const duracionDelRecorrido = (r: Punto[]): number => Math.min(Math.max((largoDeLaRuta(r) / VELOCIDAD_PX_S) * 1000, 800), 4000)

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
