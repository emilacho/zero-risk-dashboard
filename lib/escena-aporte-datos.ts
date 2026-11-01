/**
 * S4 · EL APORTE COMPLETO de un participante de la sala (servidor, SOLO LECTURA · CC6). Se pide al tocar su avatar.
 * Orden de fuentes, de la más completa a la más corta:
 * 1. informe de la mesa de análisis → `cerebro_fichas.contenido` (el informe entero, si entró al cerebro);
 * 2. resultado de quien dirige → `client_historical_outputs.content_text` (p. ej. el plan entero) del mismo cliente, guardado a ±3 min de su fila y que
 *    empieza igual que lo que entregó (si no, no es su documento);
 * 3. si no, `agent_invocations.output_summary` (la base lo guarda recortado a 2.000 caracteres: se dice).
 * Un error de la base lanza; nunca se lee como «sin aporte».
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { nombreCanonico } from "@/lib/organigrama"
import { LARGO_GUARDADO, pasoDeAnalisis } from "@/lib/escena-sala"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null)

/** dos textos son el mismo documento si sus primeros 160 caracteres (sin espacios de más) coinciden */
export const mismoComienzo = (a: string | null, b: string | null): boolean => { const n = (x: string | null) => (x ?? "").replace(/\s+/g, " ").trim().slice(0, 160); return !!n(a) && n(a) === n(b) }
export interface AporteCompleto { agente: string; corrida: string; texto: string | null; titulo: string | null; fuente: string; recortado: boolean; creado_en: string | null }
/** los minutos alrededor de la fila del participante en que se busca el texto entero */
export const MINUTOS_ALREDEDOR = 3

export async function leerAporteCompleto(supa: SupabaseClient, corrida: string, agente: string): Promise<AporteCompleto | null> {
  const invs = await filas(supa.from("agent_invocations").select("agent_name, client_id, created_at, output_summary").eq("workflow_execution_id", corrida).order("created_at", { ascending: false }).limit(20), "agent_invocations")
  const inv = invs.find((i) => nombreCanonico(i.agent_name) === nombreCanonico(agente))
  if (!inv) return null
  const cliente = s(inv.client_id), creado = s(inv.created_at)
  const t = creado ? Date.parse(creado) : NaN
  const ventana = Number.isFinite(t) ? [new Date(t - MINUTOS_ALREDEDOR * 60_000).toISOString(), new Date(t + MINUTOS_ALREDEDOR * 60_000).toISOString()] : null
  const paso = pasoDeAnalisis(corrida)
  if (paso && cliente && ventana) {
    const f = await filas(supa.from("cerebro_fichas").select("ref, titulo, contenido, creado_en").eq("client_id", cliente).like("ref", `informe:${paso}:%`).gte("creado_en", ventana[0]).lte("creado_en", ventana[1]).order("creado_en", { ascending: false }).limit(1), "cerebro_fichas")
    if (f[0] && s(f[0].contenido)) return { agente, corrida, texto: s(f[0].contenido), titulo: s(f[0].titulo), fuente: `cerebro_fichas · ${String(f[0].ref)}`, recortado: false, creado_en: s(f[0].creado_en) }
  }
  if (!paso && !corrida.includes(":") && cliente && ventana) {
    const o = await filas(supa.from("client_historical_outputs").select("title, output_type, content_text, created_at").eq("client_id", cliente).gte("created_at", ventana[0]).lte("created_at", ventana[1]).order("created_at", { ascending: false }).limit(5), "client_historical_outputs")
    // solo si es el MISMO documento: empieza igual que lo que esta persona entregó (así a la jefatura no le toca el plan que revisó)
    const mismo = (x: Fila) => mismoComienzo(s(x.content_text), s(inv.output_summary))
    const cerca = o.filter((x) => s(x.content_text) && mismo(x)).sort((a, b) => Math.abs(Date.parse(String(a.created_at)) - t) - Math.abs(Date.parse(String(b.created_at)) - t))[0]
    if (cerca) return { agente, corrida, texto: s(cerca.content_text), titulo: s(cerca.title), fuente: `client_historical_outputs · ${String(cerca.output_type ?? "")}`, recortado: false, creado_en: s(cerca.created_at) }
  }
  const resumen = s(inv.output_summary)
  return { agente, corrida, texto: resumen, titulo: null, fuente: "agent_invocations.output_summary", recortado: (resumen ?? "").length >= LARGO_GUARDADO, creado_en: creado }
}
