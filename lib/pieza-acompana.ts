/**
 * LO QUE ACOMPAÑA A UNA PIEZA (CC6 · 02-nov · boceto aprobado por Emilio): la fila del calendario de la que sale, quién la hizo (nombre real de cada empleado,
 * de `jefatura_revisiones.productores`) y el avance tras «pedir cambios» (el mismo patrón del plan, el manual y la gran idea). Lectura; no inventa lo que la base no tiene.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { AvanceDelPedido } from "@/lib/plan"

export interface FilaDeLaPieza { fecha: string | null; hora: string | null; semana: number | null; red: string | null; formato: string | null; pilar: string | null; sede: string | null; tema: string | null; fase: string | null; idea_ref: string | null }
export interface ProductorDeLaPieza { donde: string; agente: string }
/** el encargo que la oficina abrió para rehacer la pieza (sale de `oficina_encargos.sala_ref.cambios_del_dueno.desde_hitl`) y si su pieza nueva ya llegó a la bandeja */
export interface RehechuraDeLaPieza { estado: string; creado_en: string | null; nueva_en_bandeja: boolean }
export interface AcompanaALaPieza { fila: FilaDeLaPieza | null; productores: ProductorDeLaPieza[]; decidida_en: string | null; rehechura: RehechuraDeLaPieza | null }

type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R): Promise<Array<Record<string, unknown>>> { const r = await q; return r.error ? [] : ((r.data ?? []) as Array<Record<string, unknown>>) }
const t = (v: unknown): string | null => (v == null || v === "" ? null : String(v))

/** lo que acompaña a la pieza; si una lectura falla, ese bloque queda vacío (la pieza se ve y se decide igual) */
export async function leerLoQueAcompana(supa: SupabaseClient, o: { hitl_id: string; encargo_id: string | null; revision_id: string | null; decision: unknown }): Promise<AcompanaALaPieza> {
  const d = (o.decision ?? null) as Record<string, unknown> | null
  const decidida_en = d && typeof d.cuando === "string" ? d.cuando : null
  let fila: FilaDeLaPieza | null = null
  let productores: ProductorDeLaPieza[] = []
  if (o.encargo_id) {
    const [enc] = await filas(supa.from("oficina_encargos").select("sala_ref").eq("id", o.encargo_id).limit(1))
    const ref = ((enc?.sala_ref as Record<string, unknown> | null)?.fila ?? null) as Record<string, unknown> | null
    if (ref?.id) {
      const [f] = await filas(supa.from("cadena_calendario_filas").select("fecha, hora, semana, red, formato, pilar, sede, tema, fase, idea_ref").eq("id", String(ref.id)).eq("fecha", String(ref.fecha ?? "")).eq("seco", false).order("calendario_version", { ascending: false }).limit(1))
      fila = f ? { fecha: t(f.fecha), hora: f.hora ? String(f.hora).slice(0, 5) : t(ref.hora), semana: f.semana == null ? null : Number(f.semana), red: t(f.red), formato: t(f.formato), pilar: t(f.pilar), sede: t(f.sede), tema: t(f.tema), fase: t(f.fase), idea_ref: t(f.idea_ref) }
        : { fecha: t(ref.fecha), hora: t(ref.hora), semana: null, red: null, formato: null, pilar: null, sede: null, tema: null, fase: null, idea_ref: null }
    }
    const rev = o.revision_id
      ? await filas(supa.from("jefatura_revisiones").select("productores").eq("id", o.revision_id).limit(1))
      : await filas(supa.from("jefatura_revisiones").select("productores").eq("artifact_type", "pieza").eq("artifact_id", o.encargo_id).order("creado_en", { ascending: false }).limit(1))
    productores = productoresDe(rev[0]?.productores)
  }
  let rehechura: RehechuraDeLaPieza | null = null
  if (decidida_en || d?.pidio_cambios === true) {
    const [nuevo] = await filas(supa.from("oficina_encargos").select("id, estado, creado_en").eq("sala_ref->cambios_del_dueno->>desde_hitl", o.hitl_id).order("creado_en", { ascending: false }).limit(1))
    if (nuevo) {
      const llegada = await filas(supa.from("hitl_queue").select("id").eq("metadata->>oficina_encargo_id", String(nuevo.id)).limit(1))
      rehechura = { estado: String(nuevo.estado ?? ""), creado_en: t(nuevo.creado_en), nueva_en_bandeja: llegada.length > 0 }
    }
  }
  return { fila, productores, decidida_en, rehechura }
}

/** los productores tal como los guarda la jefatura (`[{donde, agente}]`), sin repetir */
export function productoresDe(v: unknown): ProductorDeLaPieza[] {
  if (!Array.isArray(v)) return []
  const vistos = new Set<string>()
  return v.map((x) => x as Record<string, unknown>).filter((x) => typeof x?.agente === "string" && x.agente).map((x) => ({ donde: String(x.donde ?? ""), agente: String(x.agente) }))
    .filter((p) => { const k = `${p.donde}|${p.agente}`; if (vistos.has(k)) return false; vistos.add(k); return true })
}

/** «quién la hizo» agrupado por empleado: content-creator → texto · hashtags */
export function quienLaHizo(p: ProductorDeLaPieza[]): Array<{ agente: string; que: string[] }> {
  const por = new Map<string, string[]>()
  for (const x of p) por.set(x.agente, [...(por.get(x.agente) ?? []), ...(x.donde ? [x.donde] : [])])
  return [...por.entries()].map(([agente, que]) => ({ agente, que }))
}

/**
 * EL AVANCE TRAS «PEDIR CAMBIOS» EN UNA PIEZA: recibido · la oficina la rehace · nueva versión en tu bandeja. Sale del encargo nuevo de la oficina;
 * sin encargo todavía, la oficina no tomó el pedido. Cuando la pieza nueva llega a la bandeja, la barra desaparece (la nueva es la que se decide).
 */
export function avanceDeLaPieza(estado: string, a: Pick<AcompanaALaPieza, "decidida_en" | "rehechura">, ahora: Date): AvanceDelPedido | null {
  if (estado !== "con_cambios" || a.rehechura?.nueva_en_bandeja) return null
  const r = a.rehechura
  // la decisión de «pedir cambios» no siempre guarda la hora: entonces se cuenta desde que la oficina abrió el encargo nuevo
  const desde = a.decidida_en ?? r?.creado_en ?? null
  const minutos = desde ? Math.max(0, Math.round((ahora.getTime() - Date.parse(desde)) / 60000)) : null
  const fallo = r?.estado === "fallido" ? { texto: "La oficina no pudo rehacer la pieza.", que_hacer: "Usa «Rehacer esta pieza…» para pedirlo de nuevo." } : null
  return {
    pasos: [
      { clave: "recibido", nombre: "Recibido", estado: "hecho", hora: a.decidida_en, detalle: null },
      { clave: "reescribiendo", nombre: "La oficina creativa rehace la pieza", estado: fallo ? "fallo" : "en_curso", hora: r?.creado_en ?? null, detalle: r ? null : "la oficina todavía no tomó el pedido" },
      { clave: "listo", nombre: "Nueva versión en tu bandeja", estado: "pendiente", hora: null, detalle: null },
    ],
    minutos, estimado: minutos != null ? `Van ${minutos} min ${a.decidida_en ? "desde tu pedido" : "desde que la oficina lo tomó"}` : "En curso", nota: null, fallo, listo: false, ahora: null,
  }
}
