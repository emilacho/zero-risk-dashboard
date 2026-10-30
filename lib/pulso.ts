/**
 * EL PULSO (30-oct · «dashboard rápido»): una huella barata de lo que cambia en las pantallas. El navegador la pregunta cada pocos segundos
 * y solo recarga la pantalla si cambió la huella de LO QUE ESA PANTALLA MUESTRA (antes recargaba todo cada 8 s, haya cambiado algo o no).
 * Tres grupos: general (piezas, revisiones, campañas, clientes, manuales), gasto (llamadas de empleados, costos) y alertas (alertas, avisos de costo, vistas, interruptor de oficinas).
 * Son consultas livianas (un contador o la fecha más reciente); el resultado se comparte 4 s entre quienes preguntan.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { conCache } from "@/lib/cache-corta"
import type { GrupoDelPulso } from "@/lib/tiempo-real"

type R = PromiseLike<{ data: Array<Record<string, unknown>> | null; count?: number | null; error: unknown }>
const ultima = (supa: SupabaseClient, tabla: string, col: string): R => supa.from(tabla).select(col).order(col, { ascending: false, nullsFirst: false }).limit(1) as unknown as R
const cuenta = (supa: SupabaseClient, tabla: string, col?: string, valor?: string): R => {
  const q = supa.from(tabla).select("*", { count: "exact", head: true })
  return (col && valor ? q.eq(col, valor) : q) as unknown as R
}

async function huella(rs: R[]): Promise<string> {
  const hechas = await Promise.all(rs.map((p) => Promise.resolve(p).then((r) => r, () => ({ data: null, count: null, error: "x" }))))
  return hechas.map((r) => (typeof r.count === "number" ? `n${r.count}` : String(Object.values(r.data?.[0] ?? {})[0] ?? "-"))).join("|")
}

export type Pulso = Record<GrupoDelPulso, string>

export async function pulsoDeLasPantallas(supa: SupabaseClient): Promise<Pulso> {
  return conCache("pulso", 4_000, async () => {
    const [general, gasto, alertas] = await Promise.all([
      huella([
        ultima(supa, "oficina_encargos", "cerrado_en"), cuenta(supa, "oficina_encargos"),
        ultima(supa, "hitl_queue", "created_at"), ultima(supa, "hitl_queue", "decided_at"), cuenta(supa, "hitl_queue", "status", "pending"),
        ultima(supa, "jefatura_revisiones", "cerrado_en"), ultima(supa, "cadena_campanas", "creada_en"),
        ultima(supa, "client_brand_books", "created_at"), ultima(supa, "clients", "updated_at"), ultima(supa, "client_web_pages", "created_at"),
      ]),
      huella([ultima(supa, "agent_invocations", "created_at"), ultima(supa, "costs", "created_at"), ultima(supa, "oficina_encargos", "cerrado_en")]),
      huella([ultima(supa, "cerebro_alertas", "ultima_en"), ultima(supa, "cost_alerts_state", "last_fired_at"), ultima(supa, "alertas_vistas", "visto_en"), ultima(supa, "oficina_config", "actualizado_en"), cuenta(supa, "oficina_encargos")]),
    ])
    return { general, gasto, alertas }
  })
}
