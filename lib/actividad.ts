/**
 * LA ACTIVIDAD DE LOS EMPLEADOS · últimos 14 días (Inicio). Tareas por día, las que salieron bien y las que fallaron.
 * Sale de las llamadas de los empleados registradas (`agent_invocations`); no inventa nada: un día sin tareas queda en cero.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { conCache, TTL_CORTO_MS } from "@/lib/cache-corta"
import { diaEnEcuador } from "@/lib/gasto"
import { estadoDelTrabajo } from "@/lib/trabajo-en-vivo"

export interface DiaDeActividad { dia: string; ok: number; fallo: number }

/** los últimos `dias` días terminando hoy (zona de Ecuador), de más viejo a más nuevo */
export function agruparActividad(filas: Array<{ created_at: unknown; status: unknown }>, ahora: Date, dias = 14): DiaDeActividad[] {
  const porDia = new Map<string, DiaDeActividad>()
  for (let i = dias - 1; i >= 0; i--) { const d = diaEnEcuador(new Date(ahora.getTime() - i * 86_400_000)); porDia.set(d, { dia: d, ok: 0, fallo: 0 }) }
  for (const f of filas) {
    const d = porDia.get(diaEnEcuador(new Date(String(f.created_at))))
    if (!d) continue
    if (estadoDelTrabajo(f.status) === "fallo") d.fallo++; else d.ok++
  }
  return [...porDia.values()]
}

export function leerActividadDeEmpleados(supa: SupabaseClient, ahora: Date = new Date(), dias = 14): Promise<DiaDeActividad[]> {
  return conCache("actividad-empleados", TTL_CORTO_MS, async () => {
    const desde = new Date(ahora.getTime() - (dias + 1) * 86_400_000).toISOString()
    const r = await supa.from("agent_invocations").select("created_at, status").gte("created_at", desde).order("created_at", { ascending: false }).limit(8000)
    if (r.error) throw new Error(`agent_invocations: ${r.error.message}`)
    return agruparActividad((r.data ?? []) as Array<{ created_at: unknown; status: unknown }>, ahora, dias)
  })
}
