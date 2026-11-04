import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { armarEscena } from "@/lib/escena-avatares"
import { armarVitrina, leerMejoresPiezas, MAXIMO_DE_PIEZAS_EN_LA_VITRINA, PANTALLA_VERTICAL } from "@/lib/escena-vitrina"
import { armarEntregas } from "@/lib/escena-entregas"
import { Avatares } from "@/components/nuevo/escena/Avatares"

const SIN = { estado: "sin_datos" as const, motivo: "pronto" }
const escena = (extra: Record<string, unknown> = {}) => ({ ...armarEscena({ despachos: [], invocaciones: [], directorio: [], agentes: [], clientes: [], equipos: null, ahora: new Date("2026-11-02T17:00:00Z") }), ...extra })
const pieza = (n: number) => ({ id: `p${n}`, titulo: `Pieza número ${n}`, imagen: null, principal: `${n}00 me gusta`, texto: "texto" })

describe("vitrina de la pantalla vertical y lámpara de firma (tarea 2 del encargo de Lenovo · 02-nov)", () => {
  it("la lectura de mejores piezas es UNA sola función y hoy devuelve «sin datos» (la forma del dato no se inventa)", async () => {
    expect(await leerMejoresPiezas(null, { cliente: "x" })).toEqual(SIN)
    const fuente = readFileSync("lib/escena-vitrina.ts", "utf8")
    expect((fuente.match(/export async function leerMejoresPiezas/g) ?? []).length).toBe(1)
    expect(fuente).not.toMatch(/\.(insert|update|delete|upsert|rpc)\(/)
  })
  it("hoy: «pronto» + la última pieza aprobada; sin pieza, la pantalla lo dice; con resultados, hasta 8 rotando", () => {
    const u = armarVitrina([], { id: "u1", titulo: "Carrusel Facebook · Náufrago · 29 oct" }, SIN)
    expect(u).toMatchObject({ modo: "ultima", lectura: "sin_datos" })
    expect(u.piezas).toEqual([{ id: "u1", titulo: "Carrusel Facebook · Náufrago · 29 oct", imagen: null, principal: null, texto: "pronto" }])
    expect(armarVitrina([], null, SIN)).toMatchObject({ modo: "vacia", piezas: [] })
    const m = armarVitrina(Array.from({ length: 11 }, (_, i) => pieza(i + 1)), { id: "u1", titulo: "x" }, SIN)
    expect(m.modo).toBe("mejores")
    expect(m.piezas).toHaveLength(MAXIMO_DE_PIEZAS_EN_LA_VITRINA)
    expect(m.piezas[0].id).toBe("p1") // el orden lo trae la lectura (de mayor a menor)
  })
  it("se dibuja sobre la pantalla vertical de la foto: la última pieza aprobada (sin rótulos repetidos: ni «VITRINA» ni «pronto» pintados en la foto)", () => {
    const vitrina = armarVitrina([], { id: "u1", titulo: "Carrusel Facebook Náufrago" }, SIN)
    const html = renderToStaticMarkup(createElement(Avatares, { datosIniciales: escena({ vitrina }) as never }))
    expect(html).toContain('data-vitrina="true" data-modo="ultima" data-piezas="1"')
    expect(html).not.toContain(">VITRINA</text>"); expect(html).not.toMatch(/>pronto<\/text>/)
    expect(html).toContain("Carrusel")
    expect(PANTALLA_VERTICAL).toHaveLength(4)
    expect(renderToStaticMarkup(createElement(Avatares, { datosIniciales: escena() as never }))).not.toContain("data-vitrina")
    const vacia = renderToStaticMarkup(createElement(Avatares, { datosIniciales: escena({ vitrina: armarVitrina([], null, SIN) }) as never }))
    expect(vacia).toContain('data-modo="vacia"')
    expect(vacia).toContain("aún sin")
  })
  it("con varias piezas muestra la primera y avisa «Pieza 1 de N»; la rotación respeta prefers-reduced-motion", () => {
    const vitrina = armarVitrina([pieza(1), pieza(2), pieza(3)], null, SIN)
    const html = renderToStaticMarkup(createElement(Avatares, { datosIniciales: escena({ vitrina }) as never }))
    expect(html).toContain('data-piezas="3"')
    expect(html).toContain("Pieza 1 de 3")
    const fuente = readFileSync("components/nuevo/escena/EntregasEnLaFoto.tsx", "utf8")
    expect(fuente).toContain("prefers-reduced-motion: reduce")
    expect(fuente).toContain("setInterval")
  })
  it("la luz de firma ya NO está en el panel vertical ni hay lámpara en Dirección (Emilio 14:08Z)", () => {
    const ent = armarEntregas({ encargos: [], turnos: [], filas: [], bandeja: [{ id: "1", expires_at: null }], revisiones: [], pasos: [], ahora: new Date("2026-11-02T17:00:00Z") } as never)
    const html = renderToStaticMarkup(createElement(Avatares, { datosIniciales: escena({ entregas: ent }) as never }))
    expect(html).not.toContain("data-lampara"); expect(html).not.toContain("nv-firma")
    expect(readFileSync("components/nuevo/escena/EntregasEnLaFoto.tsx", "utf8")).not.toContain("LamparaDeFirma")
    expect(html).not.toContain("nv-firma-luz\" points=\"1692,525")
    expect(readFileSync("lib/escena-entregas.ts", "utf8")).not.toContain("PANEL_DE_FIRMA")
  })
})
