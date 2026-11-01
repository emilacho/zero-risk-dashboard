/**
 * MÚSICA EN TU OFICINA (sprint 6.13 · Emilio, 1-nov: «la [pantalla chica] de la izquierda es para poner música: al tocarla se reproduce mi playlist. Comienza por ahí»;
 * 6.13b: «mejor ponemos una lista de Spotify porque en YouTube no tengo nada»).
 * Lógica PURA: lee el enlace (Spotify o YouTube) y arma lo que necesita el reproductor incrustado (sin login nuestro, sin costo, sin llaves).
 * Comprobado en navegador real (1-nov):
 *  · Spotify: el reproductor incrustado se maneja con su API de iframe (`open.spotify.com/embed/iframe-api/v1`): `play()` al tocar arranca con sonido (el toque es el gesto),
 *    `pause()` corta y `play()` retoma. Sin sesión de Spotify en el navegador suenan avances de 30 s; con sesión (cuenta de Emilio abierta en ese navegador), las canciones enteras.
 *  · YouTube: arranca con `autoplay=1` si el iframe nace del toque, PERO no incrusta sus «mezclas» (`RD…`): con una mezcla suena solo el video del enlace.
 */

/** el enlace que dio Emilio (1-nov, chat): su lista de Spotify. Cambiarlo = cambiar esta línea (no es un secreto). El enlace anterior (YouTube, mezcla) sigue soportado. */
export const ENLACE_DE_LA_MUSICA = "https://open.spotify.com/playlist/5kbmFdfUJ4fA5R8DpEsxDv?si=amiRDD6aR2m43fjDBzrmJw"

export type TipoDeSpotify = "playlist" | "album" | "track" | "artist" | "show" | "episode"
export interface MusicaDeSpotify { proveedor: "spotify"; tipo: TipoDeSpotify; id: string }
export interface MusicaDeYouTube { proveedor: "youtube"; video: string | null; lista: string | null; /** lista `RD…` = mezcla automática: YouTube no la incrusta */ mezcla: boolean }
export interface SinMusica { proveedor: null }
export type Musica = MusicaDeSpotify | MusicaDeYouTube | SinMusica

const ID = /^[A-Za-z0-9_-]{6,64}$/
const ID_SPOTIFY = /^[A-Za-z0-9]{22}$/
const TIPOS_SPOTIFY: TipoDeSpotify[] = ["playlist", "album", "track", "artist", "show", "episode"]

/** open.spotify.com/playlist/<id>?si=… (también /intl-es/playlist/…, /embed/playlist/…) y las URIs spotify:playlist:<id> */
export function leerEnlaceDeSpotify(enlace: string): MusicaDeSpotify | null {
  const e = enlace.trim()
  const uri = e.match(/^spotify:([a-z]+):([A-Za-z0-9]+)$/)
  if (uri) { const tipo = uri[1] as TipoDeSpotify; return TIPOS_SPOTIFY.includes(tipo) && ID_SPOTIFY.test(uri[2]) ? { proveedor: "spotify", tipo, id: uri[2] } : null }
  let u: URL
  try { u = new URL(e) } catch { return null }
  if (u.hostname.replace(/^www\./, "") !== "open.spotify.com") return null
  const partes = u.pathname.split("/").filter(Boolean).filter((p) => p !== "embed" && !/^intl-[a-z]{2}(-[a-z]{2})?$/i.test(p))
  const tipo = partes[0] as TipoDeSpotify, id = partes[1] ?? ""
  return TIPOS_SPOTIFY.includes(tipo) && ID_SPOTIFY.test(id) ? { proveedor: "spotify", tipo, id } : null
}

/** acepta youtube.com/watch?v=…&list=…, youtu.be/…, youtube.com/playlist?list=… y youtube.com/embed/… */
export function leerEnlaceDeYouTube(enlace: string): MusicaDeYouTube | null {
  let u: URL
  try { u = new URL(enlace.trim()) } catch { return null }
  const host = u.hostname.replace(/^www\.|^m\./, "")
  let video: string | null = null
  if (host === "youtu.be") video = u.pathname.slice(1).split("/")[0] || null
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") video = u.searchParams.get("v")
    else if (u.pathname.startsWith("/embed/")) video = u.pathname.slice(7).split("/")[0] || null
    else if (u.pathname.startsWith("/shorts/")) video = u.pathname.slice(8).split("/")[0] || null
  } else return null
  const lista = u.searchParams.get("list")
  const v = video && ID.test(video) ? video : null
  const l = lista && ID.test(lista) ? lista : null
  if (!v && !l) return null
  return { proveedor: "youtube", video: v, lista: l, mezcla: !!l && l.startsWith("RD") }
}

export function leerEnlaceDeMusica(enlace: string): Musica {
  return leerEnlaceDeSpotify(enlace) ?? leerEnlaceDeYouTube(enlace) ?? { proveedor: null }
}

/** Spotify: la URI que recibe su API de iframe (`createController({ uri })`) */
export const uriDeSpotify = (m: MusicaDeSpotify): string => `spotify:${m.tipo}:${m.id}`
export const GUION_DE_SPOTIFY = "https://open.spotify.com/embed/iframe-api/v1"

/** YouTube: la dirección del reproductor incrustado (dominio sin cookies de seguimiento), o null si el enlace no sirve */
export function direccionDelReproductor(m: Musica): string | null {
  if (m.proveedor !== "youtube") return null
  const base = "https://www.youtube-nocookie.com/embed/"
  const comunes = "autoplay=1&rel=0&playsinline=1&color=white&iv_load_policy=3"
  const lista = m.lista && !m.mezcla ? m.lista : null
  if (m.video) return `${base}${m.video}?${comunes}${lista ? `&list=${lista}` : ""}`
  if (lista) return `${base}videoseries?${comunes}&list=${lista}`
  return null
}

export const AVISO_MEZCLA = "YouTube no incrusta sus mezclas automáticas: suena la canción del enlace. Con una lista tuya (enlace con «list=PL…») suena la lista completa."
export const AVISO_SIN_ENLACE = "Falta el enlace de tu lista (Spotify o YouTube)."
export const AVISO_SPOTIFY_SESION = "Si tu cuenta de Spotify está abierta en este navegador suenan las canciones enteras; si no, avances de 30 segundos."

/** la pantalla chica de la izquierda del escritorio (píxeles de oficina-2560.jpg · 2560×1440 · medida 1-nov): la que está inmediatamente a la izquierda de la silla */
export const PANTALLA_MUSICA = {
  clave: "musica",
  nombre: "Música",
  rotulo: { x: 1168, y: 435, texto: "MÚSICA" }, // 6.15: letras al 30 % → el rótulo baja a pegarse al borde superior de la pantalla
  forma: "1141,450 1190,438 1200,460 1150,470", // 6.16b: re-medida sobre la foto ampliada con cuadrícula (la vieja quedaba corrida)
  /** dónde aparece el reproductor (fracción de la foto): sobre la losa vacía a la izquierda, debajo de la consola */
  caja: { x: 0.245, y: 0.40, w: 0.205 },
} as const
