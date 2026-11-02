/**
 * DASHBOARD NUEVO · SPRINT 6.44 · pedido de Emilio: Apify solo en Proveedor; flecha de regreso (sin letras) del cliente a Dinero y de la corrida a Dinero.
 */
import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { desglose, serie, type Dinero, type Movimiento } from "@/lib/dinero-completo"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, back: () => {}, refresh: () => {} }) }))

const m = (d: string, usd: number, x: Partial<Movimiento> = {}): Movimiento => ({ t: `${d}T15:00:00.000Z`, d, proveedor: "Anthropic", modelo: "claude-sonnet-4-6", empleado: "Jefe marketing", cliente: "Náufrago", client_id: "c1", corrida: `r-${d}`, usd, ok: true, cota: false, ...x })
const apify = m("2026-11-01", 2, { proveedor: "Apify", modelo: "Apify · instagram", empleado: "Apify (raspados)", equipo: "Proveedor externo · Apify", cliente: "Trabajo interno · mantenimiento y cerebro", client_id: null, corrida: null })
const movs = [m("2026-11-01", 1, { equipo: "Marketing" }), apify]
const r = { desde: "2026-10-27", hasta: "2026-11-02" }

describe("6.44 · Apify solo en Proveedor", () => {
  it("no aparece en Empleado, Equipo ni Modelo; sí en Proveedor y en Cliente (Trabajo interno)", () => {
    for (const v of ["empleado", "equipo", "modelo"] as const) expect(desglose(movs, v, r).map((f) => f.nombre).join(" ")).not.toMatch(/Apify/)
    expect(desglose(movs, "proveedor", r).map((f) => f.nombre)).toContain("Apify")
    expect(desglose(movs, "empleado", r)[0].pct).toBe(100)
  })
  it("el gráfico por empleado o modelo tampoco lo muestra", () => {
    expect(serie(movs, "empleado", r).claves).not.toContain("Apify (raspados)"); expect(serie(movs, "modelo", r).claves.join()).not.toMatch(/Apify/)
    expect(serie(movs, "proveedor", r).claves).toContain("Apify")
    expect(readFileSync("components/nuevo/PanelDinero.tsx", "utf8")).toContain("data-sin-apify")
  })
})

describe("6.44 · flechas de regreso sin letras", () => {
  it("la flecha es solo un ícono; a dónde vuelve va en la etiqueta accesible", async () => {
    const { BotonVolver } = await import("@/components/nuevo/BotonVolver")
    const h = renderToStaticMarkup(createElement(BotonVolver, { alVolver: () => {}, a: "Dinero" }))
    expect(h).toContain('aria-label="Volver a Dinero"'); expect(h.replace(/<[^>]+>/g, "").trim()).toBe("")
  }, 60000)
  it("cliente: encima de Dinero vuelve a Dinero; como página vuelve a la pantalla anterior", async () => {
    const { PanelCliente } = await import("@/components/nuevo/PanelCliente")
    const datos: Dinero = { movimientos: movs, saldos: [], topes: [], cache: null, desde: "2026-09-01T00:00:00Z", leido_en: "2026-11-02T17:00:00Z", faltan: [] }
    expect(renderToStaticMarkup(createElement(PanelCliente, { slug: "naufrago", datosIniciales: datos, alVolver: () => {} }))).toContain('aria-label="Volver a Dinero"')
    expect(renderToStaticMarkup(createElement(PanelCliente, { slug: "naufrago", datosIniciales: datos }))).toContain('aria-label="Volver a la pantalla anterior"')
  }, 60000)
  it("Dinero abre al cliente encima (Esc regresa a Dinero, no lo cierra) y la corrida abierta desde Dinero tiene flecha a Dinero", () => {
    const dinero = readFileSync("components/nuevo/PanelDinero.tsx", "utf8"), escena = readFileSync("components/nuevo/EscenaViva.tsx", "utf8"), obs = readFileSync("components/nuevo/PanelObservabilidad.tsx", "utf8")
    expect(dinero).toContain("<PanelCliente slug={cliente} datosIniciales={datos} alVolver={() => setCliente(null)}"); expect(dinero).toContain('if (e.key !== "Escape" || cliente) return')
    expect(readFileSync("components/nuevo/DineroDesglose.tsx", "utf8")).toContain("e.metaKey || e.ctrlKey")
    expect(escena).toContain("alVolver={corridaDeDinero ? () => { setTrazas(false); setCorridaDeDinero(null); setCaja(true) } : undefined}")
    expect(obs).toContain('{alVolver && <BotonVolver alVolver={alVolver} a="Dinero" />}')
  })
})
