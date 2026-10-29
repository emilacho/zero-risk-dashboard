/**
 * Puerta de /api del tablero (29-oct · Fase 0): DENEGAR POR OMISIÓN.
 * Antes el middleware dejaba pasar toda `/api/*` («cada ruta se cuida sola») y cinco rutas nacieron abiertas (cowork/messages, cowork/message, notifications/feed, dashboard/ops-extras, hitl/resolve).
 * Ahora entra solo: (1) una llave interna válida (`x-api-key` o `x-internal-key` igual a INTERNAL_API_KEY; sin llave configurada NO hay camino por llave), o (2) una sesión de un admin.
 * `API_PUBLICAS` es la lista blanca (webhooks que de verdad deban ser públicos): hoy vacía; agregar una ahí exige una línea y una razón.
 */
export const API_PUBLICAS: ReadonlySet<string> = new Set<string>([])

/** comparación en tiempo constante (el middleware corre en el borde: sin node:crypto) */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export function llaveInternaValida(req: Pick<Request, 'headers'>, esperada: string | undefined = process.env.INTERNAL_API_KEY): boolean {
  if (!esperada) return false
  const dada = req.headers.get('x-api-key') || req.headers.get('x-internal-key') || ''
  return dada.length > 0 && iguales(dada, esperada)
}
