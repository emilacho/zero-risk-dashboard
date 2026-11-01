/**
 * DASHBOARD NUEVO · SPRINT 6.13 (Emilio, 1-nov): «en mi escritorio tengo pequeñas pantallas … la de la izquierda es para poner música: al tocarla se reproduce mi playlist.
 * Comienza por ahí» (+ regla de sus pantallas: «al tocarla nuevamente se corta»). Enlace que dio: youtube.com/watch?v=xVSM2CB4MLU&list=RDxVSM2CB4MLU.
 * 6.13b (1-nov): «mejor ponemos una lista de Spotify porque en YouTube no tengo nada» → el lector entiende enlaces de Spotify y el reproductor usa su API de iframe.
 *  · lógica pura: leer el enlace (Spotify o YouTube), saber si es una «mezcla» de YouTube (RD…, que no se incrusta) y armar lo que necesita el reproductor.
 *  · la pantalla chica de la izquierda, DENTRO de tu oficina: luz + rótulo «MÚSICA» al pasar el ratón; tocar = suena; tocar otra vez = se corta.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { AVISO_MEZCLA, AVISO_SPOTIFY_SESION, ENLACE_DE_LA_MUSICA, GUION_DE_SPOTIFY, PANTALLA_MUSICA, direccionDelReproductor, leerEnlaceDeMusica, leerEnlaceDeSpotify, leerEnlaceDeYouTube, uriDeSpotify } from "@/lib/musica"
import { PantallaDeMusica } from "@/components/nuevo/PantallaDeMusica"
import { EscenaViva } from "@/components/nuevo/EscenaViva"
import { BarraSuperior } from "@/components/nuevo/MarcoNuevo"

const LISTA_SPOTIFY = "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123" // lista pública (para probar); la de Emilio va en ENLACE_DE_LA_MUSICA

describe("6.13 · la música: leer el enlace", () => {
  it("el enlace vigente se entiende y arma un reproductor (Spotify o YouTube)", () => {
    const m = leerEnlaceDeMusica(ENLACE_DE_LA_MUSICA)
    expect(m.proveedor).not.toBeNull()
    if (m.proveedor === "spotify") expect(uriDeSpotify(m)).toMatch(/^spotify:(playlist|album|track|artist|show|episode):[A-Za-z0-9]{22}$/)
    else if (m.proveedor === "youtube") expect(direccionDelReproductor(m)).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/.*autoplay=1/)
  })
  it("Spotify: enlaces de lista/álbum/canción (con ?si=, con /intl-es/, con /embed/) y URIs; basura, no", () => {
    expect(leerEnlaceDeSpotify(LISTA_SPOTIFY)).toEqual({ proveedor: "spotify", tipo: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" })
    expect(leerEnlaceDeSpotify("https://open.spotify.com/intl-es/album/4LH4d3cOWNNsVw41Gqt2kv")).toEqual({ proveedor: "spotify", tipo: "album", id: "4LH4d3cOWNNsVw41Gqt2kv" })
    expect(leerEnlaceDeSpotify("https://open.spotify.com/embed/track/4LH4d3cOWNNsVw41Gqt2kv?utm_source=generator")).toMatchObject({ tipo: "track" })
    expect(leerEnlaceDeSpotify("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M")).toMatchObject({ tipo: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" })
    expect(uriDeSpotify({ proveedor: "spotify", tipo: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" })).toBe("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M")
    expect(GUION_DE_SPOTIFY).toBe("https://open.spotify.com/embed/iframe-api/v1")
    for (const e of ["", "https://open.spotify.com/user/alguien", "https://open.spotify.com/playlist/corto", "https://open.spotify.com/playlist/<script>alert(1)</script>", "https://evil.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "spotify:playlist:x"]) expect(leerEnlaceDeSpotify(e)).toBeNull()
    expect(direccionDelReproductor({ proveedor: "spotify", tipo: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" })).toBeNull() // el de YouTube no aplica a Spotify
  })
  it("YouTube: el enlace original de Emilio es el video xVSM2CB4MLU dentro de una MEZCLA (RD…): suena el video, la lista no se incrusta", () => {
    const m = leerEnlaceDeYouTube("https://www.youtube.com/watch?v=xVSM2CB4MLU&list=RDxVSM2CB4MLU&index=1")!
    expect(m).toEqual({ proveedor: "youtube", video: "xVSM2CB4MLU", lista: "RDxVSM2CB4MLU", mezcla: true })
    const d = direccionDelReproductor(m)!
    expect(d.startsWith("https://www.youtube-nocookie.com/embed/xVSM2CB4MLU?")).toBe(true)
    expect(d).toContain("autoplay=1"); expect(d).not.toContain("list=") // la mezcla no va: YouTube la rechaza («Video player configuration error» / sin lista)
  })
  it("YouTube: acepta los formatos usuales y con una lista propia (PL…) la manda completa; Spotify y basura devuelven null", () => {
    expect(leerEnlaceDeYouTube("https://youtu.be/xVSM2CB4MLU?t=10")).toEqual({ proveedor: "youtube", video: "xVSM2CB4MLU", lista: null, mezcla: false })
    expect(leerEnlaceDeYouTube("https://www.youtube.com/watch?v=xVSM2CB4MLU&list=PLabc123DEF_-ghi")).toMatchObject({ video: "xVSM2CB4MLU", lista: "PLabc123DEF_-ghi", mezcla: false })
    expect(direccionDelReproductor({ proveedor: "youtube", video: "xVSM2CB4MLU", lista: "PLabc123DEF_-ghi", mezcla: false })).toContain("&list=PLabc123DEF_-ghi")
    expect(direccionDelReproductor({ proveedor: "youtube", video: null, lista: "PLabc123DEF_-ghi", mezcla: false })).toBe("https://www.youtube-nocookie.com/embed/videoseries?autoplay=1&rel=0&playsinline=1&color=white&iv_load_policy=3&list=PLabc123DEF_-ghi")
    expect(leerEnlaceDeYouTube("https://m.youtube.com/shorts/xVSM2CB4MLU")).toMatchObject({ video: "xVSM2CB4MLU" })
    for (const e of ["", "no es un enlace", LISTA_SPOTIFY, "https://www.youtube.com/watch?v=<script>"]) expect(leerEnlaceDeYouTube(e)).toBeNull()
    expect(leerEnlaceDeMusica("no es un enlace")).toEqual({ proveedor: null }); expect(direccionDelReproductor({ proveedor: null })).toBeNull()
    expect(leerEnlaceDeMusica(LISTA_SPOTIFY).proveedor).toBe("spotify") // el lector general prefiere Spotify y cae a YouTube
  })
})

describe("6.13 · la pantalla chica de la izquierda, dentro de tu oficina", () => {
  it("apagada: la zona con rótulo «MÚSICA» (letras de la marca) sobre la pantalla de la izquierda del escritorio; sin reproductor a la vista; la foto no cambia", () => {
    const html = renderToStaticMarkup(createElement(PantallaDeMusica, { enlace: "https://youtu.be/xVSM2CB4MLU" }))
    expect(html).toMatch(new RegExp(`<g class="nv-musica" data-zona="musica" data-encendida="false" data-proveedor="youtube" role="button" tabindex="0" aria-pressed="false" aria-label="Música: tocar para reproducir"[^>]*><polygon points="${PANTALLA_MUSICA.forma}"><\\/polygon>`))
    expect(html).toContain(">MÚSICA</text>"); expect(html).not.toContain("<iframe"); expect(html).not.toContain('data-reproductor="musica"')
    expect(html).toMatch(/\.nv-musica polygon\.nv-luz\{[^}]*mix-blend-mode:screen[^}]*transition:opacity \.45s/)
    expect(html).toContain('.nv-musica[data-encendida="true"] polygon.nv-luz{opacity:1}') // encendida, la pantalla queda iluminada
    // a la izquierda de la silla (x < 1224, el borde de la pantalla central) y sobre la consola (y 430-480)
    for (const par of PANTALLA_MUSICA.forma.split(" ")) { const [x, y] = par.split(",").map(Number); expect(x).toBeGreaterThan(1100); expect(x).toBeLessThan(1224); expect(y).toBeGreaterThan(430); expect(y).toBeLessThan(480) }
    const logo = renderToStaticMarkup(createElement(BarraSuperior)).match(/<text[^>]*>ZERO RISK<\/text>/)![0]
    const rotulo = html.match(/<text class="nv-rotulo"[^>]*>MÚSICA<\/text>/)![0]
    const num = (s: string, k: string) => Number(s.match(new RegExp(`${k}="([\\d.]+)"`))![1])
    for (const s of [logo, rotulo]) { expect(s).toContain('fill="none"'); expect(s).toContain('stroke="#e8731a"'); expect(s).toContain('font-weight="500"') }
    expect(num(rotulo, "letter-spacing") / num(rotulo, "font-size")).toBeCloseTo(num(logo, "letter-spacing") / num(logo, "font-size"), 3)
  })
  it("Spotify: el reproductor vive desde que se abre la oficina (oculto y en pausa) y al tocar se muestra; aviso de la sesión de Spotify", () => {
    const apagada = renderToStaticMarkup(createElement(PantallaDeMusica, { enlace: LISTA_SPOTIFY }))
    expect(apagada).toContain('data-proveedor="spotify"')
    expect(apagada).toMatch(/<div class="nv-reproductor absolute" data-reproductor="musica" data-visible="false" role="region" aria-label="Música" aria-hidden="true"/)
    expect(apagada).toContain('data-spotify="spotify:playlist:37i9dQZF1DXcBWIGoYBM5M"'); expect(apagada).not.toContain("<iframe") // el iframe lo crea la API de Spotify en el navegador
    expect(apagada).toContain('.nv-reproductor[data-visible="false"]{opacity:0;pointer-events:none;visibility:hidden}')
    const encendida = renderToStaticMarkup(createElement(PantallaDeMusica, { enlace: LISTA_SPOTIFY, encendidaInicial: true }))
    expect(encendida).toContain('data-encendida="true"'); expect(encendida).toContain('aria-pressed="true"'); expect(encendida).toContain('aria-label="Música: tocar para cortar"')
    expect(encendida).toContain('data-visible="true"'); expect(encendida).toContain("toca la pantalla otra vez para cortar"); expect(encendida).toContain(AVISO_SPOTIFY_SESION)
    expect(encendida).not.toContain(AVISO_MEZCLA)
    // el reproductor cae sobre la losa vacía de la izquierda (fracción de la foto), chico
    expect(encendida).toContain('style="left:24.5000%;top:40.0000%;width:20.5000%"')
    const c = readFileSync("components/nuevo/PantallaDeMusica.tsx", "utf8")
    expect(c).toContain("if (encendida) controlador.current.play(); else controlador.current.pause()") // tocar = play · tocar otra vez = pause
    expect(c).toContain("controlador.current?.destroy()") // al cerrar la oficina, el reproductor se destruye (y la música con él)
  })
  it("YouTube: encendida, el iframe con arranque automático y permiso de sonido nace con el toque y el aviso de la mezcla aparece solo con mezclas", () => {
    const html = renderToStaticMarkup(createElement(PantallaDeMusica, { enlace: "https://www.youtube.com/watch?v=xVSM2CB4MLU&list=RDxVSM2CB4MLU", encendidaInicial: true }))
    expect(html).toContain('data-encendida="true"'); expect(html).toContain('data-visible="true"')
    expect(html).toMatch(/<iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/xVSM2CB4MLU\?autoplay=1[^"]*" title="Música"[^>]*allow="autoplay; encrypted-media; picture-in-picture"/)
    expect(html).toContain(AVISO_MEZCLA); expect(html).not.toContain(AVISO_SPOTIFY_SESION)
    expect(renderToStaticMarkup(createElement(PantallaDeMusica, { encendidaInicial: true, enlace: "https://www.youtube.com/watch?v=xVSM2CB4MLU&list=PLabc123DEF_-ghi" }))).not.toContain(AVISO_MEZCLA)
  })
  it("vive solo dentro de TU OFICINA (no en marketing ni en la sala) y el toque no cierra la oficina", () => {
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: "oficina" }))).toContain('data-zona="musica"')
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: "marketing" }))).not.toContain('data-zona="musica"')
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: false }))).not.toContain('data-zona="musica"')
    const c = readFileSync("components/nuevo/PantallaDeMusica.tsx", "utf8")
    expect(c).toContain("onClick={(e) => { e.stopPropagation(); alternar() }}") // el clic fuera de la foto cierra la oficina; el toque en la pantalla, no
    expect(c).not.toMatch(/fetch\(|supabase|process\.env/) // sin red propia, sin base, sin llaves
    expect(readFileSync("components/nuevo/EscenaViva.tsx", "utf8")).toContain('{depto === "oficina" && <PantallaDeMusica />}')
  })
})
