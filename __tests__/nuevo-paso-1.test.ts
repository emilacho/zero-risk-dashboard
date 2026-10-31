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
    expect(enlaces(html).sort()).toEqual(["/nuevo/marketing", "/oficinas#cerebro"])
    expect(ZONAS.map((z) => z.clave)).toEqual(["cerebro", "marketing"])
    expect(ZONAS[1].formas.length).toBe(1) // la plataforma de marketing (la pantalla de pie queda libre para «En vivo»)
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
  it("adenda 4: riel sin teléfono (con el flujo y la onda al final), logo en contorno, escena ya sin viñeta (5.2)", () => {
    expect(MENU.map((m) => m.etiqueta)).toEqual(["Inicio", "Oficinas", "Guías", "Aplicaciones", "Piezas", "Empleados", "Flujos", "Actividad"])
    const marca = renderToStaticMarkup(createElement(BarraSuperior))
    expect(marca).toMatch(/<text[^>]*fill="none"[^>]*stroke="#e8731a"/) // solo trazo, interior transparente
    expect(marca).not.toMatch(/font-display/)
    // 5.2 (31-oct): la viñeta se quitó a pedido de Emilio («iguala la iluminación a la de la foto original»); ver nuevo-sprint-5-vida-spline.test.ts
    // 5.8 (31-oct): vuelve UNA máscara, pero solo un fundido corto arriba y abajo (nunca radial) para que los bordes se mezclen con el negro de la página
    const escena = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(escena).not.toMatch(/radial-gradient/)
    expect(escena).toContain("mask-image:linear-gradient(to bottom,transparent 0,#000 8%,#000 92%,transparent 100%)")
  })
  it("la barra de chat es SOLO la forma: sin campo de texto, sin formulario, sin envío", () => {
    const html = renderToStaticMarkup(createElement(BarraDeChat))
    expect(html).toContain("Habla con tus oficinas…")
    expect(html).not.toMatch(/<input|<textarea|<form|<button|onSubmit|href=/)
  })
  it("es dibujo propio y de servidor: sin recursos externos ni JavaScript de navegador; la marca es la nuestra", () => {
    const todo = ["components/nuevo/EscenaNuevo.tsx", "components/nuevo/MarcoNuevo.tsx", "app/nuevo/page.tsx", "app/nuevo/marketing/page.tsx", "components/nuevo/PantallaNuevo.tsx"].map(leer).join("\n")
    expect(todo).not.toContain('"use client"')
    expect(todo.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, "")).not.toMatch(/https?:\/\//i)
    const html = [createElement(EscenaNuevo), createElement(BarraSuperior), createElement(MenuLateral), createElement(BarraDeChat)].map((e) => renderToStaticMarkup(e)).join("")
    expect(html).not.toMatch(/airrived/i)
    expect(html).toContain("Zero Risk")
  })
  it("la página pide sesión de administrador y no lee la base", () => {
    const p = leer("app/nuevo/page.tsx")
    expect(p).toContain("exigirAdmin")
    expect(p).not.toMatch(/leerInicio|getServiceRoleClient|TrabajoEnVivo/)
  })
})
