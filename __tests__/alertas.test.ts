import { describe, expect, it } from "vitest"
import { claveValida, cruzarVistas, deCerebro, deCostos, deOficina } from "@/lib/alertas"
import { leerAlertas, marcarVista } from "@/lib/alertas-datos"

const AHORA = new Date("2026-10-29T15:00:00Z")
const enc = (o: Record<string, unknown>) => ({ id: "e1", brief_id: "BRF-0002", familia: "carrusel_mesa", version_encargo: 3, estado: "cerrado", con_desacuerdo: false, gasto_usd: 1.5, tope_usd: 5, dry_run: false, prueba: false, creado_en: "2026-10-28T10:00:00Z", cerrado_en: null, ...o })

describe("de dónde salen las alertas", () => {
  it("cerebro: usa la última vez y marca las cerradas", () => {
    const [a] = deCerebro([{ clave: "x", titulo: "Cerebro lento", ultimo_detalle: "d", repeticiones: 4, abierto_en: "2026-10-27T00:00:00Z", ultima_en: "2026-10-28T00:00:00Z", cerrado_en: "2026-10-28T01:00:00Z" }])
    expect(a).toMatchObject({ clave: "cerebro:x", repeticiones: 4, cerrada: true })
    expect(deCerebro([{ clave: "y", ultima_en: null }])).toEqual([]) // sin fecha no hay alerta que ordenar
  })
  it("costos: dice la cifra y el techo", () => {
    const [a] = deCostos([{ threshold_key: "diario", last_fired_at: "2026-10-28T00:00:00Z", last_value_usd: "12.5", threshold_usd: 10 }])
    expect(a.clave).toBe("costo:diario"); expect(a.detalle).toBe("llegó a US$ 12.50 con techo de US$ 10.00")
  })
  it("oficina: fallo, tope y desacuerdo cuentan; ensayo, prueba, estados sanos y lo viejo no", () => {
    const r = deOficina([
      enc({ id: "a", estado: "fallido" }), enc({ id: "b", estado: "cerrado_por_tope" }), enc({ id: "c", con_desacuerdo: true }),
      enc({ id: "d", estado: "fallido", dry_run: true }), enc({ id: "e", estado: "fallido", prueba: true }), enc({ id: "f" }),
      enc({ id: "g", estado: "fallido", creado_en: "2026-10-01T00:00:00Z" }),
    ], AHORA)
    expect(r.map((x) => x.clave)).toEqual(["oficina:a", "oficina:b", "oficina:c"])
    expect(r[2].detalle).toMatch(/no se pusieron de acuerdo/)
  })
})

describe("«ya lo vi»", () => {
  const alta = (clave: string, ultima_en: string) => ({ clave, fuente: "cerebro" as const, titulo: clave, detalle: "", repeticiones: 1, desde: ultima_en, ultima_en, cerrada: false })
  it("una alerta vista pasa a «vistas»; si ocurre de nuevo DESPUÉS de la marca, vuelve a ser nueva", () => {
    const r = cruzarVistas([alta("cerebro:a", "2026-10-28T00:00:00Z"), alta("cerebro:b", "2026-10-29T12:00:00Z"), alta("cerebro:c", "2026-10-27T00:00:00Z")],
      { "cerebro:a": "2026-10-28T06:00:00Z", "cerebro:b": "2026-10-29T06:00:00Z" })
    expect(r.vistas.map((x) => x.clave)).toEqual(["cerebro:a"])
    expect(r.nuevas.map((x) => x.clave)).toEqual(["cerebro:b", "cerebro:c"]) // la más reciente arriba
  })
  it("claves: solo las tres fuentes y sin basura", () => {
    expect(claveValida("oficina:3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBe(true)
    for (const mala of ["", "x:y", "cerebro:", "cerebro:a;drop", 5, null, "oficina:" + "a".repeat(250)]) expect(claveValida(mala)).toBe(false)
  })
})

class Q {
  constructor(private datos: unknown, private error: { message: string } | null = null) {}
  select() { return this } order() { return this } gte() { return this } limit() { return this }
  then(ok: (v: { data: unknown; error: { message: string } | null }) => unknown) { return Promise.resolve({ data: this.datos, error: this.error }).then(ok) }
}
const baseFalsa = (tablas: Record<string, unknown>, falla?: string) => ({ from: (t: string) => new Q(falla === t ? null : tablas[t] ?? [], falla === t ? { message: "caída" } : null) }) as never

describe("lectura y marca", () => {
  it("junta las tres fuentes con las marcas", async () => {
    const r = await leerAlertas(baseFalsa({
      cerebro_alertas: [{ clave: "x", titulo: "t", ultima_en: "2026-10-28T00:00:00Z" }],
      oficina_encargos: [enc({ estado: "fallido" })],
      alertas_vistas: [{ clave: "cerebro:x", visto_en: "2026-10-28T05:00:00Z" }],
    }), AHORA)
    expect(r.vistas.map((a) => a.clave)).toEqual(["cerebro:x"]); expect(r.nuevas.map((a) => a.clave)).toEqual(["oficina:e1"])
  })
  it("un error de la base es excepción, no «sin alertas»", async () => {
    await expect(leerAlertas(baseFalsa({}, "cerebro_alertas"), AHORA)).rejects.toThrow("cerebro_alertas: caída")
    await expect(leerAlertas(baseFalsa({}, "alertas_vistas"), AHORA)).rejects.toThrow("alertas_vistas: caída")
  })
  it("marcar: clave mala → 400 sin tocar la base; buena → guarda con quién y cuándo; falla de la base → 500", async () => {
    const llamadas: unknown[] = []
    const supa = { from: () => ({ upsert: async (fila: unknown, o: unknown) => { llamadas.push([fila, o]); return { error: null } } }) } as never
    expect((await marcarVista(supa, { clave: "x" }, "emilio")).status).toBe(400)
    expect((await marcarVista(supa, null, "emilio")).status).toBe(400); expect(llamadas).toHaveLength(0)
    const ok = await marcarVista(supa, { clave: "costo:diario" }, "emilio", AHORA)
    expect(ok).toEqual({ status: 200, cuerpo: { ok: true, clave: "costo:diario" } })
    expect(llamadas[0]).toEqual([{ clave: "costo:diario", visto_en: AHORA.toISOString(), visto_por: "emilio" }, { onConflict: "clave" }])
    const mala = { from: () => ({ upsert: async () => ({ error: { message: "x" } }) }) } as never
    expect((await marcarVista(mala, { clave: "costo:diario" }, "e")).status).toBe(500)
  })
})
