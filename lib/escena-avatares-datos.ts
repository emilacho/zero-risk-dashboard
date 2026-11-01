/**
 * LA ESCENA VIVA · lectura (servidor, SOLO LECTURA · CC6 Sprint 1): quién está trabajando AHORA (`agent_dispatches` abiertos), qué terminó o falló hace poco
 * (`agent_invocations`), la mesa de cada uno (`oficina_directorio.equipo` + `oficina_equipos`) y los nombres (`agents`, `clients`). Una lectura pequeña por pedido;
 * el navegador pide cada pocos segundos. Los nombres y el directorio se leen una vez cada 5 min. Nada se escribe.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { conCache } from "@/lib/cache-corta"
import { esDePractica } from "@/lib/clientes"
import { conAportes, MINUTOS_ENLACE, type ReunionDeLaSala } from "@/lib/escena-sala"
import { armarEscena, HORAS_RECIENTE, momentoDeLaCampana, type Despacho, type EscenaDatos, type InvocacionViva, type NombreDeAgente, type TarjetaDelDirectorio } from "@/lib/escena-avatares"
import { leerPlanDelCliente } from "@/lib/plan-datos"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
const s = (v: unknown): string | null => (v == null || v === "" ? null : String(v))

/** cuántas invocaciones recientes se miran (para cerrar despachos, para «falló» y para la última actividad del equipo) */
export const LIMITE_DE_INVOCACIONES = 400

async function directorio(supa: SupabaseClient) {
  return conCache("escena-viva-directorio", 300_000, async () => {
    const [ag, cl, dir, eq] = await Promise.all([
      supa.from("agents").select("name, display_name, is_active").limit(1000),
      supa.from("clients").select("id, name").limit(1000),
      supa.from("oficina_directorio").select("agente, equipo, rol").limit(500),
      supa.from("oficina_equipos").select("clave, nombre, etapa").limit(50),
    ])
    const agentes: NombreDeAgente[] = ((ag.data ?? []) as Fila[]).map((a) => ({ name: String(a.name), display_name: s(a.display_name), activo: typeof a.is_active === "boolean" ? a.is_active : null }))
    const clientes = ((cl.data ?? []) as Fila[]).map((c) => ({ id: String(c.id), nombre: String(c.name ?? "") + (esDePractica({ nombre: String(c.name ?? "") }) ? " (práctica)" : "") }))
    const tarjetas: TarjetaDelDirectorio[] = ((dir.data ?? []) as Fila[]).map((d) => ({ agente: String(d.agente), equipo: s(d.equipo), rol: s(d.rol) }))
    // la tabla de equipos puede no estar en una base vieja: entonces manda la tabla MESAS
    const equipos = eq.error ? null : ((eq.data ?? []) as Fila[]).map((q) => ({ clave: String(q.clave), nombre: s(q.nombre), etapa: s(q.etapa) }))
    return { agentes, clientes, tarjetas, equipos }
  })
}

/** el cliente y el momento de su campaña (una lectura por minuto, compartida); si no se puede leer, la escena sigue sin esa línea */
async function contexto(supa: SupabaseClient, ahora: Date): Promise<EscenaDatos["contexto"]> {
  try { return momentoDeLaCampana(await conCache("escena-viva-contexto", 60_000, () => leerPlanDelCliente(supa, { ahora }))) } catch { return null }
}

export async function leerEscenaViva(supa: SupabaseClient, o: { ahora?: Date } = {}): Promise<EscenaDatos> {
  const ahora = o.ahora ?? new Date()
  const desde = new Date(ahora.getTime() - HORAS_RECIENTE * 3_600_000).toISOString()
  const [desp, inv, dir, ctx] = await Promise.all([
    // los despachos abiertos (sin importar cuándo: los viejos se cuentan como «sin fin registrado») + los que terminaron o fallaron en la ventana
    filas(supa.from("agent_dispatches").select("id, agent_name, client_id, workflow_id, workflow_execution_id, status, running_at, completed_at, created_at").or(`status.eq.running,created_at.gte.${desde}`).order("created_at", { ascending: false }).limit(300), "agent_dispatches"),
    filas(supa.from("agent_invocations").select("agent_name, client_id, workflow_id, workflow_execution_id, status, started_at, ended_at, cost_usd, metadata").gte("created_at", desde).order("created_at", { ascending: false }).limit(LIMITE_DE_INVOCACIONES), "agent_invocations"),
    directorio(supa),
    contexto(supa, ahora),
  ])
  const despachos: Despacho[] = desp.map((d) => ({ id: String(d.id), agent_name: String(d.agent_name ?? ""), client_id: s(d.client_id), workflow_id: s(d.workflow_id), workflow_execution_id: s(d.workflow_execution_id), status: s(d.status), running_at: s(d.running_at), completed_at: s(d.completed_at), created_at: s(d.created_at) }))
  const invocaciones: InvocacionViva[] = inv.map((i) => {
    const m = (i.metadata && typeof i.metadata === "object" ? i.metadata : {}) as Fila
    return { agent_name: String(i.agent_name ?? ""), client_id: s(i.client_id), workflow_id: s(i.workflow_id), workflow_execution_id: s(i.workflow_execution_id), status: s(i.status), started_at: s(i.started_at), ended_at: s(i.ended_at), cost_usd: i.cost_usd == null ? null : Number(i.cost_usd), step_name: s(m.step_name), task_text: s(m.task_text) }
  })
  const escena = armarEscena({ despachos, invocaciones, directorio: dir.tarjetas, agentes: dir.agentes, clientes: dir.clientes, equipos: dir.equipos, ahora, contexto: ctx })
  // S4 · los aportes de la reunión de la sala (3 lecturas chicas, solo si hay reunión; se guardan 20 s)
  if (escena.sala?.reunion) escena.sala = { ...escena.sala, reunion: await leerAportesDeLaReunion(supa, escena.sala.reunion) }
  return escena
}

/** S4 · lo que hace falta para los globos: la salida guardada de cada participante, los informes que entraron al cerebro durante la reunión y la revisión
 *  de la jefatura. Un error de la base lanza (no se lee como «no se usó»). */
export async function leerAportesDeLaReunion(supa: SupabaseClient, r: ReunionDeLaSala): Promise<ReunionDeLaSala> {
  const corridas = r.participantes.map((p) => p.corrida).filter((x): x is string => !!x)
  const clave = `escena-viva-aportes|${corridas.join(",")}|${r.participantes.map((p) => p.estado).join(",")}`
  const datos = await conCache(clave, 20_000, async () => {
    const desde = r.desde ?? new Date(0).toISOString()
    const hasta = new Date(Date.parse(r.hasta ?? new Date().toISOString()) + MINUTOS_ENLACE * 60_000).toISOString()
    const tieneJefatura = r.fases.some((f) => f.nombre === "revisión de la jefatura")
    const [salidas, fichas, revision] = await Promise.all([
      corridas.length ? filas(supa.from("agent_invocations").select("agent_name, workflow_execution_id, output_summary").in("workflow_execution_id", corridas).limit(100), "agent_invocations") : Promise.resolve([] as Fila[]),
      r.cliente_id ? filas(supa.from("cerebro_fichas").select("ref").eq("client_id", r.cliente_id).eq("clase", "informe_de_analisis").gte("creado_en", desde).lte("creado_en", hasta).limit(50), "cerebro_fichas") : Promise.resolve([] as Fila[]),
      r.cliente_id && tieneJefatura ? filas(supa.from("jefatura_revisiones").select("estado_del_motor, creado_en").eq("client_id", r.cliente_id).gte("creado_en", desde).lte("creado_en", hasta).order("creado_en", { ascending: false }).limit(1), "jefatura_revisiones") : Promise.resolve([] as Fila[]),
    ])
    return {
      salidas: salidas.map((x) => ({ agent_name: String(x.agent_name ?? ""), workflow_execution_id: s(x.workflow_execution_id), output_summary: s(x.output_summary) })),
      informesEnElCerebro: fichas.map((f) => String(f.ref ?? "")).filter(Boolean),
      revision: revision[0] ? { estado_del_motor: revision[0].estado_del_motor } : null,
    }
  })
  return conAportes(r, datos)
}
