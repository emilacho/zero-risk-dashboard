/**
 * LA GRAN IDEA · lectura (servidor, SOLO LECTURA · sprint 6.10 · botón 5 del Centro de campaña). La tarjeta la abre la cadena en `hitl_queue` (`type = concepto_review`)
 * al cerrar la mesa de concepto; lo que se enseña sale de `cadena_conceptos` + `cadena_brief_creativo` por el lector de CC#1 (`lib/concepto-datos.ts`, tablero PR #77,
 * reutilizado tal cual). HOY (1-nov) no hay tarjetas de concepto y las tablas de la cadena nueva no están en producción (T9): la lectura lo dice; no se inventa.
 * La DECISIÓN (aprobar / pedir cambios) va por `POST /api/cadena/concepto` de la plataforma, que tampoco está publicada: los botones se habilitan recién cuando
 * exista y se certifique con una corrida real (regla de Emilio: nada que escribe se publica sin certificar).
 */
import { esAutorDeLaMesa } from "@/lib/organigrama"
import type { SupabaseClient } from "@supabase/supabase-js"
import { clientesParaElegir } from "@/lib/clientes-datos"
import { cargarConcepto, estadoDelConcepto, TIPO_CONCEPTO, type DetalleDelConcepto, type EstadoDelConcepto } from "@/lib/concepto-datos"
import { esTablaInexistente } from "@/lib/brief-datos"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
async function una(q: R, que: string): Promise<Fila | null> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? null) as Fila | null }

export interface TarjetaDeConcepto { hitl_id: string; status: string; estado: EstadoDelConcepto; titulo: string; creada: string; version: number | null }
export interface GranIdeaDelCliente {
  clientes: Array<{ id: string; nombre: string }>
  cliente: { id: string; nombre: string } | null
  campana: { id: string; estado: string } | null
  /** la tabla `cadena_conceptos` existe en producción */
  publicado: boolean
  /** todas las tarjetas de gran idea del cliente, de la más nueva a la más vieja */
  tarjetas: TarjetaDeConcepto[]
  /** la tarjeta elegida (la más nueva, o la pedida), leída completa */
  detalle: DetalleDelConcepto | null
  /** CC6 · quién la propuso: los empleados que aportaron en la sala de ese concepto (nombre real, de `oficina_mesa_aportes.de`) */
  quienes_propusieron?: string[]
  leido_en: string
}

export function tarjetaDesdeFila(f: Fila): TarjetaDeConcepto {
  const meta = (f.metadata ?? {}) as Record<string, unknown>
  return { hitl_id: String(f.id), status: String(f.status ?? ""), estado: estadoDelConcepto(String(f.status ?? ""), f.decision), titulo: String(f.title ?? "Gran idea"), creada: String(f.created_at ?? ""), version: meta.version == null ? null : Number(meta.version) }
}

export async function leerGranIdea(supa: SupabaseClient, o: { cliente?: string | null; tarjeta?: string | null; ahora?: Date } = {}): Promise<GranIdeaDelCliente> {
  const ahora = o.ahora ?? new Date()
  const clientes = await clientesParaElegir(supa)
  let elegido: { id: string; nombre: string } | null = (o.cliente && clientes.find((c) => c.id === o.cliente)) || null
  if (!elegido && o.cliente) {
    const c = await una(supa.from("clients").select("id, name").eq("id", o.cliente).maybeSingle(), "clients")
    if (c) elegido = { id: String(c.id), nombre: String(c.name) }
  }
  if (!elegido) elegido = clientes[0] ?? null
  const base = { clientes, leido_en: ahora.toISOString() }
  if (!elegido) return { ...base, cliente: null, campana: null, publicado: true, tarjetas: [], detalle: null }
  const [camp, hitl, sonda] = await Promise.all([
    una(supa.from("cadena_campanas").select("id, estado").eq("client_id", elegido.id).eq("seco", false).order("creada_en", { ascending: false }).limit(1).maybeSingle(), "cadena_campanas"),
    filas(supa.from("hitl_queue").select("id, status, title, created_at, decision, metadata").eq("client_id", elegido.id).eq("type", TIPO_CONCEPTO).order("created_at", { ascending: false }).limit(50), "hitl_queue"),
    // ¿existe ya la tabla de conceptos en producción? (una lectura mínima; si no existe, se dice)
    supa.from("cadena_conceptos").select("campana_id").limit(1),
  ])
  const publicado = !(sonda.error && esTablaInexistente(sonda.error.message))
  if (sonda.error && publicado) throw new Error(`cadena_conceptos: ${sonda.error.message}`)
  const tarjetas = hitl.map(tarjetaDesdeFila)
  const elegida = (o.tarjeta && tarjetas.find((t) => t.hitl_id === o.tarjeta)) || tarjetas[0] || null
  const detalle = elegida ? await cargarConcepto(supa, elegida.hitl_id) : null
  const quienes_propusieron = detalle?.campana_id && detalle.version != null ? await quienesPropusieron(supa, detalle.campana_id, detalle.version) : []
  return { ...base, cliente: elegido, campana: camp ? { id: String(camp.id), estado: String(camp.estado ?? "") } : null, publicado, tarjetas, detalle, quienes_propusieron }
}

/**
 * los empleados de la sala que aportaron al encargo de ese concepto, sin repetir y en el orden en que hablaron.
 * 10-nov (URGENTE de Lenovo): el concepto se busca por (campaña, versión), como lo guarda la cadena. Antes se buscaba por `id` con el `concepto_id` de la tarjeta
 * («con-28de888eb3f2-v2», un texto) contra una columna numérica: la base contestaba «invalid input syntax for type bigint» y se caían el panel de la gran idea y el Centro de campaña
 * la primera vez que hubo una gran idea real en la mesa de Emilio. Es un dato de apoyo: si su lectura falla, se muestra sin nombres, nunca se cae la pantalla.
 */
async function quienesPropusieron(supa: SupabaseClient, campanaId: string, version: number): Promise<string[]> {
  try { return await quienesPropusieronSinRed(supa, campanaId, version) } catch { return [] }
}
async function quienesPropusieronSinRed(supa: SupabaseClient, campanaId: string, version: number): Promise<string[]> {
  const c = await una(supa.from("cadena_conceptos").select("encargo_id").eq("campana_id", campanaId).eq("version", version).maybeSingle(), "cadena_conceptos")
  const encargo = c && typeof c.encargo_id === "string" ? c.encargo_id : null
  if (!encargo) return []
  const aportes = await filas(supa.from("oficina_mesa_aportes").select("de, n").eq("encargo_id", encargo).order("n", { ascending: true }).limit(200), "oficina_mesa_aportes")
  return quienesPropusieronDe(aportes)
}

/** los nombres de quien habló en la sala, sin repetir, en orden, sin «sistema» (no es un empleado) */
export function quienesPropusieronDe(aportes: Array<{ de?: unknown }>): string[] {
  return [...new Set(aportes.map((a) => String(a.de ?? "")).filter(esAutorDeLaMesa))]
}

/** la segunda línea del cuadro «Gran idea» */
export function detalleDeGranIdea(x: { publicado: boolean; campana: unknown; tarjetas: TarjetaDeConcepto[] }): { texto: string; aviso: boolean } {
  const pendiente = x.tarjetas.find((t) => t.estado === "pendiente")
  if (pendiente) return { texto: "Espera tu decisión", aviso: true }
  const ultima = x.tarjetas[0]
  if (ultima) return { texto: ultima.estado === "aprobada" ? "Aprobada" : ultima.estado === "con_cambios" ? "Con cambios pedidos · la mesa vuelve a sesionar" : ultima.estado === "rechazada" ? "Rechazada" : "Vista", aviso: false }
  if (!x.publicado) return { texto: "La sala creativa aún no abre (llega con T9)", aviso: false }
  if (!x.campana) return { texto: "Sin campaña todavía", aviso: false }
  return { texto: "La mesa de creativos todavía no sesionó", aviso: false }
}
