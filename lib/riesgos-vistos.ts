/**
 * RIESGOS · ABIERTAS · TOMADAS · CERRADAS (Lenovo 06-nov, sobre la imagen aprobada `APROBADO-concepto.png`).
 * La plataforma no guarda «visto» de un riesgo; el tablero lo guarda en su propia tabla de marcas (`alertas_vistas`, la misma del «ya lo vi» de las
 * alertas) con la clave `riesgo:<id>`. Con eso:
 *  - ABIERTA: el riesgo sigue activo y nadie lo marcó visto.
 *  - TOMADA: sigue activo y ya lo marcaste visto (alguien lo tiene a la vista).
 *  - CERRADA: lo marcaste visto y ya no aparece en la lista de la plataforma (se resolvió). Solo las de los últimos 7 días.
 * La marca no guarda el título del riesgo: de una cerrada solo se sabe cuándo la viste.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Riesgo } from "@/lib/direccion-riesgos"

export const PREFIJO_RIESGO = "riesgo:"
export const DIAS_DE_CERRADAS = 7
export const claveDelRiesgo = (id: string) => `${PREFIJO_RIESGO}${id}`

/** las marcas leídas: id del riesgo → instante en que se marcó visto */
export type VistosDeRiesgos = Record<string, string>
export interface Cerrada { id: string; visto_en: string }
export interface EstadoDeLosRiesgos { abiertas: Riesgo[]; tomadas: Riesgo[]; cerradas: Cerrada[] }

/** de las filas de `alertas_vistas` (clave, visto_en), solo las de riesgos, con el id sin el prefijo */
export function vistosDeLasMarcas(filas: Array<Record<string, unknown>>): VistosDeRiesgos {
  const v: VistosDeRiesgos = {}
  for (const f of filas) {
    const clave = typeof f.clave === "string" ? f.clave : "", en = typeof f.visto_en === "string" ? f.visto_en : ""
    if (clave.startsWith(PREFIJO_RIESGO) && clave.length > PREFIJO_RIESGO.length && en) v[clave.slice(PREFIJO_RIESGO.length)] = en
  }
  return v
}

/** reparte los riesgos activos entre abiertas y tomadas, y cuenta como cerradas las vistas que ya no están (últimos 7 días, la más reciente arriba) */
export function estadoDeLosRiesgos(activos: Riesgo[], vistos: VistosDeRiesgos, ahora: number = Date.now()): EstadoDeLosRiesgos {
  const ids = new Set(activos.map((r) => r.id))
  const desde = ahora - DIAS_DE_CERRADAS * 86_400_000
  const cerradas = Object.entries(vistos)
    .filter(([id, en]) => !ids.has(id) && Date.parse(en) >= desde)
    .map(([id, visto_en]) => ({ id, visto_en }))
    .sort((a, b) => Date.parse(b.visto_en) - Date.parse(a.visto_en))
  return { abiertas: activos.filter((r) => !vistos[r.id]), tomadas: activos.filter((r) => !!vistos[r.id]), cerradas }
}

/** lee las marcas de riesgos (servidor). Un error de la base da null: el panel no inventa tomadas ni cerradas */
export async function leerVistosDeRiesgos(supa: SupabaseClient): Promise<VistosDeRiesgos | null> {
  try {
    const m = await supa.from("alertas_vistas").select("clave, visto_en").like("clave", `${PREFIJO_RIESGO}%`).order("visto_en", { ascending: false }).limit(2000)
    return m.error ? null : vistosDeLasMarcas((m.data ?? []) as Array<Record<string, unknown>>)
  } catch { return null }
}
