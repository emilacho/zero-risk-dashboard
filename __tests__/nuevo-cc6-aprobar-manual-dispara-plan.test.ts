/** LA CADENA ESPERA LA APROBACIÓN DEL MANUAL · parte del panel (CC6 · 03-nov · firma de Emilio 14:46Z). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelManual, avisoDeAprobado, llamarAccion, motivoDeNoAprobar } from "@/components/nuevo/PanelManual"
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
    expect(avisoDeAprobado({ plan: { pedido: true } })).toEqual({ ok: true, texto: "✓ Manual aprobado · el plan arranca con este manual", reintentar: false })
    expect(avisoDeAprobado({})).toEqual({ ok: true, texto: "✓ Manual aprobado · el plan arranca con este manual", reintentar: false })
    expect(avisoDeAprobado({ sin_cambios: true })).toEqual({ ok: true, texto: "Ya estaba aprobado por ti.", reintentar: false })
  })
  it("contrato CC1 #868 · plan ya pedido para esta versión; plan que NO se pudo pedir (queda para reintentar)", () => {
    expect(avisoDeAprobado({ plan: { pedido: true, repetido: true } }).texto).toBe("✓ Manual aprobado · el plan de esta versión ya estaba pedido")
    const fallo = avisoDeAprobado({ plan: { pedido: false, error: "x" }, aviso: "El manual quedó aprobado, pero el plan no se pudo pedir. Vuelve a aprobar para reintentar." })
    expect(fallo.ok).toBe(false); expect(fallo.reintentar).toBe(true)
    expect(avisoDeAprobado({ plan: { pedido: false } }).reintentar).toBe(true) // sin aviso, igual se puede reintentar
    expect(fallo.texto).toBe("El manual quedó aprobado, pero el plan no se pudo pedir. Toca «Reintentar pedir el plan».") // el texto de #868 no se duplica
  })
  it("contrato CC1 #868 · los rechazos se dicen en palabras, con su detalle: reescritura en curso · plan en curso · no se pudo leer", () => {
    expect(motivoDeNoAprobar({ texto: "x", codigo: "regeneracion_en_curso", detalleCrudo: "pedido 3a…" })).toBe("Todavía no se puede aprobar: el manual se está reescribiendo. Espera a que termine (pedido 3a…).")
    expect(motivoDeNoAprobar({ texto: "x", codigo: "plan_en_curso", detalleCrudo: "corrida de hoy" })).toBe("Ya hay un plan en marcha para este cliente; no se pide otro (corrida de hoy).")
    expect(motivoDeNoAprobar({ texto: "x", codigo: "no_se_pudo_leer" })).toBe("No se pudo leer el manual para aprobarlo. Prueba de nuevo en un momento.")
    expect(motivoDeNoAprobar({ texto: "Tu sesión venció: entra de nuevo." })).toBe("Tu sesión venció: entra de nuevo.")
  })
  it("el código llega desde la puerta del tablero: 409 trae el de la plataforma en `plataforma.error`; 502 en `plataforma_error`", async () => {
    const r409 = await llamarAccion("manual-validar", {}, async () => new Response(JSON.stringify({ ok: false, error: "conflicto", detalle: "pedido p1", plataforma: { error: "regeneracion_en_curso" } }), { status: 409 }))
    expect(r409).toMatchObject({ ok: false, codigo: "regeneracion_en_curso", detalleCrudo: "pedido p1" })
    const r502 = await llamarAccion("manual-validar", {}, async () => new Response(JSON.stringify({ ok: false, error: "la_plataforma_rechazo", plataforma_error: "no_se_pudo_leer", detalle: "base caída" }), { status: 502 }))
    expect(r502).toMatchObject({ ok: false, codigo: "no_se_pudo_leer" })
  })
  it("aprobado pero sin plan pedido: el botón sigue a la vista como «Reintentar pedir el plan»; aprobado y con plan: no hay botón", () => {
    const aprobado = manual({ human_validated: true, provenance_tag: { validado_por: "dueno" } })
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: aprobado, reintentarPlanInicial: true }))
    expect(h).toMatch(/data-accion="validar-manual"[^>]*>Reintentar pedir el plan</)
    expect(renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: aprobado }))).not.toContain('data-accion="validar-manual"')
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
