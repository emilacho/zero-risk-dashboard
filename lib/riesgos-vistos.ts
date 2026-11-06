/**
 * RIESGOS · ABIERTAS · TOMADAS · CERRADAS (Lenovo 06-nov, sobre la imagen aprobada `APROBADO-concepto.png`).
 * La plataforma no guarda «visto» de un riesgo; el tablero lo guarda en su propia tabla de marcas (`alertas_vistas`, la misma del «ya lo vi» de las
 * alertas) con la clave `riesgo:<id>`. Con eso:
 *  - ABIERTA: el riesgo sigue activo y nadie lo marcó visto.
 *  - TOMADA: sigue activo y ya lo marcaste visto (alguien lo tiene a la vista).
 *  - CERRADA: lo marcaste visto y una lectura COMPLETA de la plataforma ya no lo trae (se resolvió). Solo las de los últimos 7 días.
 * CC6 06-nov (certificación de #290):
 *  - con la lista incompleta (una fuente no se leyó) no se afirma ningún cierre: Cerradas = «—»;
 *  - la marca no sobrevive al cierre: cuando una lectura completa ya no trae el riesgo, su marca `riesgo:<id>` se cambia por un cierre
 *    `riesgo-cerrada:<id>` (con el instante del cierre). Si el mismo riesgo vuelve (los ids se repiten: `credencial:n8n`, `saldo:apify`…), entra ABIERTO.
 *  - si las marcas llegan al tope de lectura, no se sabe cuáles faltan: `null` (nunca «nada visto»).
 * La marca no guarda el título del riesgo: de una cerrada solo se sabe cuándo se cerró.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Riesgo } from "@/lib/direccion-riesgos"

export const PREFIJO_RIESGO = "riesgo:"
export const PREFIJO_CERRADA = "riesgo-cerrada:"
export const DIAS_DE_CERRADAS = 7
export const TOPE_DE_MARCAS = 2000
export const claveDelRiesgo = (id: string) => `${PREFIJO_RIESGO}${id}`
export const claveDelCierre = (id: string) => `${PREFIJO_CERRADA}${id}`

/** las marcas leídas: id del riesgo → instante en que se marcó visto */
export type VistosDeRiesgos = Record<string, string>
export interface Cerrada { id: string; cerrada_en: string }
export interface EstadoDeLosRiesgos { abiertas: Riesgo[]; tomadas: Riesgo[]; cerradas: Cerrada[] | null }

/** de las filas de `alertas_vistas` (clave, visto_en), solo las de un prefijo, con el id sin el prefijo */
export function vistosDeLasMarcas(filas: Array<Record<string, unknown>>, prefijo: string = PREFIJO_RIESGO): VistosDeRiesgos {
  const v: VistosDeRiesgos = {}
  for (const f of filas) {
    const clave = typeof f.clave === "string" ? f.clave : "", en = typeof f.visto_en === "string" ? f.visto_en : ""
    if (clave.startsWith(prefijo) && clave.length > prefijo.length && en) v[clave.slice(prefijo.length)] = en
  }
  return v
}

/**
 * reparte los riesgos activos entre abiertas y tomadas. Cerradas: los cierres guardados de los últimos 7 días que no volvieron a estar activos,
 * el más reciente arriba; `null` (no se afirma nada) si la lista vino incompleta o los cierres no se pudieron leer.
 */
export function estadoDeLosRiesgos(activos: Riesgo[], vistos: VistosDeRiesgos, o: { cierres?: VistosDeRiesgos | null; completo?: boolean; ahora?: number } = {}): EstadoDeLosRiesgos {
  const ids = new Set(activos.map((r) => r.id))
  const desde = (o.ahora ?? Date.now()) - DIAS_DE_CERRADAS * 86_400_000
  const cerradas = !o.completo || !o.cierres ? null : Object.entries(o.cierres)
    .filter(([id, en]) => !ids.has(id) && Date.parse(en) >= desde)
    .map(([id, cerrada_en]) => ({ id, cerrada_en }))
    .sort((a, b) => Date.parse(b.cerrada_en) - Date.parse(a.cerrada_en))
  return { abiertas: activos.filter((r) => !vistos[r.id]), tomadas: activos.filter((r) => !!vistos[r.id]), cerradas }
}

async function leerPrefijo(supa: SupabaseClient, prefijo: string, desde?: string): Promise<VistosDeRiesgos | null> {
  try {
    let q = supa.from("alertas_vistas").select("clave, visto_en").like("clave", `${prefijo}%`)
    if (desde) q = q.gte("visto_en", desde)
    const m = await q.order("visto_en", { ascending: false }).limit(TOPE_DE_MARCAS)
    if (m.error) return null
    const filas = (m.data ?? []) as Array<Record<string, unknown>>
    return filas.length >= TOPE_DE_MARCAS ? null : vistosDeLasMarcas(filas, prefijo) // en el tope no se sabe qué quedó afuera
  } catch { return null }
}

/** lee las marcas de riesgos (servidor). Un error de la base, o llegar al tope, da null: el panel no inventa tomadas ni cerradas */
export const leerVistosDeRiesgos = (supa: SupabaseClient) => leerPrefijo(supa, PREFIJO_RIESGO)

/** lee los cierres de los últimos 7 días (servidor); null si no se pudo */
export const leerCierresDeRiesgos = (supa: SupabaseClient, ahora: Date = new Date()) =>
  leerPrefijo(supa, PREFIJO_CERRADA, new Date(ahora.getTime() - DIAS_DE_CERRADAS * 86_400_000).toISOString())

/**
 * La marca no sobrevive al cierre (servidor). Solo con una lectura COMPLETA: cada riesgo marcado visto que ya no está activo se cierra
 * (primero se guarda el cierre, después se borra la marca). Devuelve las marcas que siguen vigentes; una marca que no se pudo borrar se queda
 * (la próxima lectura lo reintenta). Con la lista incompleta no toca nada.
 */
export async function cerrarLasQueYaNoEstan(supa: SupabaseClient, activos: Riesgo[], vistos: VistosDeRiesgos | null, completo: boolean, ahora: Date = new Date()): Promise<VistosDeRiesgos | null> {
  if (!vistos || !completo) return vistos
  const ids = new Set(activos.map((r) => r.id))
  const quedan: VistosDeRiesgos = { ...vistos }
  for (const id of Object.keys(vistos)) {
    if (ids.has(id)) continue
    try {
      const c = await supa.from("alertas_vistas").upsert({ clave: claveDelCierre(id), visto_en: ahora.toISOString(), visto_por: "tablero:cierre" }, { onConflict: "clave" })
      if (c.error) continue
      const b = await supa.from("alertas_vistas").delete().eq("clave", claveDelRiesgo(id))
      if (!b.error) delete quedan[id]
    } catch { /* se reintenta en la próxima lectura */ }
  }
  return quedan
}

export type ResultadoDelVisto = { ok: true; vistos: VistosDeRiesgos } | { ok: false; error: string }

/** «Visto» (navegador): guarda la marca; solo si se guardó, el riesgo pasa a Tomada. Si falla, lo dice y el riesgo sigue Abierto */
export async function marcarRiesgoVisto(fetchImpl: typeof fetch, id: string, vistos: VistosDeRiesgos | null | undefined, ahora: Date = new Date()): Promise<ResultadoDelVisto> {
  try {
    const r = await fetchImpl("/api/alertas/visto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave: claveDelRiesgo(id) }) })
    const j = (await r.json().catch(() => null)) as { ok?: boolean } | null
    if (!r.ok || !j?.ok) return { ok: false, error: "No pude guardar que lo viste. Prueba otra vez." }
    return { ok: true, vistos: { ...(vistos ?? {}), [id]: ahora.toISOString() } }
  } catch { return { ok: false, error: "No pude guardar que lo viste. Prueba otra vez." } }
}
