/**
 * 10-nov · URGENTE de Lenovo: el Centro de campaña y el panel de la gran idea dejaron de cargar en producción la primera vez que hubo una gran idea real
 * esperando a Emilio (Náufrago, tarjeta `2d3c4da1`). Causa: «quién la propuso» buscaba `cadena_conceptos` por `id` (numérico) con el `concepto_id` de la tarjeta
 * («con-28de888eb3f2-v2», un texto) → «invalid input syntax for type bigint» → la lectura entera caía (500).
 * Aquí la base falsa se porta como Postgres: un texto contra la columna `id` de `cadena_conceptos` da ESE error. Los datos son los de producción (forma real de la tarjeta).
 */
import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { leerGranIdea } from "@/lib/gran-idea-datos"
import { leerCentro } from "@/lib/centro-datos"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const CAMPANA = "28de888e-b3f2-4aca-86b3-2c7f7bf6685a"
const HITL = "2d3c4da1-d3d5-40e0-b18e-d90e8652e001"
type Fila = Record<string, unknown>
type Respuesta = { data: unknown; error: { message: string } | null }

/** filtra por `eq` de verdad; `cadena_conceptos.id` es bigint: un texto no numérico contesta el error de Postgres */
function baseComoPostgres(tablas: Record<string, Fila[]>, o: { aportesFallan?: boolean } = {}): SupabaseClient & { pedidos: string[] } {
  const pedidos: string[] = []
  const from = (tabla: string) => {
    const filtros: Array<[string, unknown]> = []
    let una = false
    const resolver = (): Respuesta => {
      for (const [col, v] of filtros) {
        if (tabla === "cadena_conceptos" && col === "id" && !/^\d+$/.test(String(v))) return { data: null, error: { message: `invalid input syntax for type bigint: "${String(v)}"` } }
      }
      if (tabla === "oficina_mesa_aportes" && o.aportesFallan) return { data: null, error: { message: "la base no contesta" } }
      const filas = (tablas[tabla] ?? []).filter((f) => filtros.every(([c, v]) => f[c] === v))
      return { data: una ? filas[0] ?? null : filas, error: null }
    }
    const cadena: Record<string, unknown> = {}
    for (const m of ["select", "is", "gte", "in", "order", "limit", "not"]) cadena[m] = () => cadena
    cadena.eq = (c: string, v: unknown) => { filtros.push([c, v]); pedidos.push(`${tabla}.${c}=${String(v)}`); return cadena }
    cadena.maybeSingle = () => { una = true; return cadena }
    cadena.then = (ok: (r: Respuesta) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resolver()).then(ok, ko)
    return cadena
  }
  return { from, pedidos } as unknown as SupabaseClient & { pedidos: string[] }
}

/** la forma real de producción (10-nov): la tarjeta pendiente de la v2 y su fila en la cadena */
const produccion = (): Record<string, Fila[]> => ({
  clients: [{ id: NAUFRAGO, name: "Náufrago", industry: "restaurante", status: "active", archived_at: null }],
  cadena_campanas: [{ id: CAMPANA, estado: "calendario", client_id: NAUFRAGO, seco: false }],
  hitl_queue: [{
    id: HITL, client_id: NAUFRAGO, type: "concepto_review", status: "pending", title: "Gran idea · El oro que nunca buscaste", created_at: "2026-11-09T22:02:15Z", decision: null,
    metadata: { origen: "cadena", tipo: "concepto", campana_id: CAMPANA, version: 2, concepto_id: "con-28de888eb3f2-v2", brief_version: 2, seco: false },
  }],
  cadena_conceptos: [{ id: 7, campana_id: CAMPANA, version: 2, estado: "lista", aprobacion: "pendiente", leido: { estado: "ok", gran_idea: { nombre: "El oro que nunca buscaste" }, banco: [], capitulos: [] }, encargo_id: "fc2360b6-bf58-407b-9006-3340c840ce5e" }],
  cadena_brief_creativo: [{ campana_id: CAMPANA, version: 2, estado: "validada", texto_md: "## Mensaje\nuno" }],
  oficina_mesa_aportes: [
    { encargo_id: "fc2360b6-bf58-407b-9006-3340c840ce5e", n: 1, de: "creative-director-mesa" },
    { encargo_id: "fc2360b6-bf58-407b-9006-3340c840ce5e", n: 2, de: "content-creator" },
    { encargo_id: "fc2360b6-bf58-407b-9006-3340c840ce5e", n: 3, de: "creative-director-mesa" },
  ],
})

describe("la gran idea pendiente en producción ya no tumba el panel ni el Centro de campaña", () => {
  it("🔴 el panel de la gran idea carga con su tarjeta, su detalle y quién la propuso (el concepto se busca por campaña y versión, no por un id de texto)", async () => {
    const db = baseComoPostgres(produccion())
    const g = await leerGranIdea(db, { cliente: NAUFRAGO })
    expect(g.tarjetas).toHaveLength(1)
    expect(g.detalle?.hitl_id ?? HITL).toBe(HITL)
    expect(g.quienes_propusieron).toEqual(["creative-director-mesa", "content-creator"])
    expect(db.pedidos.filter((p) => p.startsWith("cadena_conceptos.id="))).toEqual([]) // nunca más por id
    expect(db.pedidos).toContain(`cadena_conceptos.campana_id=${CAMPANA}`)
  })
  it("🔴 el Centro de campaña carga y el cuadro «Gran idea» dice que espera tu decisión", async () => {
    const c = await leerCentro(baseComoPostgres(produccion()), { cliente: NAUFRAGO, riesgos: async () => ({ ok: true as const, datos: { topes: [] } as never }) })
    expect(c.gran_idea).toMatchObject({ texto: "Espera tu decisión", aviso: true })
  })
  it("🔴 «quién la propuso» es un dato de apoyo: si su lectura falla, la gran idea carga igual, sin nombres", async () => {
    const g = await leerGranIdea(baseComoPostgres(produccion(), { aportesFallan: true }), { cliente: NAUFRAGO })
    expect(g.tarjetas).toHaveLength(1)
    expect(g.quienes_propusieron).toEqual([])
  })
})
