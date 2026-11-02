/** Dashboard nuevo · CC6 · validar UN campo del manual sin versión nueva (contrato de CC1 254b94f, certificado por CC3). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ejecutarAccion } from "@/lib/tablero-acciones"
import { leerManual } from "@/lib/manual-lector"
import { PanelManual } from "@/components/nuevo/PanelManual"
import type { ManualDelCliente } from "@/lib/manual-datos"

const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
describe("validar un campo", () => {
  it("la acción llega a POST /api/tablero/manual-validar-campo con el campo y validado (por omisión, verdadero)", async () => {
    const llamadas: Array<{ url: string; cuerpo: Record<string, unknown> }> = []
    const f: typeof fetch = async (url, init) => { llamadas.push({ url: String(url), cuerpo: JSON.parse(String(init?.body)) }); return new Response(JSON.stringify({ ok: true, validado: true, sin_cambios: false }), { status: 200 }) }
    const r = await ejecutarAccion("manual-validar-campo", { client_id: CLIENTE, campo: "mision" }, { revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl: f })
    expect(r.status).toBe(200)
    expect(llamadas[0]).toMatchObject({ url: "https://p.test/api/tablero/manual-validar-campo", cuerpo: { client_id: CLIENTE, campo: "mision", validado: true, reviewer: "emilio", origen: "dashboard" } })
    await ejecutarAccion("manual-validar-campo", { client_id: CLIENTE, campo: "mision", validado: false }, { revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl: f })
    expect(llamadas[1].cuerpo.validado).toBe(false)
    for (const malo of [{ campo: "mision" }, { client_id: CLIENTE }, { client_id: CLIENTE, campo: "mision", validado: "si" }]) expect((await ejecutarAccion("manual-validar-campo", malo, { revisor: "e", plataformaUrl: "https://p.test", llave: "k", fetchImpl: f })).status).toBe(400)
  })
  it("«Validar» aparece en todos los campos con texto (también los que no se editan desde aquí); «Quitar validación» en los aceptados", () => {
    const fila = { client_id: CLIENTE, version: 2, human_validated: false, brand_purpose: "Propósito", brand_mission: "Misión", content_text: JSON.stringify({ brand_book_draft: { _field_meta: { mision: { aceptado_por_el_dueno: { por: "emilio", en: "2026-11-02T06:00:00Z", campo: true } } } } }) }
    const datos: ManualDelCliente = { clientes: [{ id: CLIENTE, nombre: "Náufrago", con_manual: true }], cliente: { id: CLIENTE, nombre: "Náufrago" }, manual: { version: 2, versiones: 2, lector: leerManual(fila)!, fidelidad: "Sin revisión", origen: null, colores: [], tipografias: [], opciones_eslogan: [], palabras_prohibidas: [], palabras: [], terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null }, leido_en: "2026-11-02T06:10:00Z" }
    const html = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: datos }))
    expect(html).toContain('data-campo-validar="proposito"')
    expect(html).not.toContain('data-campo-validar="mision"') // ya aceptado
    expect(html).toContain('data-campo-desvalidar="mision"')
    expect(html).toMatch(/data-campo="mision"[^>]*data-origen="aceptado" data-validado="true"/)
  })
})
