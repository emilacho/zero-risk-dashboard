/**
 * EL GASTO · lectura (servidor, solo lectura). Trae el libro de llamadas de los empleados y la libreta de Apify en páginas de 1.000 (PostgREST corta en 1.000 sin avisar:
 * el tablero viejo contaba 1.000 llamadas aunque había 1.275). Un error de la base se vuelve excepción: nunca un «0» por error. Si se llega al tope de seguridad, lo dice.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { diaEnEcuador, resumirGasto, type FilaDeCostos, type Invocacion, type PiezaConGasto, type Reparto, type ResumenDeGasto } from "@/lib/gasto"

const PAGINA = 1000
export const TOPE_DE_FILAS = 30000

type Fila = Record<string, unknown>
type Consulta = (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>

/** lee todas las páginas de una consulta; devuelve las filas y si se cortó por el tope de seguridad */
export async function paginar(consulta: Consulta, que: string): Promise<{ filas: Fila[]; cortado: boolean }> {
  const filas: Fila[] = []
  for (let desde = 0; desde < TOPE_DE_FILAS; desde += PAGINA) {
    const r = await consulta(desde, desde + PAGINA - 1)
    if (r.error) throw new Error(`${que}: ${r.error.message}`)
    const pagina = (r.data ?? []) as Fila[]
    filas.push(...pagina)
    if (pagina.length < PAGINA) return { filas, cortado: false }
  }
  return { filas, cortado: true }
}

/** el instante en que empieza (hora de Ecuador) el día `aaaa-mm-dd` */
const inicioDelDia = (dia: string): string => `${dia}T05:00:00.000Z`

/** `por_cliente_visible`: lo que se muestra: las fichas dadas de baja, archivadas o de prueba se juntan en UNA fila (si no, 3 fichas se llaman igual y salen nombres de prueba) */
export interface LecturaDeGasto { resumen: ResumenDeGasto; por_cliente_visible: Reparto[]; cortado: boolean; leido_en: string }

export function repartoVisible(porCliente: Reparto[], activos: Set<string>): Reparto[] {
  const visibles = porCliente.filter((r) => r.clave === "" || activos.has(r.clave))
  const resto = porCliente.filter((r) => r.clave !== "" && !activos.has(r.clave))
  if (resto.length === 0) return visibles
  const junta: Reparto = { clave: "fichas-inactivas", nombre: `Fichas dadas de baja y de prueba (${resto.length})`, total: Math.round(resto.reduce((t, r) => t + r.total, 0) * 1e6) / 1e6, llamadas: resto.reduce((t, r) => t + r.llamadas, 0) }
  return [...visibles, junta].sort((a, b) => b.total - a.total)
}

export async function leerGasto(supa: SupabaseClient, ahora: Date = new Date()): Promise<LecturaDeGasto> {
  const hoy = diaEnEcuador(ahora)
  const primeroDelMes = `${hoy.slice(0, 7)}-01`
  const hace30 = diaEnEcuador(new Date(ahora.getTime() - 29 * 86_400_000))
  const desdeDia = primeroDelMes < hace30 ? primeroDelMes : hace30
  const [inv, cos, cli, enc] = await Promise.all([
    paginar((a, b) => supa.from("agent_invocations").select("created_at, cost_usd, model, client_id").gte("created_at", inicioDelDia(desdeDia)).order("created_at", { ascending: true }).range(a, b), "agent_invocations"),
    paginar((a, b) => supa.from("costs").select("date, amount_usd, amount_usd_exact, description").gte("date", desdeDia).order("created_at", { ascending: true }).range(a, b), "costs"),
    paginar((a, b) => supa.from("clients").select("id, name, status").range(a, b), "clients"),
    supa.from("oficina_encargos").select("id, client_id, hitl_queue_id, brief_id, familia, version_encargo, estado, gasto_usd, tope_usd, dry_run, creado_en").neq("dry_run", true).order("creado_en", { ascending: false }).limit(12),
  ])
  if (enc.error) throw new Error(`oficina_encargos: ${enc.error.message}`)
  const clientes: Record<string, string> = {}
  for (const c of cli.filas) clientes[String(c.id)] = String(c.name ?? "")
  const piezas: PiezaConGasto[] = ((enc.data ?? []) as Fila[]).map((e) => ({
    id: String(e.id), client_id: e.client_id ? String(e.client_id) : null, cliente: e.client_id ? (clientes[String(e.client_id)] ?? null) : null, hitl_queue_id: e.hitl_queue_id ? String(e.hitl_queue_id) : null, brief_id: String(e.brief_id), familia: String(e.familia), version: Number(e.version_encargo), estado: String(e.estado),
    gasto_usd: Number(e.gasto_usd ?? 0), tope_usd: Number(e.tope_usd ?? 0), dry_run: e.dry_run === true, creado_en: String(e.creado_en),
  }))
  const resumen = resumirGasto({ invocaciones: inv.filas as unknown as Invocacion[], costos: cos.filas as unknown as FilaDeCostos[], clientes, piezas, ahora })
  const activos = new Set(cli.filas.filter((c) => String(c.status) !== "churned").map((c) => String(c.id)))
  return { resumen, por_cliente_visible: repartoVisible(resumen.por_cliente, activos), cortado: inv.cortado || cos.cortado, leido_en: ahora.toISOString() }
}
