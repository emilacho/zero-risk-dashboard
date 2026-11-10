/**
 * BRIEF DE CAMPAÑA · lectura (servidor, SOLO LECTURA · sprint 6.10). Campaña = la última no seca del cliente (igual que el Centro de campaña) → `cadena_brief_creativo`.
 * Si la tabla no existe todavía en producción (T9 en curso) se devuelve `publicado: false`; cualquier OTRO error de la base lanza.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { clientesParaElegir } from "@/lib/clientes-datos"
import { briefDesdeFila, ordenarBriefs, type Brief } from "@/lib/brief"
import { esAutorDeLaMesa } from "@/lib/organigrama"
import { direccionesDeFotos } from "@/lib/gran-idea-datos"
import { codigosEntreComillas, fotosCitadas } from "@/lib/sin-codigos"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function una(q: R, que: string): Promise<Fila | null> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? null) as Fila | null }
/** la tabla no está en producción (PostgREST: «Could not find the table … in the schema cache» · Postgres: «relation … does not exist») */
export const esTablaInexistente = (msg: string) => /could not find the table|does not exist|schema cache/i.test(msg)

export interface BriefDelCliente {
  clientes: Array<{ id: string; nombre: string }>
  cliente: { id: string; nombre: string } | null
  campana: { id: string; estado: string } | null
  /** la tabla del brief existe en producción */
  publicado: boolean
  briefs: Brief[]
  leido_en: string
  /** 10-nov · los códigos de foto que el brief cita y que SÍ son fotos del cliente: al mostrar se quitan (un número entre comillas que no es foto es dato del cliente y se queda) */
  fotos?: string[]
}

export async function leerBrief(supa: SupabaseClient, o: { cliente?: string | null; ahora?: Date } = {}): Promise<BriefDelCliente> {
  const ahora = o.ahora ?? new Date()
  const clientes = await clientesParaElegir(supa)
  let elegido: { id: string; nombre: string } | null = (o.cliente && clientes.find((c) => c.id === o.cliente)) || null
  if (!elegido && o.cliente) {
    const c = await una(supa.from("clients").select("id, name").eq("id", o.cliente).maybeSingle(), "clients")
    if (c) elegido = { id: String(c.id), nombre: String(c.name) }
  }
  if (!elegido) elegido = clientes[0] ?? null
  const base = { clientes, leido_en: ahora.toISOString() }
  if (!elegido) return { ...base, cliente: null, campana: null, publicado: true, briefs: [] }
  const camp = await una(supa.from("cadena_campanas").select("id, estado").eq("client_id", elegido.id).eq("seco", false).order("creada_en", { ascending: false }).limit(1).maybeSingle(), "cadena_campanas")
  if (!camp) return { ...base, cliente: elegido, campana: null, publicado: true, briefs: [] }
  const campana = { id: String(camp.id), estado: String(camp.estado ?? "") }
  const r = await supa.from("cadena_brief_creativo").select("id, campana_id, version, estado, texto_md, leido, devolucion_texto, motivo, costo_usd, seco, creada_en, actualizada_en, encargo_id").eq("campana_id", campana.id).order("version", { ascending: false }).limit(50)
  if (r.error) {
    if (esTablaInexistente(r.error.message)) return { ...base, cliente: elegido, campana, publicado: false, briefs: [] }
    throw new Error(`cadena_brief_creativo: ${r.error.message}`)
  }
  const briefs = ordenarBriefs(((r.data ?? []) as Fila[]).map(briefDesdeFila))
  const citados = [...new Set(briefs.flatMap((b) => [b.texto_md, b.devolucion_texto].flatMap((t) => [...codigosEntreComillas(t), ...fotosCitadas(t).map((c) => c.slice(0, 8))])))]
  const fotos = Object.keys(await direccionesDeFotos(supa, elegido.id, citados))
  return { ...base, cliente: elegido, campana, publicado: true, briefs: await conQuienesEscribieron(supa, briefs), fotos }
}

/** quién escribió cada versión: los empleados que aportaron en la mesa de su encargo (sin repetir, en el orden en que hablaron, sin «sistema»). Si la lectura falla, se queda sin nombres: no se inventa uno */
export async function conQuienesEscribieron(supa: SupabaseClient, briefs: Brief[]): Promise<Brief[]> {
  const encargos = [...new Set(briefs.map((b) => b.encargo_id).filter((x): x is string => !!x))]
  if (!encargos.length) return briefs.map((b) => ({ ...b, quienes_escribieron: [] }))
  const r = await supa.from("oficina_mesa_aportes").select("encargo_id, de, n").in("encargo_id", encargos).order("n", { ascending: true }).limit(1000)
  const filas = r.error ? [] : ((r.data ?? []) as Fila[])
  const por = new Map<string, string[]>()
  for (const f of filas) {
    const de = String(f.de ?? ""); const e = String(f.encargo_id ?? "")
    if (!esAutorDeLaMesa(de)) continue
    const l = por.get(e) ?? []; if (!l.includes(de)) l.push(de); por.set(e, l)
  }
  return briefs.map((b) => ({ ...b, quienes_escribieron: b.encargo_id ? por.get(b.encargo_id) ?? [] : [] }))
}
