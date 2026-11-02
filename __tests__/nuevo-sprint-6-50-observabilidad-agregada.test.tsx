/**
 * DASHBOARD NUEVO · SPRINT 6.50 · OBSERVABILIDAD CON LA LECTURA AGREGADA (corrección aprobada por Emilio 2-nov,
 * `2026-11-02-CORRECCION-LENOVO-a-CC5-observabilidad-visual-dos-detalles.md`):
 *  1. corridas y errores ENTEROS desde la lectura agregada de CC1 (#853): sin días «no leído», con la comparación del período anterior, sin la línea gris;
 *  2. «Sin nombre de proceso» → el proceso real (n8n dice de qué proceso es cada ejecución); si de verdad no hay dato, «Otros procesos internos».
 */
import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { OTROS_PROCESOS, conProcesoReal, leerCorridas, leerResumenDeCorridas, nombreDeLaCorrida, normalizarLista, normalizarResumen, procesosDeEjecuciones, type ResumenAgregado } from "@/lib/direccion-corridas"
import { cubetasDe, gruposVisibles, numerosDelAgregado, procesoDe, serieDelAgregado, ventanaDe } from "@/lib/observabilidad"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {}, back: () => {} }) }))

const NAU = "0a2ffbd4-0000-4000-8000-000000000001"
const hoy = "2026-11-02"
const v = ventanaDe("7", hoy)
const g = (workflow_id: string, por_dia: Array<[string, number, number]>, x: Record<string, unknown> = {}) => ({
  workflow_id, client_id: NAU, ejecuciones: por_dia.reduce((s, d) => s + d[1], 0), con_error: por_dia.reduce((s, d) => s + d[2], 0), en_curso: 0, atascadas: 0, sin_cierre: 0,
  mediana_ms: 60000, max_ms: 900000, costo_usd: 1, por_dia: por_dia.map(([d, ejecuciones, con_error]) => ({ d, ejecuciones, con_error })), ...x,
})
const RES = normalizarResumen({
  ok: true, desde: v.r.desde, hasta: v.r.hasta, completo: true, filas_sin_ejecucion: 0,
  grupos: [g("X9F0zp6LQ2xGEYVS", [["2026-10-27", 40, 1], ["2026-11-01", 60, 2]]), g("bTbWL9lUvQCfStAz", [["2026-10-28", 100, 0]]), g("cc-cerebro-tendencias", [["2026-10-29", 52, 0]])],
}) as ResumenAgregado
const ANT = normalizarResumen({ ok: true, desde: v.ant.desde, hasta: v.ant.hasta, completo: true, filas_sin_ejecucion: 0, grupos: [g("X9F0zp6LQ2xGEYVS", [["2026-10-22", 100, 4]])] }) as ResumenAgregado

describe("6.50 · el nombre real de «Sin nombre de proceso»", () => {
  it("la revisión del manual por la jefatura tiene nombre de oficina y cae en «Manual de marca y alta»", () => {
    expect(nombreDeLaCorrida("ssLtwYPt7zxuvnM2", "212893")).toBe("Manual de marca · revisión de la jefatura")
    expect(procesoDe({ nombre: "Manual de marca · revisión de la jefatura" })).toBe("Manual de marca y alta")
  })
  it("sin ningún dato de proceso: «Otros procesos internos», nunca un número ni «sin nombre»", () => {
    for (const [w, e] of [["212893", "212893"], [null, "pasos-n-1"], ["AbCdEfGhIjKlMnOp", "210273"]] as const) expect(nombreDeLaCorrida(w, e)).toBe(OTROS_PROCESOS)
    expect(procesoDe({ nombre: OTROS_PROCESOS })).toBe(OTROS_PROCESOS)
  })
  it("n8n dice de qué proceso es cada número de ejecución (solo lectura, solo números, sin llave no pregunta)", async () => {
    const pedidos: string[] = []
    const f = (async (u: string) => { pedidos.push(String(u)); return new Response(JSON.stringify(String(u).includes("/212893") ? { workflowId: "ssLtwYPt7zxuvnM2" } : {}), { status: 200 }) }) as unknown as typeof fetch
    vi.stubEnv("N8N_BASE_URL", "https://n8n.prueba"); vi.stubEnv("N8N_API_KEY", "k")
    try {
      const m = await procesosDeEjecuciones(["212893", "212893", "999", "X9F0zp6LQ2xGEYVS", null, "api:revisor-externo"], f)
      expect([...m]).toEqual([["212893", "ssLtwYPt7zxuvnM2"]])
      expect(pedidos).toHaveLength(2); expect(pedidos.every((u) => u.startsWith("https://n8n.prueba/api/v1/executions/"))).toBe(true)
    } finally { vi.unstubAllEnvs() }
    vi.stubEnv("N8N_BASE_URL", ""); vi.stubEnv("N8N_API_KEY", "")
    try { expect((await procesosDeEjecuciones(["212893"], f)).size).toBe(0) } finally { vi.unstubAllEnvs() }
    expect(conProcesoReal([{ workflow_id: "212893" }, { workflow_id: "999" }], new Map([["212893", "ssLtwYPt7zxuvnM2"]]))).toEqual([{ workflow_id: "ssLtwYPt7zxuvnM2" }, { workflow_id: "999" }])
  })
  it("la lista de corridas ya llega con el proceso real", async () => {
    const plat = (async () => new Response(JSON.stringify({ ok: true, total: 1, corridas: [{ workflow_execution_id: "212893", workflow_id: "212893", estado: "completa", inicio: "2026-11-02T19:14:00Z" }] }), { status: 200 })) as unknown as typeof fetch
    const n8n = (async (u: string) => new Response(JSON.stringify(String(u).includes("/executions/") ? { workflowId: "ssLtwYPt7zxuvnM2" } : { name: "x" }), { status: 200 })) as unknown as typeof fetch
    vi.stubEnv("N8N_BASE_URL", "https://n8n.prueba"); vi.stubEnv("N8N_API_KEY", "k")
    try {
      const r = await leerCorridas({ dias: 7 }, { plataformaUrl: "https://p", llave: "k", fetchImpl: plat, procesosImpl: n8n })
      expect(r.ok && r.datos.corridas[0].nombre).toBe("Manual de marca · revisión de la jefatura")
      expect(r.ok && r.datos.corridas[0].workflow_id).toBe("ssLtwYPt7zxuvnM2")
    } finally { vi.unstubAllEnvs() }
  })
  it("Dinero y los empleados usan la misma traducción (no se queda un grupo «sin nombre» en Dinero)", () => {
    expect(readFileSync("lib/dinero-completo.ts", "utf8")).toMatch(/procesosDeEjecuciones\(inv\.map/)
    expect(readFileSync("app/api/direccion/observabilidad/route.ts", "utf8")).toMatch(/procesosDeEjecuciones\(filas\.map/)
  })
})

describe("6.50 · la lectura agregada", () => {
  it("lee la ruta de la plataforma con la llave interna y el período; 400 si el período no es válido", async () => {
    const urls: string[] = []; const heads: string[] = []
    const f = (async (u: string, i: RequestInit) => { urls.push(String(u)); heads.push(String((i.headers as Record<string, string>)["x-api-key"])); return new Response(JSON.stringify({ ok: true, desde: "2026-10-27", hasta: "2026-11-02", completo: true, filas_sin_ejecucion: 0, grupos: [g("X9F0zp6LQ2xGEYVS", [["2026-10-27", 3, 1]])] }), { status: 200 }) }) as unknown as typeof fetch
    const r = await leerResumenDeCorridas({ desde: "2026-10-27", hasta: "2026-11-02", client_id: NAU }, { plataformaUrl: "https://p/", llave: "secreta", fetchImpl: f, procesosImpl: f })
    expect(urls[0]).toBe(`https://p/api/direccion/corridas/resumen?desde=2026-10-27&hasta=2026-11-02&client_id=${NAU}`); expect(heads[0]).toBe("secreta")
    expect(r.ok && r.datos.grupos[0]).toMatchObject({ nombre: "Planeación del plan de 90 días", ejecuciones: 3, con_error: 1, interno: false })
    const malo = (async () => new Response("{}", { status: 400 })) as unknown as typeof fetch
    expect(await leerResumenDeCorridas({ desde: "2026-01-01", hasta: "2026-11-02" }, { plataformaUrl: "https://p", llave: "k", fetchImpl: malo })).toMatchObject({ ok: false, status: 400 })
    expect(await leerResumenDeCorridas({ desde: "2026-10-27", hasta: "2026-11-02" }, { plataformaUrl: "https://p", llave: "" })).toMatchObject({ ok: false, status: 503 })
  })
  it("la ruta del tablero: solo administrador, valida fechas (máx. 92 días) y el cliente, no escribe", () => {
    const src = readFileSync("app/api/direccion/corridas/resumen/route.ts", "utf8")
    expect(src).toContain("exigirAdmin()"); expect(src).toMatch(/> 92/); expect(src).toContain("UUID.test(cliente)")
    expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(|method: "(POST|PATCH|PUT|DELETE)"/)
  })
  it("cifras enteras: suma de ejecuciones y errores; el % no cuenta las que siguen en curso; interno se oculta igual que en la lista", () => {
    expect(numerosDelAgregado(RES.grupos)).toEqual({ corridas: 252, con_error: 3, pct_error: 1.2, max_ms: 900000 })
    const sin = gruposVisibles(RES.grupos, false)
    expect(sin.map((x) => x.workflow_id)).toEqual(["X9F0zp6LQ2xGEYVS", "bTbWL9lUvQCfStAz"])
    expect(numerosDelAgregado([{ ...RES.grupos[0], en_curso: 50 }]).pct_error).toBe(6)
  })
  it("la serie por día sale entera (incluidos los días que la lista no alcanzaba)", () => {
    const k = cubetasDe(v)
    expect(serieDelAgregado(RES.grupos, k).map((x) => x.total)).toEqual([40, 100, 52, 0, 0, 60, 0])
    expect(serieDelAgregado(RES.grupos, k).map((x) => x.con_error)).toEqual([1, 0, 0, 0, 0, 2, 0])
  })

  const render = async (x: Record<string, unknown> = {}) => {
    const { PanelObservabilidad } = await import("@/components/nuevo/PanelObservabilidad")
    // la lista cortada (200 de 252) que antes dejaba días «no leído»
    const lista = normalizarLista({ total: 252, ejecuciones_total: 252, ejecuciones_leidas: 1, corridas: [{ workflow_execution_id: "1", workflow_id: "X9F0zp6LQ2xGEYVS", estado: "completa", inicio: "2026-11-01T17:00:00Z", duracion_ms: 60000, client_id: NAU, cliente: "Náufrago" }] })
    return renderToStaticMarkup(createElement(PanelObservabilidad, { onCerrar: () => {}, listaInicial: { ...lista, ejecuciones_total: 252, ejecuciones_leidas: 1 }, empleadosInicial: { todo: [], sin_interno: [] }, hoy, ...x })).replace(/<!-- -->/g, "")
  }
  it("en pantalla: sin «no leído» en corridas, cifra entera, comparación de vuelta y sin la línea gris", async () => {
    const h = await render({ agregadoInicial: { r: RES, ant: ANT }, internoInicial: true })
    const caja = h.slice(h.indexOf('data-grafico-caja="corridas"'), h.indexOf('data-grafico-caja="costo"'))
    expect(caja).toContain('data-corridas-total="252"'); expect(caja).toContain("3 con error"); expect(caja).not.toContain("data-no-leido")
    expect(caja).toContain("data-frente-al-anterior")
    expect(h).not.toContain("data-aviso-lectura"); expect(h).not.toContain("no leído")
    expect(h).toContain("data-definicion-agregada")
    // la demora por día no viene en la lectura agregada: se dice con una frase, no con cajas «no leído»
    expect(h).toContain("data-demora-parcial")
  })
  it("lectura agregada incompleta o sin el período anterior: se rotula, no se presenta como entera", async () => {
    const h = await render({ agregadoInicial: { r: { ...RES, completo: false }, ant: null }, internoInicial: true })
    expect(h).toContain("data-lectura-incompleta"); expect(h).toContain("data-sin-comparacion")
  })
  it("si la lectura agregada no llega, la pantalla vuelve a la lista rotulada como antes", async () => {
    const h = await render({ agregadoInicial: null, internoInicial: true })
    expect(h).toContain("data-aviso-lectura"); expect(h).toContain("data-no-leido"); expect(h).not.toContain("data-definicion-agregada")
  })
})
