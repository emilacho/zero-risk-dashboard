/**
 * DASHBOARD NUEVO · SPRINT 6.40 · DINERO MÁS FÁCIL DE LEER · TAREA A (estructura de Ramp): pantalla completa, UN selector de período que manda en todo
 * comparado con el anterior igual, número principal grande arriba e índice de secciones fijo.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ahorro, anteriorDe, cacheDelRango, desglose, loQueCambio, rangoDe, resumenDelPeriodo, type Dinero, type Movimiento } from "@/lib/dinero-completo"
import { INDICE, PanelDinero } from "@/components/nuevo/PanelDinero"

const m = (d: string, usd: number, x: Partial<Movimiento> = {}): Movimiento => ({ t: `${d}T15:00:00.000Z`, d, proveedor: "Anthropic", modelo: "claude-sonnet-4-6", empleado: "Jefe marketing", cliente: "Náufrago", client_id: "c1", corrida: `r-${d}`, usd, ok: true, cota: false, ...x })
const movs: Movimiento[] = []
for (let i = 1; i <= 31; i++) movs.push(m(`2026-10-${String(i).padStart(2, "0")}`, 1))
movs.push(m("2026-11-01", 3), m("2026-11-02", 2))
const hoy = "2026-11-02"

describe("6.40 · el período y su anterior igual", () => {
  it("ayer · los 7 días anteriores · el mismo tramo del mes anterior · los 30 días anteriores", () => {
    expect(anteriorDe("hoy", rangoDe("hoy", hoy))).toEqual({ desde: "2026-11-01", hasta: "2026-11-01", nombre: "ayer" })
    expect(anteriorDe("7", rangoDe("7", hoy))).toEqual({ desde: "2026-10-20", hasta: "2026-10-26", nombre: "los 7 días anteriores" })
    expect(anteriorDe("mes", rangoDe("mes", hoy))).toEqual({ desde: "2026-10-01", hasta: "2026-10-02", nombre: "el mismo tramo del mes anterior" })
    expect(anteriorDe("30", rangoDe("30", hoy))).toMatchObject({ desde: "2026-09-04", hasta: "2026-10-03", nombre: "los 30 días anteriores" })
    expect(anteriorDe("mes", rangoDe("mes", "2026-03-31")).hasta).toBe("2026-02-28")
  })
  it("el número principal: gasto del período y variación frente al anterior igual", () => {
    const r = rangoDe("mes", hoy), k = resumenDelPeriodo(movs, r, anteriorDe("mes", r), hoy)
    expect(k).toMatchObject({ total: 5, anterior: 2, variacion_pct: 150, dias: 2, por_dia: 2.5, llamadas: 2 })
  })
  it("«lo que cambió» y el desglose siguen al período elegido, no a la semana fija", () => {
    const r = rangoDe("hoy", hoy), ant = anteriorDe("hoy", r)
    expect(loQueCambio(movs, hoy, null, { r, ant })[0].texto).toContain("bajó 33 % frente a ayer")
    expect(desglose(movs, "cliente", r, ant)[0]).toMatchObject({ usd: 2, anterior: 3 })
  })
  it("el caché también sigue al período cuando la tabla trae el día", () => {
    const d = { movimientos: movs, saldos: [], topes: [], cache: { leido: 1, entrada: 1 }, desde: "", leido_en: "", faltan: [], cache_por_empleado: [{ empleado: "A", modelo: "claude-sonnet-4-6", entrada: 100, leido: 900, usd: 1, d: "2026-11-02" }, { empleado: "A", modelo: "claude-sonnet-4-6", entrada: 900, leido: 100, usd: 1, d: "2026-10-01" }] } as Dinero
    expect(cacheDelRango(d, rangoDe("hoy", hoy))).toEqual({ leido: 900, entrada: 100 })
    expect(ahorro(d, rangoDe("hoy", hoy)).pct_cache).toBe(90)
  })
})

describe("6.40 · la pantalla", () => {
  const panel = readFileSync("components/nuevo/PanelDinero.tsx", "utf8")
  const h = renderToStaticMarkup(createElement(PanelDinero, { onCerrar: () => {}, datosIniciales: { movimientos: movs, saldos: [], topes: [], cache: null, desde: "2026-09-01T00:00:00Z", leido_en: "2026-11-02T17:00:00Z", faltan: [] } })).replace(/<!-- -->/g, "")
  it("pantalla completa: sin ancho máximo y con el chat respetado (nv-panel)", () => {
    expect(h).toContain("data-pantalla-completa"); expect(panel).not.toContain("max-w-[1440px]"); expect(panel).toContain('className="nv-panel fixed inset-0 z-[70]')
  })
  it("UN solo selector de período, con lo que se compara a la vista", () => {
    expect(h.match(/data-selector-unico/g)).toHaveLength(1); expect(h).toContain("comparado con los 30 días anteriores")
    expect(h).not.toContain('data-tarjeta="hoy"'); expect(h).not.toContain('data-tarjeta="semana"')
  })
  it("número principal grande arriba con su variación y la proyección al lado, más chica", () => {
    expect(h).toContain("data-numero-principal"); expect(h).not.toContain("frente a el "); expect(h.indexOf("data-numero-principal")).toBeLessThan(h.indexOf('data-dinero="cambios"'))
    expect(h).toContain("frente a los 30 días anteriores"); expect(h).toContain('data-tarjeta="proyeccion"')
  })
  it("índice fijo con las 7 secciones, cada una con su ancla", () => {
    expect(INDICE.map((x) => x.t)).toEqual(["Resumen", "En el tiempo", "Desglose", "Proveedores", "Resultados", "Anomalías", "Ahorro"])
    expect(h).toContain("data-indice"); expect(panel).toContain("sticky top-0")
    for (const x of INDICE) { expect(h).toContain(`data-ir-a="${x.id}"`); expect(h).toContain(`id="dinero-${x.id}"`) }
  })
})
