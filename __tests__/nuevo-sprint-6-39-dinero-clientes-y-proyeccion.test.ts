/**
 * DASHBOARD NUEVO · SPRINT 6.39 · DINERO · tabla por cliente ordenada y proyección con el ritmo de 30 días (encargo Lenovo 02-nov, firmado por Emilio).
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { desglose, grupoDeCliente, nombresUnificados, nombreSinCodigos, PRUEBAS_Y_FICHAS_VIEJAS, tarjetas, TRABAJO_INTERNO, type Movimiento } from "@/lib/dinero-completo"
import { PanelDinero } from "@/components/nuevo/PanelDinero"

describe("6.39 · los nombres de los clientes", () => {
  it("las fichas de prueba y archivadas van a una sola fila, sin códigos, fechas ni horas", () => {
    expect(grupoDeCliente("ARCHIVADA 2026-10-11 · ficha de prueba del tramo 1 (96864e88)", "96864e88")).toEqual({ cliente: PRUEBAS_Y_FICHAS_VIEJAS, ficha: "Ficha de prueba del tramo 1" })
    expect(nombreSinCodigos("zz prueba puerta 21:22")).toBe("Prueba puerta")
    expect(nombreSinCodigos("Prueba Seca Alta 2200")).toBe("Prueba seca alta")
    expect(nombreSinCodigos("zz prueba CC3 editar manual (archivada 2026-10-30)")).toBe("Prueba cc3 editar manual")
    expect(grupoDeCliente(null, "x").cliente).toBe(PRUEBAS_Y_FICHAS_VIEJAS)
  })
  it("sin cliente es trabajo interno; un cliente de verdad conserva su nombre", () => {
    expect(grupoDeCliente(null, null).cliente).toBe(TRABAJO_INTERNO)
    expect(grupoDeCliente("Náufrago", "c1")).toEqual({ cliente: "Náufrago", ficha: null })
  })
  it("las variantes del mismo nombre se unifican en la que no está en mayúsculas", () => {
    const u = nombresUnificados(["GoEuropeAdventure", "GOEUROPEADVENTURE", "Náufrago"])
    expect(u.get("GOEUROPEADVENTURE")).toBe("GoEuropeAdventure"); expect(u.get("Náufrago")).toBe("Náufrago")
  })
})

const m = (d: string, usd: number, x: Partial<Movimiento> = {}): Movimiento => ({ t: `${d}T15:00:00.000Z`, d, proveedor: "Anthropic", modelo: "claude-sonnet-4-6", empleado: "Jefe marketing", cliente: "Zero Risk Seguridad Industrial", client_id: "z1", corrida: `r-${d}`, usd, ok: true, cota: false, ...x })
const movs: Movimiento[] = [
  m("2026-10-30", 2), m("2026-10-31", 1, { client_id: "z2" }), m("2026-10-31", 0.5, { client_id: "z3" }),
  m("2026-10-30", 0.4, { cliente: PRUEBAS_Y_FICHAS_VIEJAS, client_id: "p1", ficha: "Prueba puerta" }), m("2026-10-30", 0.2, { cliente: PRUEBAS_Y_FICHAS_VIEJAS, client_id: "p2", ficha: "Ficha vieja del piloto" }),
  m("2026-10-31", 5, { cliente: TRABAJO_INTERNO, client_id: null }), m("2026-10-29", 0.3, { cliente: "Náufrago", client_id: "c1" }),
]

describe("6.39 · la tabla por cliente", () => {
  it("los repetidos se suman en una fila con todas sus fichas; las pruebas traen su detalle", () => {
    const f = desglose(movs, "cliente", { desde: "2026-10-27", hasta: "2026-11-02" })
    const z = f.find((x) => x.clave === "Zero Risk Seguridad Industrial")!
    expect(z.usd).toBe(3.5); expect(z.ids).toEqual(["z1", "z2", "z3"])
    expect(f.find((x) => x.clave === PRUEBAS_Y_FICHAS_VIEJAS)!.fichas).toEqual([{ nombre: "Prueba puerta", usd: 0.4 }, { nombre: "Ficha vieja del piloto", usd: 0.2 }])
  })
  it("en pantalla: clientes por gasto, luego trabajo interno (explicado), al final las pruebas desplegables; sin códigos", () => {
    const h = renderToStaticMarkup(createElement(PanelDinero, { onCerrar: () => {}, datosIniciales: { movimientos: movs, saldos: [], topes: [{ client_id: "z2", cliente: "Zero Risk Seguridad Industrial", gastado_24h_usd: 1, techo_usd: 8, pct: 12 }], cache: null, desde: "2026-09-01T00:00:00Z", leido_en: "2026-11-02T17:00:00Z", faltan: [] } })).replace(/<!-- -->/g, "")
    const i = (k: string) => h.indexOf(`data-fila="${k}"`)
    expect(i("Zero Risk Seguridad Industrial")).toBeLessThan(i("Náufrago")); expect(i("Náufrago")).toBeLessThan(i(TRABAJO_INTERNO)); expect(i(TRABAJO_INTERNO)).toBeLessThan(i(PRUEBAS_Y_FICHAS_VIEJAS))
    expect(h).toContain("data-explicacion-interno"); expect(h).toContain("data-desplegar-pruebas"); expect(h).toContain("2 fichas")
    expect(h).toContain("US$ 1,00 de US$ 8,00")
    expect(h).not.toMatch(/96864e88|ARCHIVADA|Sin cliente</)
  })
})

describe("6.39 · la proyección", () => {
  it("usa el ritmo de los últimos 30 días, no los dos días del mes con un pico, y avisa que hay poco dato", () => {
    const xs: Movimiento[] = []
    for (let i = 4; i <= 31; i++) xs.push(m(`2026-10-${String(i).padStart(2, "0")}`, 1))
    xs.push(m("2026-11-01", 150), m("2026-11-02", 5))
    const k = tarjetas(xs, "2026-11-02")
    expect(k.ritmo_diario).toBe(6.1); expect(k.proyeccion).toBe(r(155 + 6.1 * 28)); expect(k.poco_dato_del_mes).toBe(true)
    expect(k.proyeccion).toBeLessThan((155 / 2) * 30)
    expect(tarjetas(xs, "2026-11-10").poco_dato_del_mes).toBe(false)
  })
})
const r = (n: number) => Math.round(n * 100) / 100
