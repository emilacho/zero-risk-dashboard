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

type Fila = Record<string, unknown>
export interface Centro {
  cliente: string | null
  informes: { texto: string; aviso: boolean; total: number }
  brief: { texto: string; aviso: boolean; publicado: boolean }
  gran_idea: { texto: string; aviso: boolean; publicado: boolean }
  equipo: { texto: string; aviso: boolean; trabajando: number }
  leido_en: string
}

export async function leerCentro(supa: SupabaseClient, o: { cliente?: string | null; ahora?: Date } = {}): Promise<Centro> {
  const ahora = o.ahora ?? new Date()
  const [brief, gran, informes, analisisFilas, abiertas] = await Promise.all([
    leerBrief(supa, { cliente: o.cliente, ahora }),
    leerGranIdea(supa, { cliente: o.cliente, ahora }),
    o.cliente ? supa.from("client_reports").select("id, kind, status, period_start, period_end, summary, created_at").eq("client_id", o.cliente).order("period_end", { ascending: false }).limit(200) : Promise.resolve({ data: [] as Fila[], error: null }),
    // los informes de la mesa de análisis viven en el cerebro (fichas vigentes `informe_de_analisis`)
    o.cliente ? supa.from("cerebro_fichas").select("id, titulo, contenido, observado_en, creado_en, provenance_tag").eq("client_id", o.cliente).eq("clase", "informe_de_analisis").is("retirada_en", null).eq("descartada", false).limit(50) : Promise.resolve({ data: [] as Fila[], error: null }),
    supa.from("agent_invocations").select("agent_name").is("ended_at", null).gte("started_at", new Date(ahora.getTime() - MINUTOS_TRABAJANDO * 60_000).toISOString()).limit(200),
  ])
  if (informes.error) throw new Error(`client_reports: ${informes.error.message}`)
  if (analisisFilas.error) throw new Error(`cerebro_fichas: ${analisisFilas.error.message}`)
  if (abiertas.error) throw new Error(`agent_invocations: ${abiertas.error.message}`)
  const xs = ((informes.data ?? []) as Fila[]).map(informeDesdeFila)
  const analisis = ((analisisFilas.data ?? []) as Fila[]).map(analisisDesdeFila)
  const trabajando = new Set(((abiertas.data ?? []) as Fila[]).map((x) => String(x.agent_name))).size
  return {
    cliente: brief.cliente?.id ?? null,
    informes: { ...detalleDeInformes(xs, analisis), total: xs.length + analisis.length },
    brief: { ...detalleDelBrief(brief), publicado: brief.publicado },
    gran_idea: { ...detalleDeGranIdea(gran), publicado: gran.publicado },
    equipo: { texto: trabajando ? `${trabajando} ${trabajando === 1 ? "empleado trabaja" : "empleados trabajan"} ahora mismo` : "Nadie trabaja en este momento · quién está en cada mesa", aviso: false, trabajando },
    leido_en: ahora.toISOString(),
  }
}
