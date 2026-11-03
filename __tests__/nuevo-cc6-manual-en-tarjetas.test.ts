/** Dashboard nuevo · CC6 · el manual de marca en tarjetas cortas (Emilio, 02-nov: revisar, corregir y certificar campo por campo, sin párrafos gigantes). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { campoValidado, origenDelCampo, PORQUE_DE_VALIDAR, valorCorto } from "@/lib/manual-campo"
import { leerManual } from "@/lib/manual-lector"
import { PanelManual } from "@/components/nuevo/PanelManual"
import type { ManualDelCliente } from "@/lib/manual-datos"

const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"

describe("de dónde salió cada campo y si está validado", () => {
  it("el origen sale del dato: dueño, aceptado, propuesta, sitio y redes, análisis; sin nota, se dice", () => {
    const v = { valor: "x", estado: "lleno" as const }
    expect(origenDelCampo({ ...v, origen: "dueno" })).toBe("dueno")
    expect(origenDelCampo({ ...v, origen: "aceptado" })).toBe("aceptado")
    expect(origenDelCampo({ ...v, origen: null, estado: "propuesta" })).toBe("propuesta")
    expect(origenDelCampo({ ...v, origen: null, fuente: "propuesta — inferida de: comunicación de beneficios" })).toBe("propuesta")
    expect(origenDelCampo({ ...v, origen: null, fuente: "Instagram post del cliente: citas directas de voz" })).toBe("sitio_redes")
    expect(origenDelCampo({ ...v, origen: null, fuente: "discovery_summary: 'Ningún competidor…'" })).toBe("sistema")
    expect(origenDelCampo({ ...v, origen: null, fuente: "discovery_summary: '… ni tiene sitio web ni Instagram'" })).toBe("sistema") // menciona «sitio web» pero sale del análisis
    expect(origenDelCampo({ ...v, origen: null, fuente: null })).toBe("sin_dato")
  })
  it("validado: lo escribió o aceptó el dueño, o el manual entero está validado; vacío nunca", () => {
    expect(campoValidado({ origen: "dueno", valor: "x" }, "propuesta")).toBe(true)
    expect(campoValidado({ origen: null, valor: "x" }, "propuesta")).toBe(false)
    expect(campoValidado({ origen: null, valor: "x" }, "jefatura")).toBe(true)
    expect(campoValidado({ origen: "dueno", valor: null }, "dueno")).toBe(false)
  })
  it("el texto se recorta en palabra; corto, entero", () => {
    expect(valorCorto("hola mundo")).toEqual({ texto: "hola mundo", recortado: false })
    const r = valorCorto("palabra ".repeat(80), 50); expect(r.recortado).toBe(true); expect(r.texto.length).toBeLessThanOrEqual(50); expect(r.texto.endsWith("…")).toBe(true)
  })
  it("el lector entrega la nota de fuente tal cual (_field_meta.fuente)", () => {
    const l = leerManual({ client_id: CLIENTE, version: 1, brand_purpose: "P", content_text: JSON.stringify({ brand_book_draft: { _field_meta: { proposito: { fuente: "Instagram post del cliente" } } } }) })!
    expect(l.campos.find((c) => c.clave === "proposito")?.fuente).toBe("Instagram post del cliente")
  })
})

describe("el panel del manual en tarjetas", () => {
  const largo = "Frase larga del público. ".repeat(40)
  const fila = { client_id: CLIENTE, version: 3, auto_generated: true, human_validated: false, brand_purpose: "Propósito corto", voice_description: "Voz cálida", content_text: JSON.stringify({ brand_book_draft: { icp_summary: largo, _field_meta: { proposito: { fuente: "Instagram post del cliente" }, voice_description: { fuente: "dueno" } } } }) }
  const datos = (): ManualDelCliente => ({ clientes: [{ id: CLIENTE, nombre: "Náufrago", con_manual: true }], cliente: { id: CLIENTE, nombre: "Náufrago" }, manual: { version: 3, versiones: 3, lector: leerManual(fila)!, fidelidad: "Sin revisión de fidelidad", origen: null, colores: [], tipografias: [], opciones_eslogan: [], palabras_prohibidas: [], palabras: [], terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null }, leido_en: "2026-11-02T05:00:00Z" })
  it("cada campo (03-nov · manual limpio): el texto entero, sin su origen ni si está validado; sin «Validar» por campo", () => {
    const html = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: datos() }))
    expect(html).toContain('data-campo="proposito"'); expect(html).toContain('data-campo="voz"')
    expect(html).not.toMatch(/data-origen=|data-validado=|data-campo-validar|encontrado en sitio y redes|dicho por el dueño|sin validar/)
    expect(html).toContain(largo.trim()) // un documento se lee entero
    expect(html).toContain("data-lo-que-falta")
    expect(html).toContain('data-ir-apartado="Palabras"')
  })
  it("«Validar» manda el valor tal cual por la misma puerta que «Editar», con su porqué", () => {
    expect(PORQUE_DE_VALIDAR).toBe("validado por el dueño sin cambios")
  })
})
