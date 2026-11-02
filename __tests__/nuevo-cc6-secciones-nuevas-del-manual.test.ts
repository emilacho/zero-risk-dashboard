/** LAS SECCIONES NUEVAS DEL MANUAL (CC6 · 02-nov · ADENDA 1 firmada por Emilio). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { jerarquiaTipografica, seccionesNuevasDelBorrador, valorDeSeccion, SECCIONES_NUEVAS } from "@/lib/manual-secciones"
import { SeccionesNuevas } from "@/components/nuevo/manual/SeccionesNuevas"

const BORRADOR = {
  tono_por_canal: [{ canal: "Instagram", tono: "cercano y alegre", ejemplos: ["¡Te esperamos en Olón!"] }, { canal: "WhatsApp", tono: "directo, con el precio" }],
  reglas_de_escritura: ["Tuteo siempre", "Encebollado primero"],
  direccion_de_fotografia: { luz: "natural de mediodía", no_mostrar: ["platos a medio comer"] },
  historia_y_origen: "Náufrago nació en Olón…",
  jerarquia_tipografica: [{ uso: "títulos", familia: "Alfa Slab One" }, { uso: "texto", familia: "Inter" }],
  _field_meta: { tono_por_canal: { estado: "propuesta" }, historia_y_origen: { fuente: "dueno" }, reglas_de_escritura: { aceptado_por_el_dueno: { por: "emilio" } } },
}

describe("la lectura de las secciones nuevas", () => {
  it("son las cuatro del encargo, en su orden", () => {
    expect(SECCIONES_NUEVAS.map((s) => s.titulo)).toEqual(["Tono según el canal", "Dirección de fotografía", "Uso del logo y jerarquía tipográfica", "Historia y origen"])
  })
  it("solo las que tienen dato; cada parte con su origen (propuesta del sistema · escrito por ti · validado por ti)", () => {
    const s = seccionesNuevasDelBorrador(BORRADOR)
    expect(s.map((x) => x.id)).toEqual(["tono-por-canal", "fotografia", "logo-y-letras", "historia"])
    expect(s[0].partes.map((p) => `${p.clave}:${p.origen}`)).toEqual(["tono_por_canal:propuesta", "reglas_de_escritura:aceptado"])
    expect(s[3].partes[0].origen).toBe("dueno")
    expect(s[2].partes.map((p) => p.clave)).toEqual(["jerarquia_tipografica"]) // sin uso_del_logo: esa parte no aparece
  })
  it("el manual de hoy (sin estas claves) no muestra ninguna sección vacía", () => {
    expect(seccionesNuevasDelBorrador({ positioning: "x", _field_meta: {} })).toEqual([])
    expect(seccionesNuevasDelBorrador({ historia_y_origen: "  ", reglas_de_escritura: [], direccion_de_fotografia: {} })).toEqual([])
  })
  it("lee con tolerancia: texto, lista, filas y apartados", () => {
    expect(valorDeSeccion("hola")).toEqual({ tipo: "texto", texto: "hola" })
    expect(valorDeSeccion(["a", " ", "b"])).toEqual({ tipo: "lista", items: ["a", "b"] })
    expect(valorDeSeccion([{ canal: "TikTok", tono: "ligero" }])).toEqual({ tipo: "filas", filas: [{ titulo: "TikTok", texto: "ligero", extra: [] }] })
    expect(valorDeSeccion({ luz: "natural", _x: "oculto" })).toEqual({ tipo: "apartados", apartados: [{ etiqueta: "Luz", valor: { tipo: "texto", texto: "natural" } }] })
    expect(valorDeSeccion(42 as unknown)).toEqual({ tipo: "texto", texto: "42" })
    expect(valorDeSeccion(null)).toBeNull()
  })
  it("la jerarquía tipográfica para la barra", () => {
    expect(jerarquiaTipografica(BORRADOR)).toEqual([{ uso: "títulos", familia: "Alfa Slab One" }, { uso: "texto", familia: "Inter" }])
  })
})

describe("en pantalla", () => {
  it("mismo patrón que el manual: tarjeta por parte, su origen, «Pedir cambios en esta sección»; lo propuesto, distinto de «falta»", () => {
    const pedidas: string[] = []
    const h = renderToStaticMarkup(createElement(SeccionesNuevas, { secciones: seccionesNuevasDelBorrador(BORRADOR), pedirCambios: (t: string) => pedidas.push(t) }))
    expect([...h.matchAll(/data-seccion-nueva="([a-z-]+)"/g)].map((x) => x[1])).toEqual(["tono-por-canal", "fotografia", "logo-y-letras", "historia"])
    expect(h).toContain("propuesta del sistema · por validar"); expect(h).toContain("escrito por ti"); expect(h).toContain("validado por ti")
    expect(h).not.toContain(">falta<")
    expect(h).toContain("«¡Te esperamos en Olón!»"); expect(h).toContain("Qué no mostrar")
    expect([...h.matchAll(/data-seccion-pedir="([^"]+)"/g)]).toHaveLength(4)
  })
  it("sin pedir cambios disponible, no hay botón; sin secciones, no se dibuja nada", () => {
    expect(renderToStaticMarkup(createElement(SeccionesNuevas, { secciones: seccionesNuevasDelBorrador(BORRADOR), pedirCambios: null }))).not.toContain("data-seccion-pedir")
    expect(renderToStaticMarkup(createElement(SeccionesNuevas, { secciones: [] }))).toBe("")
  })
})
