/**
 * MANUAL DE MARCA · lectura (servidor, SOLO LECTURA · sprint 6.3). Un error de la base lanza; nunca se lee como «sin manual».
 * Fuentes: `clients` (los clientes elegibles) · `client_brand_books` (la versión vigente = la mayor por cliente). Los textos los interpreta el lector
 * de siempre (`manual-lector.ts`: columna primero, borrador después, quién validó, qué falta); la identidad visual y las listas, `lib/manual.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { clientesParaElegir } from "@/lib/clientes-datos"
import { leerManual, type ManualLeido } from "@/lib/manual-lector"
import { borradorDelManual, coloresDelManual, listaDeTextos, origenDelManualLegible, politicaDeCompetidoresLegible, tipografiasDelManual, type ColorDelManual, type TipografiaDelManual } from "@/lib/manual"
import { revisionDeFidelidadLegible } from "@/lib/lenguaje"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
async function una(q: R, que: string): Promise<Fila | null> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? null) as Fila | null }

export interface ManualDelCliente {
  clientes: Array<{ id: string; nombre: string; con_manual: boolean }>
  cliente: { id: string; nombre: string } | null
  manual: null | {
    version: number | null
    /** cuántas versiones lleva el manual de este cliente */
    versiones: number
    lector: ManualLeido
    /** la revisión automática de fidelidad del cimiento, en palabras */
    fidelidad: string
    origen: string | null
    colores: ColorDelManual[]
    tipografias: TipografiaDelManual[]
    /** las opciones de eslogan del borrador (las marcadas «PROPUESTA» no son dato del cliente) cuando el eslogan aún no está decidido */
    opciones_eslogan: string[]
    palabras_prohibidas: string[]
    terminos_propios: string[]
    politica_competidores: string | null
    creado_en: string | null
    actualizado_en: string | null
  }
  leido_en: string
}

export async function leerManualDelCliente(supa: SupabaseClient, o: { cliente?: string | null; ahora?: Date } = {}): Promise<ManualDelCliente> {
  const ahora = o.ahora ?? new Date()
  const [elegibles, libros] = await Promise.all([
    clientesParaElegir(supa),
    filas(supa.from("client_brand_books").select("client_id, version").limit(2000), "client_brand_books"),
  ])
  const versionesPorCliente = new Map<string, number>()
  for (const l of libros) { const k = String(l.client_id); versionesPorCliente.set(k, (versionesPorCliente.get(k) ?? 0) + 1) }
  const clientes = elegibles.map((c) => ({ ...c, con_manual: versionesPorCliente.has(c.id) }))
  const elegido = (o.cliente && clientes.find((c) => c.id === o.cliente)) || clientes.find((c) => c.con_manual) || clientes[0] || null
  const base = { clientes, leido_en: ahora.toISOString() }
  if (!elegido) return { ...base, cliente: null, manual: null }
  const cliente = { id: elegido.id, nombre: elegido.nombre }

  const b = await una(supa.from("client_brand_books").select("*").eq("client_id", cliente.id).order("version", { ascending: false }).limit(1).maybeSingle(), "client_brand_books")
  if (!b) return { ...base, cliente, manual: null }
  const lector = leerManual(b)
  if (!lector) return { ...base, cliente, manual: null }
  return {
    ...base, cliente,
    manual: {
      version: b.version == null ? null : Number(b.version),
      versiones: versionesPorCliente.get(cliente.id) ?? 1,
      lector,
      fidelidad: revisionDeFidelidadLegible(b.gate_outcome),
      origen: origenDelManualLegible(b.auto_generated_from),
      colores: coloresDelManual(b),
      tipografias: tipografiasDelManual(b),
      opciones_eslogan: listaDeTextos(borradorDelManual(b).tagline_opciones),
      palabras_prohibidas: listaDeTextos(b.forbidden_words),
      terminos_propios: listaDeTextos(b.required_terminology),
      politica_competidores: politicaDeCompetidoresLegible(b.competitor_mentions_policy),
      creado_en: typeof b.created_at === "string" ? b.created_at : null,
      actualizado_en: typeof b.updated_at === "string" ? b.updated_at : null,
    },
  }
}
