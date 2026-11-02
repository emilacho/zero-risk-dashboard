/**
 * DASHBOARD NUEVO · SPRINT 6.36 · DINERO COMPLETO · PARTE 1 (secciones 1–3: lo que cambió, tarjetas, gasto en el tiempo) · boceto aprobado por Emilio 2-nov.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { diaNormal, loQueCambio, picos, proveedorDelModelo, serie, tarjetas, type Movimiento } from "@/lib/dinero-completo"
import { PanelDinero } from "@/components/nuevo/PanelDinero"

const m = (d: string, usd: number, x: Partial<Movimiento> = {}): Movimiento => ({ t: `${d}T15:00:00.000Z`, d, proveedor: "Anthropic", modelo: "claude-sonnet-4-6", empleado: "jefe-marketing", cliente: "Náufrago", client_id: "c1", corrida: `r-${d}`, usd, ok: true, cota: false, ...x })
// un día normal de US$ 1 durante octubre, un pico de US$ 5 el 28-oct (Náufrago, planeación) y Apify por día
const movs: Movimiento[] = []
for (let i = 1; i <= 31; i++) { const d = `2026-10-${String(i).padStart(2, "0")}`; movs.push(m(d, d === "2026-10-28" ? 5 : 1)); movs.push(m(d, 0.2, { proveedor: "Apify", modelo: "Apify · google_maps", empleado: "Apify · google_maps", cliente: "Sin cliente", client_id: null, corrida: null })) }
movs.push(m("2026-11-01", 0.5, { proveedor: "GPT (OpenAI)", modelo: "gpt-6.1-sol", empleado: "revisor-externo-gpt" }), m("2026-11-02", 0.06))
const hoy = "2026-11-02"

describe("6.36 · Dinero · cálculos", () => {
  it("el proveedor sale del modelo: Claude → Anthropic, GPT/Whisper/imagen → GPT (OpenAI)", () => {
    expect(proveedorDelModelo("claude-opus-5-5")).toBe("Anthropic"); expect(proveedorDelModelo("gpt-image-2.5-flare")).toBe("GPT (OpenAI)"); expect(proveedorDelModelo("whisper-1")).toBe("GPT (OpenAI)")
  })
  it("tarjetas: hoy, día normal (mediana), 7 días vs la semana anterior, el mes y la proyección a fin de mes", () => {
    const k = tarjetas(movs, hoy)
    expect(k.hoy).toBe(0.06); expect(diaNormal(movs, hoy)).toBe(1.2)
    expect(k.mes).toBe(0.56); expect(k.dias_del_mes).toBe(30); expect(k.proyeccion).toBe(36.18); expect(k.poco_dato_del_mes).toBe(true)
    expect(k.semana).toBeCloseTo(1.2 * 4 + 5.2 + 0.5 + 0.06, 2); expect(k.variacion_pct).not.toBeNull()
  })
  it("un pico es un día de 3× su normal o más (y al menos US$ 1), explicado por su corrida más cara", () => {
    const p = picos(movs, hoy)
    expect(p).toHaveLength(1); expect(p[0]).toMatchObject({ d: "2026-10-28", usd: 5.2, corrida: "r-2026-10-28" }); expect(p[0].explicacion).toContain("Náufrago")
  })
  it("la serie apila por la dimensión elegida, cada clave con un color distinto (ajuste 1 de Emilio)", () => {
    const s = serie(movs, "proveedor", { desde: "2026-10-27", hasta: hoy })
    expect(s.rotulos).toHaveLength(7); expect(s.claves).toEqual(["Anthropic", "Apify", "GPT (OpenAI)"])
    expect(new Set(Object.values(s.colores)).size).toBe(3)
    const muchos = Array.from({ length: 12 }, (_, i) => m("2026-11-01", i + 1, { empleado: `e${i}` }))
    const e = serie(muchos, "empleado", { desde: "2026-11-01", hasta: "2026-11-01" })
    expect(e.claves).toHaveLength(9); expect(e.claves.at(-1)).toBe("Otros"); expect(new Set(Object.values(e.colores)).size).toBe(9)
  })
  it("«lo que cambió»: mayor cambio, pico de la semana (o que no hubo) y caché sin dato si no hay lectura", () => {
    const c = loQueCambio(movs, hoy, null)
    expect(c.map((x) => x.tipo)).toEqual(["mayor", "pico", "ahorro"])
    expect(c[0].texto).toMatch(/frente a la semana pasada/); expect(c[2].texto).toContain("sin dato todavía")
    expect(loQueCambio(movs, hoy, { leido: 41, entrada: 59 })[2].texto).toContain("41 %")
  })
})

describe("6.36 · Dinero · la pantalla", () => {
  const panel = readFileSync("components/nuevo/PanelDinero.tsx", "utf8")
  const h = renderToStaticMarkup(createElement(PanelDinero, { onCerrar: () => {}, datosIniciales: { movimientos: movs, saldos: [], topes: [{ client_id: "c1", cliente: "Náufrago", gastado_24h_usd: 5.62, techo_usd: 20, pct: 28 }], cache: null, desde: "2026-09-01T00:00:00Z", leido_en: "2026-11-02T17:00:00Z", faltan: [] } })).replace(/<!-- -->/g, "")
  it("secciones 1–3 en el orden de Ramp: lo que cambió, tarjetas, gasto en el tiempo; sin numeritos del boceto", () => {
    expect(h.indexOf('data-dinero="cambios"')).toBeLessThan(h.indexOf('data-tarjeta="hoy"')); expect(h.indexOf('data-tarjeta="proyeccion"')).toBeLessThan(h.indexOf('data-dinero="tiempo"'))
    expect(h).toContain("a este ritmo cierras en"); expect(h).toContain("presupuesto del mes: "); expect(h).toContain("data-sin-dato-todavia")
    expect(panel).not.toMatch(/className="n8"|rounded-full bg-[#e8731a] text-black/)
  })
  it("el gráfico se cambia por proveedor, cliente, modelo y empleado; fechas bajo las barras; valor al pasar el cursor; el pico abre su corrida", () => {
    for (const d of ["proveedor", "cliente", "modelo", "empleado"]) expect(h).toContain(`data-dimension="${d}"`)
    expect(h).toContain("28 oct"); expect(panel).toContain("data-detalle-barra"); expect(panel).toContain("onMouseEnter"); expect(h).toContain('data-pico="2026-10-28"')
    expect(readFileSync("components/nuevo/EscenaViva.tsx", "utf8")).toContain("setCorridaDeDinero(id); setTrazas(true)")
    expect(readFileSync("components/nuevo/PanelObservabilidad.tsx", "utf8")).toContain("corridaInicial")
  })
  it("el freno con su cifra (ajuste 3)", () => {
    expect(h).toMatch(/data-cifra-del-freno[^>]*>US\$ 5,62 de US\$ 20,00</)
  })
  it("solo lectura y solo administrador", () => {
    const r = readFileSync("app/api/direccion/dinero/route.ts", "utf8")
    expect(r).toContain("await exigirAdmin()"); expect(r).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/)
    expect(readFileSync("lib/dinero-completo.ts", "utf8")).not.toMatch(/\.(insert|update|upsert|delete)\(/)
  })
})
