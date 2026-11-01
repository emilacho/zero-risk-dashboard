/**
 * EQUIPO · lectura (servidor, SOLO LECTURA · sprint 6.10). Fuentes: `agents` (instalados: nombre, modelo, activo) · `oficina_directorio` (rol, especialidad, pertinencia; la
 * columna `equipo` cuando exista) · `agent_invocations` de los últimos 7 días (qué hace cada uno ahora y cuánto trabajó para el cliente). El equipo sale de `lib/organigrama.ts` (6 equipos del MAPA firmado 01-nov) mientras el directorio no lo traiga.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { clientesParaElegir } from "@/lib/clientes-datos"
import { armarEquipos, resumenDelEquipo, type EquipoArmado, type FilaDeAgente, type FilaDeDirectorio, type Invocacion } from "@/lib/organigrama"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
async function una(q: R, que: string): Promise<Fila | null> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? null) as Fila | null }
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

export interface EquipoDelCliente {
  clientes: Array<{ id: string; nombre: string }>
  cliente: { id: string; nombre: string } | null
  equipos: EquipoArmado[]
  resumen: ReturnType<typeof resumenDelEquipo>
  /** cuántas corridas se miraron y desde cuándo */
  ventana: { desde: string; corridas: number }
  leido_en: string
}

export const DIAS_DE_VENTANA = 7

export async function leerEquipo(supa: SupabaseClient, o: { cliente?: string | null; ahora?: Date } = {}): Promise<EquipoDelCliente> {
  const ahora = o.ahora ?? new Date()
  const clientes = await clientesParaElegir(supa)
  let elegido: { id: string; nombre: string } | null = (o.cliente && clientes.find((c) => c.id === o.cliente)) || null
  if (!elegido && o.cliente) {
    const c = await una(supa.from("clients").select("id, name").eq("id", o.cliente).maybeSingle(), "clients")
    if (c) elegido = { id: String(c.id), nombre: String(c.name) }
  }
  if (!elegido) elegido = clientes[0] ?? null
  const desde = new Date(ahora.getTime() - DIAS_DE_VENTANA * 86400_000).toISOString()
  const [agentes, directorio, corridas] = await Promise.all([
    filas(supa.from("agents").select("name, display_name, role, model, is_active, status").limit(500), "agents"),
    filas(supa.from("oficina_directorio").select("*").limit(500), "oficina_directorio"),
    filas(supa.from("agent_invocations").select("agent_name, command, started_at, ended_at, status, client_id, cost_usd").gte("created_at", desde).order("created_at", { ascending: false }).limit(5000), "agent_invocations"),
  ])
  const a: FilaDeAgente[] = agentes.map((x) => ({ name: String(x.name), display_name: x.display_name ? String(x.display_name) : null, role: x.role ? String(x.role) : null, model: x.model ? String(x.model) : null, is_active: typeof x.is_active === "boolean" ? x.is_active : null, status: x.status ? String(x.status) : null }))
  const d: FilaDeDirectorio[] = directorio.map((x) => ({ agente: String(x.agente), rol: x.rol ? String(x.rol) : null, especialidad: x.especialidad ? String(x.especialidad) : null, sabe_hacer: lista(x.sabe_hacer), necesita: lista(x.necesita), entrega: lista(x.entrega), pertinente_en: lista(x.pertinente_en), activo: typeof x.activo === "boolean" ? x.activo : null, equipo: x.equipo ? String(x.equipo) : null, mesa: x.mesa ? String(x.mesa) : null }))
  const inv: Invocacion[] = corridas.map((x) => ({ agent_name: String(x.agent_name ?? ""), command: x.command ? String(x.command) : null, started_at: x.started_at ? String(x.started_at) : null, ended_at: x.ended_at ? String(x.ended_at) : null, status: x.status ? String(x.status) : null, client_id: x.client_id ? String(x.client_id) : null, cost_usd: x.cost_usd == null ? null : Number(x.cost_usd) }))
  const equipos = armarEquipos(a, d, inv, { cliente: elegido?.id ?? null, ahora })
  return { clientes, cliente: elegido, equipos, resumen: resumenDelEquipo(equipos), ventana: { desde, corridas: inv.length }, leido_en: ahora.toISOString() }
}
