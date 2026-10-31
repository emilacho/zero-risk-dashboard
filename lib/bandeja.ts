/**
 * LA BANDEJA DE PIEZAS EN EL ESTILO NUEVO (sprint 6.6 · Emilio 31-oct: «ya no uses el dashboard viejo… así con todo»): lógica PURA (sin red ni base) de lo que el
 * panel enseña y de los cuerpos que manda. Las reglas de la decisión (mínimos · casilla «entiendo» · láminas) son las de `lib/piezas.ts`, LAS MISMAS que exige
 * el servidor en `POST /api/piezas/{id}/decidir`: aquí solo se arman antes de enviar y se dicen en palabras. Nada de esto escribe.
 */
import type { FilaDeLaLista } from "@/lib/piezas-datos"
import { COMENTARIO_MAXIMO, COMENTARIO_MINIMO, MOTIVO_MINIMO, validarDecision, type AccionDeLaPieza, type EstadoPieza, type OrigenDeLaImagen, type PedidoDeDecision } from "@/lib/piezas"
import { usdES } from "@/lib/lenguaje"

export type FiltroDeLaBandeja = "pendiente" | "todas"
export type Tono = "ambar" | "verde" | "azul" | "rojo" | "neutro"

export const ESTADO_DE_PIEZA_LEGIBLE: Record<EstadoPieza, string> = {
  pendiente: "por aprobar", aprobada: "aprobada", con_cambios: "con cambios pedidos", rechazada: "rechazada", superada: "superada (la reemplazó otra pieza)", archivada: "archivada", otro: "otro estado",
}
export function tonoDelEstado(e: EstadoPieza): Tono {
  return e === "pendiente" ? "ambar" : e === "aprobada" ? "verde" : e === "con_cambios" ? "azul" : e === "rechazada" ? "rojo" : "neutro"
}

/** de dónde sale la imagen de una lámina, corto, para el rótulo de la lámina */
export const ORIGEN_CORTO: Record<OrigenDeLaImagen, string> = { tipografia: "solo tipografía de marca", generada: "imagen generada con IA", propia: "foto propia del cliente", con_imagen: "con imagen de fondo" }

/** lo que la fila avisa en la lista, en una línea; null si no avisa nada */
export function avisosDeLaFila(p: Pick<FilaDeLaLista, "tiene_dibujo" | "incompleta" | "desacuerdos">): string | null {
  const partes = [!p.tiene_dibujo ? "sin dibujo" : "", p.incompleta ? "revisión de la jefatura incompleta" : "", p.desacuerdos > 0 ? `${p.desacuerdos} ${p.desacuerdos === 1 ? "desacuerdo" : "desacuerdos"}` : ""].filter(Boolean)
  return partes.length ? partes.join(" · ") : null
}

/** las filas de un cliente (null = todos los clientes); las pendientes primero, el resto como llegó */
export function filtrarBandeja<T extends { cliente_id: string | null; estado: EstadoPieza }>(filas: T[], cliente: string | null): T[] {
  const del = cliente ? filas.filter((f) => f.cliente_id === cliente) : filas
  return [...del.filter((f) => f.estado === "pendiente"), ...del.filter((f) => f.estado !== "pendiente")]
}

/** la siguiente pieza pendiente después de decidir una (la lista ya filtrada); null si no queda ninguna */
export function siguientePendiente(piezas: Array<{ id: string; estado: EstadoPieza }>, idActual: string | null): string | null {
  return piezas.find((p) => p.estado === "pendiente" && p.id !== idActual)?.id ?? null
}

/** qué dice el encabezado de la lista: «2 por aprobar · 2 otras revisiones esperan» */
export function resumenDeLaBandeja(o: { por_aprobar: number; otras_pendientes: number }): string {
  const a = o.por_aprobar === 0 ? "Nada por aprobar" : `${o.por_aprobar} por aprobar`
  const b = o.otras_pendientes > 0 ? ` · ${o.otras_pendientes} ${o.otras_pendientes === 1 ? "otra revisión espera" : "otras revisiones esperan"}` : ""
  return a + b
}

export interface PedidoDelPanel {
  accion: AccionDeLaPieza
  comentario: string
  laminas: number[]
  casilla: boolean
  /** cuántas láminas tiene la pieza y si exige la casilla «entiendo» (lo dice la lectura) */
  total: number
  exige_casilla: boolean
  /** el `status` de la fila que Emilio tenía en pantalla: si cambió, el servidor responde 409 y no toca nada */
  estado_visto: string
}

/** el cuerpo que el panel manda a `POST /api/piezas/{id}/decidir`, validado con LA MISMA regla del servidor; si no pasa, el porqué en palabras */
export function cuerpoDeDecisionDePieza(p: PedidoDelPanel): { cuerpo: PedidoDeDecision } | { error: string } {
  const v = validarDecision({ accion: p.accion, comentario: p.comentario, laminas: p.laminas, casilla: p.casilla, estado_visto: p.estado_visto }, p.total, p.exige_casilla)
  if (!v.ok) return { error: v.detalle }
  return { cuerpo: v.pedido }
}

export const MINIMOS = { cambios: COMENTARIO_MINIMO, rechazo: MOTIVO_MINIMO, maximo: COMENTARIO_MAXIMO } as const

/** «Pedir cambios» o «Pedir cambios en 2 láminas» */
export function textoDelBotonDeCambios(marcadas: number[]): string {
  return marcadas.length ? `Pedir cambios en ${marcadas.length} ${marcadas.length === 1 ? "lámina" : "láminas"}` : "Pedir cambios"
}

/** a qué alcanza el pedido de cambios y qué vuelve a gastar: «Láminas 1, 3 · vuelve a gastar ≈ US$ 1,03» */
export function alcanceDeLosCambios(marcadas: number[], gastoUsd: number | null): string {
  const que = marcadas.length === 1 ? `Lámina ${marcadas[0]}` : marcadas.length ? `Láminas ${marcadas.join(", ")}` : "Toda la pieza"
  return gastoUsd != null ? `${que} · vuelve a gastar ≈ ${usdES(gastoUsd)}` : `${que} · vuelve a gastar`
}

export interface RespuestaDeDecidir { ok?: boolean; simulado?: boolean; detalle?: string; nota?: string; error?: string }

/** lo que se le dice a Emilio cuando el servidor contestó bien */
export function avisoTrasDecidir(accion: AccionDeLaPieza, j: RespuestaDeDecidir): string {
  if (j.simulado) return j.detalle ?? "Simulado: no se guardó nada."
  if (accion === "aprobar") return j.nota ?? "Aprobada. Todavía no se publica en redes: es un paso aparte."
  if (accion === "cambios") return "Cambios pedidos. La oficina creativa rehace la pieza y vuelve a esta bandeja."
  return "Rechazada. La oficina no la vuelve a hacer salvo que la pidas de nuevo."
}

/** lo que se le dice cuando NO pudo: con franqueza y sin inventar */
export function errorTrasDecidir(status: number, j: RespuestaDeDecidir): string {
  if (status === 401 || status === 403) return "Tu sesión venció: entra de nuevo."
  if (status === 409) return `${j.detalle ?? "Otra decisión se adelantó."} Se actualizó la pantalla.`
  if (status === 501) return `Todavía no está disponible: ${j.detalle ?? "la plataforma aún no tiene esta acción"}. No se cambió nada.`
  return `No se pudo: ${j.detalle ?? j.error ?? status}.`
}

/** el cuerpo de «Rehacer esta pieza» (acción del tablero `rehacer-pieza`): gasta, así que lleva la confirmación explícita del gasto */
export function cuerpoDeRehacer(encargoId: string, comentario: string): Record<string, unknown> {
  const c = comentario.trim().slice(0, COMENTARIO_MAXIMO)
  return { encargo_id: encargoId, ...(c ? { comentario: c } : {}), confirmo_gasto: true }
}

/** la proporción de la lámina para el visor (historias 9:16 · carrusel 4:5); si el manifiesto no la trae, 4:5 */
export function proporcionDeLaLamina(l: { ancho: number | null; alto: number | null } | undefined): string {
  return l && l.ancho && l.alto ? `${l.ancho}/${l.alto}` : "1080/1350"
}
