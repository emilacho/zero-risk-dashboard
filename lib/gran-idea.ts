/**
 * GRAN IDEA · la decisión desde /nuevo (sprint 6.11 · ADENDA 7.2). Lógica PURA del panel: arma el cuerpo que recibe la ruta de CC#1 (`POST /api/piezas/{id}/gran-idea`,
 * PR #77, reutilizada TAL CUAL) y traduce sus respuestas. La regla de la nota es LA MISMA que exige la plataforma (`NOTA_MINIMA` de `lib/concepto-decision.ts`).
 * El tablero no escribe nada: la plataforma aplica la decisión (cierra la tarjeta, resuelve la espera, abre la versión siguiente si hay cambios).
 */
import { NOTA_MINIMA, NOTA_MAXIMA, type ApuntaA } from "@/lib/concepto-decision"

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
