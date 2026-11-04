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
export const TEXTO_SIN_METRICAS = "pronto"
/** lo que dice el cuadro de una red que el cliente todavía no tiene (no se oculta: el estándar es mostrarlas todas) */
export const TEXTO_SIN_CUENTA = "sin cuenta"

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
  /** el cliente tiene cuenta en esa red (false = el cuadro se ve tenue y dice «sin cuenta todavía») */
  tiene: boolean
}
export interface MetricasDelPizarron { cliente: string | null; cuadros: CuadroDeMetrica[]; lectura: LecturaDeMetricas["estado"] }

const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
/** hay una cuenta declarada: texto no vacío, un sí, un número, o un objeto/lista con algo dentro (la ficha puede guardar {handle, url} y no solo el texto) */
const cuenta = (v: unknown): boolean => {
  if (typeof v === "string") return v.trim().replace(/^@/, "") !== ""
  if (typeof v === "number") return v > 0
  if (v === true) return true
  if (Array.isArray(v)) return v.some(cuenta)
  if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).some(cuenta)
  return false
}
/**
 * qué red es una llave de la ficha. La barra del manual lista CUALQUIER llave de `own_handles` tal como esté escrita («facebook_page», «tiktok_handle», «youtube_channel»,
 * «whatsapp_number»…); aquí se reconoce por lo que dice la llave, no solo si es exactamente «facebook». Corrección del 02-nov: en producción faltaban 4 redes que sí estaban.
 */
export function redDeLaLlave(llave: string): ClaveDeRed | null {
  const k = llave.toLowerCase().replace(/[^a-z]/g, "")
  if (k.includes("instagram") || k === "ig" || k === "insta") return "instagram"
  if (k.includes("facebook") || k === "fb") return "facebook"
  if (k.includes("tiktok")) return "tiktok"
  if (k.includes("youtube") || k === "yt") return "youtube"
  if (k.includes("whatsapp") || k === "wa" || k === "wsp") return "whatsapp"
  if (k.includes("maps") || k.includes("gmaps") || k.includes("googlebusiness") || k === "gmb") return "google_maps"
  return null
}

/**
 * qué redes tiene el cliente, de sus canales propios: las cuentas de su ficha (`config.apify.own_handles`, la MISMA fuente de la barra del manual), el sitio web y, si se pasan,
 * los campos de sus sedes que nombran una red (p. ej. el WhatsApp de una sede). Lo que no tiene no sale.
 */
export function redesDelCliente(config: unknown, sitio: string | null, camposDeSedes: string[] = []): ClaveDeRed[] {
  const propias = objeto(objeto(objeto(config).apify).own_handles)
  const tiene = new Set<ClaveDeRed>()
  for (const [k, v] of Object.entries(propias)) { const c = redDeLaLlave(k); if (c && cuenta(v)) tiene.add(c) }
  for (const campo of camposDeSedes) { const c = redDeLaLlave(campo); if (c) tiene.add(c) }
  if (typeof sitio === "string" && /^https?:\/\//.test(sitio.trim())) tiene.add("web")
  return REDES_DEL_PIZARRON.map((r) => r.clave).filter((c) => tiene.has(c))
}

/** Google Maps cuenta SIEMPRE como «tiene»: no está en las cuentas propias del cliente (`own_handles`) sino en el resultado de la función de Apify `own_google_maps_profile` (un negocio local la tiene aunque no la declare), y hasta que Emilio fije cuál de los negocios hallados es el suyo no hay forma de saberlo desde la ficha (contrato de CC1, 02-nov) */
const SIEMPRE_EN_EL_PIZARRON: ClaveDeRed[] = ["google_maps"]

/** EL ESTÁNDAR (Emilio, 02-nov): «General» y TODAS las redes, siempre; la red que el cliente no tiene se ve tenue y dice «sin cuenta todavía»; la que tiene dice «métricas pronto» hasta que lleguen */
export function cuadrosDelPizarron(redes: ClaveDeRed[], lectura: LecturaDeMetricas): CuadroDeMetrica[] {
  const hay = (c: ClaveDeRed) => redes.includes(c) || SIEMPRE_EN_EL_PIZARRON.includes(c)
  const cuadro = (c: { clave: ClaveDelCuadro; nombre: string; sigla: string }, tiene: boolean): CuadroDeMetrica => ({ ...c, principal: null, variacion: null, texto: tiene ? (lectura.motivo || TEXTO_SIN_METRICAS) : TEXTO_SIN_CUENTA, tiene })
  return [cuadro(CUADRO_GENERAL, true), ...REDES_DEL_PIZARRON.map((r) => cuadro(r, hay(r.clave)))]
}
