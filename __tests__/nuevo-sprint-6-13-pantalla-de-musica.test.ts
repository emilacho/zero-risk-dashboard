/**
 * DASHBOARD NUEVO · SPRINT 6.13 (Emilio, 1-nov): «en mi escritorio tengo pequeñas pantallas … la de la izquierda es para poner música: al tocarla se reproduce mi playlist.
 * Comienza por ahí» (+ regla de sus pantallas: «al tocarla nuevamente se corta»). Enlace que dio: youtube.com/watch?v=xVSM2CB4MLU&list=RDxVSM2CB4MLU.
 *  · lógica pura: leer el enlace de YouTube, saber si es una «mezcla» (RD…, que YouTube no incrusta) y armar la dirección del reproductor incrustado.
 *  · la pantalla chica de la izquierda, DENTRO de tu oficina: luz + rótulo «MÚSICA» al pasar el ratón; tocar = reproductor con arranque automático; tocar otra vez = se quita.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { AVISO_MEZCLA, ENLACE_DE_LA_MUSICA, PANTALLA_MUSICA, direccionDelReproductor, leerEnlaceDeYouTube } from "@/lib/musica"
import { PantallaDeMusica } from "@/components/nuevo/PantallaDeMusica"
import { EscenaViva } from "@/components/nuevo/EscenaViva"
import { BarraSuperior } from "@/components/nuevo/MarcoNuevo"

describe("6.13 · la música: leer el enlace de YouTube", () => {
  it("el enlace de Emilio es el video xVSM2CB4MLU dentro de una MEZCLA automática (RD…): suena el video; la lista no se puede incrustar", () => {
    const m = leerEnlaceDeYouTube(ENLACE_DE_LA_MUSICA)
    expect(m).toEqual({ video: "xVSM2CB4MLU", lista: "RDxVSM2CB4MLU", mezcla: true })
    const d = direccionDelReproductor(m)!
    expect(d.startsWith("https://www.youtube-nocookie.com/embed/xVSM2CB4MLU?")).toBe(true)
    expect(d).toContain("autoplay=1"); expect(d).not.toContain("list=") // la mezcla no va: YouTube la rechaza («Video player configuration error» / sin lista)
  })
  it("acepta los formatos usuales y con una lista propia (PL…) la manda completa", () => {
    expect(leerEnlaceDeYouTube("https://youtu.be/xVSM2CB4MLU?t=10")).toEqual({ video: "xVSM2CB4MLU", lista: null, mezcla: false })
    expect(leerEnlaceDeYouTube("https://www.youtube.com/watch?v=xVSM2CB4MLU&list=PLabc123DEF_-ghi")).toEqual({ video: "xVSM2CB4MLU", lista: "PLabc123DEF_-ghi", mezcla: false })
    expect(direccionDelReproductor({ video: "xVSM2CB4MLU", lista: "PLabc123DEF_-ghi", mezcla: false })).toContain("&list=PLabc123DEF_-ghi")
    expect(direccionDelReproductor({ video: null, lista: "PLabc123DEF_-ghi", mezcla: false })).toBe("https://www.youtube-nocookie.com/embed/videoseries?autoplay=1&rel=0&playsinline=1&color=white&iv_load_policy=3&list=PLabc123DEF_-ghi")
    expect(leerEnlaceDeYouTube("https://m.youtube.com/shorts/xVSM2CB4MLU")).toMatchObject({ video: "xVSM2CB4MLU" })
    // basura o dominios ajenos: nada (y el reproductor no se arma)
    for (const e of ["", "no es un enlace", "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "https://www.youtube.com/watch?v=<script>"]) {
      const m = leerEnlaceDeYouTube(e); expect(m.video).toBeNull(); expect(m.lista).toBeNull(); expect(direccionDelReproductor(m)).toBeNull()
    }
  })
})

describe("6.13 · la pantalla chica de la izquierda, dentro de tu oficina", () => {
  it("apagada: la zona con rótulo «MÚSICA» (letras de la marca) sobre la pantalla de la izquierda del escritorio; sin reproductor; la foto no cambia", () => {
    const html = renderToStaticMarkup(createElement(PantallaDeMusica))
    expect(html).toMatch(new RegExp(`<g class="nv-musica" data-zona="musica" data-encendida="false" role="button" tabindex="0" aria-pressed="false" aria-label="Música: tocar para reproducir"[^>]*><polygon points="${PANTALLA_MUSICA.forma}"><\\/polygon>`))
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
  it("encendida: el reproductor incrustado con arranque automático y permiso de sonido, el aviso de la mezcla, y la pantalla iluminada; «tocar otra vez para cortar»", () => {
    const html = renderToStaticMarkup(createElement(PantallaDeMusica, { encendidaInicial: true }))
    expect(html).toContain('data-encendida="true"'); expect(html).toContain('aria-pressed="true"'); expect(html).toContain('aria-label="Música: tocar para cortar"')
    expect(html).toMatch(/<iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/xVSM2CB4MLU\?autoplay=1[^"]*" title="Música"[^>]*allow="autoplay; encrypted-media; picture-in-picture"/)
    expect(html).toContain("toca la pantalla otra vez para cortar"); expect(html).toContain(AVISO_MEZCLA)
    // el reproductor cae sobre la losa vacía de la izquierda (fracción de la foto), chico
    expect(html).toContain('style="left:27.0000%;top:40.0000%;width:16.0000%"')
    // con una lista propia no hay aviso de mezcla
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
