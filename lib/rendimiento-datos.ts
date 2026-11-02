/**
 * LA FICHA DE RENDIMIENTO · lectura (servidor, SOLO LECTURA · CC6 · 02-nov). Un error de la base lanza; nunca se lee como «sin datos».
 * Fuentes: `jefatura_revisiones` (entregas revisadas de verdad: sin prueba ni ensayo; el empleado sale de `productores[].agente`) · DEVUELTA (regla de CC1,
 * RESPUESTA-CC1-a-CC4-LENOVO-dos-datos-para-la-escena): un paso `jefatura_pasos.paso LIKE 'correccion:%'` (hecho o fallo) atribuido a `jefatura_pasos.agente`, o una
 * decisión de Emilio en `hitl_queue` (pieza: pidió cambios, o la rechazó él de verdad) atribuida a todos sus productores · `agent_invocations` (sus trabajos: estado, corte, vueltas, carpeta, costo, tiempo) · `hitl_queue` (lo que llegó a la bandeja de Emilio).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { nombreCanonico } from "@/lib/organigrama"
import { rendimientoDe, type EscaladaCruda, type Rendimiento, type RevisionCruda, type TrabajoCrudo } from "@/lib/rendimiento"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
const t = (v: unknown): string | null => (typeof v === "string" && v ? v : null)
const num = (v: unknown): number | null => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v))

const obj = (v: unknown): Fila => (v && typeof v === "object" && !Array.isArray(v) ? (v as Fila) : {})
/** una decisión de Emilio que devuelve la pieza (regla de CC1): pidió cambios; o la rechazó él (no una limpieza, una superación, un vencimiento ni una prueba) */
export function devolvioEmilio(x: Fila): boolean {
  const d = obj(x.decision), quien = String(x.reviewer ?? "")
  if (x.status === "edited") return d.pidio_cambios === true || d.pidio_cambios === "true"
  if (x.status !== "rejected") return false
  if ("vencida" in d || "superada" in d || "no_es_decision_del_dueno" in d) return false
  return !!quien && !/^(sistema|oficina-)/i.test(quien) && !/prueba/i.test(quien) && !/^limpieza/i.test(quien)
}

export interface RendimientoDeLaOficina { empleados: Record<string, Rendimiento>; leido_en: string }

export async function leerRendimiento(supa: SupabaseClient, ahora: Date = new Date()): Promise<RendimientoDeLaOficina> {
  const [revs, pasos, emilio] = await Promise.all([
    filas(supa.from("jefatura_revisiones").select("id, resultado, productores, creado_en").eq("prueba", false).eq("dry_run", false).order("creado_en", { ascending: false }).limit(2000), "jefatura_revisiones"),
    filas(supa.from("jefatura_pasos").select("revision_id, paso, estado, agente").like("paso", "correccion:%").in("estado", ["hecho", "fallo"]).limit(5000), "jefatura_pasos"),
    filas(supa.from("hitl_queue").select("status, reviewer, decision, metadata").eq("type", "content_piece_review").in("status", ["edited", "rejected"]).limit(5000), "hitl_queue"),
  ])
  // la jefatura se la devolvió a ESE empleado: (revisión, empleado) con un paso de corrección suyo
  const corrigio = new Set(pasos.map((x) => `${x.revision_id}|${nombreCanonico(x.agente)}`))
  // Emilio la devolvió: la revisión entera (a todos sus productores)
  const porEmilio = new Set(emilio.filter(devolvioEmilio).map((x) => t(obj(x.metadata).jefatura_revision_id)).filter((x): x is string => !!x))
  // por empleado (nombre canónico): sus revisiones y los nombres con que firma en la base
  const porEmpleado = new Map<string, { nombres: Set<string>; revisiones: RevisionCruda[] }>()
  for (const r of revs) {
    const creado = t(r.creado_en); if (!creado) continue
    const nombres = new Set((Array.isArray(r.productores) ? r.productores : []).map((p) => (p && typeof p === "object" ? t((p as Fila).agente) : null)).filter((x): x is string => !!x))
    for (const n of nombres) {
      const k = nombreCanonico(n)
      const e = porEmpleado.get(k) ?? { nombres: new Set<string>(), revisiones: [] }
      e.nombres.add(n); e.revisiones.push({ creado_en: creado, resultado: String(r.resultado ?? ""), devuelta: corrigio.has(`${r.id}|${k}`) || porEmilio.has(String(r.id)) })
      porEmpleado.set(k, e)
    }
  }
  if (!porEmpleado.size) return { empleados: {}, leido_en: ahora.toISOString() }
  const nombres = [...new Set([...porEmpleado.values()].flatMap((e) => [...e.nombres]))]
  const [trabajos, bandeja] = await Promise.all([
    filas(supa.from("agent_invocations").select("agent_name, created_at, status, num_turns, cost_usd, duration_ms, metadata").in("agent_name", nombres).order("created_at", { ascending: false }).limit(5000), "agent_invocations"),
    filas(supa.from("hitl_queue").select("agent_name, created_at").in("agent_name", nombres).limit(5000), "hitl_queue"),
  ])
  const empleados: Record<string, Rendimiento> = {}
  for (const [k, e] of porEmpleado) {
    const mios = trabajos.filter((x) => nombreCanonico(x.agent_name) === k).map((x): TrabajoCrudo => {
      const m = (x.metadata && typeof x.metadata === "object" ? x.metadata : {}) as Fila
      return { creado_en: String(x.created_at), status: String(x.status ?? ""), stop_reason: t(m.stop_reason), num_turns: num(x.num_turns), brain_hit: typeof m.brain_hit === "boolean" ? m.brain_hit : null, cost_usd: num(x.cost_usd), duration_ms: num(x.duration_ms) }
    })
    const escaladas: EscaladaCruda[] = bandeja.filter((x) => nombreCanonico(x.agent_name) === k && t(x.created_at)).map((x) => ({ creado_en: String(x.created_at) }))
    empleados[k] = rendimientoDe(k, e.revisiones, mios, escaladas)
  }
  return { empleados, leido_en: ahora.toISOString() }
}
