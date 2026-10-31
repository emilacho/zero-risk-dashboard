/**
 * «EN VIVO» · lectura (servidor, solo lectura): lo que hacen los empleados AI, en nombres del sistema, con el empleado y la oficina para dibujar el pulso.
 * Misma fuente y mismas frases que «Lo que están haciendo ahora» del Inicio (agent_invocations + trabajo-en-vivo.ts): nada nuevo se inventa aquí.
 * Una sola consulta pequeña por pedido (los nombres se leen cada 5 min); el navegador pide cada 5 s solo lo posterior a `desde`.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { conCache } from "@/lib/cache-corta"
import { haceCuanto } from "@/lib/oficinas"
import { esDePractica } from "@/lib/clientes"
import { estadoDelTrabajo, nombreLegible, queHace, tareaDe } from "@/lib/trabajo-en-vivo"
import { oficinaDelEmpleado, OFICINAS_EN_VIVO, type FilaEnVivo } from "@/lib/en-vivo"

type Fila = Record<string, unknown>
export interface EnVivo { filas: FilaEnVivo[]; hoy: number; leido_en: string; cursor: string | null }

async function nombres(supa: SupabaseClient) {
  return conCache("directorio-en-vivo", 300_000, async () => {
    const [ag, cl] = await Promise.all([
      supa.from("agents").select("name, display_name").limit(1000),
      supa.from("clients").select("id, name").limit(1000),
    ])
    const agentes = new Map<string, string>(((ag.data ?? []) as Fila[]).map((a) => [String(a.name), String(a.display_name ?? "") || nombreLegible(String(a.name))]))
    const clientes = new Map<string, string>(((cl.data ?? []) as Fila[]).map((c) => [String(c.id), String(c.name ?? "") + (esDePractica({ nombre: String(c.name ?? "") }) ? " (práctica)" : "")]))
    return { agentes, clientes }
  })
}

export async function leerEnVivo(supa: SupabaseClient, o: { limite?: number; desde?: string | null; ahora?: Date } = {}): Promise<EnVivo> {
  const ahora = o.ahora ?? new Date()
  const limite = Math.min(Math.max(o.limite ?? 12, 1), 40)
  let q = supa.from("agent_invocations").select("id, agent_name, command, status, ended_at, created_at, started_at, client_id").order("created_at", { ascending: false }).limit(limite)
  // se sondea por cuándo se REGISTRÓ la fila (igual que el panel del Inicio): un trabajo largo que se registra al terminar no se salta
  if (o.desde && !Number.isNaN(Date.parse(o.desde))) q = q.gt("created_at", o.desde)
  const hoyDesde = new Date(ahora.getTime() - 24 * 3_600_000).toISOString()
  const [r, h, dir] = await Promise.all([q, supa.from("agent_invocations").select("*", { count: "exact", head: true }).gte("started_at", hoyDesde), nombres(supa)])
  if (r.error) throw new Error(`agent_invocations: ${r.error.message}`)
  const dibujo = ((r.data ?? []) as Fila[]).map((x) => {
    const empleado = String(x.agent_name ?? "")
    const estado = estadoDelTrabajo(x.status)
    const cliente = x.client_id ? dir.clientes.get(String(x.client_id)) ?? null : null
    const oficina = oficinaDelEmpleado(empleado, x.command)
    const cuando = String(x.ended_at ?? x.created_at ?? x.started_at)
    const fila: FilaEnVivo = {
      id: String(x.id), cuando, hace: haceCuanto(cuando, ahora), empleado, agente: dir.agentes.get(empleado) ?? nombreLegible(empleado),
      oficina, oficina_nombre: oficina ? OFICINAS_EN_VIVO.find((p) => p.clave === oficina)?.nombre ?? null : null,
      cliente, que_hace: queHace(estado, cliente, tareaDe(empleado, x.command)), estado,
    }
    return { fila, registrada: String(x.created_at ?? x.started_at) }
  })
  const cursor = dibujo.length ? dibujo.reduce((m, d) => (d.registrada > m ? d.registrada : m), "") : null
  return { filas: dibujo.map((d) => d.fila), hoy: h.count ?? 0, leido_en: ahora.toISOString(), cursor }
}
