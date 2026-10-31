/**
 * DASHBOARD NUEVO · SPRINT 6.4 · EDITAR EL MANUAL DESDE EL ESTILO NUEVO (Emilio, 31-oct: «los documentos deben tener un botón que me permita editar sus
 * diferentes partes y esa edición está conectada con el sistema: el próximo agente lee el documento actualizado»). El botón «Editar» de cada campo guarda por
 * `POST /api/acciones/manual-campos` (el servidor del tablero valida; la plataforma crea la versión max+1 vigente, marca «escrito por el dueño» y re-indexa el
 * cerebro). Solo los 7 campos que la plataforma acepta por clave de tablero llevan botón; los demás lo dicen.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EDITABLES_DESDE_EL_TABLERO, cuerpoDeEdicion, esEditableDesdeElTablero, textoParaEditar } from "@/lib/manual"
import { CAMPOS_DEL_MANUAL, ejecutarAccion } from "@/lib/tablero-acciones"
import { PanelManual, llamarAccion, resumenDelGuardado } from "@/components/nuevo/PanelManual"
import { leerManual } from "@/lib/manual-lector"
import type { ManualDelCliente } from "@/lib/manual-datos"

const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"

describe("sprint 6.4 · editar el manual desde el dashboard nuevo", () => {
  it("los campos editables son exactamente los que el servidor del tablero acepta (y por tanto los que la plataforma acepta por clave de tablero)", () => {
    expect(EDITABLES_DESDE_EL_TABLERO.map((e) => e.clave).sort()).toEqual(CAMPOS_DEL_MANUAL.map((c) => c.clave).sort())
    expect(esEditableDesdeElTablero("eslogan")).toBe(true); expect(esEditableDesdeElTablero("mision")).toBe(false)
  })
  it("el cuerpo de la edición es el que valida el servidor del tablero: listas una por línea, límite 2.000, el porqué opcional", async () => {
    expect(cuerpoDeEdicion(CLIENTE, "eslogan", "  Del mar a tu mesa ", "lo dijo el dueño")).toEqual({ client_id: CLIENTE, campos: { eslogan: "Del mar a tu mesa" }, comentario: "lo dijo el dueño" })
    expect(cuerpoDeEdicion(CLIENTE, "valores", "Frescura\n\n  Honestidad \nCercanía", "")).toEqual({ client_id: CLIENTE, campos: { valores: "Frescura\nHonestidad\nCercanía" } })
    expect(cuerpoDeEdicion(CLIENTE, "eslogan", "   ", "")).toEqual({ error: "Escribe algo antes de guardar" })
    expect(cuerpoDeEdicion(CLIENTE, "eslogan", "x".repeat(2001), "")).toEqual({ error: "Máximo 2.000 caracteres" })
    expect(cuerpoDeEdicion(CLIENTE, "mision", "x", "")).toEqual({ error: "«mision» todavía no se edita desde aquí" })
    expect(textoParaEditar("valores", "Frescura · Honestidad")).toBe("Frescura\nHonestidad"); expect(textoParaEditar("voz", "a · b")).toBe("a · b"); expect(textoParaEditar("voz", null)).toBe("")
    // lo que arma el panel lo acepta el servidor del tablero y llega a la plataforma por PATCH /api/manual/{cliente}/campos con la llave interna
    const llamadas: Array<{ url: string; metodo: string; cuerpo: Record<string, unknown> }> = []
    const fetchFalso: typeof fetch = async (url, init) => { llamadas.push({ url: String(url), metodo: String(init?.method), cuerpo: JSON.parse(String(init?.body)) }); return new Response(JSON.stringify({ ok: true, version_nueva: 2, cambios: [], cerebro: { indice: "ok", enviados: ["tagline_opciones"], pendientes: [] } }), { status: 200 }) }
    const r = await ejecutarAccion("manual-campos", cuerpoDeEdicion(CLIENTE, "eslogan", "Del mar a tu mesa", "lo dijo el dueño"), { revisor: "emilio", plataformaUrl: "https://plataforma.test", llave: "llave-de-prueba", fetchImpl: fetchFalso })
    expect(r.status).toBe(200)
    expect(llamadas).toHaveLength(1); expect(llamadas[0].url).toBe(`https://plataforma.test/api/manual/${CLIENTE}/campos`); expect(llamadas[0].metodo).toBe("PATCH")
    expect(llamadas[0].cuerpo).toMatchObject({ campos: { eslogan: "Del mar a tu mesa" }, comentario: "lo dijo el dueño", reviewer: "emilio", origen: "dashboard" })
    expect(resumenDelGuardado(r.cuerpo.resultado as Record<string, unknown>)).toBe("Versión 2 guardada · el cerebro ya lo tiene: el siguiente empleado lo lee así")
    expect(resumenDelGuardado({ version_nueva: 3, cerebro: { enviados: ["a"], pendientes: [{ clave: "b", error: "x" }] } })).toBe("Versión 3 guardada · el cerebro recibió 1 y quedan 1 pendientes")
  })
  it("la llamada del panel dice con franqueza lo que pasó", async () => {
    const ok = await llamarAccion("manual-campos", { a: 1 }, async () => new Response(JSON.stringify({ ok: true, resultado: { version_nueva: 2 } }), { status: 200 }))
    expect(ok).toEqual({ ok: true, texto: "Guardado", detalle: { version_nueva: 2 } })
    expect(await llamarAccion("manual-campos", {}, async () => new Response("{}", { status: 401 }))).toEqual({ ok: false, texto: "Tu sesión venció: entra de nuevo." })
    expect(await llamarAccion("manual-campos", {}, async () => new Response(JSON.stringify({ ok: false, detalle: "la plataforma no aceptó" }), { status: 502 }))).toEqual({ ok: false, texto: "No se pudo: la plataforma no aceptó" })
    expect(await llamarAccion("manual-campos", {}, async () => new Response("{}", { status: 501 }))).toMatchObject({ ok: false, texto: expect.stringContaining("Todavía no está disponible") })
  })
  it("el panel pone «Editar» solo en los campos que la plataforma acepta, dice cuáles no, y ofrece validar cuando no lo validó el dueño", () => {
    const fila = { client_id: CLIENTE, version: 1, auto_generated: true, human_validated: false, brand_purpose: "Propósito x", brand_mission: "Misión y", voice_description: "Voz z", tagline: "Eslogan w", content_text: "{}" }
    const lector = leerManual(fila)!
    const datos: ManualDelCliente = { clientes: [{ id: CLIENTE, nombre: "Náufrago", con_manual: true }], cliente: { id: CLIENTE, nombre: "Náufrago" }, manual: { version: 1, versiones: 1, lector, fidelidad: "Sin revisión de fidelidad", origen: null, colores: [], tipografias: [], opciones_eslogan: [], palabras_prohibidas: [], terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null }, leido_en: "x" }
    const html = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: datos }))
    expect(html).toMatch(/data-campo="proposito" data-estado="lleno" data-editable="true"/); expect(html).toMatch(/data-campo="mision" data-estado="lleno" data-editable="false"/)
    expect(html.match(/data-accion="editar-campo"/g)?.length).toBe(EDITABLES_DESDE_EL_TABLERO.length) // todos los editables se muestran, llenos o vacíos, cada uno con su botón
    expect(html).toContain('data-campo-editar="eslogan"'); expect(html).not.toContain('data-campo-editar="mision"'); expect(html).toContain("se edita en el próximo paso")
    expect(html).toContain('data-accion="validar-manual"'); expect(html).not.toContain('data-editor=') // nada abierto de entrada
    expect(html).toMatch(/data-campo="nunca" data-estado="hueco" data-editable="true"/); expect(html).toContain("Sin dato todavía: escríbelo aquí") // opcional vacío pero editable: se muestra para poder escribirlo
    // validado por el dueño → no se ofrece validar otra vez
    const validado = leerManual({ ...fila, human_validated: true, provenance_tag: { validado_por: "dueno" } })!
    const html2 = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: { ...datos, manual: { ...datos.manual!, lector: validado } } }))
    expect(html2).not.toContain('data-accion="validar-manual"')
    const c = readFileSync("components/nuevo/PanelManual.tsx", "utf8")
    expect(c).toContain('fetchImpl(`/api/acciones/${encodeURIComponent(nombre)}`') // escribe SOLO por la acción del tablero (servidor valida · plataforma hace)
    expect(c).not.toMatch(/supabase|service_role|from\("client_brand_books"\)/) // el panel no toca la base
    expect(c).toContain("void leer(cliente)") // tras guardar se relee: lo que se ve es la versión nueva
  })
})
