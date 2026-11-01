/**
 * DASHBOARD NUEVO · SPRINT 6.18 (Emilio, 1-nov): «que la bola del mundo que está como holograma gire lentamente en su propio eje sin dañar los detalles
 * preciosos que contiene» · «que al tocar cada pantalla se ilumine tal cual la oficina de marketing hiciste con el pizarrón».
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { GLOBO, TRAZO_DEL_GLOBO, cajaDelGlobo, giroDelGlobo } from "@/lib/globo-de-la-oficina"
import { GloboQueGira } from "@/components/nuevo/GloboQueGira"
import { PantallasDelArco } from "@/components/nuevo/PantallasDelArco"
import { EscenaViva } from "@/components/nuevo/EscenaViva"

describe("6.18 · el globo gira sobre su eje sin dañar sus detalles", () => {
  it("medido sobre la foto y lento", () => {
    expect(GLOBO.cx).toBeGreaterThan(1350); expect(GLOBO.cx).toBeLessThan(1365); expect(GLOBO.cy).toBeGreaterThan(714); expect(GLOBO.cy).toBeLessThan(726)
    expect(GLOBO.r).toBeGreaterThan(49); expect(GLOBO.r).toBeLessThan(54)
    expect(GLOBO.segundosPorVuelta).toBe(78) // despacio, 15 % más rápido que los 90 s del primer ensayo
    const c = cajaDelGlobo(); expect(c.w).toBeCloseTo(2 * GLOBO.r * GLOBO.margen, 6); expect(c.x + c.w / 2).toBe(GLOBO.cx)
  })
  it("6.18b · gira hacia el este a partir de Ecuador al frente, con el eje inclinado hacia la cámara", () => {
    expect(giroDelGlobo(0)).toEqual([-GLOBO.longitudInicial, -GLOBO.inclinacion, 0])
    expect(GLOBO.longitudInicial).toBe(-78); expect(GLOBO.inclinacion).toBeGreaterThan(0); expect(GLOBO.inclinacion).toBeLessThan(30)
    const [l0] = giroDelGlobo(0), [l1] = giroDelGlobo(1); expect(l1 - l0).toBeCloseTo(-360 / GLOBO.segundosPorVuelta, 6) // hacia el este
    expect(giroDelGlobo(GLOBO.segundosPorVuelta)[0]).toBeCloseTo(l0, 6) // una vuelta entera vuelve al mismo dibujo
    for (let t = 0; t < 400; t += 7.3) { const [l] = giroDelGlobo(t); expect(l).toBeGreaterThanOrEqual(-180); expect(l).toBeLessThanOrEqual(180) }
  })
  it("6.18b · redibujado con un mapa del mundo real; de la foto quedan la luz, el borde brillante y el anillo", () => {
    const src = readFileSync("components/nuevo/GloboQueGira.tsx", "utf8")
    expect(src).toContain('import("world-atlas/land-110m.json")'); expect(src).toContain("geoOrthographic"); expect(src).toContain("geoGraticule")
    expect(src).toContain('"destination-in"') // el fundido hacia la foto en el borde
    expect(GLOBO.fundido.desde).toBeLessThan(GLOBO.fundido.hasta); expect(GLOBO.fundido.hasta).toBeLessThan(1)
    expect(TRAZO_DEL_GLOBO.atras).toBeLessThan(0.5) // la cara de atrás, tenue
  })
  it("el lienzo va encima del globo de la foto, invisible hasta el primer cuadro, sin toques; solo en TU OFICINA", () => {
    const html = renderToStaticMarkup(createElement(GloboQueGira))
    expect(html).toMatch(/<canvas class="nv-globo pointer-events-none absolute" aria-hidden="true" data-listo="false"/)
    expect(html).toContain("opacity:0")
    const src = readFileSync("components/nuevo/GloboQueGira.tsx", "utf8")
    expect(src).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")'); expect(src).toContain("document.hidden")
    expect(src).not.toMatch(/fetch\(|onClick|createPortal|supabase|process\.env/)
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: "oficina" }))).toContain('class="nv-globo')
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: "marketing" }))).not.toContain("nv-globo")
  })
})

describe("6.18 · cada pantalla se ilumina al tocarla, como el pizarrón", () => {
  it("14 zonas de toque (la de música ya tiene la suya) con la misma luz que la pantalla de música; sin rótulos ni acciones", () => {
    const html = renderToStaticMarkup(createElement(PantallasDelArco))
    const toques = [...html.matchAll(/<g class="nv-toque" data-id="(arco|escritorio)-(\d+)" data-tono="[^"]+"><polygon class="nv-zona-toque" points="([^"]+)"><\/polygon><polygon class="nv-luz" points="\3"><\/polygon><\/g>/g)]
    expect(toques.length).toBe(14); expect(toques.map((t) => `${t[1]}-${t[2]}`)).not.toContain("escritorio-2")
    expect(html).toContain('<radialGradient id="nv-luz-pantalla"')
    expect(html).toContain(".nv-toque:hover polygon.nv-luz,.nv-toque:active polygon.nv-luz{opacity:1}")
    expect(html).toContain('.nv-proy:has(.nv-toque[data-id="arco-3"]:hover) .nv-pantalla[data-grupo="arco"][data-pantalla="3"] .nv-hud{opacity:1}')
    expect(html).toContain('.nv-proy:has(.nv-musica:hover) .nv-pantalla[data-grupo="escritorio"][data-pantalla="2"] .nv-hud{opacity:1}')
    // 6.18b · en los vidrios naranjas la luz cálida se perdía: luz más clara y filo de luz; los negros (durazno) siguen igual
    expect(html).toContain('<radialGradient id="nv-luz-clara"'); expect(html).toContain('.nv-toque:not([data-tono="durazno"]) polygon.nv-luz{fill:url(#nv-luz-clara)')
    expect(html.match(/class="nv-toque" data-id="[^"]+" data-tono="durazno"/g)!.length).toBe(5) // los 4 negros y el mapa (10)
    expect(html).not.toMatch(/role="button"|tabindex|<text|onclick/i)
    const luzMusica = readFileSync("components/nuevo/PantallaDeMusica.tsx", "utf8").match(/<radialGradient id="nv-luz-musica"[\s\S]*?<\/radialGradient>/)![0]
    const luz = readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8").match(/<radialGradient id="nv-luz-pantalla"[\s\S]*?<\/radialGradient>/)![0]
    expect(luz.replace(/\s+/g, " ").replace("nv-luz-pantalla", "X")).toBe(luzMusica.replace(/\s+/g, " ").replace("nv-luz-musica", "X")) // la misma luz
  })
})
