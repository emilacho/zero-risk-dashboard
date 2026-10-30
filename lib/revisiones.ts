/**
 * B7 · «Otras revisiones»: cada tipo con sus botones, en palabras de negocio (30-oct). Lo que cada botón hace lo decide la plataforma (`revision-resolver`):
 * aquí solo se dice cómo se llama y qué pide. Un tipo que no está en la lista lleva «Aprobar» / «Rechazar» genéricos, nunca queda solo de lectura.
 */
export interface BotonesDeRevision { aprobar: string; rechazar: string; pista: string }

export function botonesDeRevision(tipo: string): BotonesDeRevision {
  switch (tipo) {
    case "confirm_competitor_list": return { aprobar: "Confirmar la lista", rechazar: "Rechazar la lista", pista: "Si la confirmas, el sistema vigila a estos competidores." }
    case "editor_escalation": return { aprobar: "Dar por revisada", rechazar: "Devolver al equipo", pista: "El editor pidió que una persona mire este texto." }
    case "plan_con_pendientes": return { aprobar: "Aprobar el plan así", rechazar: "Pedir cambios al plan", pista: "El plan tiene puntos por resolver; puedes aprobarlo así o devolverlo." }
    default: return { aprobar: "Aprobar", rechazar: "Rechazar", pista: "" }
  }
}
