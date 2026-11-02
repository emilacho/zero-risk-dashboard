/**
 * DASHBOARD NUEVO · SPRINT 6.38 · DINERO COMPLETO · PARTE 3 (6 costo por resultado y de rehacer · 7 anomalías · 8 ahorro).
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ahorro, anomalias, costoDeRehacer, costoPorResultado, PROCESO_DEL_ALTA, PROCESO_DEL_PLAN, type Dinero, type Movimiento } from "@/lib/dinero-completo"
import { PanelDinero } from "@/components/nuevo/PanelDinero"

const m = (d: string, usd: number, x: Partial<Movimiento> = {}): Movimiento => ({ t: `${d}T15:00:00.000Z`, d, proveedor: "Anthropic", modelo: "claude-sonnet-4-6", empleado: "Jefe marketing", cliente: "Náufrago", client_id: "c1", corrida: `r-${d}`, usd, ok: true, cota: false, proceso: "Oficina · un turno", ...x })
const movs: Movimiento[] = []
for (let i = 10; i <= 31; i++) movs.push(m(`2026-10-${i}`, 0.5))
movs.push(m("2026-10-30", 3, { corrida: "caro", empleado: "Content creator" }))
movs.push(m("2026-10-25", 2, { proceso: PROCESO_DEL_PLAN, corrida: "plan-1" }), m("2026-10-25", 1, { proceso: PROCESO_DEL_PLAN, corrida: "plan-1" }), m("2026-10-29", 2, { proceso: PROCESO_DEL_PLAN, corrida: "plan-2" }))
movs.push(m("2026-10-20", 4, { proceso: PROCESO_DEL_ALTA, corrida: "alta-1" }))
movs.push(m("2026-10-28", 0.7, { ok: false, corrida: "f1" }), m("2026-10-28", 0.6, { cota: true, corrida: "t1" }), m("2026-10-27", 1.5, { proceso: "Prueba de un empleado", corrida: "p1" }))
const hoy = "2026-11-02", r = { desde: "2026-10-04", hasta: hoy }
const datos: Dinero = {
  movimientos: movs, saldos: [], topes: [], cache: { leido: 720, entrada: 280 }, desde: "2026-09-01T00:00:00Z", leido_en: "2026-11-02T17:00:00Z", faltan: [],
  piezas: [{ d: "2026-10-30", estado: "approved", usd: 2 }, { d: "2026-10-30", estado: "edited", usd: 1 }, { d: "2026-10-29", estado: "rejected", usd: 1.8 }, { d: "2026-10-29", estado: "rejected", usd: null }, { d: "2026-10-29", estado: "pending", usd: 1 }],
  manuales: ["2026-10-20", "2026-10-21"],
  cache_por_empleado: [{ empleado: "Portero del cerebro", modelo: "claude-sonnet-5-5", entrada: 1_000_000, leido: 0, usd: 3 }, { empleado: "Jefe marketing", modelo: "claude-opus-5-5", entrada: 100_000, leido: 2_000_000, usd: 2 }],
}

describe("6.38 · costo por resultado y de rehacer", () => {
  it("plan = cada corrida de planeación; manual = cada alta (+ versiones del manual); pieza = lo anotado en las aprobadas", () => {
    const [plan, manual, pieza] = costoPorResultado(datos, r)
    expect(plan).toMatchObject({ cuantos: 2, total: 5, por_unidad: 2.5 })
    expect(manual).toMatchObject({ cuantos: 1, por_unidad: 4 }); expect(manual.nota).toContain("2 versiones guardadas")
    expect(pieza).toMatchObject({ cuantos: 2, por_unidad: 1.5 }); expect(pieza.nota).toBe("2 aprobadas de 5 revisadas")
  })
  it("sin bandeja legible la pieza dice «sin dato todavía», nunca un cero", () => {
    expect(costoPorResultado({ ...datos, piezas: null }, r)[2]).toMatchObject({ por_unidad: null, nota: "sin dato todavía" })
  })
  it("rehacer: devueltas, fallidas, cortadas por tope y pruebas", () => {
    const x = Object.fromEntries(costoDeRehacer(datos, r).map((y) => [y.clave, y]))
    expect(x.cambios).toMatchObject({ usd: 1.8, cuantos: 2 }); expect(x.cambios.nota).toContain("sin costo anotado")
    expect(x.fallidas.usd).toBe(0.7); expect(x.tope.usd).toBe(0.6); expect(x.pruebas.usd).toBe(1.5)
  })
})

describe("6.38 · anomalías y ahorro", () => {
  it("una corrida 3× la mediana de su proceso aparece con su enlace; las corridas normales no", () => {
    const a = anomalias(datos, hoy, r)
    const caro = a.find((x) => x.corrida === "caro" && x.tipo === "corrida")!
    expect(caro.tipo).toBe("corrida"); expect(caro.veces).toBe(6); expect(caro.texto).toContain("Oficina · un turno · Náufrago")
    expect(a.some((x) => x.corrida === "r-2026-10-12")).toBe(false)
  })
  it("ahorro: % leído del caché, lo ahorrado estimado por modelo y oportunidades sin bajar la calidad", () => {
    const a = ahorro(datos, r)
    expect(a.pct_cache).toBe(72); expect(a.ahorrado_usd).toBe(9)
    expect(a.oportunidades[0].texto).toContain("Portero del cerebro"); expect(a.oportunidades.map((o) => o.texto).join(" ")).toContain("fallidas")
    expect(a.oportunidades.map((o) => o.texto).join(" ")).not.toMatch(/modelo más barato|cambiar a haiku/i)
  })
})

describe("6.38 · la pantalla", () => {
  const h = renderToStaticMarkup(createElement(PanelDinero, { onCerrar: () => {}, datosIniciales: datos, alAbrirCorrida: () => {} })).replace(/<!-- -->/g, "")
  it("secciones 6, 7 y 8 después del desglose y los proveedores", () => {
    expect(h.indexOf('data-dinero="proveedores"')).toBeLessThan(h.indexOf('data-dinero="resultado"'))
    expect(h.indexOf('data-dinero="resultado"')).toBeLessThan(h.indexOf('data-dinero="anomalias"'))
    expect(h).toContain('data-dinero="ahorro"'); expect(h).toContain('data-resultado="pieza"'); expect(h).toContain('data-rehacer="tope"'); expect(h).toContain("data-registro-topes")
    expect(h).toContain("Ver la corrida →"); expect(h).toContain("72 %")
  })
  it("solo lectura y sin Slack", () => {
    const c = readFileSync("components/nuevo/DineroResultados.tsx", "utf8")
    expect(c).not.toMatch(/fetch\(|method:/); expect(readFileSync("lib/dinero-completo.ts", "utf8")).not.toMatch(/slack|\.(insert|update|upsert|delete)\(/i)
  })
})
