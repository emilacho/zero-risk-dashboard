/**
 * Dashboard nuevo · CC6 · TABLERO DEL DUEÑO · palabras del manual con intención (01-nov · encargo del equipo del manual firmado por Emilio, §1 · puerta de
 * CC1 #815). Cada palabra dice si la prohíbe una norma, el dueño o es solo estilo; el dueño la prohíbe, la deja como estilo o la quita. US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { agruparPalabras, decisionesPara, fuenteLegible, palabrasDelManual } from "@/lib/manual-palabras"
import { ejecutarAccion } from "@/lib/tablero-acciones"
import { PanelManual } from "@/components/nuevo/PanelManual"
import { PalabrasDelManual } from "@/components/nuevo/PalabrasDelManual"
import { leerManual } from "@/lib/manual-lector"
import type { ManualDelCliente } from "@/lib/manual-datos"

const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const FECHA = "2026-11-01T10:00:00Z"

describe("las palabras del manual con su intención (la misma regla que la plataforma)", () => {
  it("lo viejo es estilo; una dura necesita su fuente (norma: cita · dueño: cita y fecha); la unión no repite y la dura gana", () => {
    const p = palabrasDelManual({
      forbidden_words: ["el mejor de", "Lujo", "barato", "gratis", "  ", 7],
      palabras_con_intencion: [
        { texto: "gratis", intencion: "legal", fuente: { cita: "Art. 12 de la norma X", origen: "regulador" } },
        { texto: "barato", intencion: "del_dueno", fuente: { cita: "No quiero esa palabra", fecha: FECHA, por: "emilio" } },
        { texto: "lujo", intencion: "estilo", porque: "la marca es de barrio" },
        { texto: "promo", intencion: "legal", fuente: {} }, // dura sin cita → estilo
        { texto: "oferta", intencion: "del_dueno", fuente: { cita: "no", fecha: "ayer" } }, // dueño sin fecha válida → estilo
        "texto suelto", { intencion: "legal" },
      ],
    })
    const por = Object.fromEntries(p.map((x) => [x.texto, x.intencion]))
    expect(por).toEqual({ gratis: "legal", barato: "del_dueno", lujo: "estilo", promo: "estilo", oferta: "estilo", "el mejor de": "estilo" })
    expect(p.find((x) => x.texto === "lujo")?.porque).toBe("la marca es de barrio") // «Lujo» de la lista no se repite (sin mayúsculas)
    expect(palabrasDelManual(null)).toEqual([])
    expect(palabrasDelManual({ forbidden_words: ["café"], palabras_con_intencion: [{ texto: "cafe", intencion: "legal", fuente: { cita: "c" } }] }).map((x) => [x.texto, x.intencion])).toEqual([["cafe", "legal"]])
  })

  it("se agrupan en tres filas (norma · dueño · estilo); lo que se ofrece decidir cambia algo; la fuente se dice en palabras", () => {
    const p = palabrasDelManual({ forbidden_words: ["b", "a"], palabras_con_intencion: [{ texto: "x", intencion: "del_dueno", fuente: { cita: "lo dije", fecha: FECHA } }] })
    const g = agruparPalabras(p)
    expect(g.map((x) => [x.intencion, x.palabras.map((y) => y.texto)])).toEqual([["legal", []], ["del_dueno", ["x"]], ["estilo", ["a", "b"]]])
    expect(decisionesPara({ intencion: "estilo" })).toEqual(["prohibir", "quitar"])
    expect(decisionesPara({ intencion: "del_dueno" })).toEqual(["contexto", "quitar"])
    expect(decisionesPara({ intencion: "legal" })).toEqual(["contexto", "quitar"])
    expect(fuenteLegible(p.find((y) => y.texto === "x")!)).toBe("lo dije · el 2026-11-01")
    expect(fuenteLegible(p.find((y) => y.texto === "a")!)).toBeNull()
  })
})

describe("la acción del tablero «manual-palabra» (contrato de CC1)", () => {
  const llamar = async (cuerpo: Record<string, unknown>, respuesta: Response = new Response(JSON.stringify({ ok: true, version_nueva: 16, decision: "prohibir", texto: "barato", duras: ["barato"] }), { status: 200 })) => {
    const llamadas: Array<{ url: string; metodo: string; cuerpo: Record<string, unknown> }> = []
    const fetchFalso: typeof fetch = async (url, init) => { llamadas.push({ url: String(url), metodo: String(init?.method), cuerpo: JSON.parse(String(init?.body)) }); return respuesta }
    const r = await ejecutarAccion("manual-palabra", cuerpo, { revisor: "emilio", plataformaUrl: "https://plataforma.test", llave: "llave-de-prueba", fetchImpl: fetchFalso })
    return { r, llamadas }
  }
  it("valida y llega a POST /api/tablero/manual-palabra con revisor y origen; sin gasto", async () => {
    const { r, llamadas } = await llamar({ client_id: CLIENTE, texto: "  barato ", decision: "prohibir", comentario: " no me gusta " })
    expect(r.status).toBe(200)
    expect(llamadas[0]).toMatchObject({ url: "https://plataforma.test/api/tablero/manual-palabra", metodo: "POST", cuerpo: { client_id: CLIENTE, texto: "barato", decision: "prohibir", comentario: "no me gusta", reviewer: "emilio", origen: "dashboard" } })
    expect(llamadas[0].cuerpo).not.toHaveProperty("confirmo_gasto")
  })
  it("rechaza lo que la plataforma rechazaría, sin llamarla", async () => {
    for (const malo of [{ texto: "x", decision: "prohibir" }, { client_id: CLIENTE, texto: "", decision: "prohibir" }, { client_id: CLIENTE, texto: "x".repeat(201), decision: "prohibir" }, { client_id: CLIENTE, texto: "x", decision: "borrar" }, { client_id: CLIENTE, texto: "x", decision: "quitar", comentario: "y".repeat(1001) }]) {
      const { r, llamadas } = await llamar(malo)
      expect(r.status).toBe(400); expect(llamadas).toHaveLength(0)
    }
  })
  it("una palabra que no está o un cliente sin manual vuelven con su motivo (no «todavía no disponible»)", async () => {
    const { r } = await llamar({ client_id: CLIENTE, texto: "nada", decision: "quitar" }, new Response(JSON.stringify({ ok: false, error: "palabra_no_esta", detalle: "«nada» no está en la lista del manual" }), { status: 404 }))
    expect(r).toMatchObject({ status: 404, cuerpo: { error: "no_encontrado", detalle: "«nada» no está en la lista del manual" } })
  })
})

describe("el tablero en el manual de marca", () => {
  const PALABRAS = palabrasDelManual({ forbidden_words: ["el mejor de", "barato", "gratis"], palabras_con_intencion: [{ texto: "gratis", intencion: "legal", fuente: { cita: "Ley de defensa del consumidor" } }, { texto: "barato", intencion: "del_dueno", fuente: { cita: "No quiero esa palabra", fecha: FECHA } }] })
  it("cada palabra en su fila, con su fuente y sus botones; y el campo para prohibir otra", () => {
    const html = renderToStaticMarkup(createElement(PalabrasDelManual, { palabras: PALABRAS, cliente: CLIENTE, accion: async () => ({ ok: true, texto: "Guardado", detalle: {} }), onGuardado: () => {} }))
    expect(html).toMatch(/data-palabra="gratis" data-intencion="legal"/)
    expect(html).toMatch(/data-palabra="barato" data-intencion="del_dueno"/)
    expect(html).toMatch(/data-palabra="el mejor de" data-intencion="estilo"/)
    expect(html).toContain("Prohibidas por una norma · bloquean")
    expect(html).toContain("Estilo de la marca · no bloquean")
    expect(html).toContain('title="norma: Ley de defensa del consumidor"')
    expect(html).toContain("data-agregar-palabra")
    expect(html).not.toContain("data-decidir") // de entrada solo fichas: las decisiones aparecen al tocar una
    expect(html).not.toContain("data-confirmar")
  })
  it("al tocar una ficha aparecen sus decisiones (solo las que cambian algo) y su fuente", () => {
    const de = (t: string) => renderToStaticMarkup(createElement(PalabrasDelManual, { palabras: PALABRAS, cliente: CLIENTE, accion: async () => ({ ok: true, texto: "Guardado", detalle: {} }), onGuardado: () => {}, elegidaInicial: t }))
    const estilo = de("el mejor de")
    expect(estilo).toContain('data-decisiones="el mejor de"')
    expect([...estilo.matchAll(/data-decidir="([a-z]+)"/g)].map((m) => m[1])).toEqual(["prohibir", "quitar"])
    const dueno = de("barato")
    expect([...dueno.matchAll(/data-decidir="([a-z]+)"/g)].map((m) => m[1])).toEqual(["contexto", "quitar"])
    expect(dueno).toContain("No quiero esa palabra · el 2026-11-01")
    expect(dueno).not.toContain("data-confirmar") // elegir la decisión todavía no la manda: se confirma aparte
  })
  it("el manual de marca lo muestra en lugar de la lista plana; sin avisos de gasto", () => {
    const fila = { client_id: CLIENTE, version: 1, auto_generated: true, human_validated: false, brand_purpose: "Propósito", content_text: "{}" }
    const datos: ManualDelCliente = { clientes: [{ id: CLIENTE, nombre: "Náufrago", con_manual: true }], cliente: { id: CLIENTE, nombre: "Náufrago" }, manual: { version: 1, versiones: 1, lector: leerManual(fila)!, fidelidad: "Sin revisión de fidelidad", origen: null, colores: [], tipografias: [], opciones_eslogan: [], palabras_prohibidas: ["el mejor de", "barato", "gratis"], palabras: PALABRAS, terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null }, leido_en: FECHA }
    const html = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: datos }))
    expect(html).toContain("data-tablero-palabras")
    expect(html).not.toContain("Palabras prohibidas · nunca")
    for (const f of ["components/nuevo/PalabrasDelManual.tsx", "lib/manual-palabras.ts"]) expect(readFileSync(f, "utf8")).not.toMatch(/US\$|gasto|costo/i)
  })
})
