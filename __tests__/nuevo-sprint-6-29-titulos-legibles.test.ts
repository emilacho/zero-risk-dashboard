/**
 * DASHBOARD NUEVO · SPRINT 6.29 (2-nov · Emilio: «al pasar el cursor encima de las pantallas las letras del título deben agrandarse para que sean legibles»).
 * El título grande va en una capa sin recorte (el vidrio cortaba el título si crecía), sin ratón (el clic sigue siendo del vidrio), al doble y con halo oscuro.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { ESTILO_DE_DIRECCION, TITULO_GRANDE, TituloGrande } from "@/components/nuevo/TablerosDeDireccion"

describe("6.29 · el título se agranda y se lee al pasar el cursor", () => {
  it("hasta el doble (se ajusta a los largos); el título chico se apaga mientras tanto", () => {
    expect(TITULO_GRANDE.escala).toBeGreaterThanOrEqual(2)
    const h = renderToStaticMarkup(createElement("svg", null, createElement(TituloGrande, { lineas: ["IDEAS", "Y PROYECTOS"], clave: "arco-2", tono: "#ff9a2e" })))
    const e = Number(h.match(/scale\((\d\.\d+)\)/)?.[1]); expect(e).toBeGreaterThan(1.5); expect(e).toBeLessThanOrEqual(2) // 6.30: se ajusta a los largos
    expect(h.match(/class="nv-tg-letras"/g)).toHaveLength(1); expect(h.match(/<text/g)).toHaveLength(4) // letras + barrido
    expect(ESTILO_DE_DIRECCION).toContain(".nv-pantalla[data-encima] .nv-titulo{opacity:0}")
  })
  it("va en su propia capa, sin recorte y sin ratón, solo para la pantalla bajo el cursor", () => {
    const s = readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8")
    expect(s).toContain('className="nv-titulos-grandes pointer-events-none')
    expect(s).toContain("todas.filter(({ id, p }) => id === encima && p.titulo)")
    const capa = s.slice(s.indexOf("nv-titulos-grandes"), s.indexOf("nv-titulos-grandes") + 900)
    expect(capa).not.toContain("clipPath")
  })
})

describe("6.30 · elegante y futurista (Emilio: «demasiado básico… animación sutil, estilo futurista»)", () => {
  it("velo difuso, letras que se abren y se encienden con el tono de la pantalla, una luz que barre una vez y un visor que se dibuja", () => {
    const h = renderToStaticMarkup(createElement("svg", null, createElement(TituloGrande, { lineas: ["DECISIONES"], clave: "arco-5", tono: "#ff9a2e" })))
    expect(Number(h.match(/scale\((\d\.\d+)\)/)?.[1])).toBeGreaterThan(1.8); expect(h).toContain("nv-tg-velo"); expect(h).toContain("feGaussianBlur")
    expect(h).toContain('attributeName="x1"'); expect(h.match(/nv-tg-esquina/g)).toHaveLength(4); expect(h.match(/nv-tg-linea/g)).toHaveLength(2)
    expect(h).toContain("--tono:#ff9a2e"); expect(h).not.toContain("paint-order")
    for (const k of ["nvTgAbre", "nvTgEnciende", "nvTgTraza", "nvTgEsquina", "prefers-reduced-motion"]) expect(ESTILO_DE_DIRECCION).toContain(k)
  })
})
