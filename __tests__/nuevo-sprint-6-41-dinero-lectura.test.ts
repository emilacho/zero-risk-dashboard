/**
 * DASHBOARD NUEVO · SPRINT 6.41 · DINERO MÁS FÁCIL DE LEER · TAREA B (lectura, como Ramp): «lo que cambió» en 3 tarjetas con número grande y una línea;
 * gráfico con US$ en el eje, leyenda grande clicable y total del día; tablas que se ordenan y se buscan con encabezado fijo; textos cortos con «?».
 * Además (Emilio): «Llamadas con costo» → «Costo de rehacer».
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { anteriorDe, loQueCambio, rangoDe, type Movimiento } from "@/lib/dinero-completo"
import { PanelDinero } from "@/components/nuevo/PanelDinero"

const m = (d: string, usd: number, x: Partial<Movimiento> = {}): Movimiento => ({ t: `${d}T15:00:00.000Z`, d, proveedor: "Anthropic", modelo: "claude-sonnet-4-6", empleado: "Jefe marketing", cliente: "Náufrago", client_id: "c1", corrida: `r-${d}`, usd, ok: true, cota: false, ...x })
const movs: Movimiento[] = []
for (let i = 1; i <= 31; i++) movs.push(m(`2026-10-${String(i).padStart(2, "0")}`, i === 30 ? 9 : 1))
movs.push(m("2026-11-01", 2, { ok: false, proveedor: "Apify" }), m("2026-11-02", 2))
const hoy = "2026-11-02"
const panel = readFileSync("components/nuevo/PanelDinero.tsx", "utf8"), tabla = readFileSync("components/nuevo/DineroDesglose.tsx", "utf8"), resultados = readFileSync("components/nuevo/DineroResultados.tsx", "utf8")
const h = renderToStaticMarkup(createElement(PanelDinero, { onCerrar: () => {}, datosIniciales: { movimientos: movs, saldos: [], topes: [], cache: { leido: 70, entrada: 30 }, desde: "2026-09-01T00:00:00Z", leido_en: "2026-11-02T17:00:00Z", faltan: [] }, alAbrirCorrida: () => {} })).replace(/<!-- -->/g, "")

describe("6.41 · «lo que cambió» en 3 tarjetas", () => {
  it("cada tarjeta trae un número grande y una línea corta; el texto largo queda para «ver más»", () => {
    const r = rangoDe("7", hoy), c = loQueCambio(movs, hoy, { leido: 70, entrada: 30 }, { r, ant: anteriorDe("7", r) })
    expect(c.map((x) => x.numero)).toEqual(["▲ 143 %", "US$ 9,00", "70 %"])
    for (const x of c) { expect(x.linea!.length).toBeLessThanOrEqual(60); expect(x.texto.length).toBeGreaterThan(x.linea!.length) }
  })
  it("en pantalla: 3 tarjetas con número, línea y «ver más»", () => {
    expect(h.match(/data-cambio-numero/g)).toHaveLength(3); expect(h.match(/data-cambio-linea/g)).toHaveLength(3); expect(h.match(/data-ver-mas/g)).toHaveLength(3)
    expect(h).not.toContain("data-cambio-detalle")
  })
})

describe("6.41 · el gráfico", () => {
  it("US$ en el eje, leyenda grande clicable (ocultar/mostrar) y total del día al pasar el cursor", () => {
    expect(h).toMatch(/data-eje[^>]*>US\$ /)
    expect(h).toContain('data-serie="Anthropic"'); expect(h).toContain('aria-pressed="true"'); expect(panel).toContain("text-[13px]")
    expect(panel).toContain("alternar(k)"); expect(panel).toContain("data-mostrar-todas"); expect(panel).toContain("data-total-del-dia")
  })
})

describe("6.41 · tablas", () => {
  it("se ordenan por columna, se buscan y tienen el encabezado fijo", () => {
    for (const c of ["nombre", "usd", "pct", "variacion", "freno"]) expect(h).toContain(`data-ordenar="${c}"`)
    expect(h).toContain("data-buscar"); expect(h).toContain('aria-sort="none"')
    expect(tabla).toContain("sticky top-0 z-10"); expect(h).toContain("data-tabla-con-encabezado-fijo")
  })
})

describe("6.41 · textos más cortos con «?»", () => {
  it("las explicaciones largas salen del pie y van a la ayuda", () => {
    expect(h).toContain("data-ayuda")
    expect(tabla).not.toContain('<p className="mt-3 text-[12px] text-zinc-500">'); expect(resultados).not.toContain('<p className="mt-3 text-[12px] text-zinc-500">')
    expect(h).not.toContain("se ordena solo cuando se limpien los datos")
  })
})

describe("6.41 · «Costo de rehacer» en lugar de «Llamadas con costo»", () => {
  it("la tarjeta chica muestra el costo de rehacer del período", () => {
    expect(h).not.toContain("Llamadas con costo"); expect(h).toContain('data-tarjeta="rehacer"'); expect(h).toContain("Costo de rehacer")
    expect(h).toMatch(/data-tarjeta="rehacer"[\s\S]*?US\$ 2,00/)
  })
})

describe("6.41 · el eje con cifras redondas", () => {
  it("1 · 2 · 2,5 · 5 × 10ⁿ", async () => {
    const { pasoRedondo } = await import("@/components/nuevo/PanelDinero")
    expect(pasoRedondo(3.93)).toBe(5); expect(pasoRedondo(1.47)).toBe(2); expect(pasoRedondo(0.23)).toBe(0.25); expect(pasoRedondo(11)).toBe(20)
  })
})
