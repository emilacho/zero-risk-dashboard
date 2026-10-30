/**
 * EL PULSO (30-oct · «dashboard rápido»): una huella barata de lo que cambia en las pantallas. El navegador la pregunta cada pocos segundos
 * y solo recarga la pantalla si la huella cambió (antes recargaba todo cada 8 s, haya cambiado algo o no).
 * Son consultas livianas (un contador o la fecha más reciente); el resultado se comparte 4 s entre quienes preguntan.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { conCache } from "@/lib/cache-corta"

type R = PromiseLike<{ data: Array<Record<string, unknown>> | null; count?: number | null; error: unknown }>
const ultima = (supa: SupabaseClient, tabla: string, col: string): R => supa.from(tabla).select(col).order(col, { ascending: false, nullsFirst: false }).limit(1) as unknown as R
const pendientes = (supa: SupabaseClient, tabla: string, col: string, valor: string): R => supa.from(tabla).select("id", { count: "exact", head: true }).eq(col, valor) as unknown as R

export async function huellaDelPulso(supa: SupabaseClient): Promise<string> {
  return conCache("pulso", 4_000, async () => {
    const rs = await Promise.all([
      ultima(supa, "oficina_encargos", "cerrado_en"),
      supa.from("oficina_encargos").select("id", { count: "exact", head: true }) as unknown as R,
      ultima(supa, "hitl_queue", "created_at"),
      ultima(supa, "hitl_queue", "decided_at"),
      pendientes(supa, "hitl_queue", "status", "pending"),
      ultima(supa, "jefatura_revisiones", "cerrado_en"),
      ultima(supa, "cadena_campanas", "creada_en"),
      ultima(supa, "client_brand_books", "created_at"),
      ultima(supa, "clients", "updated_at"),
      ultima(supa, "client_web_pages", "created_at"),
    ].map((p) => Promise.resolve(p).then((r) => r, () => ({ data: null, count: null, error: "x" }))))
    return rs.map((r) => (typeof r.count === "number" ? `n${r.count}` : String(Object.values(r.data?.[0] ?? {})[0] ?? "-"))).join("|")
  })
}
