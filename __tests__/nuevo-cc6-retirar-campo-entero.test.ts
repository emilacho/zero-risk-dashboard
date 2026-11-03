/** RETIRAR UN CAMPO ENTERO DEL MANUAL (CC6 · 03-nov · contrato de CC1 #864 · condición A de CC3: un cuadro en blanco NO retira por accidente). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ejecutarAccion } from "@/lib/tablero-acciones"
import { PanelManual } from "@/components/nuevo/PanelManual"
import { SeccionesNuevas } from "@/components/nuevo/manual/SeccionesNuevas"
import { leerManual } from "@/lib/manual-lector"
import { seccionesNuevasDelBorrador } from "@/lib/manual-secciones"
import type { ManualDelCliente } from "@/lib/manual-datos"

const C = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const deps = (llamadas: Array<Record<string, unknown>>) => ({ revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl: (async (_u: unknown, i?: RequestInit) => { llamadas.push(JSON.parse(String(i?.body))); return new Response(JSON.stringify({ ok: true }), { status: 200 }) }) as typeof fetch })

describe("la puerta del tablero: vacío = retirar, SOLO si el pedido lo nombra", () => {
  it("con `retirar` nombrando el campo, el vacío pasa a la plataforma tal cual (contrato #864: `''`)", async () => {
    const ll: Array<Record<string, unknown>> = []
    const r = await ejecutarAccion("manual-campos", { client_id: C, campos: { vision: "", mision: "Servimos mariscos" }, retirar: ["vision"] }, deps(ll))
    expect(r.status).toBe(200)
    expect(ll[0]).toMatchObject({ campos: { vision: "", mision: "Servimos mariscos" } })
    expect(ll[0]).not.toHaveProperty("retirar") // la plataforma no lo necesita: el vacío ya dice retirar
  })
  it("un cuadro en blanco SIN `retirar` sigue rechazado (no borra por accidente, ni desde el tablero viejo); y no se puede «retirar» algo que viene con texto", async () => {
    const ll: Array<Record<string, unknown>> = []
    expect((await ejecutarAccion("manual-campos", { client_id: C, campos: { vision: "  " } }, deps(ll))).status).toBe(400)
    expect((await ejecutarAccion("manual-campos", { client_id: C, campos: { vision: "" }, retirar: ["mision"] }, deps(ll))).status).toBe(400)
    expect((await ejecutarAccion("manual-campos", { client_id: C, campos: { vision: "Ser la referencia" }, retirar: ["vision"] }, deps(ll))).status).toBe(400)
    expect(ll).toHaveLength(0)
  })
})

describe("en el panel", () => {
  const fila = { client_id: C, version: 2, auto_generated: true, human_validated: false, brand_purpose: "Que el mar sea para todos", brand_vision: "Ser la referencia del encebollado", brand_values: "Frescura", brand_personality: "Cálido · Costeño", content_text: JSON.stringify({ brand_book_draft: { historia_y_origen: "Abrió frente al mar", uso_del_logo: ["Solo fondos oscuros"] } }) }
  const datos: ManualDelCliente = { clientes: [{ id: C, nombre: "Náufrago", con_manual: true }], cliente: { id: C, nombre: "Náufrago" }, manual: { version: 2, versiones: 2, lector: leerManual(fila)!, fidelidad: "", origen: null, colores: [], tipografias: [], opciones_eslogan: [], palabras_prohibidas: [], palabras: [], terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null, secciones_nuevas: seccionesNuevasDelBorrador({ historia_y_origen: "Abrió frente al mar", uso_del_logo: ["Solo fondos oscuros"] }) }, leido_en: "x" }
  const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: datos }))
  const tramo = (clave: string) => { const i = h.indexOf(`data-campo="${clave}"`); return h.slice(i, h.indexOf("data-campo=", i + 20)) }
  it("un campo de una sola frase (Visión, Propósito) y una lista de un elemento (Valores) tienen «Retirar»; una lista de varios lo tiene en cada elemento, no en el campo", () => {
    for (const k of ["vision", "proposito"]) expect((tramo(k).match(/data-accion="retirar"/g) ?? []).length, k).toBe(1)
    expect((tramo("valores").match(/data-accion="retirar"/g) ?? []).length).toBe(1)
    expect((tramo("personalidad").match(/data-accion="retirar"/g) ?? []).length).toBe(2) // uno por elemento
    expect(h).not.toContain("data-confirmar-retirar") // la confirmación aparece solo al tocar
  })
  it("en las secciones nuevas: la historia (un texto) se retira entera y la lista de un elemento también", () => {
    expect((tramo("historia_y_origen").match(/data-accion="retirar"/g) ?? []).length).toBe(1)
    expect((tramo("uso_del_logo").match(/data-accion="retirar"/g) ?? []).length).toBe(1)
  })
  it("retirar la parte entera pide confirmación antes, con palabras claras", () => {
    const s = renderToStaticMarkup(createElement(SeccionesNuevas, { secciones: seccionesNuevasDelBorrador({ historia_y_origen: "Abrió frente al mar" }), onRetirar: () => {}, confirmarInicial: "historia_y_origen" }))
    expect(s).toContain('data-confirmar-retirar="historia_y_origen"'); expect(s).toContain("¿Retirar «Historia y origen» del manual? Queda vacío hasta que lo vuelvas a escribir.")
    expect(s).toContain('data-accion="confirmar-retirar"'); expect(s).toContain(">Sí, retirar<"); expect(s).toContain(">Cancelar<")
  })
  it("una parte retirada sin guardar se ve vacía (su título y nada más)", () => {
    const s = renderToStaticMarkup(createElement(SeccionesNuevas, { secciones: seccionesNuevasDelBorrador({ historia_y_origen: "Abrió frente al mar" }), pendiente: (p) => (p.clave === "historia_y_origen" ? "" : undefined) }))
    expect(s).not.toContain("Abrió frente al mar")
    const l = renderToStaticMarkup(createElement(SeccionesNuevas, { secciones: seccionesNuevasDelBorrador({ uso_del_logo: ["Solo fondos oscuros"] }), pendiente: (p) => (p.clave === "uso_del_logo" ? "" : undefined) }))
    const parte = l.slice(l.indexOf('data-campo="uso_del_logo"'), l.indexOf('data-campo="jerarquia_tipografica"'))
    expect(parte).not.toContain("<ul") // ni una lista vacía
  })
})
