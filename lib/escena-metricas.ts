/**
 * EL PIZARRÓN DE MÉTRICAS · lo que se ve (CC4 · 02-nov · encargo de Lenovo `ENCARGO-LENOVO-a-CC4-pizarron-de-metricas`, tarea 1, firmado por Emilio).
 * Los gastos NO van aquí (se ven en Tu oficina › Dinero): el pizarrón de marketing muestra las métricas de cada red del cliente y las generales.
 * Las métricas todavía NO existen en la base: CC1/CC2 las preparan («listas para conectar»). Por eso hay UNA sola función de lectura (`leerMetricas`) que hoy devuelve
 * «sin datos»; la FORMA del dato la fija el contrato de CC1 y no se inventa aquí: cuando llegue, se amplía `LecturaDeMetricas` y `cuadroDe` (nada más).
 */
import type { SupabaseClient } from "@supabase/supabase-js"

export type ClaveDeRed = "instagram" | "facebook" | "tiktok" | "youtube" | "whatsapp" | "web" | "google_maps"
export type ClaveDelCuadro = ClaveDeRed | "general"
export const REDES_DEL_PIZARRON: Array<{ clave: ClaveDeRed; nombre: string; sigla: string }> = [
  { clave: "instagram", nombre: "Instagram", sigla: "IG" },
  { clave: "facebook", nombre: "Facebook", sigla: "FB" },
  { clave: "tiktok", nombre: "TikTok", sigla: "TT" },
  { clave: "youtube", nombre: "YouTube", sigla: "YT" },
  { clave: "whatsapp", nombre: "WhatsApp", sigla: "WA" },
  { clave: "web", nombre: "Sitio web", sigla: "WEB" },
  { clave: "google_maps", nombre: "Google Maps", sigla: "MAP" },
]
export const CUADRO_GENERAL = { clave: "general" as const, nombre: "General", sigla: "GEN" }
export const TEXTO_SIN_METRICAS = "métricas pronto"

/** lo que devuelve la lectura: hoy solo «sin datos» (la forma del dato con métricas la define el contrato de CC1) */
export type LecturaDeMetricas = { estado: "sin_datos"; motivo: string }

/** LA ÚNICA FUNCIÓN DE LECTURA DE MÉTRICAS del pizarrón. Hoy no hay tabla que leer: devuelve «sin datos». Cuando exista el contrato de CC1 se conecta aquí y en ningún otro lado. */
export async function leerMetricas(_supa: SupabaseClient | null, _o: { cliente: string | null }): Promise<LecturaDeMetricas> {
  return { estado: "sin_datos", motivo: TEXTO_SIN_METRICAS }
}

export interface CuadroDeMetrica {
  clave: ClaveDelCuadro
  nombre: string
  sigla: string
  /** la métrica principal y su variación: hoy nunca hay (null); se llenan con el contrato de CC1 */
  principal: string | null
  variacion: string | null
  /** lo que dice el cuadro */
  texto: string
}
export interface MetricasDelPizarron { cliente: string | null; cuadros: CuadroDeMetrica[]; lectura: LecturaDeMetricas["estado"] }

const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const cuenta = (v: unknown): boolean => typeof v === "string" ? v.trim().replace(/^@/, "") !== "" : v === true || (typeof v === "number" && v > 0)
/** las llaves de `clients.config.apify.own_handles` (o su equivalente) que se reconocen como WhatsApp y Google Maps */
const ALIAS: Record<string, ClaveDeRed> = { instagram: "instagram", facebook: "facebook", tiktok: "tiktok", youtube: "youtube", whatsapp: "whatsapp", google_maps: "google_maps", googlemaps: "google_maps", maps: "google_maps", gmaps: "google_maps" }

/** qué redes tiene el cliente, de sus canales propios (las cuentas de su ficha y su sitio web); lo que no tiene no sale */
export function redesDelCliente(config: unknown, sitio: string | null): ClaveDeRed[] {
  const propias = objeto(objeto(objeto(config).apify).own_handles)
  const tiene = new Set<ClaveDeRed>()
  for (const [k, v] of Object.entries(propias)) { const c = ALIAS[k.toLowerCase()]; if (c && cuenta(v)) tiene.add(c) }
  if (typeof sitio === "string" && /^https?:\/\//.test(sitio.trim())) tiene.add("web")
  return REDES_DEL_PIZARRON.map((r) => r.clave).filter((c) => tiene.has(c))
}

/** un cuadro por red del cliente + «General»; sin métricas todos dicen «métricas pronto» */
export function cuadrosDelPizarron(redes: ClaveDeRed[], lectura: LecturaDeMetricas): CuadroDeMetrica[] {
  const cuadro = (c: { clave: ClaveDelCuadro; nombre: string; sigla: string }): CuadroDeMetrica => ({ ...c, principal: null, variacion: null, texto: lectura.motivo || TEXTO_SIN_METRICAS })
  return [cuadro(CUADRO_GENERAL), ...REDES_DEL_PIZARRON.filter((r) => redes.includes(r.clave)).map(cuadro)]
}
