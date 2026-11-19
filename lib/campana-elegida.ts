/**
 * 19-nov · VARIAS CAMPAÑAS POR CLIENTE (GO Lenovo a CC1, parte A de CC3) · LA regla común para saber qué campaña muestra una pantalla.
 *
 *  1. la PEDIDA (`?campana=`), si es de ese cliente, no es de ensayo (`seco`), no está cerrada ni reemplazada y no está archivada;
 *  2. si no, la primera VIVA del cliente (la más nueva en un estado vivo, sin archivar);
 *  3. si no hay ninguna viva, la última que no es de ensayo, en cualquier estado (lo que mostraban estas pantallas antes: así una campaña cerrada se sigue viendo).
 *
 * La usan el brief, la gran idea y el pizarrón (calendario); CC1 la reusa en piezas, equipo y dinero (parte C).
 */
import type { SupabaseClient } from "@supabase/supabase-js"

type Fila = Record<string, unknown>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** los estados en los que una campaña sigue viva (los mismos que `pizarron-datos.ts`) */
export const ESTADOS_DE_CAMPANA_VIVA = ["abierta", "estrategia", "calendario", "activa", "pausada", "necesita_humano"] as const
/** los estados con los que una campaña pedida ya no se muestra */
export const ESTADOS_QUE_NO_SE_MUESTRAN = ["cerrada", "reemplazada"] as const

/** ¿el `?campana=` tiene forma de campaña? (las rutas lo validan igual que `?cliente=`) */
export const esCampanaValida = (v: string | null | undefined): boolean => !v || UUID.test(v)

async function una(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Fila | null> {
  const r = await q
  if (r.error) throw new Error(`cadena_campanas: ${r.error.message}`)
  return (r.data ?? null) as Fila | null
}

/** ¿esta campaña pedida se puede mostrar? (de este cliente, no de ensayo, sin cerrar ni reemplazar, sin archivar) */
export function sePuedeMostrar(c: Fila | null, clienteId: string): boolean {
  if (!c) return false
  if (String(c.client_id ?? "") !== clienteId) return false
  if (c.seco === true) return false
  if ((ESTADOS_QUE_NO_SE_MUESTRAN as readonly string[]).includes(String(c.estado ?? ""))) return false
  return c.archivada_en == null
}

/**
 * La campaña que muestra la pantalla, con las `columnas` que necesita (siempre se agregan `id` y `estado`).
 * `pedida` es el `?campana=`; vacía o con otra forma, se ignora (cae a la regla 2).
 */
export async function elegirCampana(supa: SupabaseClient, clienteId: string, pedida: string | null | undefined, columnas = "id, estado"): Promise<Fila | null> {
  const cols = [...new Set(["id", "estado", ...columnas.split(",").map((c) => c.trim()).filter(Boolean)])].join(", ")
  if (pedida && UUID.test(pedida)) {
    const c = await una(supa.from("cadena_campanas").select(`${cols}, client_id, seco, archivada_en`).eq("id", pedida).maybeSingle())
    if (sePuedeMostrar(c, clienteId)) return c
  }
  const viva = await una(
    supa.from("cadena_campanas").select(cols).eq("client_id", clienteId).eq("seco", false).in("estado", [...ESTADOS_DE_CAMPANA_VIVA]).is("archivada_en", null).order("creada_en", { ascending: false }).limit(1).maybeSingle(),
  )
  if (viva) return viva
  return una(supa.from("cadena_campanas").select(cols).eq("client_id", clienteId).eq("seco", false).order("creada_en", { ascending: false }).limit(1).maybeSingle())
}
