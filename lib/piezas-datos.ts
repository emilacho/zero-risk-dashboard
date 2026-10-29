/**
 * LA VENTANA DE PIEZAS · lectura (servidor): la lista de la bandeja y el detalle de una pieza (manifiesto, texto por lámina, libro de la mesa, jefatura, gasto).
 * La base y la red entran por parámetro para probarlo sin tocar nada.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  TIPO_PIEZA,
  avisosDeLaPieza,
  direccionDeLaLamina,
  estadoDeLaPieza,
  exigeCasilla,
  gastoDeLaFila,
  laminasDeLaPieza,
  type ArchivoDelManifiesto,
  type Aviso,
  type EstadoPieza,
  type Lamina,
  type SlideDeLaOficina,
} from "@/lib/piezas"

export const COLUMNAS_DE_LA_LISTA = "id, status, client_id, created_at, title, type, agent_name, output_preview, metadata"

export interface FilaDeLaLista {
  id: string
  estado: EstadoPieza
  status: string
  tipo: string
  es_pieza: boolean
  titulo: string
  cliente_id: string | null
  cliente: string | null
  creada: string
  gasto_usd: number | null
  incompleta: boolean
  desacuerdos: number
  tiene_dibujo: boolean
}

export type FiltroDeEstado = "pendiente" | "todas"

export async function listarPiezas(supa: SupabaseClient, filtro: { estado?: FiltroDeEstado; limite?: number } = {}): Promise<FilaDeLaLista[]> {
  let q = supa.from("hitl_queue").select(COLUMNAS_DE_LA_LISTA).order("created_at", { ascending: false }).limit(filtro.limite ?? 60)
  if ((filtro.estado ?? "pendiente") === "pendiente") q = q.eq("status", "pending")
  const r = await q
  if (r.error) throw new Error(`no pude leer la bandeja: ${r.error.message}`)
  const filas = (r.data ?? []) as Array<Record<string, unknown>>
  const ids = [...new Set(filas.map((f) => f.client_id).filter((x): x is string => typeof x === "string"))]
  const nombres = new Map<string, string>()
  if (ids.length > 0) {
    const c = await supa.from("clients").select("id, name").in("id", ids)
    for (const x of (c.data ?? []) as Array<{ id: string; name: string }>) nombres.set(x.id, x.name)
  }
  return filas.map((f) => {
    const meta = (f.metadata ?? {}) as Record<string, unknown>
    const desac = Array.isArray(meta.desacuerdos) ? meta.desacuerdos.length : 0
    return {
      id: String(f.id),
      estado: estadoDeLaPieza(String(f.status)),
      status: String(f.status),
      tipo: String(f.type ?? ""),
      es_pieza: f.type === TIPO_PIEZA,
      titulo: String(f.title ?? f.output_preview ?? "(sin título)"),
      cliente_id: (f.client_id as string | null) ?? null,
      cliente: f.client_id ? nombres.get(String(f.client_id)) ?? null : null,
      creada: String(f.created_at),
      gasto_usd: gastoDeLaFila(meta),
      incompleta: meta.revision_incompleta === true,
      desacuerdos: desac,
      tiene_dibujo: typeof meta.enlace_entrega === "object" && meta.enlace_entrega !== null && "manifest.json" in (meta.enlace_entrega as object),
    }
  })
}

export interface AporteDelLibro { n: number; de: string; para: string | null; tipo: string; texto: string; costo_usd: number | null }

export interface DetalleDeLaPieza {
  id: string
  estado: EstadoPieza
  status: string
  tipo: string
  es_pieza: boolean
  titulo: string
  cliente: string | null
  creada: string
  familia: string | null
  brief_id: string | null
  encargo_id: string | null
  gasto_usd: number | null
  laminas: Lamina[]
  pie: string | null
  avisos: Aviso[]
  exige_casilla: boolean
  jefatura: { resultado: string | null; desacuerdos: string[]; opinion_externa: string | null; revision_id: string | null }
  aportes: AporteDelLibro[]
  version: number | null
  resumen_de_la_bandeja: string | null
}

export interface DepsDeLectura { fetchImpl?: typeof fetch; urlBase?: string }

/** el manifiesto vive en el almacén de la oficina; solo se baja si la dirección cuelga de él */
export async function leerManifiesto(enlace: Record<string, unknown> | null | undefined, deps: DepsDeLectura = {}): Promise<ArchivoDelManifiesto[]> {
  const url = typeof enlace?.["manifest.json"] === "string" ? (enlace["manifest.json"] as string) : null
  const base = deps.urlBase ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  if (!url || !direccionDeLaLamina(url, "x.png", base)) return []
  try {
    const r = await (deps.fetchImpl ?? fetch)(url, { cache: "no-store" })
    if (!r.ok) return []
    const j = (await r.json()) as { archivos?: ArchivoDelManifiesto[] }
    return Array.isArray(j.archivos) ? j.archivos : []
  } catch {
    return []
  }
}

export async function cargarPieza(supa: SupabaseClient, id: string, deps: DepsDeLectura = {}): Promise<DetalleDeLaPieza | null> {
  const r = await supa.from("hitl_queue").select("*").eq("id", id).maybeSingle()
  if (r.error) throw new Error(`no pude leer la pieza: ${r.error.message}`)
  const f = r.data as Record<string, unknown> | null
  if (!f) return null
  const meta = (f.metadata ?? {}) as Record<string, unknown>
  const encargoId = typeof meta.oficina_encargo_id === "string" ? meta.oficina_encargo_id : null

  let cliente: string | null = null
  if (f.client_id) cliente = ((await supa.from("clients").select("name").eq("id", f.client_id as string).maybeSingle()).data as { name?: string } | null)?.name ?? null

  const archivos = await leerManifiesto(meta.enlace_entrega as Record<string, unknown> | undefined, deps)

  let slides: SlideDeLaOficina[] = []
  let version: number | null = null
  let aportes: AporteDelLibro[] = []
  if (encargoId) {
    const a = await supa.from("oficina_artefactos").select("version, contenido").eq("encargo_id", encargoId).eq("tipo", "laminas_armadas").order("version", { ascending: false }).limit(1)
    const c = ((a.data ?? [])[0] ?? null) as { version?: number; contenido?: { slides?: SlideDeLaOficina[] } } | null
    slides = c?.contenido?.slides ?? []
    version = c?.version ?? null
    const l = await supa.from("oficina_mesa_aportes").select("n, de, para, tipo, texto, costo_usd").eq("encargo_id", encargoId).order("n", { ascending: true }).limit(80)
    aportes = ((l.data ?? []) as Array<Record<string, unknown>>).map((x) => ({ n: Number(x.n), de: String(x.de), para: (x.para as string | null) ?? null, tipo: String(x.tipo), texto: String(x.texto ?? ""), costo_usd: x.costo_usd == null ? null : Number(x.costo_usd) }))
  }
  const laminas = laminasDeLaPieza(archivos, slides)
  const opinion = (meta.opinion_externa as { texto?: string } | null | undefined)?.texto ?? null
  return {
    id: String(f.id),
    estado: estadoDeLaPieza(String(f.status)),
    status: String(f.status),
    tipo: String(f.type ?? ""),
    es_pieza: f.type === TIPO_PIEZA,
    titulo: String(f.title ?? "(sin título)"),
    cliente,
    creada: String(f.created_at),
    familia: (meta.familia as string | undefined) ?? null,
    brief_id: (meta.brief_id as string | undefined) ?? null,
    encargo_id: encargoId,
    gasto_usd: gastoDeLaFila(meta),
    laminas,
    pie: await leerPie(meta.enlace_entrega as Record<string, unknown> | undefined, deps),
    avisos: avisosDeLaPieza({ output_preview: (f.output_preview as string | null) ?? null, metadata: meta }, laminas),
    exige_casilla: exigeCasilla({ metadata: meta }),
    jefatura: {
      resultado: (meta.jefatura_resultado as string | undefined) ?? null,
      desacuerdos: Array.isArray(meta.desacuerdos) ? meta.desacuerdos.map(String) : [],
      opinion_externa: opinion,
      revision_id: (meta.jefatura_revision_id as string | undefined) ?? null,
    },
    aportes,
    version,
    resumen_de_la_bandeja: (f.output_preview as string | null) ?? null,
  }
}

/** el pie de la publicación es el `_texto.txt` de la entrega */
async function leerPie(enlace: Record<string, unknown> | undefined, deps: DepsDeLectura): Promise<string | null> {
  const base = deps.urlBase ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const nombre = enlace ? Object.keys(enlace).find((k) => /_texto\.txt$/.test(k)) : undefined
  const url = nombre && typeof enlace?.[nombre] === "string" ? (enlace[nombre] as string) : null
  if (!url || !direccionDeLaLamina(url, "x.png", base)) return null
  try {
    const r = await (deps.fetchImpl ?? fetch)(url, { cache: "no-store" })
    return r.ok ? (await r.text()).slice(0, 4000) : null
  } catch {
    return null
  }
}

/** el archivo de la lámina `n` (1…) de una pieza, ya validado contra el almacén; null si no hay */
export async function direccionDeLaLaminaDeUnaPieza(supa: SupabaseClient, id: string, n: number, deps: DepsDeLectura = {}): Promise<string | null> {
  const r = await supa.from("hitl_queue").select("metadata").eq("id", id).maybeSingle()
  const meta = ((r.data as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}) as Record<string, unknown>
  const enlace = meta.enlace_entrega as Record<string, unknown> | undefined
  const archivos = (await leerManifiesto(enlace, deps)).filter((a) => /\.(png|jpe?g|webp)$/i.test(a.nombre))
  const a = archivos[n - 1]
  const manifiesto = typeof enlace?.["manifest.json"] === "string" ? (enlace["manifest.json"] as string) : null
  if (!a) return null
  return direccionDeLaLamina(manifiesto, a.nombre, deps.urlBase ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)
}
