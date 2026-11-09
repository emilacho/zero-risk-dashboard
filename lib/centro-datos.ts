/**
 * EL CENTRO DE CAMPAÑA · la segunda línea de los cuadros nuevos (sprint 6.10): informes, brief, gran idea y equipo, en UNA lectura liviana para el cliente enfocado.
 * Cada dato sale de su fuente real; lo que no está publicado se marca (`publicado: false`) y la pantalla lo dice.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { detalleDelBrief } from "@/lib/brief"
import { leerBrief } from "@/lib/brief-datos"
import { detalleDeGranIdea, leerGranIdea } from "@/lib/gran-idea-datos"
import { analisisDesdeFila, detalleDeInformes, informeDesdeFila } from "@/lib/informes"
import { MINUTOS_TRABAJANDO } from "@/lib/organigrama"
import { quienValido } from "@/lib/manual-lector"
import { versionDelTag } from "@/lib/plan"
import { briefVigente } from "@/lib/brief"
import { leerRiesgos, type Tope } from "@/lib/direccion-riesgos"
import { empleadosActivosDe, leerOrganizacion } from "@/lib/direccion-organizacion"

type Fila = Record<string, unknown>
export interface Centro {
  cliente: string | null
  /** 09-nov (estado y cantidad en cada tarjeta): `esperan` = cuántos esperan tu revisión · `ultimo` = el día del más reciente (ISO) */
  informes: { texto: string; aviso: boolean; total: number; esperan?: number; ultimo?: string | null }
  /** 09-nov · `versiones`, `estado` y `fecha` del brief vigente (null = todavía no hay) */
  brief: { texto: string; aviso: boolean; publicado: boolean; versiones?: number; estado?: string | null; fecha?: string | null }
  /** 09-nov · `versiones` = tarjetas de gran idea; `estado` y `fecha` de la más nueva */
  gran_idea: { texto: string; aviso: boolean; publicado: boolean; versiones?: number; estado?: string | null; fecha?: string | null }
  /** 09-nov · `agentes` = cuántos empleados del Departamento de Marketing están activos (10-nov · antes: todos los del sistema) (null = no se pudo leer) */
  equipo: { texto: string; aviso: boolean; trabajando: number; agentes?: number | null }
  /** 09-nov · los manuales del cliente: cuántas versiones, si el vigente lo aprobó el dueño y su fecha (null = no se pudo leer) */
  manual?: { total: number; aprobado: boolean | null; fecha: string | null } | null
  /** 09-nov · el plan vigente: su estado en la plataforma, su versión y su última fecha (null = no hay plan · undefined = no se pudo leer) */
  plan?: { estado: string; version: number; fecha: string | null } | null
  /** 09-nov · el freno de gasto del cliente (24 h y techo), de la ruta certificada de riesgos · null = no se pudo leer */
  dinero?: { gastado_24h_usd: number | null; techo_usd: number | null } | null
  leido_en: string
}

/** la ruta de riesgos lee toda la plataforma: si tarda más que esto, la tarjeta dice «—» y el resto del Centro no espera */
export const ESPERA_DEL_DINERO_MS = 6000
async function dineroDelCliente(cliente: string | null, leer: typeof leerRiesgos): Promise<Centro["dinero"]> {
  if (!cliente) return null
  let reloj: ReturnType<typeof setTimeout> | undefined
  const tiempo = new Promise<null>((r) => { reloj = setTimeout(() => r(null), ESPERA_DEL_DINERO_MS) })
  const r = await Promise.race([leer().catch(() => null), tiempo]).finally(() => clearTimeout(reloj))
  if (!r || !r.ok) return null
  const t: Tope | undefined = r.datos.topes.find((x) => x.client_id === cliente)
  return t ? { gastado_24h_usd: t.gastado_24h_usd, techo_usd: t.techo_usd } : null
}
/** una lectura de apoyo: si falla, su tarjeta dice «—» (nunca un cero inventado) y el Centro sigue */
async function oNulo<T>(f: () => PromiseLike<T>): Promise<T | undefined> { try { return await f() } catch { return undefined } }

export async function leerCentro(supa: SupabaseClient, o: { cliente?: string | null; ahora?: Date; riesgos?: typeof leerRiesgos } = {}): Promise<Centro> {
  const ahora = o.ahora ?? new Date()
  const cli = o.cliente ?? null
  const [manuales, planes, marketing, dinero] = await Promise.all([
    cli ? oNulo(async () => { const r = await supa.from("client_brand_books").select("version, human_validated, provenance_tag, created_at").eq("client_id", cli).order("version", { ascending: false }).limit(200); if (r.error) throw new Error(r.error.message); return (r.data ?? []) as Fila[] }) : Promise.resolve([] as Fila[]),
    cli ? oNulo(async () => { const r = await supa.from("client_historical_outputs").select("status, provenance_tag, created_at, updated_at").eq("client_id", cli).eq("output_type", "campaign_plan_90d").order("created_at", { ascending: false }).limit(40); if (r.error) throw new Error(r.error.message); return (r.data ?? []) as Fila[] }) : Promise.resolve([] as Fila[]),
    // 10-nov (Lenovo, aprobado por Emilio con ajustes): «Equipo» cuenta SOLO los empleados del Departamento de Marketing que cuentan hoy (la misma regla del
    // organigrama: activos, sin los «por activar» de segunda etapa ni los apagados). Antes contaba los 70 activos de TODO el sistema. Los empleados no se
    // asignan por cliente: el Departamento de Marketing entero trabaja para cada cliente.
    oNulo(async () => new Set(empleadosActivosDe(await leerOrganizacion(supa, { ahora, conInvocaciones: false }), "marketing"))),
    dineroDelCliente(cli, o.riesgos ?? leerRiesgos),
  ])
  const [brief, gran, informes, analisisFilas, abiertas] = await Promise.all([
    leerBrief(supa, { cliente: o.cliente, ahora }),
    leerGranIdea(supa, { cliente: o.cliente, ahora }),
    o.cliente ? supa.from("client_reports").select("id, kind, status, period_start, period_end, summary, created_at").eq("client_id", o.cliente).order("period_end", { ascending: false }).limit(200) : Promise.resolve({ data: [] as Fila[], error: null }),
    // los informes de la mesa de análisis viven en el cerebro (fichas vigentes `informe_de_analisis`)
    o.cliente ? supa.from("cerebro_fichas").select("id, titulo, contenido, observado_en, creado_en, provenance_tag").eq("client_id", o.cliente).eq("clase", "informe_de_analisis").is("retirada_en", null).eq("descartada", false).limit(50) : Promise.resolve({ data: [] as Fila[], error: null }),
    // «trabajando»: corridas abiertas de ESTE cliente (sin cliente elegido: de todos)
    (o.cliente ? supa.from("agent_invocations").select("agent_name, client_id").eq("client_id", o.cliente) : supa.from("agent_invocations").select("agent_name, client_id")).is("ended_at", null).gte("started_at", new Date(ahora.getTime() - MINUTOS_TRABAJANDO * 60_000).toISOString()).limit(200),
  ])
  if (informes.error) throw new Error(`client_reports: ${informes.error.message}`)
  if (analisisFilas.error) throw new Error(`cerebro_fichas: ${analisisFilas.error.message}`)
  if (abiertas.error) throw new Error(`agent_invocations: ${abiertas.error.message}`)
  const xs = ((informes.data ?? []) as Fila[]).map(informeDesdeFila)
  const analisis = ((analisisFilas.data ?? []) as Fila[]).map((f) => analisisDesdeFila(f))
  // solo cuentan los del Departamento de Marketing (si el organigrama no se pudo leer, no se filtra por departamento)
  const trabajando = new Set(((abiertas.data ?? []) as Fila[]).map((x) => String(x.agent_name)).filter((n) => !marketing || marketing.has(n))).size
  const fechas = [...xs.map((x) => x.creado_en), ...analisis.map((a) => a.creado_en)].filter((x): x is string => !!x).sort()
  const bv = briefVigente(brief.briefs)
  const gi = gran.tarjetas[0] ?? null
  const mv = manuales?.[0] ?? null
  const vigente = planes?.find((p) => p.status !== "rejected" && versionDelTag(p.provenance_tag).vigente) ?? null
  return {
    cliente: brief.cliente?.id ?? null,
    informes: { ...detalleDeInformes(xs, analisis), total: xs.length + analisis.length, esperan: xs.filter((x) => x.estado === "awaiting_review").length, ultimo: fechas[fechas.length - 1] ?? null },
    brief: { ...detalleDelBrief(brief), publicado: brief.publicado, versiones: brief.briefs.length, estado: bv?.estado ?? null, fecha: bv ? bv.actualizada_en ?? bv.creada_en : null },
    gran_idea: { ...detalleDeGranIdea(gran), publicado: gran.publicado, versiones: gran.tarjetas.length, estado: gi?.estado ?? null, fecha: gi?.creada || null },
    equipo: { texto: trabajando ? `${trabajando} ${trabajando === 1 ? "empleado trabaja" : "empleados trabajan"} ahora mismo` : "Nadie trabaja en este momento · quién está en cada mesa", aviso: false, trabajando, agentes: marketing ? marketing.size : null },
    manual: manuales === undefined ? null : { total: manuales.length, aprobado: mv ? quienValido(mv) === "dueno" : null, fecha: mv?.created_at ? String(mv.created_at) : null },
    plan: planes === undefined ? undefined : vigente ? { estado: String(vigente.status ?? ""), version: versionDelTag(vigente.provenance_tag).version, fecha: vigente.updated_at ? String(vigente.updated_at) : vigente.created_at ? String(vigente.created_at) : null } : null,
    dinero,
    leido_en: ahora.toISOString(),
  }
}
