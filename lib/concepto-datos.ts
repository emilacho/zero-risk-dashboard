/**
 * LA TARJETA «GRAN IDEA» · lectura (servidor) · T4 del nuevo orden de la cadena (31-oct · CC#1).
 * La fila de `hitl_queue` con `type = concepto_review` (la abre la cadena al cerrar la mesa de concepto) apunta a `cadena_conceptos` (campaña + versión):
 * de ahí salen la gran idea, los capítulos, el banco de ideas y los caminos descartados (`leido`, lo que leyó la cadena del texto de la mesa); el brief creativo
 * (`cadena_brief_creativo`) se muestra en solo lectura (el cliente firma también el brief). La base entra por parámetro para probarlo sin tocar nada;
 * `detalleDelConcepto` es pura (filas → lo que la tarjeta enseña).
 */
import type { SupabaseClient } from "@supabase/supabase-js"

/** el `type` de la tarjeta en la bandeja (la plataforma: `TIPO_TARJETA_DE_CONCEPTO`) */
export const TIPO_CONCEPTO = "concepto_review"
/** vueltas de cambios por campaña (brief + concepto sumados); lo hace cumplir la plataforma (`CAP_DE_VUELTAS_DE_CAMBIOS`), aquí solo se muestra */
export const VUELTAS_MAXIMAS_DE_CAMBIOS = 2

export type EstadoDelConcepto = "pendiente" | "aprobada" | "con_cambios" | "rechazada" | "otro"

export interface IdeaDelBanco { id: string; capitulo: string | null; red: string; formato: string; idea: string; mensaje: string; gancho: string; protagonista: string; serie: string | null; foto: string | null }
export interface SerieDelCapitulo { id: string; nombre: string; que_cuenta: string; redes: string[] }
export interface CapituloDelConcepto { clave: string; fase: string | null; nombre: string; que_cuenta: string; objetivo_cita: string; como_se_ve: string; series: SerieDelCapitulo[] }
export interface BancoParcial { red: string; capitulo: string; faltan: number; esperadas: number; hay: number }
export interface ResumenDelBanco { total: number; por_red: Record<string, number>; por_capitulo: Record<string, number>; ejemplos: Record<string, Array<{ id: string; idea: string; mensaje: string; gancho: string }>>; parcial: BancoParcial[] }

export interface DetalleDelConcepto {
  hitl_id: string
  status: string
  estado: EstadoDelConcepto
  titulo: string
  cliente: string | null
  cliente_id: string | null
  creada: string
  campana_id: string | null
  version: number | null
  concepto_id: string | null
  /** la cadena corrió en seco (ensayo): la tarjeta lo dice; aprobarla igual prueba el camino */
  seco: boolean
  costo_usd: number | null
  vueltas_restantes: number | null
  avisos: string[]
  gran_idea: { nombre: string; frase: string } | null
  por_que_funciona: string
  como_se_ve: string
  como_suena: string
  fotos_citadas: string[]
  capitulos: CapituloDelConcepto[]
  banco: IdeaDelBanco[]
  resumen: ResumenDelBanco
  caminos_descartados: string
  /** «Devolución del brief» de la dirección creativa, si la hubo */
  devolucion_del_brief: string | null
  brief: { version: number; estado: string; texto_md: string } | null
  /** lo que ya se decidió (si se decidió) */
  aprobacion: string | null
  nota_de_emilio: string | null
  apunta_a: string | null
  decidido_en: string | null
  /** si la cadena no tiene la fila del concepto (o no se pudo leer), la tarjeta lo dice en vez de inventar */
  sin_concepto: string | null
}

const texto = (x: unknown): string => (typeof x === "string" ? x : "")
const numero = (x: unknown): number | null => (x == null || x === "" || Number.isNaN(Number(x)) ? null : Number(x))
const lista = <T>(x: unknown, f: (y: Record<string, unknown>) => T): T[] => (Array.isArray(x) ? x.filter((y) => y && typeof y === "object").map((y) => f(y as Record<string, unknown>)) : [])

/** el estado de la tarjeta: la cadena cierra «cambios» como `rejected` con `decision.accion = pedir_cambios` (no es un rechazo) */
export function estadoDelConcepto(status: string, decision: unknown): EstadoDelConcepto {
  if (status === "pending") return "pendiente"
  if (status === "approved") return "aprobada"
  if (status === "rejected") return (decision as { accion?: unknown } | null)?.accion === "pedir_cambios" ? "con_cambios" : "rechazada"
  return "otro"
}

/** el resumen del banco (M1 de CC3): conteo por red y por capítulo + hasta 3 ejemplos por capítulo; el mismo cálculo que hace la cadena */
export function resumenDelBanco(banco: IdeaDelBanco[], parcial: BancoParcial[], ejemplosPorCapitulo = 3): ResumenDelBanco {
  const por_red: Record<string, number> = {}
  const por_capitulo: Record<string, number> = {}
  const ejemplos: ResumenDelBanco["ejemplos"] = {}
  for (const i of banco) {
    por_red[i.red] = (por_red[i.red] ?? 0) + 1
    const k = i.capitulo ?? "?"
    por_capitulo[k] = (por_capitulo[k] ?? 0) + 1
    ;(ejemplos[k] ??= [])
    if (ejemplos[k].length < ejemplosPorCapitulo) ejemplos[k].push({ id: i.id, idea: i.idea, mensaje: i.mensaje, gancho: i.gancho })
  }
  return { total: banco.length, por_red, por_capitulo, ejemplos, parcial }
}

export interface FilasDelConcepto {
  hitl: Record<string, unknown>
  concepto: Record<string, unknown> | null
  brief: Record<string, unknown> | null
  cliente: string | null
}

/** PURA · de las filas (bandeja + concepto + brief) a lo que la tarjeta enseña; lo que falta se declara, no se inventa */
export function detalleDelConcepto(f: FilasDelConcepto): DetalleDelConcepto {
  const meta = (f.hitl.metadata ?? {}) as Record<string, unknown>
  const leido = ((f.concepto?.leido ?? null) as Record<string, unknown> | null) ?? null
  const banco = lista<IdeaDelBanco>(leido?.banco, (i) => ({
    id: texto(i.id), capitulo: typeof i.capitulo === "string" ? i.capitulo : null, red: texto(i.red), formato: texto(i.formato), idea: texto(i.idea), mensaje: texto(i.mensaje), gancho: texto(i.gancho), protagonista: texto(i.protagonista),
    serie: typeof i.serie === "string" ? i.serie : null, foto: typeof i.foto === "string" ? i.foto : null,
  }))
  const parcial = lista<BancoParcial>(leido?.banco_parcial, (p) => ({ red: texto(p.red), capitulo: texto(p.capitulo), faltan: Number(p.faltan ?? 0), esperadas: Number(p.esperadas ?? 0), hay: Number(p.hay ?? 0) }))
  const granIdea = leido?.gran_idea as { nombre?: unknown; frase?: unknown } | null | undefined
  const version = numero(f.concepto?.version ?? meta.version)
  return {
    hitl_id: String(f.hitl.id),
    status: String(f.hitl.status ?? ""),
    estado: estadoDelConcepto(String(f.hitl.status ?? ""), f.hitl.decision),
    titulo: texto(f.hitl.title) || "Gran idea",
    cliente: f.cliente,
    cliente_id: typeof f.hitl.client_id === "string" ? f.hitl.client_id : null,
    creada: String(f.hitl.created_at ?? ""),
    campana_id: typeof meta.campana_id === "string" ? meta.campana_id : (typeof f.concepto?.campana_id === "string" ? f.concepto.campana_id : null),
    version,
    concepto_id: typeof meta.concepto_id === "string" ? meta.concepto_id : null,
    seco: f.concepto?.seco === true || meta.seco === true,
    costo_usd: numero(f.concepto?.costo_usd ?? meta.costo_usd),
    vueltas_restantes: numero(meta.vueltas_restantes),
    avisos: [...new Set([...(Array.isArray(meta.avisos) ? meta.avisos.map(String) : []), ...(Array.isArray(leido?.avisos) ? (leido!.avisos as unknown[]).map(String) : [])])],
    gran_idea: granIdea && typeof granIdea.nombre === "string" && granIdea.nombre ? { nombre: granIdea.nombre, frase: texto(granIdea.frase) } : null,
    por_que_funciona: texto(leido?.por_que_funciona),
    como_se_ve: texto(leido?.como_se_ve),
    como_suena: texto(leido?.como_suena),
    fotos_citadas: Array.isArray(leido?.fotos_citadas) ? (leido!.fotos_citadas as unknown[]).map(String) : [],
    capitulos: lista<CapituloDelConcepto>(leido?.capitulos, (c) => ({
      clave: texto(c.clave), fase: typeof c.fase === "string" ? c.fase : null, nombre: texto(c.nombre), que_cuenta: texto(c.que_cuenta), objetivo_cita: texto(c.objetivo_cita), como_se_ve: texto(c.como_se_ve),
      series: lista<SerieDelCapitulo>(c.series, (s) => ({ id: texto(s.id), nombre: texto(s.nombre), que_cuenta: texto(s.que_cuenta), redes: Array.isArray(s.redes) ? s.redes.map(String) : [] })),
    })),
    banco,
    resumen: resumenDelBanco(banco, parcial),
    caminos_descartados: texto(leido?.caminos_descartados),
    devolucion_del_brief: typeof leido?.devolucion_del_brief === "string" && leido.devolucion_del_brief ? leido.devolucion_del_brief : null,
    brief: f.brief && typeof f.brief.texto_md === "string" ? { version: Number(f.brief.version ?? 0), estado: texto(f.brief.estado), texto_md: f.brief.texto_md } : null,
    aprobacion: typeof f.concepto?.aprobacion === "string" ? f.concepto.aprobacion : null,
    nota_de_emilio: typeof f.concepto?.nota_de_emilio === "string" ? f.concepto.nota_de_emilio : null,
    apunta_a: typeof f.concepto?.apunta_a === "string" ? f.concepto.apunta_a : null,
    decidido_en: typeof f.concepto?.decidido_en === "string" ? f.concepto.decidido_en : null,
    sin_concepto: f.concepto ? (leido ? null : "la cadena guardó el concepto sin lectura (leido vacío): se muestra solo la bandeja") : (version == null ? "la tarjeta no dice a qué campaña ni versión apunta" : `la cadena no tiene la versión ${version} del concepto de esta campaña (¿migración 202610312001 sin aplicar?)`),
  }
}

/** la fila de la bandeja y, si es una tarjeta de concepto, lo que la cadena guardó; `null` si la fila no existe o no es una tarjeta de concepto */
export async function cargarConcepto(supa: SupabaseClient, hitlId: string): Promise<DetalleDelConcepto | null> {
  const r = await supa.from("hitl_queue").select("*").eq("id", hitlId).maybeSingle()
  if (r.error) throw new Error(`no pude leer la tarjeta: ${r.error.message}`)
  const hitl = r.data as Record<string, unknown> | null
  if (!hitl || hitl.type !== TIPO_CONCEPTO) return null
  const meta = (hitl.metadata ?? {}) as Record<string, unknown>
  const campana = typeof meta.campana_id === "string" ? meta.campana_id : null
  const version = numero(meta.version)

  let cliente: string | null = null
  if (typeof hitl.client_id === "string") cliente = ((await supa.from("clients").select("name").eq("id", hitl.client_id).maybeSingle()).data as { name?: string } | null)?.name ?? null

  let concepto: Record<string, unknown> | null = null
  let brief: Record<string, unknown> | null = null
  if (campana && version != null) {
    const c = await supa.from("cadena_conceptos").select("campana_id, version, estado, aprobacion, leido, costo_usd, nota_de_emilio, apunta_a, decidido_en, seco").eq("campana_id", campana).eq("version", version).maybeSingle()
    concepto = (c.error ? null : (c.data as Record<string, unknown> | null)) ?? null
    const briefVersion = numero(meta.brief_version)
    let b = supa.from("cadena_brief_creativo").select("version, estado, texto_md").eq("campana_id", campana)
    b = briefVersion != null ? b.eq("version", briefVersion) : b.eq("estado", "validada")
    const rb = await b.order("version", { ascending: false }).limit(1)
    brief = (rb.error ? null : ((rb.data ?? [])[0] as Record<string, unknown> | undefined)) ?? null
  }
  return detalleDelConcepto({ hitl, concepto, brief, cliente })
}
