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
  it("al doble, en claro y con halo oscuro; el título chico se apaga mientras tanto", () => {
    expect(TITULO_GRANDE.escala).toBeGreaterThanOrEqual(2)
    const h = renderToStaticMarkup(createElement("svg", null, createElement(TituloGrande, { lineas: ["IDEAS", "Y PROYECTOS"] })))
    expect(h).toContain("scale(2)"); expect(h).toContain('paint-order="stroke"'); expect(h.match(/<text/g)).toHaveLength(2)
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
