/** LAS TARJETAS DE «TU OFICINA» CON SU DATO (CC6 · 03-nov · encargo de Lenovo 22:20Z: ORGANIZACIÓN era la única sin estado). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { TableroDeDireccionVivo } from "@/components/nuevo/TablerosDeDireccion"
import { PantallaDeMusica } from "@/components/nuevo/PantallaDeMusica"
import { resumenQueSuma } from "@/lib/direccion-organizacion"
import { resumenDeOrganizacion, resumenDePortafolio, textoDelPortafolio, TEXTO_PRONTO } from "@/lib/tableros-con-dato"
import type { TableroDeDireccion } from "@/lib/pantallas-de-la-oficina"

const R = { empleados: 60, departamentos: 6, trabajando: 2, activos: 40, por_activar: 18, apagados: 2, por_cubrir: 5 }
const vidrio = (tablero: TableroDeDireccion, extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement("svg", null, createElement(TableroDeDireccionVivo, { tablero, titulo: ["X"], quieto: true, ...extra })))

describe("Organización dice lo mismo que su panel", () => {
  it("lo grande y el detalle son las MISMAS palabras de la suma del panel (#251)", () => {
    const o = resumenDeOrganizacion(R)
    expect(o).toEqual({ grande: "2 trabajando ahora", detalle: "38 activos · 18 por activar · 2 apagados" })
    for (const parte of [o.grande, ...o.detalle.split(" · ")]) expect(resumenQueSuma(R)).toContain(parte)
    expect(resumenDeOrganizacion({ ...R, trabajando: 0, apagados: 0 })).toEqual({ grande: "40 activos", detalle: "18 por activar" })
  })
  it("el vidrio lo pinta; sin lectura dice «pronto» (nunca queda vacío)", () => {
    const h = vidrio("organizacion", { organizacion: resumenDeOrganizacion({ ...R, trabajando: 0, apagados: 0 }) })
    expect(h).toContain('data-dato="organizacion"'); expect(h).toContain(">40 activos</text>"); expect(h).toContain(">18 por activar</text>")
    expect(vidrio("organizacion")).toMatch(/data-dato="organizacion"[^>]*>pronto<\/text>/)
  })
  it("la escena lee la organización (misma ruta que el panel) y los clientes (misma ruta que el selector), cada minuto con la oficina abierta", () => {
    const e = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")
    expect(e).toContain('fetch("/api/direccion/organizacion", { cache: "no-store" })'); expect(e).toContain('fetch("/api/direccion/clientes", { cache: "no-store" })')
    expect(e).toContain("void leerOrganizacionYPortafolio() }"); expect(e).toContain("organizacion={organizacion} portafolio={portafolio}")
  })
})

describe("ninguna tarjeta queda vacía", () => {
  it("Gobierno e Ideas y proyectos: «pronto» honesto (no hay de dónde leer todavía)", () => {
    expect(vidrio("gobierno")).toMatch(/data-dato="gobierno"[^>]*>pronto<\/text>/)
    expect(vidrio("proyectos")).toMatch(/data-dato="proyectos"[^>]*>pronto<\/text>/)
    expect(TEXTO_PRONTO).toBe("pronto")
  })
  it("Portafolio: cuántos clientes de verdad (los del selector); sin lectura, «pronto»", () => {
    expect(textoDelPortafolio(resumenDePortafolio([{}, {}, {}]))).toBe("3 clientes"); expect(textoDelPortafolio({ clientes: 1 })).toBe("1 cliente"); expect(textoDelPortafolio({ clientes: 0 })).toBe("sin clientes")
    expect(vidrio("portafolio", { portafolio: { clientes: 3 } })).toMatch(/data-dato="portafolio"[^>]*>3 clientes<\/text>/)
    expect(vidrio("portafolio")).toMatch(/data-dato="portafolio"[^>]*>pronto<\/text>/)
  })
  it("Música: la pantalla dice en qué está («▶ escuchar» / «sonando»)", () => {
    expect(renderToStaticMarkup(createElement(PantallaDeMusica, {}))).toMatch(/data-estado-musica="apagada"[^>]*>▶ escuchar<\/text>/)
    expect(renderToStaticMarkup(createElement(PantallaDeMusica, { encendidaInicial: true }))).toMatch(/data-estado-musica="sonando"[^>]*>sonando<\/text>/)
  })
  it("los vidrios que ya tenían dato no cambian (Dinero, Decisiones, Riesgos, Agenda, Observabilidad no llevan el dato nuevo)", () => {
    for (const t of ["dinero", "decisiones", "riesgos", "agenda-ejecutiva", "observabilidad"] as const) expect(vidrio(t)).not.toContain("data-dato=")
  })
})
