/**
 * 10-nov (CORRECCIÓN Lenovo «sistema agnóstico», 2º cliente): el lector del brief dice cuáles de los códigos que cita el brief SON fotos del cliente,
 * para que al mostrar solo esos se quiten. Un número entre comillas que no es foto (una referencia de producto) no entra.
 */
import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { leerBrief } from "@/lib/brief-datos"

/** una base de mentira: cada tabla responde sus filas a cualquier cadena de filtros */
function base(tablas: Record<string, unknown[] | { error: string }>): SupabaseClient {
  const consulta = (t: string) => {
    const v = tablas[t] ?? []
    const res = Array.isArray(v) ? { data: v, error: null } : { data: null, error: { message: v.error } }
    const b: Record<string, unknown> = {}
    for (const m of ["select", "eq", "in", "order", "limit", "neq", "is"]) b[m] = () => b
    b.maybeSingle = async () => ({ data: Array.isArray(v) ? v[0] ?? null : null, error: res.error })
    b.then = (ok: (x: unknown) => unknown, mal: (e: unknown) => unknown) => Promise.resolve(res).then(ok, mal)
    return b
  }
  return { from: consulta } as unknown as SupabaseClient
}

const CLIENTE = { id: "00000000-0000-4000-8000-0000000000b2", name: "Proveedor industrial", industry: "industrial", status: "active", archived_at: null }
const BRIEF = {
  id: "b1", campana_id: "k1", version: 2, estado: "devuelta", leido: false, motivo: null, costo_usd: null, seco: false, creada_en: "2026-11-10T10:00:00Z", actualizada_en: null, encargo_id: null,
  texto_md: "## Citas\n\nFotos de planta: `40056781`, `9a8b7c6d` y `foto:1234abcd`. Guantes referencia `4005678`.",
  devolucion_texto: "Usa la foto `fedcba98`.",
}

describe("leerBrief · las fotos que cita el brief", () => {
  it("solo las que son fotos del cliente (por su código de 8), sin la referencia de producto", async () => {
    const supa = base({
      clients: [CLIENTE], cadena_campanas: [{ id: "k1", estado: "en_curso" }], cadena_brief_creativo: [BRIEF], oficina_mesa_aportes: [],
      client_social_images: [
        { id: "40056781-0000-4000-8000-000000000001", url: "u1" }, { id: "9a8b7c6d-0000-4000-8000-000000000002", url: "u2" },
        { id: "1234abcd-0000-4000-8000-000000000003", url: "u3" }, { id: "fedcba98-0000-4000-8000-000000000004", url: "u4" }, { id: "11111111-0000-4000-8000-000000000005", url: "u5" },
      ],
    })
    const r = await leerBrief(supa, { cliente: CLIENTE.id })
    expect(r.briefs).toHaveLength(1)
    expect([...(r.fotos ?? [])].sort()).toEqual(["1234abcd", "40056781", "9a8b7c6d", "fedcba98"])
  })
  it("si la lectura de fotos falla, ninguna (el brief se muestra igual)", async () => {
    const supa = base({ clients: [CLIENTE], cadena_campanas: [{ id: "k1", estado: "en_curso" }], cadena_brief_creativo: [BRIEF], oficina_mesa_aportes: [], client_social_images: { error: "caída" } })
    const r = await leerBrief(supa, { cliente: CLIENTE.id })
    expect(r.briefs).toHaveLength(1)
    expect(r.fotos).toEqual([])
  })
})
