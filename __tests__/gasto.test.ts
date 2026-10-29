import { describe, expect, it } from "vitest"
import { apifyPorDia, diaEnEcuador, proveedorDe, resumirGasto, ultimosDias, usdFino } from "@/lib/gasto"
import { paginar } from "@/lib/gasto-datos"

const llamada = (date: string, monto: number, exacto?: number, client_id?: string) => ({
  date, amount_usd: monto, amount_usd_exact: exacto ?? null, description: JSON.stringify({ tipo: "llamada", ...(client_id ? { client_id } : {}) }),
})
const delDia = (date: string, monto: number) => ({ date, amount_usd: monto, amount_usd_exact: null, description: JSON.stringify({ tipo: "costo" }) })
const AHORA = new Date("2026-10-29T15:00:00Z")

describe("días en hora de Ecuador", () => {
  it("las 02:00 UTC del 29 todavía son el 28 en Ecuador; las 05:00 UTC ya son el 29", () => {
    expect(diaEnEcuador("2026-10-29T02:00:00Z")).toBe("2026-10-28")
    expect(diaEnEcuador("2026-10-29T04:59:59Z")).toBe("2026-10-28")
    expect(diaEnEcuador("2026-10-29T05:00:00Z")).toBe("2026-10-29")
  })
  it("30 días terminando hoy, el más viejo primero", () => {
    const d = ultimosDias(30, AHORA)
    expect(d).toHaveLength(30); expect(d[29]).toBe("2026-10-29"); expect(d[0]).toBe("2026-09-30")
  })
})

describe("Apify: llamadas contra fila del día", () => {
  it("si el día tiene llamadas, la fila del día NO se suma (las repite)", () => {
    expect(apifyPorDia([llamada("2026-10-28", 0.5), llamada("2026-10-28", 0.25), delDia("2026-10-28", 0.75)])).toEqual({ "2026-10-28": 0.75 })
  })
  it("si el día no tiene llamadas, la fila del día ES el dato", () => {
    expect(apifyPorDia([delDia("2026-08-01", 1.2)])).toEqual({ "2026-08-01": 1.2 })
  })
  it("usa el importe exacto cuando existe (la columna redondeada pierde centavos)", () => {
    expect(apifyPorDia([llamada("2026-10-28", 0.01, 0.0143), llamada("2026-10-28", 0.01, 0.0143)])["2026-10-28"]).toBe(0.0286)
  })
  it("ignora filas sin tipo reconocido y descripciones rotas", () => {
    expect(apifyPorDia([{ date: "2026-10-28", amount_usd: 9, description: "no json" }, { date: "2026-10-28", amount_usd: 9, description: null }])).toEqual({})
  })
})

describe("proveedor", () => {
  it.each([["claude-sonnet-4-6", "Anthropic"], ["gpt-image-1", "OpenAI"], ["gpt-5.5", "OpenAI"], ["", "Sin modelo"], [null, "Sin modelo"], ["llama-3", "Otros"]])("%s → %s", (m, p) => {
    expect(proveedorDe(m)).toBe(p)
  })
})

describe("resumen", () => {
  const inv = [
    { created_at: "2026-10-29T10:00:00Z", cost_usd: 1.5, model: "claude-sonnet-4-6", client_id: "c1" },
    { created_at: "2026-10-29T03:00:00Z", cost_usd: 2, model: "gpt-image-1", client_id: null }, // 28 en Ecuador
    { created_at: "2026-10-01T10:00:00Z", cost_usd: "0.5", model: "claude-haiku-4-5", client_id: "c1" },
    { created_at: "2026-08-01T10:00:00Z", cost_usd: 99, model: "claude-opus", client_id: "c1" }, // fuera de 30 días y del mes
  ]
  const r = resumirGasto({ invocaciones: inv, costos: [llamada("2026-10-29", 0.3, 0.3, "c1"), llamada("2026-10-28", 0.2), delDia("2026-10-28", 0.2)], clientes: { c1: "Náufrago" }, piezas: [], ahora: AHORA })
  it("hoy, mes y 30 días suman lo que toca", () => {
    expect(r.hoy).toEqual({ dia: "2026-10-29", agentes: 1.5, apify: 0.3, total: 1.8 })
    expect(r.mes.total).toBe(4.5); expect(r.mes.etiqueta).toBe("octubre 2026")
    expect(r.ultimos.total).toBe(4.5); expect(r.ultimos.promedio_por_dia).toBe(0.15)
  })
  it("reparte por cliente y por proveedor, y separa lo sin cliente", () => {
    expect(r.por_cliente.find((c) => c.clave === "c1")).toMatchObject({ nombre: "Náufrago", total: 2.3 })
    expect(r.por_cliente.find((c) => c.clave === "")?.nombre).toMatch(/Sin cliente/)
    expect(r.sin_cliente_agentes_usd).toBe(2); expect(r.apify_sin_cliente_usd).toBe(0.2)
    expect(r.por_proveedor.map((p) => p.clave).sort()).toEqual(["Anthropic", "Apify", "OpenAI"])
    expect(r.por_proveedor.find((p) => p.clave === "Apify")?.total).toBe(0.5)
  })
  it("la suma por cliente y por proveedor cuadra con el total de 30 días", () => {
    const sc = r.por_cliente.reduce((s, c) => s + c.total, 0), sp = r.por_proveedor.reduce((s, c) => s + c.total, 0)
    expect(Math.round(sc * 1e6) / 1e6).toBe(r.ultimos.total); expect(Math.round(sp * 1e6) / 1e6).toBe(r.ultimos.total)
  })
})

describe("lectura paginada", () => {
  it("lee todas las páginas (no se queda en 1.000)", async () => {
    const todas = Array.from({ length: 2300 }, (_, i) => ({ i }))
    const { filas, cortado } = await paginar(async (a, b) => ({ data: todas.slice(a, b + 1), error: null }), "x")
    expect(filas).toHaveLength(2300); expect(cortado).toBe(false)
  })
  it("un error de la base se vuelve excepción, no un cero", async () => {
    await expect(paginar(async () => ({ data: null, error: { message: "caída" } }), "costs")).rejects.toThrow("costs: caída")
  })
  it("avisa si llega al tope de seguridad", async () => {
    const { cortado } = await paginar(async (a, b) => ({ data: Array.from({ length: b - a + 1 }, () => ({})), error: null }), "x")
    expect(cortado).toBe(true)
  })
})

describe("formato", () => {
  it("lo muy pequeño no se redondea a cero", () => { expect(usdFino(0.0042)).toBe("US$ 0,0042"); expect(usdFino(0)).toBe("US$ 0,00"); expect(usdFino(1.234)).toBe("US$ 1,23") })
})

describe("fichas dadas de baja y de prueba (D7)", () => {
  it("se juntan en UNA fila; las activas y «sin cliente» se quedan aparte; el total no cambia", async () => {
    const { repartoVisible } = await import("@/lib/gasto-datos")
    const filas = [
      { clave: "a", nombre: "Zero Risk", total: 13, llamadas: 5 }, { clave: "b", nombre: "Zero Risk", total: 4, llamadas: 2 }, { clave: "c", nombre: "cliente prueba-p", total: 8, llamadas: 9 },
      { clave: "", nombre: "Sin cliente (gasto de la agencia)", total: 3, llamadas: 1 },
    ]
    const v = repartoVisible(filas, new Set(["a"]))
    expect(v.map((x) => x.nombre)).toEqual(["Zero Risk", "Fichas dadas de baja y de prueba (2)", "Sin cliente (gasto de la agencia)"].sort((x, y) => v.findIndex((r) => r.nombre === x) - v.findIndex((r) => r.nombre === y)))
    expect(v.find((x) => x.clave === "fichas-inactivas")).toMatchObject({ total: 12, llamadas: 11 })
    expect(v.reduce((t, x) => t + x.total, 0)).toBe(28)
  })
})
