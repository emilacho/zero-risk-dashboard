import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { MapaIsometrico } from "@/components/nuevo/MapaIsometrico"

const leer = (p: string) => readFileSync(p, "utf8")

describe("dashboard nuevo · paso 1 (/nuevo)", () => {
  const html = renderToStaticMarkup(createElement(MapaIsometrico))

  it("trae las cinco oficinas y cada una enlaza a su sección de /oficinas", () => {
    const enlaces = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*aria-label="([^"]+)"/g)].map((m) => [m[1], m[2]])
    expect(enlaces).toEqual(expect.arrayContaining([
      ["/oficinas#creativa", "Oficina creativa"], ["/oficinas#financiera", "Oficina financiera"], ["/oficinas#cerebro", "Cerebro"],
      ["/oficinas#jefatura", "Jefatura"], ["/oficinas#planeacion", "Planeación"],
    ]))
    expect(enlaces).toHaveLength(5)
  })

  it("las secciones a las que enlaza existen en /oficinas (clave de cada oficina)", () => {
    const fuente = leer("lib/oficinas.ts")
    for (const c of ["creativa", "financiera", "cerebro", "jefatura", "planeacion"]) expect(fuente, c).toContain(`"${c}"`)
  })

  it("es dibujo propio: sin imágenes, sin recursos externos ni JavaScript de navegador", () => {
    expect(html).not.toMatch(/<image|<img|href="https?:|xlink:href|url\(http/i)
    expect(leer("components/nuevo/MapaIsometrico.tsx")).not.toContain('"use client"')
  })

  it("la página no trae nada más que el dibujo y pide sesión de administrador", () => {
    const p = leer("app/nuevo/page.tsx")
    expect(p).toContain("exigirAdmin")
    expect(p).toContain("<MapaIsometrico />")
    expect(p).not.toMatch(/leerInicio|getServiceRoleClient|TrabajoEnVivo/)
  })
})
