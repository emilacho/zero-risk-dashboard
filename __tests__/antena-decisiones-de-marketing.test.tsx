/**
 * 10-nov · GO de Lenovo a CC5 (Emilio: «Esa decisión debería salir en la antena y no la veo»).
 * La antena del Dept. Marketing cuenta también lo que espera tu aprobación de la campaña (gran idea, piezas, revisiones, plan).
 * Caso real: la gran idea v2 de Náufrago (`2d3c4da1`, fuente `hitl_queue`, ficha «Revisión») pendiente desde las 22:02Z del 09-nov.
 * Una decisión de finanzas o del cerebro NO la prende. US$ 0 · sin red (la lista de la plataforma se inyecta).
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { armarAlertas, decisionesPendientes, departamentoDeLaDecision, DESTINO_DEL_AVISO, type AlertaDeLaAntena, type DecisionPendiente, type EntradaDeAlertas } from "@/lib/escena-alertas"
import { normalizarDecisiones } from "@/lib/direccion-decisiones"
import { AntenaDeAlertas, ListaDeLasAlertas } from "@/components/nuevo/escena/AntenaDeAlertas"
import { leerAlertasDeLaAntena } from "@/lib/escena-avatares-datos"
import type { SupabaseClient } from "@supabase/supabase-js"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const AHORA = new Date("2026-11-09T23:10:00Z")
const vacia = (): EntradaDeAlertas => ({ cliente: NAUFRAGO, ahora: AHORA, plan: [], cerebroDiario: [], alarmasDelCerebro: [], preguntas: [], corridas: [] })
const dibujar = (alertas: AlertaDeLaAntena[]) => renderToStaticMarkup(createElement("svg", null, createElement(AntenaDeAlertas, { alertas, onAbrir: () => undefined })))

// la respuesta REAL de GET /api/direccion/decisiones del 09-nov 23:0xZ (recortada a los campos que la antena lee)
const RESPUESTA_REAL = {
  ok: true, completo: true,
  decisiones: [
    { id: "f4d46f59-1d22-4780-9e40-252e74fa53b4", tipo: "firma_de_finanzas", subtipo: "tablero_sin_firma", fuente: "finanzas_tableros", client_id: "df7e47cc-bec4-4fa2-bc24-ff97ba5213a5", titulo: "Tablero financiero: espera tu firma", desde: "2026-10-20T20:11:17.494374+00:00",
      decidir: {}, ficha: { departamento: { oficina: "financiera", nombre: "Financiero" } } },
    { id: "2d3c4da1-d3d5-40e0-b18e-d90e8652e001", tipo: "gran_idea", subtipo: "concepto_review", fuente: "hitl_queue", client_id: NAUFRAGO, titulo: "Gran idea · **El oro que nunca buscaste** · campaña Náufrago", desde: "2026-11-09T22:02:15.407521+00:00",
      decidir: {}, ficha: { departamento: { oficina: "revision", nombre: "Revisión" }, donde_se_hace: { pantalla: "gran_idea" } } },
  ],
  fuentes: [], sin_fuente: [],
}
const deLaPlataforma = (raw: unknown): DecisionPendiente[] =>
  normalizarDecisiones(raw).decisiones.map((d) => ({ id: d.id, tipo: d.tipo, fuente: d.fuente, client_id: d.client_id, desde: d.desde, oficina: d.departamento_oficina ?? null }))
const dec = (p: Partial<DecisionPendiente>): DecisionPendiente => ({ id: "x", tipo: "gran_idea", fuente: "hitl_queue", client_id: NAUFRAGO, desde: "2026-11-09T22:02:15Z", oficina: "revision", ...p })

describe("1 · la gran idea de Náufrago (la respuesta real de hoy) prende la antena", () => {
  it("con la lista real: entra la gran idea, la firma de finanzas no; el número es 1", () => {
    const a = armarAlertas({ ...vacia(), cliente: null, decisiones: deLaPlataforma(RESPUESTA_REAL) })
    expect(a.map((x) => x.clave)).toEqual(["decision:2d3c4da1-d3d5-40e0-b18e-d90e8652e001"])
    const html = dibujar(a)
    expect(html).toContain('data-alertas="1"'); expect(html).toContain("1 alerta del departamento")
  })
  it("el aviso dice «Gran idea de la Campaña de Marketing espera tu aprobación» y abre Decisiones", () => {
    const [a] = armarAlertas({ ...vacia(), decisiones: deLaPlataforma(RESPUESTA_REAL) })
    expect(a.texto).toBe("Gran idea de la Campaña de Marketing espera tu aprobación")
    expect(a.abre).toBe("decisiones"); expect(DESTINO_DEL_AVISO.decision).toBe("decisiones")
    expect(a.departamento).toBe("marketing")
    const lista = renderToStaticMarkup(ListaDeLasAlertas({ alertas: [a], onAbrir: () => undefined, onCerrar: () => undefined, ahora: AHORA.getTime() }))
    expect(lista).toContain("Gran idea de la Campaña de Marketing espera tu aprobación"); expect(lista).toContain('data-alerta="decision"')
  })
  it("la lectura guarda la oficina de la ficha (sin ella no sabríamos si la plataforma ya dice marketing)", () => {
    expect(normalizarDecisiones(RESPUESTA_REAL).decisiones.map((d) => d.departamento_oficina)).toEqual(["financiera", "revision"])
    expect(normalizarDecisiones({ decisiones: [{ id: "a", tipo: "pieza", titulo: "t" }] }).decisiones[0]).not.toHaveProperty("departamento_oficina")
  })
})

describe("2 · lo que no es de marketing no la prende", () => {
  it("una decisión del cerebro (fuente del cerebro, sin departamento) no entra", () => {
    const delCerebro = dec({ id: "c", tipo: "revision", fuente: "cerebro_conocimiento", oficina: null })
    expect(departamentoDeLaDecision(delCerebro)).toBeNull()
    expect(armarAlertas({ ...vacia(), decisiones: [delCerebro] })).toEqual([])
    expect(dibujar(armarAlertas({ ...vacia(), decisiones: [delCerebro] }))).not.toContain("nv-antena")
  })
  it("una del cerebro con su oficina escrita («cerebro») tampoco", () => {
    expect(armarAlertas({ ...vacia(), decisiones: [dec({ fuente: "cerebro_preguntas", oficina: "cerebro" })] })).toEqual([])
  })
  it("la firma de finanzas no entra aunque sea del mismo cliente", () => {
    expect(armarAlertas({ ...vacia(), decisiones: [dec({ tipo: "firma_de_finanzas", fuente: "finanzas_tableros", oficina: "financiera" })] })).toEqual([])
  })
  it("las preguntas al dueño no se cuentan dos veces (ya avisan como «pregunta»)", () => {
    expect(decisionesPendientes({ ...vacia(), decisiones: [dec({ tipo: "pregunta_al_dueno", fuente: "dueno_preguntas", oficina: "marketing" })] })).toEqual([])
  })
  it("la decisión de otro cliente no entra en la escena de Náufrago", () => {
    expect(armarAlertas({ ...vacia(), decisiones: [dec({ client_id: "df7e47cc-bec4-4fa2-bc24-ff97ba5213a5" })] })).toEqual([])
  })
})

describe("3 · el departamento sale del dato, no del tipo", () => {
  it("las tres fuentes de la campaña son del departamento; la ficha que diga «marketing» también manda", () => {
    for (const fuente of ["hitl_queue", "plan_aprobaciones", "cadena_campanas"]) expect(departamentoDeLaDecision({ fuente, oficina: "revision" })).toBe("marketing")
    expect(departamentoDeLaDecision({ fuente: "otra", oficina: " Marketing " })).toBe("marketing")
    expect(departamentoDeLaDecision({ fuente: "otra", oficina: "planeacion" })).toBe("planeacion")
  })
  it("el MISMO tipo entra o no según su fuente", () => {
    expect(armarAlertas({ ...vacia(), decisiones: [dec({ id: "a" })] })).toHaveLength(1)
    expect(armarAlertas({ ...vacia(), decisiones: [dec({ id: "b", fuente: "cerebro_conocimiento", oficina: null })] })).toHaveLength(0)
  })
  it("cada tipo de la campaña con su frase; el número cuenta pieza + revisión + plan + gran idea = 4", () => {
    const a = armarAlertas({ ...vacia(), decisiones: [dec({ id: "1" }), dec({ id: "2", tipo: "pieza" }), dec({ id: "3", tipo: "revision" }), dec({ id: "4", tipo: "plan", fuente: "plan_aprobaciones" })] })
    expect(a.map((x) => x.texto).sort()).toEqual(["Gran idea de la Campaña de Marketing espera tu aprobación", "Pieza de la Campaña de Marketing espera tu aprobación", "Plan de Marketing espera tu aprobación", "Revisión de la Campaña de Marketing espera tu aprobación"])
    expect(dibujar(a)).toContain('data-alertas="4"')
  })
})

describe("4 · la lectura del servidor", () => {
  it("lee la lista de la plataforma y la pasa a la antena; si la plataforma falla, es error de lectura (nunca «sin decisiones»)", () => {
    const datos = readFileSync("lib/escena-avatares-datos.ts", "utf8")
    expect(datos).toContain("lectorDeDecisiones()")
    expect(datos).toMatch(/if \(!r\.ok\) throw/)
    expect(datos).toContain("oficina: d.departamento_oficina ?? null")
  })
  // una base falsa que a toda consulta responde «sin dato» (data: null): sin cliente en la escena: el camino real del servidor, sin red
  const baseVacia = (): SupabaseClient => {
    const q: unknown = new Proxy(function () {}, { get: (_t, k) => (k === "then" ? (ok: (v: unknown) => void) => ok({ data: null, error: null }) : () => q), apply: () => q })
    return { from: () => q } as unknown as SupabaseClient
  }
  it("CAMINO REAL · leerAlertasDeLaAntena con la lista real de la plataforma devuelve la gran idea y nada más", async () => {
    const lector = async () => ({ ok: true as const, datos: normalizarDecisiones(RESPUESTA_REAL) })
    const a = await leerAlertasDeLaAntena(baseVacia(), AHORA, "c5-camino-real-1", lector)
    expect(a.map((x) => [x.tipo, x.texto, x.abre])).toEqual([["decision", "Gran idea de la Campaña de Marketing espera tu aprobación", "decisiones"]])
  })
  it("CAMINO REAL · si la plataforma no entrega la lista, la lectura falla (la escena no inventa «todo en orden»)", async () => {
    const lector = async () => ({ ok: false as const, status: 502, error: "La plataforma no entregó las decisiones (500)." })
    await expect(leerAlertasDeLaAntena(baseVacia(), AHORA, "c5-camino-real-2", lector)).rejects.toThrow(/decisiones/)
  })
})
