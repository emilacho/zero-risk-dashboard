/** LA CADENA ESPERA LA APROBACIÓN DEL MANUAL · parte del panel (CC6 · 03-nov · firma de Emilio 14:46Z). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelManual, avisoDeAprobado } from "@/components/nuevo/PanelManual"
import { detalleDelCuadro } from "@/components/nuevo/PanelAplicaciones"
import { leerPizarron } from "@/lib/pizarron-datos"
import { leerManual } from "@/lib/manual-lector"
import { seccionesNuevasDelBorrador } from "@/lib/manual-secciones"
import type { ManualDelCliente } from "@/lib/manual-datos"

const C = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const manual = (fila: Record<string, unknown>, ciclo: unknown = undefined): ManualDelCliente => ({ clientes: [{ id: C, nombre: "Náufrago", con_manual: true }], cliente: { id: C, nombre: "Náufrago" }, manual: { version: 1, versiones: 1, lector: leerManual({ client_id: C, version: 1, brand_purpose: "P", content_text: "{}", ...fila })!, fidelidad: "", origen: null, colores: [], tipografias: [], opciones_eslogan: [], palabras_prohibidas: [], palabras: [], terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null, secciones_nuevas: seccionesNuevasDelBorrador({}), ...(ciclo ? { ciclo } : {}) } as never, leido_en: "x" })

describe("el botón del manual dice que es el disparador del plan", () => {
  it("sin aprobar: «✓ Aprobar el manual y seguir con el plan», grande (44 px); ya no «Validar el manual»", () => {
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manual({}) }))
    expect(h).toMatch(/data-accion="validar-manual"[^>]*class="min-h-11[^"]*"[^>]*>✓ Aprobar el manual y seguir con el plan</)
    expect(h).not.toContain(">Validar el manual<")
    expect(h).not.toContain("data-aprobar-espera") // sin cambios en espera ni reescritura: se puede aprobar
  })
  it("aprobado por el dueño: el botón ya no aparece", () => {
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manual({ human_validated: true, provenance_tag: { validado_por: "dueno" } }) }))
    expect(h).not.toContain('data-accion="validar-manual"')
  })
  it("con una reescritura del manual en curso no se puede aprobar, y lo dice", () => {
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manual({}, { disponible: true, abierto: { id: "p", estado: "en_reescritura" }, avance: null, que_cambio: [] }) }))
    expect(h).toMatch(/data-accion="validar-manual"[^>]*disabled=""/)
    expect(h).toContain("Espera a que termine la reescritura del manual.")
  })
  it("CC3 reserva 1 · con cambios SIN GUARDAR (un Retirar o un Editar en espera) el botón queda deshabilitado y lo dice: lo retirado tiene que contar", () => {
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manual({}), cambiosIniciales: { vision: "" } }))
    expect(h).toMatch(/data-accion="validar-manual"[^>]*disabled=""/)
    expect(h).toContain("Guarda tus cambios antes de aprobar.")
    const sin = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manual({}) }))
    expect(sin).not.toMatch(/data-accion="validar-manual"[^>]*disabled=""/)
  })
  it("la confirmación (al tocar) explica que arranca el plan y que lo retirado cuenta; su botón es grande (44 px)", () => {
    const c = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manual({}) }))
    expect(c).not.toContain('data-accion="confirmar-validar"') // de entrada, no
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manual({}), confirmarAprobarInicial: true }))
    expect(h).toContain("arranca el plan de campaña"); expect(h).toContain("Lo que retiraste o editaste ya cuenta")
    expect(h).toMatch(/data-accion="confirmar-validar"[^>]*class="min-h-11[^"]*"[^>]*>Sí, aprobar y seguir con el plan de Náufrago</)
  })
  it("CC3 reserva 2 · el aviso después de aprobar dice que arranca el plan", () => {
    expect(avisoDeAprobado({})).toBe("✓ Manual aprobado · el plan arranca con este manual")
    expect(avisoDeAprobado({ sin_cambios: true })).toBe("Ya estaba aprobado por ti.")
  })
})

describe("el pizarrón: «Plan: espera que apruebes el manual» mientras no esté aprobado", () => {
  const base = { clientes: [], cliente: { id: C, nombre: "Náufrago" }, campana: null, fases: [], fase_activa: { situacion: "sin_fecha" }, gran_idea: { texto: null, nota: "" }, esperas: [], filas: [], semanas: [], totales: {}, hoy: "2026-11-03", leido_en: "x" } as never
  it("sin aprobar: el cuadro del Plan lo dice (con aviso); aprobado o sin manual: lo de siempre", () => {
    expect(detalleDelCuadro("plan", { ...(base as object), manual_aprobado: false } as never)).toEqual({ texto: "Plan: espera que apruebes el manual", aviso: true })
    expect(detalleDelCuadro("plan", { ...(base as object), manual_aprobado: true } as never)).toEqual({ texto: "Sin campaña todavía", aviso: false })
    expect(detalleDelCuadro("plan", { ...(base as object), manual_aprobado: null } as never)).toEqual({ texto: "Sin campaña todavía", aviso: false })
  })
  it("CC3 reserva 3 · con una campaña en marcha el plan NO espera: lo que espera es el manual nuevo", () => {
    const conCampana = { ...(base as object), clientes: [{ id: C, nombre: "Náufrago", con_campana: true }], manual_aprobado: false } as never
    expect(detalleDelCuadro("plan", conCampana)).toEqual({ texto: "El manual nuevo espera tu aprobación", aviso: true })
  })
  it("la lectura del pizarrón sabe si el DUEÑO aprobó el manual vigente (la jefatura no cuenta); si la lectura del manual falla, null", async () => {
    const base2 = (bb: Record<string, unknown> | null, falla = false) => ({ from: (t: string) => {
      const q: Record<string, unknown> = {}
      for (const m of ["select", "eq", "order", "limit", "in", "is", "not", "gte", "lte", "neq"]) q[m] = () => q
      const res = t === "client_brand_books" ? (falla ? { data: null, error: { message: "x" } } : { data: bb, error: null }) : t === "clients" ? { data: [{ id: C, name: "Náufrago", status: "active" }], error: null } : { data: t === "cadena_campanas" ? [] : null, error: null }
      q.maybeSingle = () => Promise.resolve(res)
      q.then = (ok: (r: unknown) => unknown) => Promise.resolve(res).then(ok)
      return q
    } }) as never
    expect((await leerPizarron(base2({ human_validated: false, provenance_tag: {} }), { cliente: C })).manual_aprobado).toBe(false)
    expect((await leerPizarron(base2({ human_validated: true, provenance_tag: { validado_por: "dueno" } }), { cliente: C })).manual_aprobado).toBe(true)
    expect((await leerPizarron(base2({ human_validated: true, provenance_tag: { validado_por: "jefatura" } }), { cliente: C })).manual_aprobado).toBe(false)
    expect((await leerPizarron(base2(null), { cliente: C })).manual_aprobado).toBeNull()
    expect((await leerPizarron(base2(null, true), { cliente: C })).manual_aprobado).toBeNull()
  })
})
