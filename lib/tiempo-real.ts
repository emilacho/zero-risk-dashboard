/**
 * TIEMPO REAL (CC#1 · 30-oct · ADENDA 3): las pantallas se ponen al día solas.
 * El tablero lee con la llave de servicio en el servidor, así que no hay suscripción directa desde el navegador:
 * cada pocos segundos la pantalla pide al servidor que vuelva a leer (`router.refresh()`), con la sesión del administrador.
 * Eso conserva lo que ya está en pantalla (la lámina que miras, lo que escribes). Aquí vive solo la decisión de CUÁNDO refrescar.
 */

/** cada cuánto se vuelve a leer (el encargo pide ≤ 10 s) */
export const INTERVALO_DE_ACTUALIZACION_MS = 8_000

/** pantallas que no se refrescan: el acceso aún no tiene sesión */
const RUTAS_SIN_REFRESCO = ["/login", "/auth"]

export function rutaSeRefresca(ruta: string | null | undefined): boolean {
  if (!ruta) return false
  return !RUTAS_SIN_REFRESCO.some((r) => ruta === r || ruta.startsWith(`${r}/`))
}

/** tras un clic o un cambio de pantalla no se recarga durante este rato: la navegación manda */
export const PAUSA_TRAS_NAVEGAR_MS = 4_000

export interface EstadoDeLaPantalla {
  /** ms desde el último clic en un enlace o cambio de ruta */
  desdeNavegar?: number
  ruta: string | null | undefined
  /** la pestaña no se está viendo */
  oculta: boolean
  /** el cursor está dentro de un campo de texto, o hay un panel de botón abierto */
  escribiendo: boolean
  /** se está enviando una acción */
  enviando?: boolean
  /** no hay conexión */
  sinRed?: boolean
}

/** ¿toca volver a leer ahora? Nunca mientras escribes o mientras envías: perderías lo escrito */
export function debeRefrescar(e: EstadoDeLaPantalla): boolean {
  return rutaSeRefresca(e.ruta) && !e.oculta && !e.escribiendo && !e.enviando && !e.sinRed && !(e.desdeNavegar !== undefined && e.desdeNavegar < PAUSA_TRAS_NAVEGAR_MS)
}
