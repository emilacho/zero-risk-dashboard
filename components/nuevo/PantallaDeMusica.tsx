"use client"

import { useEffect, useRef, useState } from "react"
import { AVISO_MEZCLA, AVISO_SIN_ENLACE, AVISO_SPOTIFY_SESION, ENLACE_DE_LA_MUSICA, GUION_DE_SPOTIFY, PANTALLA_MUSICA, direccionDelReproductor, leerEnlaceDeMusica, uriDeSpotify, type MusicaDeSpotify } from "@/lib/musica"

/**
 * LA PANTALLA CHICA DE LA IZQUIERDA del escritorio de TU OFICINA = música (sprint 6.13 · Emilio, 1-nov: «al tocarla se reproduce mi playlist»; «al tocarla nuevamente se corta»
 * es la regla de sus pantallas · 6.13b: «mejor una lista de Spotify»). Al pasar el ratón: luz suave recortada a la pantalla + rótulo «MÚSICA» con las letras de la marca.
 * Al tocarla: aparece un reproductor pequeño sobre la losa vacía y arranca (el toque es el gesto del usuario que Spotify/YouTube exigen para sonar). Al tocarla otra vez:
 * la música para y el reproductor se recoge. Sin login nuestro, sin costo, sin llaves. Coordenadas en píxeles de la foto 2560×1440. Se monta DENTRO de la proyección
 * de tu oficina (`.nv-proy`), que ya para los clics.
 *  · Spotify: su API de iframe (comprobada 1-nov): el reproductor se crea al abrir la oficina (oculto y en pausa); tocar = `play()` · tocar otra vez = `pause()`.
 *  · YouTube: el iframe nace con el toque (`autoplay=1`) y se quita al tocar otra vez.
 */
const FOTO = { w: 2560, h: 1440 }
const TAM_ROTULO = 10 // 6.15 (Emilio): «reduce el tamaño de las letras que dicen música en 70 %» → 32 × 0,3 ≈ 10 (cabe en el ancho de la pantalla chica)
const pct = (n: number, total: number) => `${((n / total) * 100).toFixed(4)}%`

const ESTILO = `
.nv-musica{cursor:pointer;outline:none;pointer-events:auto}
.nv-musica polygon{fill:rgba(255,140,40,0);stroke:none}
.nv-musica polygon.nv-luz{fill:url(#nv-luz-musica);opacity:0;mix-blend-mode:screen;pointer-events:none;transition:opacity .45s ease}
.nv-musica:hover polygon.nv-luz,.nv-musica:focus-visible polygon.nv-luz,.nv-musica[data-encendida="true"] polygon.nv-luz{opacity:1}
.nv-musica .nv-rotulo{opacity:0;transform:translateY(5px);transition:opacity .45s ease,transform .45s ease;pointer-events:none}
.nv-musica:hover .nv-rotulo,.nv-musica:focus-visible .nv-rotulo{opacity:1;transform:translateY(0)}
.nv-reproductor[data-visible="true"]{animation:nvMusicaEntra .5s ease both}
.nv-reproductor[data-visible="false"]{opacity:0;pointer-events:none;visibility:hidden}
@keyframes nvMusicaEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.nv-musica polygon.nv-luz,.nv-musica .nv-rotulo{transition:none}.nv-reproductor[data-visible="true"]{animation:none}}
`

/* ─── la API de iframe de Spotify (un solo guion por página; la promesa se guarda para los montajes siguientes) ─── */
interface ControladorDeSpotify { play: () => void; pause: () => void; togglePlay: () => void; destroy: () => void; loadUri: (uri: string) => void; addListener: (evento: string, cb: (e: { data: unknown }) => void) => void }
interface ApiDeSpotify { createController: (el: HTMLElement, opciones: { uri: string; width?: string | number; height?: string | number; theme?: "dark" | "light" }, cb: (c: ControladorDeSpotify) => void) => void }
declare global { interface Window { onSpotifyIframeApiReady?: (api: ApiDeSpotify) => void } }
let apiDeSpotify: Promise<ApiDeSpotify> | null = null
function cargarApiDeSpotify(): Promise<ApiDeSpotify> {
  if (apiDeSpotify) return apiDeSpotify
  apiDeSpotify = new Promise<ApiDeSpotify>((resolver) => {
    window.onSpotifyIframeApiReady = (api) => resolver(api)
    const s = document.createElement("script"); s.src = GUION_DE_SPOTIFY; s.async = true; document.head.appendChild(s)
  })
  return apiDeSpotify
}

function ReproductorDeSpotify({ musica, encendida }: { musica: MusicaDeSpotify; encendida: boolean }) {
  const caja = useRef<HTMLDivElement>(null)
  const controlador = useRef<ControladorDeSpotify | null>(null)
  const [listo, setListo] = useState(false)
  const [sonando, setSonando] = useState(false) // lo que reporta Spotify (playback_update): visible en el DOM para comprobarlo
  const uri = uriDeSpotify(musica)
  // el reproductor se crea al abrir la oficina, oculto y en pausa: así el toque solo tiene que decir play()
  useEffect(() => {
    let vivo = true
    const nodo = document.createElement("div"); caja.current?.appendChild(nodo)
    cargarApiDeSpotify().then((api) => { if (!vivo) return; api.createController(nodo, { uri, width: "100%", height: 152, theme: "dark" }, (c) => { if (!vivo) { c.destroy(); return } controlador.current = c; c.addListener("playback_update", (e) => { const d = e.data as { isPaused?: boolean } | undefined; setSonando(!!d && d.isPaused === false) }); setListo(true) }) })
    return () => { vivo = false; controlador.current?.destroy(); controlador.current = null; nodo.remove() }
  }, [uri])
  useEffect(() => { if (!listo || !controlador.current) return; if (encendida) controlador.current.play(); else controlador.current.pause() }, [encendida, listo])
  return <div ref={caja} data-spotify={uri} data-sonando={sonando} className="block min-h-[152px] w-full" />
}

export function PantallaDeMusica({ enlace = ENLACE_DE_LA_MUSICA, encendidaInicial = false }: { enlace?: string; encendidaInicial?: boolean }) {
  const [encendida, setEncendida] = useState(encendidaInicial)
  const musica = leerEnlaceDeMusica(enlace)
  const direccionYouTube = direccionDelReproductor(musica)
  const alternar = () => setEncendida((e) => !e)
  // Spotify: el reproductor vive siempre (oculto cuando está apagado) · YouTube: solo mientras suena
  const visible = encendida
  const montar = musica.proveedor === "spotify" || encendida
  return (
    <>
      <style>{ESTILO}</style>
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="pointer-events-none absolute inset-0 h-full w-full" role="group" aria-label="Pantallas del escritorio" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="nv-luz-musica" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(255,196,120,0.75)" /><stop offset="60%" stopColor="rgba(255,160,70,0.4)" /><stop offset="100%" stopColor="rgba(255,140,40,0.1)" />
          </radialGradient>
          <filter id="nv-luz-suave-musica" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" /></filter>
          <clipPath id="nv-sup-musica"><polygon points={PANTALLA_MUSICA.forma} /></clipPath>
        </defs>
        <g className="nv-musica" data-zona={PANTALLA_MUSICA.clave} data-encendida={encendida} data-proveedor={musica.proveedor ?? "ninguno"} role="button" tabIndex={0} aria-pressed={encendida}
          aria-label={encendida ? "Música: tocar para cortar" : "Música: tocar para reproducir"}
          onClick={(e) => { e.stopPropagation(); alternar() }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternar() } }}>
          <polygon points={PANTALLA_MUSICA.forma} />
          <g clipPath="url(#nv-sup-musica)"><polygon className="nv-luz" points={PANTALLA_MUSICA.forma} filter="url(#nv-luz-suave-musica)" /></g>
          <text className="nv-rotulo" x={PANTALLA_MUSICA.rotulo.x} y={PANTALLA_MUSICA.rotulo.y} textAnchor="middle" fill="none" stroke="#e8731a" strokeWidth={TAM_ROTULO * 0.9 / 16}
            fontSize={TAM_ROTULO} fontWeight="500" letterSpacing={TAM_ROTULO * 3.4 / 16} fontFamily="system-ui, Arial, sans-serif">{PANTALLA_MUSICA.rotulo.texto}</text>
        </g>
      </svg>
      {montar && (
        <div className="nv-reproductor absolute" data-reproductor="musica" data-visible={visible} role="region" aria-label="Música" aria-hidden={!visible}
          style={{ left: pct(PANTALLA_MUSICA.caja.x * FOTO.w, FOTO.w), top: pct(PANTALLA_MUSICA.caja.y * FOTO.h, FOTO.h), width: pct(PANTALLA_MUSICA.caja.w * FOTO.w, FOTO.w) }}
          onClick={(e) => e.stopPropagation()}>
          <div className="overflow-hidden rounded-md border border-[#e8731a]/40 bg-black/80 shadow-[0_0_30px_rgba(232,115,26,0.15)]">
            {musica.proveedor === "spotify" ? <ReproductorDeSpotify musica={musica} encendida={encendida} />
              : direccionYouTube ? <iframe src={direccionYouTube} title="Música" className="block aspect-video w-full" allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />
              : <p className="p-3 text-[12px] text-zinc-300">{AVISO_SIN_ENLACE}</p>}
          </div>
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Música · toca la pantalla otra vez para cortar</p>
          {musica.proveedor === "spotify" && <p className="mt-0.5 text-[10px] leading-snug text-zinc-500" data-aviso="spotify">{AVISO_SPOTIFY_SESION}</p>}
          {musica.proveedor === "youtube" && musica.mezcla && <p className="mt-0.5 text-[10px] leading-snug text-zinc-500" data-aviso="mezcla">{AVISO_MEZCLA}</p>}
        </div>
      )}
    </>
  )
}
