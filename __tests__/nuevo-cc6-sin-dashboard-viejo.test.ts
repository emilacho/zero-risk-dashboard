/** EL DASHBOARD NUEVO ES EL ÚNICO QUE SE ABRE (CC6 · 03-nov · corrección de Lenovo + ADENDA 19:40Z: el viejo morado al recargar y entre clics). US$ 0. */
import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { esPantallaNueva, panelDeLaDireccion, rutaNuevaDe } from "@/lib/rutas-viejas"
import { enlaceDeLaPieza } from "@/lib/pizarron"

let ruta = "/nuevo/marketing"
vi.mock("next/navigation", () => ({ usePathname: () => ruta, useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }) }))

const ID = "70b922a5-e9f8-4f48-9134-24f3418d9a0b"
describe("a dónde va cada ruta vieja (una sola tabla, para cualquier cliente)", () => {
  it("la raíz va al inicio nuevo; cada ruta vieja a su panel del marco nuevo; la oficina a la oficina nueva", () => {
    expect(rutaNuevaDe("/")).toBe("/nuevo")
    expect(rutaNuevaDe("/piezas")).toBe("/nuevo?panel=piezas")
    expect(rutaNuevaDe("/piezas", new URLSearchParams(`id=${ID}&estado=todas`))).toBe(`/nuevo?panel=piezas&pieza=${ID}`)
    expect(rutaNuevaDe(`/piezas/${ID}`)).toBe(`/nuevo?panel=piezas&pieza=${ID}`)
    expect(rutaNuevaDe("/piezas", new URLSearchParams("id=<script>"))).toBe("/nuevo?panel=piezas") // lo que no es un id no viaja
    expect(rutaNuevaDe("/gasto")).toBe("/nuevo?panel=dinero")
    expect(rutaNuevaDe("/alertas")).toBe("/nuevo?panel=riesgos")
    expect(rutaNuevaDe("/mapa")).toBe("/nuevo?panel=organizacion")
    expect(rutaNuevaDe("/oficinas")).toBe("/nuevo/oficina"); expect(rutaNuevaDe("/oficinas/financiera")).toBe("/nuevo/oficina")
  })
  it("sin equivalente directo (la ficha vieja de un cliente es por id), al inicio nuevo; con barra final, igual", () => {
    expect(rutaNuevaDe("/clientes")).toBe("/nuevo"); expect(rutaNuevaDe(`/clientes/${ID}`)).toBe("/nuevo")
    expect(rutaNuevaDe("/gasto/")).toBe("/nuevo?panel=dinero")
  })
  it("lo que no es una ruta vieja se deja pasar (el nuevo, el login, la api, rutas parecidas)", () => {
    for (const p of ["/nuevo", "/nuevo/marketing", "/nuevo/cliente/naufrago", "/login", "/api/manual", "/piezasx", "/mapas"]) expect(rutaNuevaDe(p), p).toBeNull()
  })
  it("las pantallas nuevas son `/nuevo` y lo que cuelga de ahí", () => {
    expect(esPantallaNueva("/nuevo")).toBe(true); expect(esPantallaNueva("/nuevo/oficina")).toBe(true)
    expect(esPantallaNueva("/nuevos")).toBe(false); expect(esPantallaNueva("/")).toBe(false); expect(esPantallaNueva(null)).toBe(false)
  })
  it("el panel que pide la dirección: solo paneles del marco y una pieza con forma de id", () => {
    expect(panelDeLaDireccion(`?panel=piezas&pieza=${ID}`)).toEqual({ panel: "piezas", pieza: ID })
    expect(panelDeLaDireccion("?panel=dinero")).toEqual({ panel: "dinero", pieza: null })
    expect(panelDeLaDireccion("?panel=piezas&pieza=x")).toEqual({ panel: "piezas", pieza: null })
    expect(panelDeLaDireccion("?panel=hackeo")).toBeNull(); expect(panelDeLaDireccion("")).toBeNull()
  })
})

describe("la primera pintura de una pantalla nueva no trae nada del dashboard viejo", () => {
  it("en /nuevo…: sin la barra lateral vieja (sus enlaces a /, /piezas, /mapa…), sin el halo violeta ni el margen; fondo negro desde el CSS", async () => {
    const { MarcoDeLaApp } = await import("@/components/MarcoDeLaApp")
    ruta = "/nuevo/marketing"
    const h = renderToStaticMarkup(createElement(MarcoDeLaApp, null, createElement("main", null, "escena")))
    expect(h).toBe('<div data-pantalla-nueva="true" class="min-h-screen bg-black"><main>escena</main></div>')
    expect(h).not.toMatch(/href="\/(piezas|mapa|gasto|alertas|oficinas|clientes)?"/); expect(h).not.toContain("ambient-halo")
    expect(readFileSync("app/globals.css", "utf8")).toContain("body:has([data-pantalla-nueva]) { background-color: #000; }")
  })
  it("en el dashboard viejo sigue igual (no se borra nada en esta tarea)", async () => {
    const { MarcoDeLaApp } = await import("@/components/MarcoDeLaApp")
    ruta = "/settings"
    const h = renderToStaticMarkup(createElement(MarcoDeLaApp, null, "viejo"))
    expect(h).toContain("ambient-halo"); expect(h).toContain('class="pl-[64px]"')
  })
  it("el diseño raíz usa ese marco (ya no monta la barra vieja para todas las rutas) y la puerta redirige solo al admin", () => {
    const layout = readFileSync("app/layout.tsx", "utf8")
    expect(layout).toContain("<MarcoDeLaApp>{children}</MarcoDeLaApp>"); expect(layout).not.toMatch(/<Sidebar\s*\/>/)
    const mw = readFileSync("middleware.ts", "utf8")
    expect(mw).toMatch(/if \(role === "admin"\) \{\s*const destino = rutaNuevaDe\(pathname, req\.nextUrl\.searchParams\)\s*if \(destino\) return NextResponse\.redirect\(new URL\(destino, req\.url\)\)/)
  })
  it("el calendario abre la pieza en el panel de Piezas del NUEVO, sin cambiar de página", () => {
    expect(enlaceDeLaPieza(ID)).toBe(`/nuevo?panel=piezas&pieza=${ID}`)
    expect(readFileSync("components/nuevo/PanelPizarron.tsx", "utf8")).toContain('onClick={(e) => { e.preventDefault(); abrirPanel("piezas", { pieza: f.pieza!.id }) }}')
  })
})
