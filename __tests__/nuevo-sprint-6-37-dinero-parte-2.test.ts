/**
 * DASHBOARD NUEVO · SPRINT 6.37 · DINERO COMPLETO · PARTE 2 (sección 4 desglose · sección 5 proveedores).
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { aCsv, desglose, topeSugerido, type Movimiento } from "@/lib/dinero-completo"
import { PanelDinero } from "@/components/nuevo/PanelDinero"

const m = (d: string, usd: number, x: Partial<Movimiento> = {}): Movimiento => ({ t: `${d}T15:00:00.000Z`, d, proveedor: "Anthropic", modelo: "claude-sonnet-4-6", empleado: "jefe-marketing", equipo: "Marketing · Estrategia", cliente: "Náufrago", client_id: "c1", corrida: `r-${d}`, usd, ok: true, cota: false, ...x })
const movs: Movimiento[] = []
for (let i = 20; i <= 31; i++) movs.push(m(`2026-10-${i}`, 1))
movs.push(m("2026-11-01", 2, { cliente: "Peniche", client_id: "c2", empleado: "copywriter", equipo: "Marketing · Creativo", corrida: "r-x" }), m("2026-11-02", 0.5, { proveedor: "Apify", modelo: "Apify · google_maps", empleado: "Apify (raspados)", equipo: "Proveedor externo · Apify", cliente: "Sin cliente", client_id: null, corrida: null }))
const hoy = "2026-11-02"

describe("6.37 · desglose", () => {
  it("por cliente: gasto, % del total y comparación con el período anterior del mismo largo", () => {
    const f = desglose(movs, "cliente", { desde: "2026-10-27", hasta: hoy })
    const c1 = f.find((x) => x.clave === "Náufrago")!
    expect(c1.usd).toBe(5); expect(c1.anterior).toBe(7); expect(c1.variacion_pct).toBe(-29)
    expect(f.find((x) => x.clave === "Peniche")!.variacion_pct).toBeNull()
    expect(Math.round(f.reduce((a, x) => a + x.pct, 0))).toBe(100)
  })
  it("por equipo sale del organigrama; por corrida trae día y detalle", () => {
    expect(desglose(movs, "equipo", { desde: "2026-11-01", hasta: hoy }).map((x) => x.nombre).sort()).toEqual(["Marketing · Creativo", "Proveedor externo · Apify"])
    const r = desglose(movs, "corrida", { desde: "2026-11-01", hasta: hoy })
    expect(r).toHaveLength(1); expect(r[0]).toMatchObject({ corrida: "r-x", dia: "2026-11-01" })
  })
  it("el tope suave sugerido: 30 días × 1,2 redondeado a US$ 5 (mínimo 5); sin gasto no sugiere", () => {
    expect(topeSugerido(movs, (x) => x.client_id === "c1", hoy)).toBe(15)
    expect(topeSugerido(movs, (x) => x.client_id === "nadie", hoy)).toBeNull()
  })
  it("CSV con comillas cuando hace falta", () => {
    expect(aCsv([{ a: "x, y", b: 2 }])).toBe(['a,b', '"x, y",2'].join(String.fromCharCode(10)))
    expect(aCsv([])).toBe("")
  })
})

describe("6.37 · la pantalla", () => {
  const h = renderToStaticMarkup(createElement(PanelDinero, { onCerrar: () => {}, datosIniciales: { movimientos: movs, saldos: [{ proveedor: "Apify", plan: "Starter", usado_usd: 26, credito_usd: 29, pct: 90, ciclo_hasta: "2026-11-15T00:00:00Z" }], topes: [{ client_id: "c1", cliente: "Náufrago", gastado_24h_usd: 5.62, techo_usd: 20, pct: 28 }, { client_id: "c9", cliente: "Sin gasto", gastado_24h_usd: 0, techo_usd: 10, pct: 0 }], cache: null, desde: "2026-09-01T00:00:00Z", leido_en: "2026-11-02T17:00:00Z", faltan: [] } } as never)).replace(/<!-- -->/g, "")
  it("las pestañas de Ramp y el CSV", () => {
    for (const v of ["cliente", "equipo", "empleado", "modelo", "proveedor", "corrida"]) expect(h).toContain(`data-vista="${v}"`)
    expect(h).toContain("data-csv"); expect(h).toContain("Exportar CSV")
  })
  it("por cliente: freno 24 h con su cifra, margen sin dato todavía, tope suave sugerido; aparece el cliente con freno y sin gasto", () => {
    expect(h).toContain("US$ 5,62 de US$ 20,00"); expect(h).toContain("data-margen"); expect(h).toContain("data-tope-sugerido"); expect(h).toContain("/mes"); expect(h).toContain('data-fila="Sin gasto"')
  })
  it("proveedores: los 7, Apify con saldo, corte y aviso de saldo bajo; los demás sin dato todavía", () => {
    for (const p of ["Anthropic", "GPT (OpenAI)", "Apify", "Higgsfield", "Railway", "Vercel", "Supabase"]) expect(h).toContain(`data-saldo="${p}"`)
    expect(h).toContain("data-saldo-bajo"); expect(h).toContain("US$ 26,00 de US$ 29,00"); expect(h).toContain("quedan US$ 3,00")
  })
  it("solo lectura: el tope suave se sugiere, no se escribe", () => {
    expect(readFileSync("components/nuevo/DineroDesglose.tsx", "utf8")).not.toMatch(/fetch\(|method:/)
  })
})
