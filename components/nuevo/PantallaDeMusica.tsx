"use client"

import { useState } from "react"
import { AVISO_MEZCLA, AVISO_SIN_ENLACE, ENLACE_DE_LA_MUSICA, PANTALLA_MUSICA, direccionDelReproductor, leerEnlaceDeYouTube } from "@/lib/musica"

/**
 * LA PANTALLA CHICA DE LA IZQUIERDA del escritorio de TU OFICINA = música (sprint 6.13 · Emilio, 1-nov: «al tocarla se reproduce mi playlist»; «al tocarla nuevamente se corta»
 * es la regla de sus pantallas). Al pasar el ratón: luz suave recortada a la pantalla + rótulo «MÚSICA» con las letras de la marca. Al tocarla: aparece un reproductor
 * pequeño sobre la losa vacía y arranca (el toque es el gesto del usuario que YouTube exige para sonar). Al tocarla otra vez: el reproductor se quita y la música para.
 * Sin login, sin costo, sin llaves. Coordenadas en píxeles de la foto 2560×1440. Se monta DENTRO de la proyección de tu oficina (`.nv-proy`), que ya para los clics.
 */
const FOTO = { w: 2560, h: 1440 }
const TAM_ROTULO = 32 // como el rótulo del Centro de campaña dentro de marketing (≈ 26 px de la sala en pantalla)
const pct = (n: number, total: number) => `${((n / total) * 100).toFixed(4)}%`

const ESTILO = `
.nv-musica{cursor:pointer;outline:none;pointer-events:auto}
.nv-musica polygon{fill:rgba(255,140,40,0);stroke:none}
.nv-musica polygon.nv-luz{fill:url(#nv-luz-musica);opacity:0;mix-blend-mode:screen;pointer-events:none;transition:opacity .45s ease}
.nv-musica:hover polygon.nv-luz,.nv-musica:focus-visible polygon.nv-luz,.nv-musica[data-encendida="true"] polygon.nv-luz{opacity:1}
.nv-musica .nv-rotulo{opacity:0;transform:translateY(5px);transition:opacity .45s ease,transform .45s ease;pointer-events:none}
.nv-musica:hover .nv-rotulo,.nv-musica:focus-visible .nv-rotulo{opacity:1;transform:translateY(0)}
.nv-reproductor{animation:nvMusicaEntra .5s ease both}
@keyframes nvMusicaEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.nv-musica polygon.nv-luz,.nv-musica .nv-rotulo{transition:none}.nv-reproductor{animation:none}}
`

export function PantallaDeMusica({ enlace = ENLACE_DE_LA_MUSICA, encendidaInicial = false }: { enlace?: string; encendidaInicial?: boolean }) {
  const [encendida, setEncendida] = useState(encendidaInicial)
  const musica = leerEnlaceDeYouTube(enlace)
  const direccion = direccionDelReproductor(musica)
  const alternar = () => setEncendida((e) => !e)
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
        <g className="nv-musica" data-zona={PANTALLA_MUSICA.clave} data-encendida={encendida} role="button" tabIndex={0} aria-pressed={encendida}
          aria-label={encendida ? "Música: tocar para cortar" : "Música: tocar para reproducir"}
          onClick={(e) => { e.stopPropagation(); alternar() }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternar() } }}>
          <polygon points={PANTALLA_MUSICA.forma} />
          <g clipPath="url(#nv-sup-musica)"><polygon className="nv-luz" points={PANTALLA_MUSICA.forma} filter="url(#nv-luz-suave-musica)" /></g>
          <text className="nv-rotulo" x={PANTALLA_MUSICA.rotulo.x} y={PANTALLA_MUSICA.rotulo.y} textAnchor="middle" fill="none" stroke="#e8731a" strokeWidth={TAM_ROTULO * 0.9 / 16}
            fontSize={TAM_ROTULO} fontWeight="500" letterSpacing={TAM_ROTULO * 3.4 / 16} fontFamily="system-ui, Arial, sans-serif">{PANTALLA_MUSICA.rotulo.texto}</text>
        </g>
      </svg>
      {encendida && (
        <div className="nv-reproductor absolute" data-reproductor="musica" role="region" aria-label="Música"
          style={{ left: pct(PANTALLA_MUSICA.caja.x * FOTO.w, FOTO.w), top: pct(PANTALLA_MUSICA.caja.y * FOTO.h, FOTO.h), width: pct(PANTALLA_MUSICA.caja.w * FOTO.w, FOTO.w) }}
          onClick={(e) => e.stopPropagation()}>
          <div className="overflow-hidden rounded-md border border-[#e8731a]/40 bg-black/80 shadow-[0_0_30px_rgba(232,115,26,0.15)]">
            {direccion ? (
              <iframe src={direccion} title="Música" className="block aspect-video w-full" allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />
            ) : (
              <p className="p-3 text-[12px] text-zinc-300">{AVISO_SIN_ENLACE}</p>
            )}
          </div>
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Música · toca la pantalla otra vez para cortar</p>
          {musica.mezcla && <p className="mt-0.5 text-[10px] leading-snug text-zinc-500" data-aviso="mezcla">{AVISO_MEZCLA}</p>}
        </div>
      )}
    </>
  )
}
