import { describe, expect, it } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { EscenaNuevo, ZONAS, VISTA } from "@/components/nuevo/EscenaNuevo"
import { BarraDeChat, BarraSuperior, MENU, MenuLateral } from "@/components/nuevo/MarcoNuevo"

const leer = (p: string) => readFileSync(p, "utf8")
const enlaces = (html: string) => [...html.matchAll(/<a [^>]*?href="([^"]+)"/g)].map((m) => m[1])

describe("dashboard nuevo · sprint 1 (/nuevo)", () => {
  it("de la escena solo son clicables DOS cosas: el monolito (cerebro) y las pantallas y el proyector (oficinas)", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(enlaces(html).sort()).toEqual(["/oficinas", "/oficinas#cerebro"])
    expect(ZONAS.map((z) => z.clave)).toEqual(["cerebro", "oficinas"])
    expect(ZONAS[1].formas.length).toBe(4) // el proyector y las tres pantallas
  })
  it("las zonas caen dentro del recorte de la imagen (si no, el clic no coincidiría con el dibujo)", () => {
    for (const z of ZONAS) for (const f of z.formas) for (const par of f.split(" ")) {
      const [x, y] = par.split(",").map(Number)
      expect(x).toBeGreaterThanOrEqual(VISTA.x); expect(x).toBeLessThanOrEqual(VISTA.x + VISTA.w)
      expect(y).toBeGreaterThanOrEqual(VISTA.y); expect(y).toBeLessThanOrEqual(VISTA.y + VISTA.h)
    }
  })
  it("las imágenes de la escena existen y son livianas (< 500 KB la grande)", () => {
    for (const [f, max] of [["public/nuevo/escena-2560.jpg", 500_000], ["public/nuevo/escena-1280.jpg", 200_000]] as const) {
      expect(existsSync(f), f).toBe(true)
      expect(readFileSync(f).length, f).toBeLessThan(max)
    }
  })
  it("barra superior: ≡ · Zero Risk · Seleccionar cliente · Buscar con «/» · y los 5 iconos (+, campana, $, salir, claro/oscuro)", () => {
    const html = renderToStaticMarkup(createElement(BarraSuperior))
    for (const t of ["Zero Risk", "Seleccionar cliente", "Buscar", "Menú"]) expect(html).toContain(t)
    expect(html).toContain("<kbd")
    for (const e of ["Nuevo", "Alertas", "Gasto", "Salir", "Claro u oscuro"]) expect(html).toContain(`aria-label="${e}"`)
    expect(enlaces(html).sort()).toEqual(["/alertas", "/gasto"]) // solo los que ya tienen pantalla
  })
  it("menú lateral: los 8 lugares de la referencia; enlaza solo donde hay pantalla equivalente", () => {
    expect(MENU).toHaveLength(8)
    const html = renderToStaticMarkup(createElement(MenuLateral))
    expect(enlaces(html).sort()).toEqual(["/mapa", "/nuevo", "/oficinas", "/piezas"])
  })
  it("adenda 4: riel sin teléfono (con el flujo y la onda al final), logo en contorno, escena con viñeta", () => {
    expect(MENU.map((m) => m.etiqueta)).toEqual(["Inicio", "Oficinas", "Guías", "Aplicaciones", "Piezas", "Empleados", "Flujos", "Actividad"])
    const marca = renderToStaticMarkup(createElement(BarraSuperior))
    expect(marca).toMatch(/-webkit-text-stroke:1px[^;"]*;?/i)
    expect(marca).toMatch(/color:transparent/)
    expect(renderToStaticMarkup(createElement(EscenaNuevo))).toMatch(/mask-image:radial-gradient/)
  })
  it("la barra de chat es SOLO la forma: sin campo de texto, sin formulario, sin envío", () => {
    const html = renderToStaticMarkup(createElement(BarraDeChat))
    expect(html).toContain("Habla con tus oficinas…")
    expect(html).not.toMatch(/<input|<textarea|<form|<button|onSubmit|href=/)
  })
  it("es dibujo propio y de servidor: sin recursos externos ni JavaScript de navegador; la marca es la nuestra", () => {
    const todo = ["components/nuevo/EscenaNuevo.tsx", "components/nuevo/MarcoNuevo.tsx", "app/nuevo/page.tsx"].map(leer).join("\n")
    expect(todo).not.toContain('"use client"')
    expect(todo.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, "")).not.toMatch(/https?:\/\//i)
    const html = [EscenaNuevo, BarraSuperior, MenuLateral, BarraDeChat].map((c) => renderToStaticMarkup(createElement(c))).join("")
    expect(html).not.toMatch(/airrived/i)
    expect(html).toContain("Zero Risk")
  })
  it("la página pide sesión de administrador y no lee la base", () => {
    const p = leer("app/nuevo/page.tsx")
    expect(p).toContain("exigirAdmin")
    expect(p).not.toMatch(/leerInicio|getServiceRoleClient|TrabajoEnVivo/)
  })
})
