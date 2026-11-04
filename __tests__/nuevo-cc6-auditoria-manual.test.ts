/** AUDITORÍA DEL MANUAL (CC6 · 02-nov · CORRECCIONES de Lenovo aprobadas por Emilio) · puntos 1 y 2. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { avanceDelPedido, errorEnPalabras, nombreDelPasoDeReescritura } from "@/lib/plan"
import { BarraDelPedido } from "@/components/nuevo/pedido/PiezasDelPedido"
import { faltantesDeLasSecciones, seccionesNuevasDelBorrador } from "@/lib/manual-secciones"
import { SeccionesNuevas } from "@/components/nuevo/manual/SeccionesNuevas"
import { PanelManual } from "@/components/nuevo/PanelManual"
import { leerManual } from "@/lib/manual-lector"
import type { ManualDelCliente } from "@/lib/manual-datos"

const AHORA = new Date("2026-11-02T20:40:00Z")
const base = { despachos: [], invocaciones: [], version_nueva: null, jefatura: null, compuerta_nueva: null }
const CRUDO = "The connection to the server was closed unexpectedly, either by the server or a proxy."

describe("1 · la línea de pasos dice lo que de verdad pasó", () => {
  it("el título según el estado: está reescribiendo · reescribió · no terminó (manual y plan)", () => {
    expect(nombreDelPasoDeReescritura(true, "en_curso")).toBe("El equipo del manual está reescribiendo")
    expect(nombreDelPasoDeReescritura(true, "hecho")).toBe("El equipo del manual reescribió")
    expect(nombreDelPasoDeReescritura(true, "fallo")).toBe("El equipo del manual no terminó")
    expect(nombreDelPasoDeReescritura(false, "hecho")).toBe("El jefe de marketing reescribió")
    const roto = avanceDelPedido({ ...base, pedido: { id: "p", estado: "fallido", creado_en: "2026-11-02T19:00:00Z", actualizado_en: "2026-11-02T19:30:00Z", despertado: true, despertar_detalle: CRUDO } }, AHORA, "manual")
    const paso = roto.pasos.find((p) => p.clave === "reescribiendo")!
    expect(paso.estado).toBe("fallo"); expect(paso.nombre).toBe("El equipo del manual no terminó")
    const hecho = avanceDelPedido({ ...base, invocaciones: [{ status: "completed", creado_en: "2026-11-02T19:05:00Z" }], pedido: { id: "p", estado: "en_reescritura", creado_en: "2026-11-02T19:00:00Z", actualizado_en: "2026-11-02T19:10:00Z", despertado: true, despertar_detalle: null } }, AHORA, "plan")
    expect(hecho.pasos.find((p) => p.clave === "reescribiendo")!.nombre).toBe("El jefe de marketing reescribió")
  })
  it("el error se dice en español; el texto técnico va solo detrás de «ver detalle»", () => {
    expect(errorEnPalabras(CRUDO, "el manual")).toBe("Se cortó la conexión con el equipo; el manual no cambió.")
    expect(errorEnPalabras("Request timed out after 300s", "el plan")).toBe("El equipo tardó demasiado y se cortó; el plan no cambió.")
    expect(errorEnPalabras("Your credit balance is too low", "el manual")).toMatch(/saldo o límite/)
    expect(errorEnPalabras("TypeError: undefined is not a function", "el manual")).toBe("Hubo un error técnico; el manual no cambió.")
    expect(errorEnPalabras("tope de gasto", "el manual")).toBe("tope de gasto") // ya en español: tal cual
    const roto = avanceDelPedido({ ...base, pedido: { id: "p", estado: "fallido", creado_en: "2026-11-02T19:00:00Z", actualizado_en: "2026-11-02T19:30:00Z", despertado: true, despertar_detalle: CRUDO } }, AHORA, "manual")
    const paso = roto.pasos.find((p) => p.estado === "fallo")!
    expect(paso.detalle).toBe("Se cortó la conexión con el equipo; el manual no cambió."); expect(paso.detalle_tecnico).toBe(CRUDO)
    const h = renderToStaticMarkup(createElement(BarraDelPedido, { avance: roto }))
    expect(h).toMatch(/<details data-detalle-tecnico[^>]*><summary[^>]*>ver detalle<\/summary>/); expect(h).toContain("Se cortó la conexión con el equipo")
    expect(h.indexOf(CRUDO.slice(0, 30))).toBeGreaterThan(h.indexOf("ver detalle")) // el crudo, solo dentro del detalle
  })
})

describe("2 · las 6 secciones nuevas se ven siempre y cuentan en «Lo que falta»", () => {
  it("vacías: se pintan con su título y nada más (03-nov · manual limpio: sin «falta» ni «sin dato»)", () => {
    const s = seccionesNuevasDelBorrador({})
    const h = renderToStaticMarkup(createElement(SeccionesNuevas, { secciones: s }))
    for (const t of ["Historia y origen", "Tono según el canal", "Dirección de fotografía", "Uso del logo y jerarquía tipográfica"]) expect(h).toContain(t)
    expect(h).not.toMatch(/falta|sin dato|Sin dato|propone el equipo/); expect((h.match(/id="campo-/g) ?? []).length).toBe(6)
    expect(h).toContain('id="campo-historia_y_origen"') // «Lo que falta» lleva hasta ahí
  })
  it("con dato, no cuentan; sin dato, sí", () => {
    expect(faltantesDeLasSecciones(seccionesNuevasDelBorrador({ historia_y_origen: "Nació en Olón" })).map((f) => f.clave)).not.toContain("historia_y_origen")
    expect(faltantesDeLasSecciones(seccionesNuevasDelBorrador({}))).toHaveLength(6)
  })
  it("en el panel: lo que falta (campos de siempre + secciones vacías, con su nombre) va en UNA línea del lateral, no arriba del documento (03-nov 08:20Z)", () => {
    const C = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
    const fila = { client_id: C, version: 3, auto_generated: true, human_validated: false, brand_purpose: "P", voice_description: "V", content_text: JSON.stringify({ brand_book_draft: {} }) }
    const lector = leerManual(fila)!
    const datos: ManualDelCliente = { clientes: [{ id: C, nombre: "Náufrago", con_manual: true }], cliente: { id: C, nombre: "Náufrago" }, manual: { version: 3, versiones: 3, lector, fidelidad: "—", origen: null, colores: [], tipografias: [], opciones_eslogan: [], palabras_prohibidas: [], palabras: [], terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null, secciones_nuevas: seccionesNuevasDelBorrador({}) }, leido_en: "x" }
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: datos }))
    const n = lector.huecos.length + 6
    expect(h).not.toContain("Lo que falta"); expect(h).not.toContain("data-lo-que-falta"); expect(h).not.toContain("Incompleto")
    const estado = h.slice(h.indexOf('data-barra="estado"'), h.indexOf('data-barra="estado"') + 4000)
    expect(estado).toContain("Por completar"); expect((estado.match(/data-ir-campo=/g) ?? []).length).toBe(n) /* CC6 · 03-nov · manual limpio para el cliente (regla 5): sin rótulos de origen ni de validación */
    expect(h).toMatch(/data-ir-campo="historia_y_origen"[^>]*>Historia y origen</); expect(h).toMatch(/data-ir-campo="tono_por_canal"[^>]*>Tono según el canal</)
  })
})
