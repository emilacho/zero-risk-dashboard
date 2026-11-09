/**
 * 09-nov 23:08Z · URGENTE de Lenovo: el Centro de campaña dejó de cargar en producción (Emilio, con la gran idea v2 de Náufrago en su mesa).
 * Causa: «quién la propuso» buscaba `cadena_conceptos.id = "con-28de888eb3f2-v2"` (texto) en una columna numérica; la base respondía
 * `invalid input syntax for type bigint` y `leerGranIdea` lanzaba, y con ella `leerCentro` (500). US$ 0 · sin red: base falsa con las filas reales.
 */
import { describe, expect, it } from "vitest"
import { leerGranIdea, quienesPropusieron } from "@/lib/gran-idea-datos"

const CLIENTE = "c-naufrago", CAMP = "28de888e-b3f2-4aca-86b3-2c7f7bf6685a", ENCARGO_V2 = "fc2360b6-bf58-407b-9006-3340c840ce5e"
// las filas reales de producción (09-nov): los dos conceptos de la campaña y la tarjeta de la v2 (hitl 2d3c4da1)
const CONCEPTOS = [{ id: 1, campana_id: CAMP, version: 1, encargo_id: "577c6038-f343-4d88-a629-348b4d4a25af", estado: "sin_mesa" }, { id: 2, campana_id: CAMP, version: 2, encargo_id: ENCARGO_V2, estado: "lista" }]
const HITL_V2 = { id: "2d3c4da1-0000-4000-8000-000000000001", type: "concepto_review", status: "pending", title: "Gran idea · Náufrago", client_id: CLIENTE, created_at: "2026-11-09T22:02:00Z", decision: null, metadata: { campana_id: CAMP, version: 2, concepto_id: "con-28de888eb3f2-v2" } }
const APORTES = [{ encargo_id: ENCARGO_V2, de: "sistema", n: 0 }, { encargo_id: ENCARGO_V2, de: "creative-director-mesa", n: 1 }, { encargo_id: ENCARGO_V2, de: "content-creator", n: 2 }, { encargo_id: ENCARGO_V2, de: "creative-director-mesa", n: 3 }]

/** base falsa: filtra por eq, y como Postgres, rechaza un texto que no es número en una columna numérica */
function base(o: { rompeAportes?: boolean } = {}) {
  const tablas: Record<string, Record<string, unknown>[]> = {
    cadena_conceptos: CONCEPTOS, hitl_queue: [HITL_V2], oficina_mesa_aportes: APORTES,
    clients: [{ id: CLIENTE, name: "Náufrago" }], cadena_campanas: [{ id: CAMP, client_id: CLIENTE, estado: "calendario", seco: false }], cadena_brief_creativo: [],
  }
  const numericas: Record<string, string[]> = { cadena_conceptos: ["id", "version"] }
  const consultas: string[] = []
  const from = (t: string) => {
    const filtros: Array<[string, unknown]> = []
    let error: string | null = null
    const q: Record<string, unknown> = {}
    const sigue = () => q
    for (const m of ["select", "order", "limit", "is", "in", "like", "gte", "lte", "not", "or"]) q[m] = sigue
    q.eq = (c: string, v: unknown) => {
      filtros.push([c, v]); consultas.push(`${t}.${c}=${String(v)}`)
      if (numericas[t]?.includes(c) && !/^-?[0-9]+$/.test(String(v))) error = `invalid input syntax for type bigint: "${String(v)}"`
      return q
    }
    const resultado = () => {
      if (o.rompeAportes && t === "oficina_mesa_aportes") return { data: null, error: { message: "se cortó la conexión" } }
      if (error) return { data: null, error: { message: error } }
      return { data: (tablas[t] ?? []).filter((f) => filtros.every(([c, v]) => String(f[c]) === String(v))), error: null }
    }
    q.maybeSingle = async () => { const r = resultado(); return r.error ? r : { data: (r.data as unknown[])[0] ?? null, error: null } }
    q.single = q.maybeSingle
    q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(resultado()).then(res, rej)
    return q
  }
  return { supa: { from } as never, consultas }
}

describe("el Centro no se cae con la gran idea v2", () => {
  it("🔴 con la tarjeta real de la v2, leer la gran idea NO lanza y trae quién la propuso (por campaña y versión, no por el id de texto)", async () => {
    const { supa, consultas } = base()
    const g = await leerGranIdea(supa, { cliente: CLIENTE })
    expect(g.detalle?.concepto_id).toBe("con-28de888eb3f2-v2")
    expect(g.quienes_propusieron).toEqual(["creative-director-mesa", "content-creator"])
    expect(consultas).not.toContain("cadena_conceptos.id=con-28de888eb3f2-v2")
  })
  it("busca el concepto por campaña y versión; por id solo si el id es un número", async () => {
    const { supa, consultas } = base()
    expect(await quienesPropusieron(supa, { concepto_id: "con-28de888eb3f2-v2", campana_id: CAMP, version: 2 })).toEqual(["creative-director-mesa", "content-creator"])
    expect(consultas).toEqual(expect.arrayContaining([`cadena_conceptos.campana_id=${CAMP}`, "cadena_conceptos.version=2"]))
    const viejo = base()
    expect(await quienesPropusieron(viejo.supa, { concepto_id: "2", campana_id: null, version: null })).toEqual(["creative-director-mesa", "content-creator"])
    expect(viejo.consultas).toContain("cadena_conceptos.id=2")
    const nada = base()
    expect(await quienesPropusieron(nada.supa, { concepto_id: "con-28de888eb3f2-v2", campana_id: null, version: null })).toEqual([])
    expect(nada.consultas.some((c) => c.startsWith("cadena_conceptos.id="))).toBe(false) // un id de texto nunca se manda a la columna numérica
  })
  it("es un dato de adorno: si su lectura falla, la lista queda vacía y la gran idea se lee igual", async () => {
    const { supa } = base({ rompeAportes: true })
    const g = await leerGranIdea(supa, { cliente: CLIENTE })
    expect(g.quienes_propusieron).toEqual([]); expect(g.detalle?.hitl_id).toBe(HITL_V2.id)
  })
})
