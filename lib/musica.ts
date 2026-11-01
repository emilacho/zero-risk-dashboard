/**
 * MÚSICA EN TU OFICINA (sprint 6.13 · Emilio, 1-nov: «la [pantalla chica] de la izquierda es para poner música: al tocarla se reproduce mi playlist. Comienza por ahí»).
 * Lógica PURA: lee el enlace de YouTube que dio Emilio y arma la dirección del reproductor incrustado (sin login, sin costo, sin llaves).
 * Comprobado en navegador real (1-nov): el reproductor incrustado arranca con sonido al tocar la pantalla (el toque es el gesto del usuario), PERO YouTube no incrusta
 * sus «mezclas» automáticas (listas `RD…`): con una mezcla suena solo la canción del enlace; con una lista propia (`PL…`, `OL…`, etc.) suena la lista completa.
 */

/** el enlace que dio Emilio (1-nov · chat). Cambiarlo = cambiar esta línea (no es un secreto). */
export const ENLACE_DE_LA_MUSICA = "https://www.youtube.com/watch?v=xVSM2CB4MLU&list=RDxVSM2CB4MLU&index=1"

export interface Musica { video: string | null; lista: string | null; /** lista `RD…` = mezcla automática: YouTube no la incrusta */ mezcla: boolean }

const ID = /^[A-Za-z0-9_-]{6,64}$/

/** acepta youtube.com/watch?v=…&list=…, youtu.be/…, youtube.com/playlist?list=… y youtube.com/embed/… */
export function leerEnlaceDeYouTube(enlace: string): Musica {
  let u: URL
  try { u = new URL(enlace.trim()) } catch { return { video: null, lista: null, mezcla: false } }
  const host = u.hostname.replace(/^www\.|^m\./, "")
  let video: string | null = null
  if (host === "youtu.be") video = u.pathname.slice(1).split("/")[0] || null
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") video = u.searchParams.get("v")
    else if (u.pathname.startsWith("/embed/")) video = u.pathname.slice(7).split("/")[0] || null
    else if (u.pathname.startsWith("/shorts/")) video = u.pathname.slice(8).split("/")[0] || null
  } else return { video: null, lista: null, mezcla: false }
  const lista = u.searchParams.get("list")
  const v = video && ID.test(video) ? video : null
  const l = lista && ID.test(lista) ? lista : null
  return { video: v, lista: l, mezcla: !!l && l.startsWith("RD") }
}

/** la dirección del reproductor incrustado (dominio sin cookies de seguimiento), o null si el enlace no sirve */
export function direccionDelReproductor(m: Musica): string | null {
  const base = "https://www.youtube-nocookie.com/embed/"
  const comunes = "autoplay=1&rel=0&playsinline=1&color=white&iv_load_policy=3"
  const lista = m.lista && !m.mezcla ? m.lista : null
  if (m.video) return `${base}${m.video}?${comunes}${lista ? `&list=${lista}` : ""}`
  if (lista) return `${base}videoseries?${comunes}&list=${lista}`
  return null
}

export const AVISO_MEZCLA = "YouTube no incrusta sus mezclas automáticas: suena la canción del enlace. Con una lista tuya (enlace con «list=PL…») suena la lista completa."
export const AVISO_SIN_ENLACE = "Falta el enlace de tu lista de YouTube."

/** la pantalla chica de la izquierda del escritorio (píxeles de oficina-2560.jpg · 2560×1440 · medida 1-nov): la que está inmediatamente a la izquierda de la silla */
export const PANTALLA_MUSICA = {
  clave: "musica",
  nombre: "Música",
  rotulo: { x: 1168, y: 416, texto: "MÚSICA" },
  forma: "1136,449 1196,440 1200,467 1140,476",
  /** dónde aparece el reproductor (fracción de la foto): sobre la losa vacía a la izquierda, debajo de la consola */
  caja: { x: 0.27, y: 0.40, w: 0.16 },
} as const
