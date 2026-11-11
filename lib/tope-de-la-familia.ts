/**
 * EL TOPE DE LA FAMILIA DE UNA PIEZA · SOLO LECTURA (GO Lenovo 11-nov 20:28 · Emilio 20:27: «no me interesa precios»).
 * «Rehacer» ya no manda US$ 5 fijos: manda el tope por pieza de la FAMILIA de esa pieza, el mismo con que la abre la oficina y el que la plataforma usa
 * para recortar (`topeDeLaFamilia` de #1051): la familia del encargo → `oficina_tipos_de_grupo.limites.tope_encargo_usd`. No se muestra en ninguna pantalla.
 * Vive aparte de la puerta de acciones a propósito: esa puerta no toca la base (prueba `dashboard-que-se-maneja-b`).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getServiceRoleClient } from "@/lib/supabase-server"

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

/** el tope por pieza de la familia de un encargo; null si falta la familia, la plantilla o un tope legible (nunca se inventa uno) */
export async function topeDeLaFamiliaDelEncargo(supa: SupabaseClient, encargoId: string): Promise<number | null> {
  const e = await supa.from("oficina_encargos").select("familia").eq("id", encargoId).limit(1)
  const familia = e.error ? null : ((e.data ?? [])[0] as { familia?: unknown } | undefined)?.familia
  if (typeof familia !== "string" || !familia) return null
  const p = await supa.from("oficina_tipos_de_grupo").select("familia, limites").eq("familia", familia).limit(1)
  const limites = p.error ? null : ((p.data ?? [])[0] as { limites?: unknown } | undefined)?.limites
  const tope = esObjeto(limites) ? Number(limites.tope_encargo_usd) : Number.NaN
  return Number.isFinite(tope) && tope > 0 ? tope : null
}

/** la que usa la puerta de acciones: con la conexión del servidor */
export const leerTopeDeLaFamilia = (encargoId: string): Promise<number | null> => topeDeLaFamiliaDelEncargo(getServiceRoleClient(), encargoId)
