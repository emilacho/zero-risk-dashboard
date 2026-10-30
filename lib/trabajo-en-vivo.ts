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
export interface TrabajoEnVivo {
  filas: FilaDelTrabajo[]; hoy: number; leido_en: string
  /** hasta dónde llegó la lectura (cuándo se REGISTRÓ la última tarea): la próxima pide solo lo registrado después. Un trabajo largo se registra al terminar, así que ninguno se salta */
  cursor: string | null
}

/** QUÉ hizo cada empleado, en palabras del sistema: [presente, pasado, infinitivo] + el objeto. Por el nombre del empleado; el portero del cerebro, además, por su orden. */
const TAREAS_POR_EMPLEADO: Record<string, [string, string, string, string]> = {
  "campaign-brief-agent": ["arma", "armó", "armar", "el brief de la campaña"],
  "content-creator": ["escribe", "escribió", "escribir", "el texto de una pieza"],
  "revisor-externo-gpt": ["revisa", "revisó", "revisar", "una pieza con un segundo revisor"],
  "reporting-agent": ["prepara", "preparó", "preparar", "un informe"],
  "design-image-prompt-engineer": ["prepara", "preparó", "preparar", "las instrucciones del dibujo"],
  "marketing_instagram_curator": ["arma", "armó", "armar", "el contenido para Instagram"],
  "jefe-marketing": ["dirige", "dirigió", "dirigir", "el trabajo de marketing"],
  "desmenuzador-del-dueno": ["separa", "separó", "separar", "en datos una nota del dueño"],
  "finance-fpa-analyst": ["analiza", "analizó", "analizar", "las cifras financieras"],
  "onboarding-specialist": ["prepara", "preparó", "preparar", "el alta de un cliente"],
  "competitive-intelligence-agent": ["revisa", "revisó", "revisar", "a la competencia"],
  "social-media-strategist": ["planea", "planeó", "planear", "las redes sociales"],
  "editor-en-jefe": ["revisa", "revisó", "revisar", "la voz y los hechos de una pieza"],
  "carousel-designer": ["diseña", "diseñó", "diseñar", "un carrusel"],
  "chief-financial-officer": ["revisa", "revisó", "revisar", "las finanzas"],
  "tracking-specialist": ["configura", "configuró", "configurar", "el seguimiento de resultados"],
  "jefe-client-success": ["revisa", "revisó", "revisar", "una pieza desde el lado del cliente"],
  "brand-strategist": ["revisa", "revisó", "revisar", "el posicionamiento de la marca"],
  "creative-director-mesa": ["dirige", "dirigió", "dirigir", "la mesa creativa"],
  "spell-check-corrector": ["corrige", "corrigió", "corregir", "la ortografía"],
  "design-visual-storyteller": ["cuenta", "contó", "contar", "la historia visual de una pieza"],
  "image-generation": ["genera", "generó", "generar", "una imagen"],
  "etiquetador-del-cerebro": ["clasifica", "clasificó", "clasificar", "un dato nuevo del cerebro"],
}
const TAREAS_DEL_PORTERO: Array<[string, [string, string, string, string]]> = [
  ["proponer_busquedas", ["propone", "propuso", "proponer", "qué buscar afuera sobre un cliente"]],
  ["razonar", ["decide", "decidió", "decidir", "qué guardar en el cerebro"]],
  ["recibir", ["recibe", "recibió", "recibir", "un dato para el cerebro"]],
  ["juzgar", ["juzga", "juzgó", "juzgar", "si un dato sirve"]],
  ["etiquetar", ["clasifica", "clasificó", "clasificar", "un dato nuevo del cerebro"]],
  ["desmenuzar", ["separa", "separó", "separar", "en datos una nota del dueño"]],
]
export function tareaDe(agente: string, comando: unknown): [string, string, string, string] {
  const c = typeof comando === "string" ? comando : ""
  const esPrueba = /prueba/i.test(c)
  if (agente.startsWith("paid_media")) return ["planea", "planeó", "planear", "la publicidad pagada"]
  if (c.startsWith("portero.")) { const t = TAREAS_DEL_PORTERO.find(([k]) => c.includes(k)); if (t) return esPrueba ? [t[1][0], t[1][1], t[1][2], t[1][3] + " (prueba)"] : t[1] }
  return TAREAS_POR_EMPLEADO[agente] ?? ["hace", "hizo", "hacer", "una tarea"]
}

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

export function queHace(estado: EstadoDelTrabajo, cliente: string | null, tarea: [string, string, string, string] = ["hace", "hizo", "hacer", "una tarea"]): string {
  const para = cliente ? ` para ${cliente}` : ""
  if (estado === "trabajando") return `${tarea[0]} ${tarea[3]}${para}`
  if (estado === "fallo") return `no pudo ${tarea[2]} ${tarea[3]}${para}`
  return `${tarea[1]} ${tarea[3]}${para}`
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
  let q = supa.from("agent_invocations").select("id, agent_name, command, status, started_at, ended_at, created_at, client_id").order("created_at", { ascending: false }).limit(limite)
  // se ordena y se sondea por cuándo se REGISTRÓ (el fin), no por cuándo empezó: un trabajo largo que empezó antes y terminó después no se salta
  if (o.desde && !Number.isNaN(Date.parse(o.desde))) q = q.gt("created_at", o.desde)
  const hoyDesde = new Date(ahora.getTime() - 24 * 3_600_000).toISOString()
  const [r, h, dir] = await Promise.all([
    q,
    supa.from("agent_invocations").select("*", { count: "exact", head: true }).gte("started_at", hoyDesde),
    directorio(supa),
  ])
  if (r.error) throw new Error(`agent_invocations: ${r.error.message}`)
  const filas: Array<FilaDelTrabajo & { _registrada: string }> = ((r.data ?? []) as Fila[]).map((x) => {
    const a = dir.agentes.get(String(x.agent_name))
    const c = x.client_id ? dir.clientes.get(String(x.client_id)) : undefined
    const estado = estadoDelTrabajo(x.status)
    const cliente = c ? (c.practica ? `${c.nombre} (práctica)` : c.nombre) : null
    return { id: String(x.id), cuando: String(x.ended_at ?? x.created_at ?? x.started_at), hace: haceCuanto(String(x.ended_at ?? x.created_at ?? x.started_at), ahora), agente: a?.nombre ?? nombreLegible(String(x.agent_name ?? "")), oficina: a?.oficina ?? null, cliente, que_hace: queHace(estado, cliente, tareaDe(String(x.agent_name ?? ""), x.command)), estado, _registrada: String(x.created_at ?? x.started_at) }
  })
  const cursor = filas.length ? filas.reduce((m, f) => (f._registrada > m ? f._registrada : m), "") : null
  return { filas: filas.map(({ _registrada, ...f }) => { void _registrada; return f }), hoy: h.count ?? 0, leido_en: ahora.toISOString(), cursor }
}
