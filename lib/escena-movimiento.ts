/**
 * LA ESCENA VIVA · LOS AGENTES EN SUS ESCRITORIOS (CC4 · 02-nov · SPRINT 1 del encargo de Lenovo firmado por Emilio: «ese montón de muñecos se ve mal… siluetas holográficas»).
 * Referencia estructural: AI Town (a16z, código abierto); la fachada es la nuestra (luz ámbar). Todo aquí es PURO (sin red ni reloj).
 * Reglas (Emilio): solo se ven los que trabajan AHORA · UNA silla por escritorio (el que escribe se sienta; los que aportan se paran alrededor de esa computadora).
 * Caminar a la sala, la entrega al pizarrón y el clic en el agente son los sprints 2 a 4: NO están aquí.
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
