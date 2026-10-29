/**
 * CLIENTES (CC#1 · 29-oct · parte 3 del dashboard): lógica PURA de la ficha por cliente. Cada cifra sale de una tabla real; lo que no existe se dice («sin plan», «sin manual»), nunca se rellena.
 * Ojo con el gasto: la libreta `costs` NO trae client_id, así que el gasto POR CLIENTE sale de `agent_invocations` (lo que gastaron los agentes) y de `oficina_encargos` (lo que costó cada pieza). No es la cifra de la libreta; esa es la de Gasto.
 */
export const DIAS_DEL_GASTO = 30

export const ETIQUETA_DEL_CLIENTE: Record<string, string> = { active: "Activo", onboarding: "En alta", paused: "En pausa", churned: "Dado de baja", prospect: "Prospecto" }
export const etiquetaDelCliente = (estado: string | null | undefined): string => ETIQUETA_DEL_CLIENTE[String(estado ?? "")] ?? (estado ? String(estado) : "Sin estado")

export interface FilaDeGasto { cost_usd?: unknown; costo_usd?: unknown; gasto_usd?: unknown; dry_run?: unknown }

const numero = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

/** suma de una columna de gasto, sin los ensayos (dry_run) */
export function gastoReal(filas: FilaDeGasto[], columna: "cost_usd" | "gasto_usd"): number {
  let t = 0
  for (const f of filas) { if (f.dry_run === true) continue; t += numero(f[columna]) }
  return Math.round(t * 1e6) / 1e6
}

export interface FasesDelPlan { clave: string; objetivo: string; cita_plan?: string; dia_desde: number; dia_hasta: number }

/** las fases de la estrategia validada; vacío si el contenido no las trae */
export function fasesDelPlan(contenido: unknown): FasesDelPlan[] {
  const f = (contenido as { fases?: unknown } | null)?.fases
  if (!Array.isArray(f)) return []
  return f.filter((x): x is Record<string, unknown> => !!x && typeof x === "object").map((x) => ({ clave: String(x.clave ?? ""), objetivo: String(x.objetivo ?? ""), cita_plan: x.cita_plan ? String(x.cita_plan) : undefined, dia_desde: numero(x.dia_desde), dia_hasta: numero(x.dia_hasta) }))
}

/** el manual del cliente: de dónde sale y cuánto confiar (generado por el sistema vs validado por una persona) */
export function origenDelManual(b: { auto_generated?: unknown; human_validated?: unknown } | null): { texto: string; propuesta: boolean } {
  if (!b) return { texto: "Sin manual de marca", propuesta: false }
  if (b.human_validated === true) return { texto: "Validado por una persona", propuesta: false }
  if (b.auto_generated === true) return { texto: "Propuesta del sistema · sin validar", propuesta: true }
  return { texto: "Escrito a mano · sin validar", propuesta: false }
}

export interface ResumenDeCliente {
  id: string
  nombre: string
  rubro: string | null
  estado: string
  piezas_por_aprobar: number
  gasto_30d: number
  trozos_del_cerebro: number
  campana: string | null
}

/** primero lo que necesita a Emilio, luego por gasto, luego por nombre */
export function ordenarClientes(c: ResumenDeCliente[]): ResumenDeCliente[] {
  return [...c].sort((a, b) => b.piezas_por_aprobar - a.piezas_por_aprobar || b.gasto_30d - a.gasto_30d || a.nombre.localeCompare(b.nombre, "es"))
}
