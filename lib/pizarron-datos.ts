/**
 * PIZARRÓN DE PIEZAS · lectura (servidor, SOLO LECTURA). Un error de la base lanza; nunca se lee como «0» ni como «sin campaña».
 * Fuentes: `cadena_campanas` (la campaña viva del cliente) · `cadena_estrategias` (las fases) · `cadena_calendario_filas` (las publicaciones, última versión del calendario)
 * · `oficina_encargos` (qué publicación está en la oficina: `sala_ref.fila`) · `jefatura_revisiones` (la revisión del encargo) · `hitl_queue` (la bandeja de Emilio) · `cadena_esperas` (por qué espera la campaña).
 * La «gran idea» todavía NO existe en ninguna tabla (la mesa de concepto está diseñada, no construida · DISENO-CC1 31-oct): se dice tal cual.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { fasesDelPlan, type FasesDelPlan } from "@/lib/clientes"
import { clientesParaElegir } from "@/lib/clientes-datos"
import { estadoDeLaPieza } from "@/lib/piezas"
import { versionDelTag } from "@/lib/plan"
import { estadoDelTablero, faseActiva, hoyEnEcuador, semanasDelTablero, totalesDelTablero, type EncargoDelTablero, type FaseActiva, type FilaDelTablero, type PiezaDelTablero, type RevisionDelTablero, type SemanaDelTablero, type EstadoDelTablero } from "@/lib/pizarron"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
async function una(q: R, que: string): Promise<Fila | null> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? null) as Fila | null }

const textos = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).filter(Boolean) : typeof v === "string" && v ? [v] : [])

export interface Pizarron {
  clientes: Array<{ id: string; nombre: string; con_campana: boolean }>
  cliente: { id: string; nombre: string } | null
  campana: null | { id: string; estado: string; desde: string | null; hasta: string | null; version_calendario: number | null; version_estrategia: number | null; /** el calendario se armó con un plan que ya no es el vigente */ del_plan_anterior?: boolean }
  fases: FasesDelPlan[]
  fase_activa: FaseActiva
  /** no existe en ninguna tabla todavía; se dice así */
  gran_idea: { texto: string | null; nota: string }
  esperas: Array<{ motivo: string; vence_en: string | null }>
  filas: FilaDelTablero[]
  semanas: SemanaDelTablero[]
  totales: Partial<Record<EstadoDelTablero, number>>
  hoy: string
  leido_en: string
}

const ESTADOS_VIVOS = ["abierta", "estrategia", "calendario", "activa", "pausada", "necesita_humano"]

export async function leerPizarron(supa: SupabaseClient, o: { cliente?: string | null; ahora?: Date } = {}): Promise<Pizarron> {
  const ahora = o.ahora ?? new Date()
  const hoy = hoyEnEcuador(ahora)
  const [elegibles, campanas] = await Promise.all([
    clientesParaElegir(supa),
    filas(supa.from("cadena_campanas").select("id, client_id, estado, seco, creada_en").eq("seco", false).order("creada_en", { ascending: false }).limit(200), "cadena_campanas"),
  ])
  const conCampana = new Set(campanas.filter((c) => ESTADOS_VIVOS.includes(String(c.estado))).map((c) => String(c.client_id)))
  const clientes = elegibles.map((c) => ({ ...c, con_campana: conCampana.has(c.id) }))
  const elegido = (o.cliente && clientes.find((c) => c.id === o.cliente)) || clientes.find((c) => c.con_campana) || clientes[0] || null
  const vacio = (cliente: Pizarron["cliente"]): Pizarron => ({ clientes, cliente, campana: null, fases: [], fase_activa: faseActiva([], null, hoy), gran_idea: GRAN_IDEA_SIN_TABLA, esperas: [], filas: [], semanas: [], totales: {}, hoy, leido_en: ahora.toISOString() })
  if (!elegido) return vacio(null)
  const cliente = { id: elegido.id, nombre: elegido.nombre }

  const camp = await una(supa.from("cadena_campanas").select("id, plan_id, estado, fecha_inicio, fecha_fin").eq("client_id", cliente.id).eq("seco", false).order("creada_en", { ascending: false }).limit(1).maybeSingle(), "cadena_campanas")
  if (!camp) return vacio(cliente)
  const campId = String(camp.id)

  // el plan vigente del cliente (el último que no está rechazado ni reemplazado): si la campaña apunta a otro, su calendario es del plan anterior
  const planes = await filas(supa.from("client_historical_outputs").select("id, status, provenance_tag").eq("client_id", cliente.id).eq("output_type", "campaign_plan_90d").order("created_at", { ascending: false }).limit(40), "client_historical_outputs")
  const vigente = planes.find((p) => p.status !== "rejected" && versionDelTag(p.provenance_tag).vigente)
  const delPlanAnterior = !!(vigente && camp.plan_id && String(vigente.id) !== String(camp.plan_id))
  const [est, ultimaVersion, esperas, encargos] = await Promise.all([
    una(supa.from("cadena_estrategias").select("version, contenido").eq("campana_id", campId).eq("seco", false).order("version", { ascending: false }).limit(1).maybeSingle(), "cadena_estrategias"),
    una(supa.from("cadena_calendario_filas").select("calendario_version").eq("campana_id", campId).eq("seco", false).order("calendario_version", { ascending: false }).limit(1).maybeSingle(), "cadena_calendario_filas"),
    filas(supa.from("cadena_esperas").select("motivo, vence_en").eq("campana_id", campId).eq("estado", "viva").eq("seco", false).order("vence_en", { ascending: true }).limit(20), "cadena_esperas"),
    filas(supa.from("oficina_encargos").select("id, brief_id, familia, estado, hitl_queue_id, sala_ref, gasto_usd, creado_en").eq("client_id", cliente.id).eq("dry_run", false).order("creado_en", { ascending: false }).limit(500), "oficina_encargos"),
  ])
  const version = ultimaVersion ? Number(ultimaVersion.calendario_version) : null
  const crudas = version == null ? [] : await filas(
    supa.from("cadena_calendario_filas").select("id, tanda, semana, fecha, hora, red, formato, pilar, tema, sede, pieza_fija, pendientes, estado, avisos, brief_ref")
      .eq("campana_id", campId).eq("seco", false).eq("calendario_version", version).order("fecha", { ascending: true }).limit(600),
    "cadena_calendario_filas",
  )

  // el encargo más reciente de cada publicación (la oficina guarda la fila en `sala_ref.fila`: id + fecha)
  const encargoDe = new Map<string, Fila>()
  for (const e of encargos) {
    const fila = ((e.sala_ref as Record<string, unknown> | null)?.fila ?? null) as Record<string, unknown> | null
    if (!fila?.id) continue
    const k = `${String(fila.id)}|${String(fila.fecha ?? "")}`
    if (!encargoDe.has(k)) encargoDe.set(k, e) // vienen de más nuevo a más viejo
  }
  const usados = [...encargoDe.values()]
  const idsEncargo = usados.map((e) => String(e.id))
  const idsHitl = usados.map((e) => e.hitl_queue_id).filter(Boolean).map(String)
  const [revisiones, bandeja] = await Promise.all([
    idsEncargo.length ? filas(supa.from("jefatura_revisiones").select("artifact_id, estado, resultado, creado_en").eq("artifact_type", "pieza").in("artifact_id", idsEncargo).order("creado_en", { ascending: false }).limit(1000), "jefatura_revisiones") : Promise.resolve([] as Fila[]),
    idsHitl.length ? filas(supa.from("hitl_queue").select("id, status, decision, expires_at, created_at").in("id", idsHitl).limit(1000), "hitl_queue") : Promise.resolve([] as Fila[]),
  ])
  const revisionDe = new Map<string, Fila>()
  for (const r of revisiones) { const k = String(r.artifact_id); if (!revisionDe.has(k)) revisionDe.set(k, r) }
  const piezaDe = new Map<string, Fila>(bandeja.map((b) => [String(b.id), b]))

  const lista: FilaDelTablero[] = crudas.map((x) => {
    const id = String(x.id), fecha = String(x.fecha ?? "")
    const e = encargoDe.get(`${id}|${fecha}`) ?? null
    const encargo: EncargoDelTablero | null = e ? { id: String(e.id), familia: String(e.familia ?? ""), estado: String(e.estado ?? ""), gasto_usd: Number(e.gasto_usd ?? 0), creado_en: String(e.creado_en ?? "") } : null
    const r = e ? revisionDe.get(String(e.id)) ?? null : null
    const jefatura: RevisionDelTablero | null = r ? { estado: String(r.estado ?? ""), resultado: r.resultado == null ? null : String(r.resultado) } : null
    const p = e?.hitl_queue_id ? piezaDe.get(String(e.hitl_queue_id)) ?? null : null
    const pieza: PiezaDelTablero | null = p ? { id: String(p.id), status: String(p.status ?? ""), estado: estadoDeLaPieza(String(p.status ?? ""), p.decision), expires_at: p.expires_at ? String(p.expires_at) : null, created_at: String(p.created_at ?? "") } : null
    const { tablero, motivo } = estadoDelTablero({ estado_fila: String(x.estado ?? ""), encargo, jefatura, pieza: p ? { status: String(p.status ?? ""), decision: p.decision } : null })
    return {
      id, fecha, hora: x.hora ? String(x.hora).slice(0, 5) : null, red: String(x.red ?? ""), formato: String(x.formato ?? ""), pilar: x.pilar ? String(x.pilar) : null, tema: String(x.tema ?? ""), sede: x.sede ? String(x.sede) : null,
      pieza_fija: x.pieza_fija === true, tanda: x.tanda == null ? null : Number(x.tanda), semana: x.semana == null ? null : Number(x.semana), estado_fila: String(x.estado ?? ""),
      avisos: textos(x.avisos), pendientes: textos(x.pendientes), encargo, jefatura, pieza, tablero, motivo,
    }
  })
  const fases = fasesDelPlan(est?.contenido)
  return {
    clientes, cliente,
    campana: { id: campId, estado: String(camp.estado ?? ""), desde: camp.fecha_inicio ? String(camp.fecha_inicio) : null, hasta: camp.fecha_fin ? String(camp.fecha_fin) : null, version_calendario: version, version_estrategia: est ? Number(est.version) : null, del_plan_anterior: delPlanAnterior },
    fases, fase_activa: faseActiva(fases, camp.fecha_inicio ? String(camp.fecha_inicio) : null, hoy),
    gran_idea: GRAN_IDEA_SIN_TABLA,
    esperas: esperas.map((e) => ({ motivo: String(e.motivo ?? ""), vence_en: e.vence_en ? String(e.vence_en) : null })),
    filas: lista, semanas: semanasDelTablero(lista), totales: totalesDelTablero(lista), hoy, leido_en: ahora.toISOString(),
  }
}

export const GRAN_IDEA_SIN_TABLA = { texto: null, nota: "Todavía no hay gran idea: la mesa de concepto que la escribe está diseñada (31-oct) pero no construida." } as const
