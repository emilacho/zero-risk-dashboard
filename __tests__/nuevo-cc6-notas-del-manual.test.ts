/** LAS NOTAS DE UN DATO DEL MANUAL (CC6 · 02-nov · SEÑAL de Lenovo «desbloquear el manual»): `datos_sin_fuente` (la puerta, CC1 #855) y `notas_del_juez` (el juez, CC2),
 *  discretas bajo el campo; no tocan el texto. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { notasDelCampo, QUIEN_MARCO } from "@/lib/manual-notas"
import { leerManual } from "@/lib/manual-lector"
import { seccionesNuevasDelBorrador } from "@/lib/manual-secciones"
import { PanelManual } from "@/components/nuevo/PanelManual"
import { SeccionesNuevas } from "@/components/nuevo/manual/SeccionesNuevas"
import type { ManualDelCliente } from "@/lib/manual-datos"

const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const META = {
  proposito: {
    fuente: "Instagram post del cliente",
    datos_sin_fuente: [{ dato: "desde 1998", marca: "1998", clausula: "Servimos encebollado desde 1998", motivo: "dato sin fuente en la evidencia" }],
    notas_del_juez: [{ dato: "desde 1998", motivo: "no hay registro del año de apertura" }, { dato: "el mejor de Olón", motivo: "superlativo sin respaldo" }],
  },
}

describe("las notas de un dato del manual", () => {
  it("lee las dos fuentes; si el mismo dato viene de las dos, una sola nota de «la puerta y el juez»; sin dato, nada", () => {
    expect(notasDelCampo(META.proposito)).toEqual([
      { dato: "desde 1998", motivo: "dato sin fuente en la evidencia", quien: "ambos" },
      { dato: "el mejor de Olón", motivo: "superlativo sin respaldo", quien: "juez" },
    ])
    expect(notasDelCampo({ datos_sin_fuente: [{ dato: "", motivo: "x" }, { marca: "120 mesas" }] })).toEqual([{ dato: "120 mesas", motivo: "dato sin fuente en la evidencia", quien: "puerta" }])
    expect(notasDelCampo({})).toEqual([]); expect(notasDelCampo(null)).toEqual([]); expect(notasDelCampo({ notas_del_juez: "no es lista" })).toEqual([])
    expect(QUIEN_MARCO.puerta).toMatch(/puerta/); expect(QUIEN_MARCO.juez).toMatch(/juez/)
  })
  it("llegan por el lector (campos de siempre) y por las secciones nuevas", () => {
    const l = leerManual({ client_id: CLIENTE, version: 1, brand_purpose: "Servimos encebollado desde 1998", content_text: JSON.stringify({ brand_book_draft: { _field_meta: META } }) })!
    expect(l.campos.find((c) => c.clave === "proposito")?.notas?.map((n) => n.quien)).toEqual(["ambos", "juez"])
    const s = seccionesNuevasDelBorrador({ historia_y_origen: "Abrió en 1998", _field_meta: { historia_y_origen: { notas_del_juez: [{ dato: "1998", motivo: "año sin fuente" }] } } })
    expect(s.flatMap((x) => x.partes).find((p) => p.clave === "historia_y_origen")?.notas).toEqual([{ dato: "1998", motivo: "año sin fuente", quien: "juez" }])
  })
  it("en el panel: la nota va bajo el campo, discreta, sin tocar el texto del campo", () => {
    const fila = { client_id: CLIENTE, version: 3, auto_generated: true, human_validated: false, brand_purpose: "Servimos encebollado desde 1998", content_text: JSON.stringify({ brand_book_draft: { _field_meta: META } }) }
    const datos: ManualDelCliente = { clientes: [{ id: CLIENTE, nombre: "Náufrago", con_manual: true }], cliente: { id: CLIENTE, nombre: "Náufrago" }, manual: { version: 3, versiones: 3, lector: leerManual(fila)!, fidelidad: "Sin revisión de fidelidad", origen: null, colores: [], tipografias: [], opciones_eslogan: [], palabras_prohibidas: [], palabras: [], terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null }, leido_en: "2026-11-02T05:00:00Z" }
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: datos }))
    expect(h).toContain("data-notas-del-campo"); expect(h).toContain("«desde 1998»"); expect(h).toContain("lo marcaron la puerta y el juez"); expect(h).toContain("«el mejor de Olón»")
    expect(h).toContain("Servimos encebollado desde 1998") // el texto queda tal cual
    expect(h).not.toMatch(/role="alert"[^>]*>[^<]*1998/) // no es una alarma
  })
  it("en las secciones nuevas también, bajo su parte", () => {
    const secciones = seccionesNuevasDelBorrador({ historia_y_origen: "Abrió en 1998", _field_meta: { historia_y_origen: { notas_del_juez: [{ dato: "1998", motivo: "año sin fuente" }] } } })
    const h = renderToStaticMarkup(createElement(SeccionesNuevas, { secciones, pedirCambios: null }))
    expect(h).toContain("data-notas-del-campo"); expect(h).toContain("«1998»"); expect(h).toContain("lo marcó el juez")
  })
})
