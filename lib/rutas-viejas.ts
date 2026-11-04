/**
 * EL DASHBOARD NUEVO ES EL ÚNICO QUE SE ABRE (CC6 · 03-nov · corrección de Lenovo «al recargar se ve el dashboard viejo morado», Emilio 18:07Z
 * y ADENDA 19:40Z: también entre clic y clic). Una sola tabla, usada por la puerta (`middleware.ts`) y por las pruebas:
 *   · `/` → el inicio nuevo (`/nuevo`, el «Inicio» del marco nuevo);
 *   · cada ruta vieja → su equivalente nuevo; las que tienen panel en el marco nuevo lo abren con `?panel=` (y la pieza con `&pieza=`);
 *   · sin equivalente → el inicio nuevo.
 * No se borra código viejo: solo se redirige (borrar va aparte, con firma de Emilio).
 */
import type { PanelDelMarco } from "@/lib/buscador"

export const INICIO_NUEVO = "/nuevo"
/** las pantallas del dashboard nuevo: ahí no se pinta nada del viejo (barra lateral, halo violeta, fondo violeta) */
export const esPantallaNueva = (pathname: string | null | undefined): boolean => !!pathname && (pathname === INICIO_NUEVO || pathname.startsWith(`${INICIO_NUEVO}/`))

const conPanel = (panel: PanelDelMarco, pieza?: string | null) => `${INICIO_NUEVO}?panel=${panel}${pieza ? `&pieza=${encodeURIComponent(pieza)}` : ""}`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** a dónde va una ruta vieja; null = no es una ruta vieja (se deja pasar) */
export function rutaNuevaDe(pathname: string, buscar: URLSearchParams = new URLSearchParams()): string | null {
  const p = pathname.replace(/\/+$/, "") || "/"
  const es = (base: string) => p === base || p.startsWith(`${base}/`)
  if (p === "/") return INICIO_NUEVO
  if (es("/piezas")) {
    const id = buscar.get("id") ?? (p.split("/")[2] || null)
    return conPanel("piezas", id && UUID.test(id) ? id : null)
  }
  if (es("/gasto")) return conPanel("dinero")
  if (es("/alertas")) return conPanel("riesgos")
  if (es("/mapa")) return conPanel("organizacion")
  if (es("/oficinas")) return `${INICIO_NUEVO}/oficina`
  // la ficha vieja de un cliente es por id; la nueva es por nombre: sin equivalente directo, al inicio nuevo
  if (es("/clientes")) return INICIO_NUEVO
  return null
}

/** los paneles que se pueden pedir por la dirección (`/nuevo?panel=…`) */
export const PANELES_POR_DIRECCION: readonly PanelDelMarco[] = ["riesgos", "dinero", "organizacion", "observabilidad", "piezas", "aplicaciones", "envivo", "decisiones"]
/** `?panel=piezas&pieza=<id>` → el pedido de panel; cualquier otra cosa, nada */
export function panelDeLaDireccion(buscar: string): { panel: PanelDelMarco; pieza: string | null } | null {
  const q = new URLSearchParams(buscar)
  const panel = q.get("panel") as PanelDelMarco | null
  if (!panel || !PANELES_POR_DIRECCION.includes(panel)) return null
  const pieza = q.get("pieza")
  return { panel, pieza: pieza && UUID.test(pieza) ? pieza : null }
}
