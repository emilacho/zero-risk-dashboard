/**
 * EL TRABAJO EN TIEMPO REAL (30-oct · panel del Inicio). Lo que están haciendo los empleados AI ahora mismo, en nombres del sistema:
 * quién (agente), de qué oficina, para qué cliente, qué hace y cómo le fue. Sin códigos, sin costos, sin textos internos.
 * Lectura del servidor (llave de servicio) detrás de la sesión de administrador; el navegador la pide cada pocos segundos con `desde` para traer solo lo nuevo.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { conCache } from "@/lib/cache-corta"
import { haceCuanto } from "@/lib/oficinas"
import { esDePractica } from "@/lib/clientes"

type Fila = Record<string, unknown>
export type EstadoDelTrabajo = "trabajando" | "listo" | "fallo"
export interface FilaDelTrabajo { id: string; cuando: string; hace: string; agente: string; oficina: string | null; cliente: string | null; que_hace: string; estado: EstadoDelTrabajo }
export interface TrabajoEnVivo { filas: FilaDelTrabajo[]; hoy: number; leido_en: string }

/** el estado crudo de la base → tres estados que se entienden */
export function estadoDelTrabajo(crudo: unknown): EstadoDelTrabajo {
  const s = String(crudo ?? "").toLowerCase()
  if (s.includes("error") || s.includes("fail") || s.includes("timeout") || s.includes("cancel")) return "fallo"
  if (s.includes("run") || s.includes("progress") || s.includes("pending") || s.includes("queue") || s.includes("start")) return "trabajando"
  return "listo"
}

/** «sales_account_strategist» → «Sales account strategist» cuando el empleado no tiene nombre propio en la base */
export function nombreLegible(slug: string): string {
  const t = slug.replace(/[_\-:.]+/g, " ").replace(/\s+/g, " ").trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Un empleado"
}

export function queHace(estado: EstadoDelTrabajo, cliente: string | null): string {
  const para = cliente ? ` para ${cliente}` : ""
  if (estado === "trabajando") return `trabaja${para}`
  if (estado === "fallo") return `tuvo un problema${para}`
  return `terminó una tarea${para}`
}

/** los nombres de empleados, oficinas y clientes cambian poco: se leen una vez cada 5 minutos */
async function directorio(supa: SupabaseClient) {
  return conCache("directorio-del-trabajo", 300_000, async () => {
    const [ag, de, cl] = await Promise.all([
      supa.from("agents").select("name, display_name, department_id").limit(1000),
      supa.from("departments").select("id, name, display_name").limit(200),
      supa.from("clients").select("id, name, slug").limit(1000),
    ])
    const dep = new Map<string, string>(((de.data ?? []) as Fila[]).map((d) => [String(d.id), String(d.display_name ?? d.name ?? "")]))
    const agentes = new Map<string, { nombre: string; oficina: string | null }>(((ag.data ?? []) as Fila[]).map((a) => [String(a.name), { nombre: String(a.display_name ?? "") || nombreLegible(String(a.name)), oficina: a.department_id ? dep.get(String(a.department_id)) ?? null : null }]))
    const clientes = new Map<string, { nombre: string; practica: boolean }>(((cl.data ?? []) as Fila[]).map((c) => [String(c.id), { nombre: String(c.name ?? ""), practica: esDePractica({ nombre: String(c.name ?? "") }) }]))
    return { agentes, clientes }
  })
}

export async function leerTrabajoEnVivo(supa: SupabaseClient, o: { limite?: number; desde?: string | null; ahora?: Date } = {}): Promise<TrabajoEnVivo> {
  const ahora = o.ahora ?? new Date()
  const limite = Math.min(Math.max(o.limite ?? 8, 1), 30)
  let q = supa.from("agent_invocations").select("id, agent_name, status, started_at, client_id").order("started_at", { ascending: false }).limit(limite)
  if (o.desde && !Number.isNaN(Date.parse(o.desde))) q = q.gt("started_at", o.desde)
  const hoyDesde = new Date(ahora.getTime() - 24 * 3_600_000).toISOString()
  const [r, h, dir] = await Promise.all([
    q,
    supa.from("agent_invocations").select("*", { count: "exact", head: true }).gte("started_at", hoyDesde),
    directorio(supa),
  ])
  if (r.error) throw new Error(`agent_invocations: ${r.error.message}`)
  const filas: FilaDelTrabajo[] = ((r.data ?? []) as Fila[]).map((x) => {
    const a = dir.agentes.get(String(x.agent_name))
    const c = x.client_id ? dir.clientes.get(String(x.client_id)) : undefined
    const estado = estadoDelTrabajo(x.status)
    const cliente = c ? (c.practica ? `${c.nombre} (práctica)` : c.nombre) : null
    return { id: String(x.id), cuando: String(x.started_at), hace: haceCuanto(String(x.started_at), ahora), agente: a?.nombre ?? nombreLegible(String(x.agent_name ?? "")), oficina: a?.oficina ?? null, cliente, que_hace: queHace(estado, cliente), estado }
  })
  return { filas, hoy: h.count ?? 0, leido_en: ahora.toISOString() }
}
