import { describe, expect, it } from "vitest"
import { existsSync, readFileSync, statSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { EscenaViva } from "@/components/nuevo/EscenaViva"
import { EscenaNuevo, ORIGEN_MARKETING, VISTA, ZONAS } from "@/components/nuevo/EscenaNuevo"

const leer = (p: string) => readFileSync(p, "utf8")

describe("dashboard nuevo · sprint 3 · Dept. Marketing proyectado", () => {
  it("las imágenes del interior existen y son livianas", () => {
    for (const [f, max] of [["public/nuevo/marketing-2560.jpg", 500_000], ["public/nuevo/marketing-1280.jpg", 200_000]] as const) {
      expect(existsSync(f), f).toBe(true)
      expect(statSync(f).size, f).toBeLessThan(max)
    }
  })
  it("la plataforma de marketing es la zona que lleva a /nuevo/marketing, con rótulo «Dept. Marketing»; la pantalla de pie no es suya", () => {
    const z = ZONAS.find((x) => x.clave === "marketing")!
    expect(z.href).toBe("/nuevo/marketing")
    expect(z.rotulo?.texto).toBe("Dept. Marketing")
    for (const par of z.formas.join(" ").split(" ")) {
      const [x, y] = par.split(",").map(Number)
      expect(x).toBeGreaterThanOrEqual(VISTA.x); expect(x).toBeLessThanOrEqual(VISTA.x + VISTA.w)
      expect(y).toBeGreaterThanOrEqual(VISTA.y); expect(y).toBeLessThanOrEqual(VISTA.y + VISTA.h)
      // la pantalla suelta de abajo (1068-1116 × 642-736) es de «En vivo»
      expect(x >= 1060 && x <= 1120 && y >= 636 && y <= 740).toBe(false)
    }
    expect(ORIGEN_MARKETING.x).toBeGreaterThan(0); expect(ORIGEN_MARKETING.x).toBeLessThan(100)
    expect(ORIGEN_MARKETING.y).toBeGreaterThan(0); expect(ORIGEN_MARKETING.y).toBeLessThan(100)
  })
  it("el rótulo y el resalte aparecen poco a poco (300–500 ms), no de golpe; con «reducir movimiento» no hay transición", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(html).toMatch(/\.nv-rotulo\{[^}]*transition:opacity \.45s/)
    expect(html).toMatch(/\.nv-zona polygon\{[^}]*transition:fill \.45s/)
    expect(html).toMatch(/prefers-reduced-motion:reduce/)
  })
  it("cerrada: solo la escena (sin el interior ni el control de volver); abierta de entrada: escena atenuada + interior + «Escena»", () => {
    const cerrada = renderToStaticMarkup(createElement(EscenaViva, { inicial: false }))
    expect(cerrada).not.toContain("marketing-2560.jpg")
    expect(cerrada).not.toContain("Volver a la escena")
    const abierta = renderToStaticMarkup(createElement(EscenaViva, { inicial: true }))
    expect(abierta).toContain("marketing-2560.jpg")
    expect(abierta).toContain('data-atenuado="true"')
    expect(abierta).toContain("Volver a la escena")
    // el interior no tiene zonas clicables propias: los únicos enlaces son los de la escena de fondo
    expect([...abierta.matchAll(/<a [^>]*?href="([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(["/nuevo/marketing", "/oficinas#cerebro"])
  })
  it("vuelve con Esc, con el control y con clic fuera; la dirección cambia sin reiniciar la página", () => {
    const c = leer("components/nuevo/EscenaViva.tsx")
    expect(c).toContain('e.key === "Escape"')
    expect(c).toContain("popstate")
    expect(c).toContain('History.prototype.pushState.call')
    expect(c).toContain("/nuevo/marketing")
    expect(c).toMatch(/onClick=\{\(\) => abierta && cerrar\(\)\}/) // clic fuera
    expect(c).toMatch(/max-width:700px/) // móvil: versión más simple (sin zoom ni desenfoque)
  })
  it("/nuevo/marketing pide sesión de administrador, igual que /nuevo", () => {
    const p = leer("app/nuevo/marketing/page.tsx")
    expect(p).toContain("exigirAdmin")
    expect(p).toContain("<PantallaNuevo marketing />")
    expect(p).toContain("%2Fnuevo%2Fmarketing")
  })
})
