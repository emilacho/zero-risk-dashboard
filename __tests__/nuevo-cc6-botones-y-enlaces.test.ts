/** BOTONES QUE NO HACÍAN NADA Y ENLACES AL DASHBOARD VIEJO (CC6 · 03-nov · sprint dashboard · ENCARGO-LENOVO-a-CC6-botones-muertos-y-enlaces-al-viejo). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PANELES_DEL_BUSCADOR, esAtajoDelBuscador, normalizar, resultadosDeBusqueda, type FuentesDelBuscador } from "@/lib/buscador"
import { Buscador } from "@/components/nuevo/Buscador"

const FUENTES: FuentesDelBuscador = {
  clientes: [{ nombre: "Náufrago", ruta: "/nuevo/cliente/naufrago" }, { nombre: "Zero Risk Seguridad Industrial", ruta: "/nuevo/cliente/zero-risk" }],
  empleados: [{ id: "a1", nombre: "Editor en Jefe", puesto: "Jefe de contenido", departamento: "Marketing" }, { id: "a2", nombre: "Brand Strategist", puesto: "Estratega de marca", departamento: "Marketing" }],
  piezas: [{ id: "p1", titulo: "Carrusel Facebook · Náufrago · 29 oct", cliente: "Náufrago" }, { id: "p2", titulo: "Historia Instagram · Zero Risk · 30 oct", cliente: "Zero Risk Seguridad Industrial" }],
}

describe("la búsqueda (lógica pura)", () => {
  it("sin tildes ni mayúsculas: «naufrago» encuentra al cliente y sus piezas; «organizacion» el panel", () => {
    expect(normalizar("Organización")).toBe("organizacion")
    const r = resultadosDeBusqueda("naufrago", FUENTES)
    expect(r.map((x) => `${x.tipo}:${x.titulo}`)).toEqual(["cliente:Náufrago", "pieza:Carrusel Facebook · Náufrago · 29 oct"])
    expect(resultadosDeBusqueda("organizacion", FUENTES)[0]).toMatchObject({ tipo: "panel", panel: "organizacion", titulo: "Organización" })
  })
  it("los paneles se encuentran también por las palabras de antes: «alertas» → Riesgos y alarmas · «gasto» → Dinero · «empleados» → Organización", () => {
    expect(resultadosDeBusqueda("alertas", FUENTES)[0]).toMatchObject({ panel: "riesgos" })
    expect(resultadosDeBusqueda("gasto", FUENTES)[0]).toMatchObject({ panel: "dinero" })
    expect(resultadosDeBusqueda("empleados", FUENTES)[0]).toMatchObject({ panel: "organizacion" })
  })
  it("los empleados, por nombre y por puesto; lo que empieza igual va primero; vacío no devuelve nada; a lo más N por grupo", () => {
    expect(resultadosDeBusqueda("editor", FUENTES).map((x) => x.titulo)).toEqual(["Editor en Jefe"])
    expect(resultadosDeBusqueda("estratega", FUENTES).map((x) => x.titulo)).toEqual(["Brand Strategist"])
    expect(resultadosDeBusqueda("   ", FUENTES)).toEqual([])
    const muchos: FuentesDelBuscador = { clientes: Array.from({ length: 9 }, (_, i) => ({ nombre: `Cliente ${i}`, ruta: `/c/${i}` })), empleados: [], piezas: [] }
    expect(resultadosDeBusqueda("cliente", muchos, 5)).toHaveLength(5)
    expect(resultadosDeBusqueda("zero", FUENTES).map((x) => x.tipo)).toEqual(["cliente", "pieza"])
    expect(resultadosDeBusqueda("risk", FUENTES)[0]).toMatchObject({ tipo: "cliente" }) // una palabra que empieza igual cuenta
    const orden: FuentesDelBuscador = { clientes: [{ nombre: "Pinturas del Mar", ruta: "/a" }, { nombre: "Casa Marina", ruta: "/b" }, { nombre: "Marisquería Olón", ruta: "/c" }], empleados: [], piezas: [] }
    expect(resultadosDeBusqueda("mar", orden).filter((x) => x.tipo === "cliente").map((x) => x.titulo)).toEqual(["Marisquería Olón", "Casa Marina", "Pinturas del Mar"]) // empieza igual · una palabra empieza igual (orden alfabético)
  })
  it("«/» abre el buscador, salvo que estés escribiendo en otro campo o uses Ctrl/Cmd", () => {
    expect(esAtajoDelBuscador({ key: "/" }, { tagName: "BODY" })).toBe(true)
    expect(esAtajoDelBuscador({ key: "/" }, null)).toBe(true)
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) expect(esAtajoDelBuscador({ key: "/" }, { tagName })).toBe(false)
    expect(esAtajoDelBuscador({ key: "/" }, { tagName: "DIV", isContentEditable: true })).toBe(false)
    expect(esAtajoDelBuscador({ key: "/", ctrlKey: true }, null)).toBe(false)
    expect(esAtajoDelBuscador({ key: "a" }, null)).toBe(false)
  })
  it("cada panel del buscador lo abre la escena (no queda ninguno sin destino)", () => {
    const escena = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")
    for (const p of PANELES_DEL_BUSCADOR) expect(escena, p.panel).toMatch(new RegExp(`panel === "${p.panel}"`))
  })
})

describe("el buscador en pantalla", () => {
  it("cerrado: un botón «Buscar» con su «/»; abierto con texto: los resultados por grupo, cada uno elegible", () => {
    const cerrado = renderToStaticMarkup(createElement(Buscador, {}))
    expect(cerrado).toMatch(/<button[^>]*data-accion="abrir-buscador"[^>]*aria-label="Buscar \(tecla \/\)"/)
    const abierto = renderToStaticMarkup(createElement(Buscador, { abiertoInicial: true, consultaInicial: "nau", fuentesIniciales: FUENTES }))
    expect(abierto).toContain('aria-label="Buscar clientes, empleados, paneles y piezas"')
    expect([...abierto.matchAll(/data-resultado="([a-z]+)"/g)].map((m) => m[1])).toEqual(["cliente", "pieza"])
    expect(abierto).toContain("Náufrago")
    const nada = renderToStaticMarkup(createElement(Buscador, { abiertoInicial: true, consultaInicial: "xyzzy", fuentesIniciales: FUENTES }))
    expect(nada).toContain("Nada con «xyzzy».")
  })
})

describe("regla 9 · iPhone (reservas de CC3)", () => {
  it("todo lo que se toca en el marco mide al menos 44 px (h-11/w-11 o min-h-11), y el buscador también existe en el celular", () => {
    const marco = readFileSync("components/nuevo/MarcoNuevo.tsx", "utf8"), buscador = readFileSync("components/nuevo/Buscador.tsx", "utf8"), selector = readFileSync("components/nuevo/SelectorDeCliente.tsx", "utf8")
    expect(marco).toContain('const ICONO_SUPERIOR = "flex h-11 w-11'); expect(marco).toContain('const clase = "flex h-11 w-11'); expect(marco).not.toMatch(/h-9 w-9/)
    expect(selector).toContain('aria-haspopup="menu"'); expect(selector).toContain('className="flex min-h-11 items-center gap-2 whitespace-nowrap')
    const cerrado = renderToStaticMarkup(createElement(Buscador, {}))
    expect(cerrado).toMatch(/data-accion="abrir-buscador-celular"[^>]*aria-label="Buscar"[^>]*class="[^"]*h-11 w-11[^"]*md:hidden/) // la lupa en el celular
    expect(cerrado).toMatch(/data-accion="abrir-buscador"[^>]*class="hidden h-11[^"]*md:flex/) // la barra desde 768 px
    expect(cerrado).not.toMatch(/data-buscador[^>]*class="[^"]*hidden md:block/) // ya no se esconde entero
    expect(buscador).not.toContain("h-9 ")
  })
})

describe("el marco ya no manda al dashboard viejo", () => {
  it("ningún archivo de la pantalla nueva enlaza a /mapa, /piezas, /oficinas, /alertas ni /gasto", () => {
    for (const f of ["components/nuevo/MarcoNuevo.tsx", "components/nuevo/Buscador.tsx", "components/nuevo/BotonesDelMarco.tsx", "components/nuevo/EscenaViva.tsx"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/["'`]\/(mapa|piezas|oficinas|alertas|gasto)["'`?]/)
    }
  })
  it("la escena abre lo que pide el marco: Riesgos, Dinero, Organización, Flujos y Decisiones en Tu oficina; Aplicaciones en Marketing; Piezas y En vivo encima de todo", () => {
    const e = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")
    expect(e).toContain('window.addEventListener(EVENTO_ABRIR_PANEL, alPedir)')
    expect(e).toMatch(/panel === "aplicaciones"\) \{ asegurar\("marketing"\); setVistaDelPizarron\(vista \?\? null\); setPizarron\(true\)/) // 04-nov: con la aplicación a abrir (el aviso del pizarrón abre el manual)
    expect(e).toMatch(/asegurar\("oficina"\)\s*\n\s*if \(panel === "riesgos"\) setRadar\(true\)/)
    expect(e).toMatch(/<PanelPiezas onCerrar=\{\(\) => setPiezasDelMarco\(null\)\} piezaInicial=\{piezasDelMarco\.pieza\} \/>/)
  })
})
