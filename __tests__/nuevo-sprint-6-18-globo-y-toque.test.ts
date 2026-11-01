/**
 * DASHBOARD NUEVO · SPRINT 6.18 (Emilio, 1-nov): «que la bola del mundo que está como holograma gire lentamente en su propio eje sin dañar los detalles
 * preciosos que contiene» · «que al tocar cada pantalla se ilumine tal cual la oficina de marketing hiciste con el pizarrón».
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { GLOBO, cajaDelGlobo, origenesDelPunto } from "@/lib/globo-de-la-oficina"
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
  it("en el ángulo 0 el centro sale de sí mismo (arranca idéntico a la foto) y el borde nunca gira", () => {
    for (const [x, y] of [[0, 0], [0.3, -0.2], [-0.4, 0.4], [0.5, 0.1], [0.1, -0.6]]) {
      const o = origenesDelPunto(x, y, 0); expect(o.peso).toBe(1); expect(o.principal[0]).toBeCloseTo(x, 6); expect(o.principal[1]).toBeCloseTo(y, 6)
    }
    for (const [x, y] of [[0.95, 0], [0, -0.96], [-0.7, 0.7], [0.91, 0]]) expect(origenesDelPunto(x, y, 1.3).principal).toEqual([x, y])
  })
  it("girar es correr en longitud, tomando solo la franja nítida (nunca el canto), y la imagen vuelve a ser la misma cada 110°", () => {
    const o = origenesDelPunto(0, 0, 0.3); expect(o.principal[0]).toBeLessThan(0); expect(Math.abs(o.principal[1])).toBeLessThan(0.05)
    const tope = GLOBO.nitido + GLOBO.empalme
    for (let t = 0; t < 7; t += 0.37) for (let x = -0.9; x <= 0.9; x += 0.15) for (let y = -0.9; y <= 0.9; y += 0.15) {
      if (Math.hypot(x, y) >= 0.9) continue
      const r = origenesDelPunto(x, y, t)
      expect(Math.abs(r.longitudes![0])).toBeLessThanOrEqual(GLOBO.nitido + 1e-9) // el principal, dentro de la franja
      if (r.peso < 1) expect(Math.abs(r.longitudes![1])).toBeLessThanOrEqual(tope + 1e-9) // la copia vecina solo entra en el empalme, y sin llegar al canto
      for (const q of [r.principal, r.vecino]) expect(Math.hypot(q[0], q[1])).toBeLessThanOrEqual(1.0001)
    }
    expect(Math.sin(tope)).toBeLessThan(0.92) // el canto (brillo del borde) empieza más afuera
    const a = origenesDelPunto(0.2, 0.1, 0.4), b = origenesDelPunto(0.2, 0.1, 0.4 + 2 * GLOBO.nitido)
    expect(b.principal[0]).toBeCloseTo(a.principal[0], 6); expect(b.principal[1]).toBeCloseTo(a.principal[1], 6)
  })
  it("el empalme es suave: el peso va de 1 a ½ en el borde de la franja y ahí las dos copias pesan igual", () => {
    const pesos: number[] = []
    for (let t = 0; t < 2 * GLOBO.nitido; t += 0.01) pesos.push(origenesDelPunto(0, 0, t).peso)
    expect(Math.min(...pesos)).toBeGreaterThanOrEqual(0.5); expect(Math.max(...pesos)).toBe(1)
    for (let k = 1; k < pesos.length; k++) expect(Math.abs(pesos[k] - pesos[k - 1])).toBeLessThan(0.08) // sin saltos
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
    const toques = [...html.matchAll(/<g class="nv-toque" data-id="(arco|escritorio)-(\d+)"><polygon class="nv-zona-toque" points="([^"]+)"><\/polygon><polygon class="nv-luz" points="\3"><\/polygon><\/g>/g)]
    expect(toques.length).toBe(14); expect(toques.map((t) => `${t[1]}-${t[2]}`)).not.toContain("escritorio-2")
    expect(html).toContain('<radialGradient id="nv-luz-pantalla"')
    expect(html).toContain(".nv-toque:hover polygon.nv-luz,.nv-toque:active polygon.nv-luz{opacity:1}")
    expect(html).toContain('.nv-proy:has(.nv-toque[data-id="arco-3"]:hover) .nv-pantalla[data-grupo="arco"][data-pantalla="3"] .nv-hud{opacity:1}')
    expect(html).toContain('.nv-proy:has(.nv-musica:hover) .nv-pantalla[data-grupo="escritorio"][data-pantalla="2"] .nv-hud{opacity:1}')
    expect(html).not.toMatch(/role="button"|tabindex|<text|onclick/i)
    const luzMusica = readFileSync("components/nuevo/PantallaDeMusica.tsx", "utf8").match(/<radialGradient id="nv-luz-musica"[\s\S]*?<\/radialGradient>/)![0]
    const luz = readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8").match(/<radialGradient id="nv-luz-pantalla"[\s\S]*?<\/radialGradient>/)![0]
    expect(luz.replace(/\s+/g, " ").replace("nv-luz-pantalla", "X")).toBe(luzMusica.replace(/\s+/g, " ").replace("nv-luz-musica", "X")) // la misma luz
  })
})
