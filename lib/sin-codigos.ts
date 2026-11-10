/**
 * LO QUE LEE EMILIO, SIN CÓDIGOS DEL SISTEMA (GO Lenovo 10-nov ~10:38Z · Emilio: «no necesito boceto, es muy simple»).
 * Lógica PURA de presentación, UNA sola para todo el tablero: al MOSTRAR un documento o una tarjeta (brief, gran idea, plan, avisos, fichas) se quitan
 * los códigos internos. NUNCA se toca lo guardado: los agentes y los lectores de la cadena siguen leyendo los códigos (las fotos dependen de eso).
 *
 * Las formas reales que se limpian (Náufrago, 10-nov: brief v2, gran idea v3 y sus avisos):
 *  - «## Brief creativo de campaña · Náufrago · brf-28de888eb3f2 · v2 (revisión)»   → «## Brief creativo de campaña · Náufrago»
 *  - «El brief (brf-28de888eb3f2 v2) nombra el insight»                              → «El brief nombra el insight»
 *  - «El aporte A3 ya contiene el brief v3 completo»                                 → «El aporte A3 ya contiene el brief completo»
 *  - «la idea C1-I08 trae «80 %»»                                                    → «la idea 8 del capítulo 1 trae «80 %»» (o su título, si se sabe)
 *  - «caldo hirviendo (`foto:6275c0ba`)»                                             → «caldo hirviendo» + la miniatura de esa foto (o nada)
 *  - «encebollado cenital: `19671014`, `c0355f3d`»                                   → la miniatura si es una foto conocida; si no, nada
 *  - un identificador largo (uuid) suelto                                            → nada
 */

/** un pedazo de lo que se muestra: texto, o un grupo de fotos citadas (sus códigos, para buscar la miniatura) */
export type Trozo = { texto: string } | { fotos: string[] }

export interface ContextoSinCodigos {
  /** el nombre legible de una idea del banco («C1-I08» → su título), si se conoce */
  nombreDeIdea?: (id: string) => string | null | undefined
  /** los códigos de foto conocidos (prefijos de 8): un código suelto entre comillas invertidas que esté aquí es una foto, no un hash */
  fotos?: ReadonlySet<string> | readonly string[]
}

const HEX = "[0-9a-f]"
/** `foto:<id>` con o sin comillas invertidas; el id son 6+ caracteres de hex y guiones */
const FOTO = String.raw`\`?foto:(${HEX}[0-9a-f-]{5,})\`?`
const UNA_FOTO = new RegExp(FOTO, "gi")
/** un grupo de fotos: entre paréntesis o suelto, separadas por coma o «y» */
const GRUPO_DE_FOTOS = new RegExp(String.raw`\(\s*${FOTO}(?:\s*(?:,|y)\s*${FOTO})*\s*\)|${FOTO}(?:\s*(?:,|y)\s*${FOTO})*`, "gi")
/** el id de un documento de la cadena (brief, concepto, plan, manual, pieza, revisión, campaña) con su versión y «(revisión)» pegados */
const DOCUMENTO = new RegExp(String.raw`\`?\b(?:brf|con|pln|man|pie|rev|cam)-${HEX}{6,}(?:-v\d+)?\`?(?:\s*[·,]?\s*v\d+\b)?(?:\s*\(revisi[oó]n\))?`, "gi")
/** una versión suelta en el texto («el brief v3») */
const VERSION_SUELTA = /(?<![\p{L}\p{N}_-])v\d+(?![\p{L}\p{N}_-])/gu
const UUID = new RegExp(String.raw`\`?\b${HEX}{8}-${HEX}{4}-${HEX}{4}-${HEX}{4}-${HEX}{12}\b\`?`, "gi")
/** un hash corto entre comillas invertidas (`19671014`) */
const HASH = new RegExp(String.raw`\`(${HEX}{7,12})\``, "gi")
/** «C1-I08» · si va precedido de «la idea», se dice una sola vez */
const IDEA = /(\b(?:la|esa|una|cada)\s+idea\s+)?\bC(\d+)-I(\d+)\b/g

const nombreDeLaIdea = (cap: string, num: string, ctx: ContextoSinCodigos): string => {
  const titulo = ctx.nombreDeIdea?.(`C${cap}-I${num}`)
  if (titulo && titulo.trim()) return `la idea «${titulo.trim()}»`
  return `la idea ${Number(num)} del capítulo ${Number(cap)}`
}

/** lo que queda suelto al sacar un código: paréntesis vacíos, separadores colgando, comas dobles, espacios de más (sin juntar líneas: el markdown sigue igual) */
function ordenar(t: string): string {
  return t
    .replace(/\(\s*[,;·y]*\s*\)/g, "")
    .replace(/\([ \t]*[—–-][ \t]+/g, "(")
    .replace(/:\s*(?:[,;y]\s*)+(?=[)\n.;]|$)/gm, "")
    .replace(/:[ \t]*(?=[.;])|:[ \t]+(?=\))/g, "") // «cenital: `19671014`.» → «cenital.» (una carita «:)» queda)
    .replace(/,\s*(?:,\s*)+/g, ", ")
    .replace(/\([ \t]*[,;][ \t]*/g, "(") // «(`fe452b8f`, `4f09cef2` con el personaje» → «(con el personaje»
    .replace(/[ \t]*·[ \t]*(?=[,.;:)])/g, "") // «Brief creativo · brf-… v2: espera» → «Brief creativo: espera»
    .replace(/[ \t]+·[ \t]*(?=\n|$)/gm, "")
    .replace(/(?:[ \t]*·[ \t]*){2,}/g, " · ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:)])/g, "$1")
    .replace(/\([ \t]+/g, "(")
    .replace(/[ \t]+$/gm, "")
}

/** quita los códigos de un pedazo de texto (sin fotos: esas ya se separaron) */
function limpiarTexto(t: string, ctx: ContextoSinCodigos, fotos: ReadonlySet<string>, alFoto?: (id: string) => void): string {
  return t
    .replace(DOCUMENTO, "")
    .replace(UUID, "")
    .replace(HASH, (_m, h: string) => { if (fotos.has(h.toLowerCase().slice(0, 8))) alFoto?.(h); return "" })
    .replace(IDEA, (_m, _la: string | undefined, cap: string, num: string) => nombreDeLaIdea(cap, num, ctx))
    .replace(VERSION_SUELTA, "")
}

/**
 * El texto partido en pedazos para mostrar: el texto sin códigos y, donde se citaban fotos, un pedazo con sus códigos (el panel pone la miniatura
 * o nada). Pedazos de texto vacíos no salen.
 */
export function trozosSinCodigos(t: string | null | undefined, ctx: ContextoSinCodigos = {}): Trozo[] {
  const s = String(t ?? "")
  if (!s) return []
  const fotos = new Set([...(ctx.fotos ?? [])].map((f) => f.toLowerCase().slice(0, 8)))
  const out: Trozo[] = []
  let i = 0
  const empujarTexto = (x: string) => {
    const sueltas: string[] = []
    const limpio = limpiarTexto(x, ctx, fotos, (h) => sueltas.push(h))
    if (limpio) out.push({ texto: limpio })
    if (sueltas.length) out.push({ fotos: sueltas })
  }
  for (const m of s.matchAll(GRUPO_DE_FOTOS)) {
    empujarTexto(s.slice(i, m.index))
    out.push({ fotos: [...m[0].matchAll(UNA_FOTO)].map((x) => x[1]) })
    i = (m.index ?? 0) + m[0].length
  }
  empujarTexto(s.slice(i))
  // ordenar sobre el texto unido, para que la limpieza vea los dos lados de una foto que se fue
  const unidos: Trozo[] = []
  for (const x of out) {
    const ult = unidos.at(-1)
    if ("texto" in x && ult && "texto" in ult) ult.texto += x.texto
    else unidos.push("texto" in x ? { texto: x.texto } : x)
  }
  return unidos.map((x) => ("texto" in x ? { texto: ordenar(x.texto) } : x)).filter((x) => !("texto" in x) || x.texto.trim() !== "")
}

/** el texto sin códigos y sin fotos (para lo que se muestra como texto plano: títulos, el brief en secciones, avisos) */
export function sinCodigos(t: string | null | undefined, ctx: ContextoSinCodigos = {}): string {
  return ordenar(trozosSinCodigos(t, ctx).map((x) => ("texto" in x ? x.texto : "")).join(""))
}

/** los códigos de foto citados en un texto, sin repetir (para pedir sus miniaturas) */
export function fotosCitadas(t: string | null | undefined): string[] {
  return [...new Set([...String(t ?? "").matchAll(UNA_FOTO)].map((m) => m[1].toLowerCase()))]
}
