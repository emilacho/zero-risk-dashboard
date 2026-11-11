/**
 * El tope de la familia de una pieza (GO Lenovo 11-nov 20:28): «rehacer» manda el tope por pieza de la FAMILIA del encargo, no 5 fijos.
 * La lectura es SOLO lectura y nunca inventa un tope: si falta algo, null (y la puerta de acciones responde 503 sin gastar).
 */
import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { topeDeLaFamiliaDelEncargo } from "@/lib/tope-de-la-familia"

type Res = { data: unknown[] | null; error: { message: string } | null }
/** base falsa: solo `select`; cualquier escritura revienta. Anota tabla, columnas y filtros */
function base(tablas: Record<string, Res>) {
  const pedidos: { tabla: string; cols: string; filtros: [string, unknown][] }[] = []
  const supa = {
    from(tabla: string) {
      const p = { tabla, cols: "", filtros: [] as [string, unknown][] }
      const q = {
        select(cols: string) { p.cols = cols; return q },
        eq(col: string, val: unknown) { p.filtros.push([col, val]); return q },
        limit() { pedidos.push(p); return Promise.resolve(tablas[tabla] ?? { data: [], error: null }) },
        insert() { throw new Error("escritura prohibida") }, update() { throw new Error("escritura prohibida") }, upsert() { throw new Error("escritura prohibida") }, delete() { throw new Error("escritura prohibida") },
      }
      return q
    },
  }
  return { supa: supa as unknown as SupabaseClient, pedidos }
}
const ok = (data: unknown[]): Res => ({ data, error: null })
const ID = "11111111-2222-3333-4444-555555555555"

describe("topeDeLaFamiliaDelEncargo", () => {
  it("lee la familia del encargo y el tope de su plantilla (video 35, foto 2.5)", async () => {
    for (const [familia, tope] of [["video", 35], ["imagen", 2.5]] as const) {
      const b = base({ oficina_encargos: ok([{ familia }]), oficina_tipos_de_grupo: ok([{ familia, limites: { tope_encargo_usd: tope, otro: 1 } }]) })
      expect(await topeDeLaFamiliaDelEncargo(b.supa, ID)).toBe(tope)
      expect(b.pedidos).toEqual([
        { tabla: "oficina_encargos", cols: "familia", filtros: [["id", ID]] },
        { tabla: "oficina_tipos_de_grupo", cols: "familia, limites", filtros: [["familia", familia]] },
      ])
    }
  })
  it("acepta el tope escrito como texto numérico", async () => {
    const b = base({ oficina_encargos: ok([{ familia: "video" }]), oficina_tipos_de_grupo: ok([{ familia: "video", limites: { tope_encargo_usd: "10" } }]) })
    expect(await topeDeLaFamiliaDelEncargo(b.supa, ID)).toBe(10)
  })
  it("nunca inventa un tope: sin encargo, sin familia, sin plantilla, sin límites o con errores de la base → null", async () => {
    const plantilla = ok([{ familia: "video", limites: { tope_encargo_usd: 35 } }])
    const casos: Record<string, Res>[] = [
      { oficina_encargos: ok([]), oficina_tipos_de_grupo: plantilla },
      { oficina_encargos: ok([{ familia: null }]), oficina_tipos_de_grupo: plantilla },
      { oficina_encargos: ok([{ familia: "" }]), oficina_tipos_de_grupo: plantilla },
      { oficina_encargos: { data: null, error: { message: "caída" } }, oficina_tipos_de_grupo: plantilla },
      { oficina_encargos: ok([{ familia: "video" }]), oficina_tipos_de_grupo: ok([]) },
      { oficina_encargos: ok([{ familia: "video" }]), oficina_tipos_de_grupo: { data: null, error: { message: "caída" } } },
      // un error de la base nunca se lee como dato, aunque venga con filas
      { oficina_encargos: { data: [{ familia: "video" }], error: { message: "caída" } }, oficina_tipos_de_grupo: plantilla },
      { oficina_encargos: ok([{ familia: "video" }]), oficina_tipos_de_grupo: { data: [{ familia: "video", limites: { tope_encargo_usd: 35 } }], error: { message: "caída" } } },
      { oficina_encargos: ok([{ familia: "video" }]), oficina_tipos_de_grupo: ok([{ familia: "video", limites: null }]) },
      { oficina_encargos: ok([{ familia: "video" }]), oficina_tipos_de_grupo: ok([{ familia: "video", limites: [35] }]) },
      { oficina_encargos: ok([{ familia: "video" }]), oficina_tipos_de_grupo: ok([{ familia: "video", limites: { otro: 35 } }]) },
      { oficina_encargos: ok([{ familia: "video" }]), oficina_tipos_de_grupo: ok([{ familia: "video", limites: { tope_encargo_usd: "mucho" } }]) },
      { oficina_encargos: ok([{ familia: "video" }]), oficina_tipos_de_grupo: ok([{ familia: "video", limites: { tope_encargo_usd: 0 } }]) },
      { oficina_encargos: ok([{ familia: "video" }]), oficina_tipos_de_grupo: ok([{ familia: "video", limites: { tope_encargo_usd: -5 } }]) },
    ]
    for (const [i, t] of casos.entries()) expect(await topeDeLaFamiliaDelEncargo(base(t).supa, ID), `caso ${i}`).toBeNull()
  })
  it("sin familia no consulta las plantillas", async () => {
    const b = base({ oficina_encargos: ok([]) })
    await topeDeLaFamiliaDelEncargo(b.supa, ID)
    expect(b.pedidos.map((p) => p.tabla)).toEqual(["oficina_encargos"])
  })
})
