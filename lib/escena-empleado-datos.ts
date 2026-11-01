/**
 * LA FICHA DEL EMPLEADO · lectura (servidor, SOLO LECTURA · CC6 · Sprint B). Un error de la base lanza; nunca se lee como «sin dato».
 * Fuentes: `agents` (identidad, modelo, alta, a quién reporta) · `oficina_directorio` (especialidad, lo que sabe hacer, equipo) · `agent_skill_assignments` +
 * `agent_skills` (sus métodos) · `agent_invocations` (su trabajo y sus números) · `agent_dispatches` (lo que tiene abierto) · `oficina_mesa_aportes` (sus aportes)
 * · `clients` (nombres). La interpretación es de `lib/escena-empleado.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { MESAS, MINUTOS_TOPE, mesaDelAgente } from "@/lib/escena-avatares"
import { equipoDelAgente, EQUIPOS_DE_MARKETING } from "@/lib/organigrama"
import { esDePractica } from "@/lib/clientes"
import { habilidadesDe, modeloLegible, nombresDePersona, numerosDelEmpleado, origenLegible, tareasRecientes, type FichaDelEmpleado, type InvocacionDelEmpleado } from "@/lib/escena-empleado"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
async function una(q: R, que: string): Promise<Fila | null> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? null) as Fila | null }
const t = (v: unknown): string | null => (typeof v === "string" && v ? v : null)
export const LIMITE_DE_TAREAS = 2000

export async function leerFichaDelEmpleado(supa: SupabaseClient, agente: string, o: { ahora?: Date } = {}): Promise<FichaDelEmpleado | null> {
  const ahora = o.ahora ?? new Date()
  const [ag, todos, dir, tarjetas, invs, desp, aportes] = await Promise.all([
    una(supa.from("agents").select("id, name, display_name, model, created_at, identity_source, identity_content, reports_to").eq("name", agente).limit(1).maybeSingle(), "agents"),
    filas(supa.from("agents").select("id, name, display_name, created_at").limit(1000), "agents"),
    una(supa.from("oficina_directorio").select("agente, especialidad, sabe_hacer, equipo").eq("agente", agente).limit(1).maybeSingle(), "oficina_directorio"),
    filas(supa.from("oficina_directorio").select("agente, equipo").limit(500), "oficina_directorio"),
    filas(supa.from("agent_invocations").select("created_at, status, cost_usd, duration_ms, client_id, workflow_id, workflow_execution_id, metadata").eq("agent_name", agente).order("created_at", { ascending: false }).limit(LIMITE_DE_TAREAS), "agent_invocations"),
    filas(supa.from("agent_dispatches").select("status, created_at, running_at").eq("agent_name", agente).eq("status", "running").limit(100), "agent_dispatches"),
    filas(supa.from("oficina_mesa_aportes").select("tipo").eq("de", agente).limit(1000), "oficina_mesa_aportes"),
  ])
  if (!ag) return null
  const agentId = String(ag.id)
  const [asignaciones, clientes] = await Promise.all([
    filas(supa.from("agent_skill_assignments").select("skill_id").eq("agent_id", agentId).limit(100), "agent_skill_assignments"),
    (() => { const ids = [...new Set(invs.map((i) => t(i.client_id)).filter((x): x is string => !!x))]; return ids.length ? filas(supa.from("clients").select("id, name").in("id", ids.slice(0, 200)), "clients") : Promise.resolve([] as Fila[]) })(),
  ])
  const skillIds = asignaciones.map((a) => t(a.skill_id)).filter((x): x is string => !!x)
  const skills = skillIds.length ? await filas(supa.from("agent_skills").select("id, skill_name, skill_source").in("id", skillIds), "agent_skills") : []

  const nombres = nombresDePersona(todos.map((a) => ({ name: String(a.name ?? ""), created_at: t(a.created_at) })))
  const mesa = mesaDelAgente(agente, tarjetas.map((x) => ({ agente: String(x.agente), equipo: t(x.equipo) })))
  const enMapa = !mesa ? equipoDelAgente(agente) : null
  const equipo: FichaDelEmpleado["equipo"] = mesa
    ? { clave: mesa.mesa, nombre: MESAS.find((m) => m.clave === mesa.mesa)?.nombre ?? mesa.mesa, origen: mesa.origen }
    : enMapa && (EQUIPOS_DE_MARKETING as readonly string[]).includes(enMapa) ? { clave: enMapa, nombre: MESAS.find((m) => m.clave === enMapa)?.nombre ?? enMapa, origen: "mapa" } : { clave: null, nombre: "sin mesa conocida", origen: null }
  const jefe = t(ag.reports_to) ? todos.find((a) => String(a.id) === ag.reports_to || String(a.name) === ag.reports_to) : null
  const tope = ahora.getTime() - MINUTOS_TOPE * 60_000
  const abiertos = desp.map((d) => Date.parse(t(d.running_at) ?? t(d.created_at) ?? ""))
  const cuentaAportes = new Map<string, number>()
  for (const a of aportes) { const k = String(a.tipo ?? "aporte"); cuentaAportes.set(k, (cuentaAportes.get(k) ?? 0) + 1) }
  const mapaClientes = new Map(clientes.map((c) => [String(c.id), String(c.name ?? "") + (esDePractica({ nombre: String(c.name ?? "") }) ? " (práctica)" : "")]))
  const tareas: InvocacionDelEmpleado[] = invs.map((i) => ({
    created_at: t(i.created_at), status: String(i.status ?? ""), cost_usd: i.cost_usd == null ? null : Number(i.cost_usd), duration_ms: i.duration_ms == null ? null : Number(i.duration_ms),
    client_id: t(i.client_id), workflow_id: t(i.workflow_id), workflow_execution_id: t(i.workflow_execution_id), metadata: i.metadata,
  }))
  return {
    agente,
    persona: nombres.get(agente) ?? agente,
    puesto: t(ag.display_name) ?? agente,
    especialidad: dir ? t(dir.especialidad) : null,
    equipo,
    modelo: modeloLegible(ag.model),
    contratado_en: t(ag.created_at),
    revisa: jefe ? String(jefe.display_name ?? jefe.name) : "sin dato (no tiene a quién reporta en la base)",
    origen: origenLegible(ag.identity_source),
    habilidades: habilidadesDe(dir?.sabe_hacer, ag.identity_content),
    metodos: skills.map((s) => ({ nombre: String(s.skill_name ?? ""), fuente: t(s.skill_source) })).filter((m) => m.nombre),
    numeros: numerosDelEmpleado(tareas, ahora),
    recientes: tareasRecientes(tareas, mapaClientes),
    ahora: { trabajando: abiertos.filter((x) => !Number.isNaN(x) && x >= tope).length, sin_cierre_registrado: abiertos.filter((x) => Number.isNaN(x) || x < tope).length },
    aportes: [...cuentaAportes].map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
    fuente: `agents · oficina_directorio · agent_skills · agent_invocations (${invs.length}${invs.length >= LIMITE_DE_TAREAS ? `, las últimas ${LIMITE_DE_TAREAS}` : ""}) · agent_dispatches · oficina_mesa_aportes`,
    leido_en: ahora.toISOString(),
  }
}
