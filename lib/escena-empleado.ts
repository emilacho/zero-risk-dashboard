/**
 * LA FICHA DEL EMPLEADO (CC6 · Sprint B · pedido de Emilio, 01-nov): un currículum moderno de cada empleado de la oficina, al tocar su nombre en la lista de
 * la mesa. Lógica PURA (sin red ni base): el nombre de persona, el origen, las habilidades, los métodos, los números y el trabajo reciente.
 * Nada se inventa: lo que no está en la base se dice «sin dato».
 */
import { nombreDelFlujo, pasoDe } from "@/lib/escena-avatares"

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "")
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

// ── el nombre de persona: inventado, diverso y neutro, ESTABLE ──
// Sale del identificador del empleado (no de datos de personas reales). Se asigna en el orden de alta de los empleados y, si dos chocan, el más nuevo toma el
// siguiente libre: así el nombre de cada uno no cambia entre visitas ni cuando entran empleados nuevos.
export const NOMBRES = [
  "Valeria", "Mateo", "Camila", "Joaquín", "Lucía", "Andrés", "Sofía", "Tomás", "Isabela", "Gabriel", "Renata", "Nicolás", "Mariana", "Sebastián", "Elena",
  "Daniel", "Paula", "Martín", "Daniela", "Emilio", "Julia", "Santiago", "Carla", "Diego", "Abril", "Iván", "Noa", "Rafael", "Inés", "Bruno",
  "Amara", "Kenji", "Leila", "Omar", "Nadia", "Tariq", "Mei", "Ravi", "Aiyana", "Kofi", "Lina", "Arjun", "Yara", "Jonas", "Ayla",
  "Marco", "Clara", "Hugo", "Alba", "Teo", "Vera", "León", "Irene", "Gael", "Olivia", "Samuel", "Maite", "Ariel", "Luz", "Adrián",
] as const
export const APELLIDOS = [
  "Ortiz", "Navarro", "Salazar", "Vera", "Paredes", "Molina", "Cárdenas", "Ríos", "Aguilar", "Mendoza", "Castro", "Herrera", "Rojas", "Benítez", "Luna",
  "Ibarra", "Campos", "Fuentes", "Delgado", "Montero", "Pineda", "Robles", "Cortés", "Andrade", "Valencia", "Zambrano", "Espinoza", "Guerrero", "Mora", "Ponce",
  "Okafor", "Tanaka", "Haddad", "Nakamura", "Mensah", "Kaur", "Rahman", "Silva", "Costa", "Novak", "Lindqvist", "Petrov", "Duarte", "Calderón", "Sáenz",
  "Bravo", "Quintero", "Villalba", "Arce", "Toledo", "Escobar", "Medina", "Serrano", "Acosta", "Garcés", "Bermúdez", "Sandoval", "Moya", "Lozano", "Rivas",
] as const
/** FNV-1a de 32 bits: el mismo identificador da siempre el mismo número */
export function huella(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h >>> 0
}
/** los nombres de persona de TODOS los empleados, asignados en orden de alta (y por identificador si comparten fecha) sin repetir */
export function nombresDePersona(agentes: Array<{ name: string; created_at: string | null }>): Map<string, string> {
  const orden = [...agentes].filter((a) => a.name).sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.name.localeCompare(b.name))
  const total = NOMBRES.length * APELLIDOS.length
  const usados = new Set<number>(), fuera = new Map<string, string>()
  for (const a of orden) {
    let k = huella(a.name) % total
    while (usados.has(k)) k = (k + 1) % total
    usados.add(k)
    fuera.set(a.name, `${NOMBRES[k % NOMBRES.length]} ${APELLIDOS[Math.floor(k / NOMBRES.length) % APELLIDOS.length]}`)
  }
  return fuera
}
export const iniciales = (nombre: string): string => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("")

// ── origen, habilidades y métodos ──
/** de dónde sale su identidad (`agents.identity_source`), en palabras; la licencia solo si la base la dice */
export function origenLegible(fuente: unknown): { texto: string; repositorio: string | null; archivo: string | null } {
  const f = texto(fuente)
  if (!f) return { texto: "sin dato", repositorio: null, archivo: null }
  const canon = f.match(/^canonical:([^@:\s]+\/[^@:\s]+)(?:@([^:\s]+))?:(\S+)/)
  if (canon) return { texto: `repositorio ${canon[1]}${canon[2] ? ` (versión ${canon[2].slice(0, 7)})` : ""}`, repositorio: canon[1], archivo: canon[3] }
  const local = f.match(/^project-local:(\S+)/)
  if (local) return { texto: "identidad propia de Zero Risk", repositorio: "zero-risk-platform", archivo: local[1] }
  if (/^registry:managed_agents_registry/.test(f)) return { texto: "registro de agentes administrados de Zero Risk", repositorio: null, archivo: f.split(":")[2]?.split(/\s/)[0] ?? null }
  if (/managed_agents_registry/.test(f)) return { texto: "registro de agentes administrados de Zero Risk", repositorio: null, archivo: null }
  const repo = f.match(/^([\w.-]+\/[\w.-]+)/)
  if (repo) return { texto: `repositorio ${repo[1]}`, repositorio: repo[1], archivo: null }
  return { texto: "registrado en la base, sin repositorio declarado", repositorio: null, archivo: null } // la nota interna no se muestra tal cual
}
/** las habilidades destacadas: lo que sabe hacer según el directorio de la oficina; si no hay tarjeta, las responsabilidades de su identidad (tal cual, recortadas) */
export function habilidadesDe(sabeHacer: unknown, identidad: unknown, maximo = 6): { lista: string[]; fuente: "directorio" | "identidad" | null } {
  const sabe = Array.isArray(sabeHacer) ? sabeHacer.map(texto).filter(Boolean) : []
  if (sabe.length) return { lista: sabe.slice(0, maximo), fuente: "directorio" }
  const t = texto(identidad)
  const seccion = t.match(/(?:^|\n)#{1,3}\s*(Responsibilities|Core (?:Skills|Capabilities)|Capabilities|Skills|Expertise|Habilidades|Responsabilidades)[^\n]*\n([\s\S]*?)(?=\n#{1,3}\s|$(?![\s\S]))/i)
  const vinetas = seccion ? seccion[2].split("\n").map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, "").replace(/\*\*/g, "").trim()).filter((l) => l.length > 3) : []
  return vinetas.length ? { lista: vinetas.slice(0, maximo).map((v) => (v.length > 140 ? `${v.slice(0, 137)}…` : v)), fuente: "identidad" } : { lista: [], fuente: null }
}
/** el modelo, en palabras */
export function modeloLegible(m: unknown): string {
  const s = texto(m).toLowerCase()
  if (!s) return "sin dato"
  if (s.includes("opus")) return "Claude Opus"
  if (s.includes("sonnet")) return "Claude Sonnet"
  if (s.includes("haiku")) return "Claude Haiku"
  if (s.includes("gpt")) return s.toUpperCase().replace(/-/g, " ")
  return texto(m)
}

// ── el trabajo y los números ──
export interface InvocacionDelEmpleado { created_at: string | null; status: string; cost_usd: number | null; duration_ms: number | null; client_id: string | null; workflow_id: string | null; workflow_execution_id: string | null; metadata: unknown }
export interface TareaReciente { fecha: string | null; cliente: string; flujo: string; paso: string | null; estado: "completada" | "fallida" | "otra"; costo_usd: number | null; minutos: number | null }
export interface NumerosDelEmpleado { tareas: number; completadas: number; fallidas: number; tasa_de_exito: number | null; minutos_promedio: number | null; gasto_total_usd: number; gasto_30d_usd: number; primera: string | null; ultima: string | null }
const esFallo = (s: string) => s === "failed" || s === "error" || s === "timeout"
export function numerosDelEmpleado(invs: InvocacionDelEmpleado[], ahora: Date): NumerosDelEmpleado {
  const hace30 = ahora.getTime() - 30 * 86_400_000
  let completadas = 0, fallidas = 0, gastoTotal = 0, gasto30 = 0, dur = 0, nDur = 0
  for (const i of invs) {
    if (i.status === "completed") completadas++
    else if (esFallo(i.status)) fallidas++
    const c = typeof i.cost_usd === "number" && Number.isFinite(i.cost_usd) ? i.cost_usd : 0
    gastoTotal += c
    if (i.created_at && Date.parse(i.created_at) >= hace30) gasto30 += c
    if (typeof i.duration_ms === "number" && i.duration_ms > 0) { dur += i.duration_ms; nDur++ }
  }
  const fechas = invs.map((i) => i.created_at).filter((x): x is string => !!x).sort()
  const decididas = completadas + fallidas
  return {
    tareas: invs.length, completadas, fallidas, tasa_de_exito: decididas ? Math.round((completadas / decididas) * 100) : null,
    minutos_promedio: nDur ? Math.round((dur / nDur / 60000) * 10) / 10 : null,
    gasto_total_usd: Math.round(gastoTotal * 10000) / 10000, gasto_30d_usd: Math.round(gasto30 * 10000) / 10000,
    primera: fechas[0] ?? null, ultima: fechas[fechas.length - 1] ?? null,
  }
}
export function tareasRecientes(invs: InvocacionDelEmpleado[], clientes: Map<string, string>, n = 8): TareaReciente[] {
  return [...invs].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, n).map((i) => {
    const meta = objeto(i.metadata)
    return {
      fecha: i.created_at,
      cliente: i.client_id ? clientes.get(i.client_id) ?? "cliente sin nombre" : "sin cliente",
      flujo: nombreDelFlujo(i.workflow_id),
      paso: texto(meta.step_name) || pasoDe(i.workflow_execution_id),
      estado: i.status === "completed" ? "completada" : esFallo(i.status) ? "fallida" : "otra",
      costo_usd: typeof i.cost_usd === "number" ? i.cost_usd : null,
      minutos: typeof i.duration_ms === "number" && i.duration_ms > 0 ? Math.round((i.duration_ms / 60000) * 10) / 10 : null,
    }
  })
}

// ── la ficha completa (lo que devuelve /api/escena-viva/empleado) ──
export interface FichaDelEmpleado {
  agente: string
  persona: string
  puesto: string
  especialidad: string | null
  equipo: { clave: string | null; nombre: string; origen: "directorio" | "mapa" | null }
  modelo: string
  contratado_en: string | null
  revisa: string
  origen: ReturnType<typeof origenLegible>
  habilidades: ReturnType<typeof habilidadesDe>
  metodos: Array<{ nombre: string; fuente: string | null }>
  numeros: NumerosDelEmpleado
  recientes: TareaReciente[]
  /** despachos «running»: los de menos de 20 min son trabajo en curso; los más viejos no tienen cierre registrado (no cuentan como trabajando) */
  ahora: { trabajando: number; sin_cierre_registrado: number }
  aportes: Array<{ tipo: string; n: number }>
  fuente: string
  leido_en: string
}
