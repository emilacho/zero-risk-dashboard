/**
 * LA BARRA LATERAL DEL MANUAL · lógica pura (CC6 · 02-nov · boceto aprobado por Emilio: «el manual de marca, ejemplo perfecto de UX/UI fácil de usar»).
 * Lo esencial del manual a la vista mientras se lee: estado · colores · tipografías · logo y fotos · personalidad · frases del cliente · palabras ·
 * sedes y horarios · canales. Todo con DATOS REALES (nada de muestra): si un dato no existe, se dice que falta; nunca se inventa.
 */
type Fila = Record<string, unknown>
const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "")
const objeto = (v: unknown): Fila => { if (typeof v === "string") { try { v = JSON.parse(v) } catch { return {} } } return v && typeof v === "object" && !Array.isArray(v) ? (v as Fila) : {} }

/** el estado del manual: cuántos campos validó/escribió el dueño, cuántos faltan y qué tan completo está */
export function estadoDelManual(campos: Array<{ valor: string | null; delDueno: boolean }>, faltan: string[]): { validados: number; faltan: string[]; completo_pct: number } {
  const llenos = campos.filter((c) => !!c.valor && c.valor.trim()).length
  const total = llenos + faltan.length
  return { validados: campos.filter((c) => !!c.valor && c.delDueno).length, faltan, completo_pct: total ? Math.round((llenos / total) * 100) : 0 }
}

/** «personalidad en pocas palabras»: de cada rasgo, lo que va antes de la explicación (« — », «:», «(»), hasta 4 palabras; sin repetir */
export function personalidadCorta(valor: string | null, max = 6): string[] {
  if (!valor) return []
  const salida: string[] = []
  for (const parte of valor.split(/\s·\s|\n|;/)) {
    const corta = parte.split(/\s[—–-]\s|:|\(|«|"/)[0].trim().replace(/[.,]$/, "")
    if (!corta) continue
    const palabras = corta.split(/\s+/)
    if (palabras.length > 4) continue // una frase larga no es «en pocas palabras»: se lee completa en su tarjeta
    for (const p of corta.split(/\s+y\s+|,\s*/)) { const t = p.trim().toLowerCase(); if (t && !salida.includes(t)) salida.push(t) }
  }
  return salida.slice(0, max)
}

/** las frases que el cliente usa (contexto, sin regla): el eslogan y las opciones que NO son propuesta del agente */
export function frasesDelCliente(eslogan: string | null, opciones: string[]): string[] {
  const esPropuesta = (t: string) => /^PROPUESTA\b/i.test(t)
  const xs = [eslogan ?? "", ...opciones].map((t) => t.trim()).filter((t) => t && !esPropuesta(t))
  return [...new Set(xs)].slice(0, 4)
}

/** la dirección de Google Fonts para dibujar cada tipografía con su propia letra (solo nombres de familia limpios) */
export function urlDeLasTipografias(familias: string[]): string | null {
  const limpias = [...new Set(familias.map((f) => f.trim()).filter((f) => /^[A-Za-z0-9 ]{2,40}$/.test(f)))]
  return limpias.length ? `https://fonts.googleapis.com/css2?${limpias.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}`).join("&")}&display=swap` : null
}

export interface SedeDeLaBarra { ciudad: string; estado: string | null; atencion: string | null; horario: string | null; direccion: string | null; fuentes: string[] }
const FUENTE_LEGIBLE: Record<string, string> = { dueno: "dicho por ti", sitio: "de la web", mapas: "de Google Maps", ficha_de_mapas: "de Google Maps", redes: "de sus redes", instagram: "de su Instagram", facebook: "de su Facebook" }
const dominio = (u: string): string => { const m = /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(u.trim()); return m ? m[1].toLowerCase() : "" }
/**
 * Qué dato manda cuando hay varios (02-nov: en Náufrago la sede de Guayaquil tiene horarios de OTROS negocios sacados de Uber Eats):
 * lo que dijo el dueño → su propia web → su ficha de Mapas → su Instagram/Facebook → cualquier otra fuente. Así no gana una ficha ajena.
 */
function rango(d: Fila, sitio: string): number {
  const f = String(d.fuente ?? ""), ref = dominio(texto(d.fuente_ref))
  if (f === "dueno") return 0
  if (sitio && ref && (ref === sitio || ref.endsWith(`.${sitio}`))) return 1
  if (f === "mapas" || f === "ficha_de_mapas") return 2
  if (f === "instagram" || f === "facebook" || f === "redes") return 3
  return 9
}
const limpiarHorario = (h: string) => h.replace(/\s*\(bio:.*$/i, "").trim()
/** las sedes con lo que se sabe de cada una (estado, atención, horario, dirección) y de dónde salió */
export function sedesDeLaBarra(sedes: Fila[], datos: Fila[], sitioWeb: string | null = null): SedeDeLaBarra[] {
  const sitio = dominio(sitioWeb ?? "")
  return sedes.map((s) => {
    const mios = datos.filter((d) => d.sede_id === s.id)
    const elegir = (campo: string) => mios.filter((d) => d.campo === campo && texto(d.valor_texto)).sort((a, b) => rango(a, sitio) - rango(b, sitio))[0] ?? null
    const es = elegir("estado_de_la_sede"), at = elegir("tipo_de_atencion"), ho = elegir("horario"), di = elegir("direccion")
    const fuentes = [...new Set([at, ho, di].filter(Boolean).map((d) => FUENTE_LEGIBLE[String(d!.fuente)] ?? String(d!.fuente)))]
    const ciudad = texto(s.ciudad) || texto(s.clave)
    return { ciudad: ciudad === "Olon" ? "Olón" : ciudad, estado: es ? texto(es.valor_texto) : null, atencion: at ? texto(at.valor_texto) : null, horario: ho ? limpiarHorario(texto(ho.valor_texto)) : null, direccion: di ? texto(di.valor_texto) : null, fuentes }
  })
}

export interface CanalDeLaBarra { red: string; cuenta: string; url: string | null }
const RED_LEGIBLE: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn", youtube: "YouTube", x: "X" }
const URL_DE_RED: Record<string, (h: string) => string> = { instagram: (h) => `https://instagram.com/${h}`, facebook: (h) => `https://facebook.com/${h}`, tiktok: (h) => `https://tiktok.com/@${h}`, youtube: (h) => `https://youtube.com/@${h}`, x: (h) => `https://x.com/${h}` }
/** los canales propios del cliente: sus cuentas (las de su ficha) y su sitio web */
export function canalesDelCliente(config: unknown, sitio: string | null): CanalDeLaBarra[] {
  const propias = objeto(objeto(objeto(config).apify).own_handles)
  const salida: CanalDeLaBarra[] = []
  for (const [red, h] of Object.entries(propias)) {
    const cuenta = texto(h).replace(/^@/, "")
    if (cuenta) salida.push({ red: RED_LEGIBLE[red] ?? red, cuenta: `@${cuenta}`, url: URL_DE_RED[red]?.(cuenta) ?? null })
  }
  const web = texto(sitio)
  if (/^https?:\/\//.test(web)) salida.push({ red: "Sitio web", cuenta: web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), url: web })
  return salida
}

export interface FotoDeLaBarra { url: string; que_muestra: string | null }
/** las fotos propias del cliente (producto y ambiente, ya copiadas a nuestro almacén): imágenes sí, nada de otra dirección */
export function fotosDeLaBarra(filas: Fila[], max = 6): FotoDeLaBarra[] {
  return filas
    .filter((f) => /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//.test(texto(f.url)) && /\.(jpe?g|png|webp)$/i.test(texto(f.url)))
    .slice(0, max)
    .map((f) => ({ url: texto(f.url), que_muestra: texto(f.que_muestra) || null }))
}

/** el logo del borrador (copia propia en nuestro almacén), si existe */
export function logoDelManual(borrador: Fila): { url: string; procedencia: string | null } | null {
  const cg = objeto(objeto(borrador.visual).capa_grafica)
  const url = texto(cg.logo_url)
  return /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//.test(url) ? { url, procedencia: texto(cg.logo_procedencia) || null } : null
}
