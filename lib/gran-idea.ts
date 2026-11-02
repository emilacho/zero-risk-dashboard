/**
 * GRAN IDEA · la decisión desde /nuevo (sprint 6.11 · ADENDA 7.2). Lógica PURA del panel: arma el cuerpo que recibe la ruta de CC#1 (`POST /api/piezas/{id}/gran-idea`,
 * PR #77, reutilizada TAL CUAL) y traduce sus respuestas. La regla de la nota es LA MISMA que exige la plataforma (`NOTA_MINIMA` de `lib/concepto-decision.ts`).
 * El tablero no escribe nada: la plataforma aplica la decisión (cierra la tarjeta, resuelve la espera, abre la versión siguiente si hay cambios).
 */
import { NOTA_MINIMA, NOTA_MAXIMA, type ApuntaA } from "@/lib/concepto-decision"
import type { AvanceDelPedido } from "@/lib/plan"

export type AccionDeGranIdea = "aprobar" | "cambios"

export const rutaDeDecisionDeGranIdea = (hitlId: string): string => `/api/piezas/${encodeURIComponent(hitlId)}/gran-idea`

export interface PedidoDelPanelDeGranIdea { accion: AccionDeGranIdea; nota: string; apunta_a: ApuntaA; estado_visto: string }

/** aprobar: nota opcional · cambios: nota de al menos `NOTA_MINIMA` letras y a qué apunta (concepto | brief). `estado_visto` viaja siempre: una pantalla vieja recibe 409 */
export function cuerpoDeDecisionDeGranIdea(p: PedidoDelPanelDeGranIdea): { cuerpo: Record<string, unknown> } | { error: string } {
  const nota = p.nota.trim().slice(0, NOTA_MAXIMA)
  if (p.accion === "aprobar") return { cuerpo: { accion: "aprobar", ...(nota ? { nota } : {}), estado_visto: p.estado_visto } }
  if (nota.length < NOTA_MINIMA) return { error: `Escribe qué quieres distinto (mínimo ${NOTA_MINIMA} letras).` }
  return { cuerpo: { accion: "cambios", nota, apunta_a: p.apunta_a, estado_visto: p.estado_visto } }
}

export interface RespuestaDeDecisionDeGranIdea { ok?: boolean; nota?: string; detalle?: string; error?: string; ya_decidido?: boolean }

export function avisoTrasDecidirGranIdea(accion: AccionDeGranIdea, j: RespuestaDeDecisionDeGranIdea): string {
  if (j.nota) return j.nota
  return accion === "aprobar" ? "Gran idea aprobada. La cadena sigue con el calendario de la primera tanda." : "Cambios pedidos: la mesa de creativos hace otra ronda con tu nota."
}

export function errorTrasDecidirGranIdea(status: number, j: RespuestaDeDecisionDeGranIdea): string {
  if (status === 401 || status === 403) return "Necesitas una sesión de administrador para decidir."
  if (status === 409) return `${j.detalle ?? "La tarjeta cambió mientras la mirabas."} Se actualizó la pantalla.`
  if (status === 501) return "La plataforma todavía no tiene la ruta de la gran idea: no se envió nada."
  return j.detalle ?? j.error ?? `No se pudo decidir (${status}).`
}

/**
 * EL AVANCE TRAS «PEDIR CAMBIOS» (CC6 · 02-nov · el mismo patrón del plan y el manual): si la última propuesta quedó con cambios pedidos y todavía no llegó una nueva,
 * la sala creativa está rehaciendo. Tres pasos (recibido · la sala rehace · nueva propuesta lista). Sale de las tarjetas: no inventa tiempos que la base no tiene.
 */
export function avanceDeGranIdea(tarjetas: Array<{ estado: string; creada: string }>, decididoEn: string | null, ahora: Date): AvanceDelPedido | null {
  const [ultima] = tarjetas
  if (!ultima || ultima.estado !== "con_cambios") return null
  const minutos = decididoEn ? Math.max(0, Math.round((ahora.getTime() - Date.parse(decididoEn)) / 60000)) : null
  return {
    pasos: [
      { clave: "recibido", nombre: "Recibido", estado: "hecho", hora: decididoEn, detalle: null },
      { clave: "reescribiendo", nombre: "La sala creativa rehace la gran idea", estado: "en_curso", hora: decididoEn, detalle: null },
      { clave: "listo", nombre: "Nueva propuesta lista para ti", estado: "pendiente", hora: null, detalle: null },
    ],
    minutos, estimado: minutos != null ? `Van ${minutos} min desde tu pedido` : "En curso", nota: null, fallo: null, listo: false, ahora: null,
  }
}
/** lo que pasa al aprobar */
export const AL_APROBAR_LA_GRAN_IDEA = "La cadena arma el calendario de la primera tanda con esta idea y este brief."
