/**
 * LO QUE LEE EMILIO, SIN CÓDIGOS DEL SISTEMA (GO Lenovo 10-nov ~10:38Z · Emilio: «no necesito boceto, es muy simple»).
 * Lógica PURA de presentación, UNA sola para todo el tablero: al MOSTRAR un documento o una tarjeta (brief, gran idea, plan, avisos, fichas) se quitan
 * los códigos internos. NUNCA se toca lo guardado: los agentes y los lectores de la cadena siguen leyendo los códigos (las fotos dependen de eso).
 *
 * Las formas reales que se limpian (Náufrago, 10-nov: brief v2, gran idea v3 y sus avisos):
 *  - «## Brief creativo de campaña · Náufrago · brf-28de888eb3f2 · v2 (revisión)»   → «## Brief creativo de campaña · Náufrago»
 *  - «El brief (brf-28de888eb3f2 v2) nombra el insight»                              → «El brief nombra el insight»
 *  - «El aporte A3 ya contiene el brief v3 completo»                                 → «El aporte de campaign-brief-agent ya contiene el brief completo»
 *  - «**A1 usé:** material del portero»                                              → «**Usé el aporte de portero:** material del portero»
 *  - «(prompt de A12)» · «propuesto en A17» · «A1–A3»                                → «(prompt de <quien>)» · «propuesto en el aporte de <quien>» · «los aportes de <quienes>»
 *    (SOLO los aportes de la mesa de ese encargo: otro «A4» es del cliente y se queda · GO Lenovo 10-nov 14:10Z: «A1», «S1» también se ocultan)
 *  - «la serie S1»                                                                   → «la serie «La leyenda se confirma»» (solo las series del concepto)
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
  /** los aportes de la mesa del encargo de ese documento: número («3» de «A3») → quién lo dio («portero», «campaign-brief-agent»; vacío si fue el sistema).
   *  Solo un «A<n>» que esté aquí es un aporte; sin esta lista, «A4» se queda (puede ser del cliente: un papel A4, un modelo A1) */
  aportes?: Readonly<Record<string, string>>
  /** las series del concepto: código («S1») → su nombre. Solo un «S<n>» que esté aquí es una serie */
  series?: Readonly<Record<string, string>>
}

const HEX = "[0-9a-f]"
/** `foto:<id>` con o sin comillas invertidas; el id son 6+ caracteres de hex y guiones */
const FOTO = String.raw`\`?foto:(${HEX}[0-9a-f-]{5,})\`?`
const UNA_FOTO = new RegExp(FOTO, "gi")
/** un grupo de fotos: entre paréntesis o suelto, separadas por coma o «y» */
const GRUPO_DE_FOTOS = new RegExp(String.raw`\(\s*${FOTO}(?:\s*(?:,|y)\s*${FOTO})*\s*\)|${FOTO}(?:\s*(?:,|y)\s*${FOTO})*`, "gi")
/** el id de un documento de la cadena (brief, concepto, plan, manual, pieza, revisión, campaña) con su versión y «(revisión)» pegados */
const DOCUMENTO = new RegExp(String.raw`\`?\b(?:brf|con|pln|man|pie|rev|cam)-${HEX}{6,}(?:-v\d+)?\`?(?:\s*[·,]?\s*v\d+\b)?(?:\s*\(revisi[oó]n\))?`, "gi")
/** una versión suelta, SOLO en la forma exacta que escribe el sistema (10-nov · CC6 #323 🟡): «vN» en minúscula pegado a un documento que solo existe en
 *  la cadena (brief, gran idea, concepto), o al empezar una línea. Cualquier otra «vN» es del cliente y se queda («el kit v2», «Motor de v8», «plan v2 de
 *  financiamiento»). Límite declarado: «desde v2» escrito por un agente se queda a la vista */
const VERSION_SUELTA = /\b([Bb]rief|[Gg]ran\s+idea|[Cc]oncepto)\s+v\d+(?![\p{L}\p{N}_-])|^v(\d+)(?![\p{L}\p{N}_-])/gmu
/** «el brief v3» → «el brief»; «v2» al empezar la línea → «Versión 2» */
const versionEnPalabras = (_m: string, doc: string | undefined, nInicio: string | undefined): string => (nInicio ? `Versión ${Number(nInicio)}` : doc!)
/** la forma exacta de un identificador del sistema entre comillas: hex en MINÚSCULAS, con al menos una letra y un número (10-nov · CC6 #323 🟡).
 *  «AB12CD34» o una referencia solo de números es del cliente. Límite declarado: un lote del cliente en hex minúsculo («a1b2c3d4») también se iría */
const esIdDelSistema = (h: string) => /^[0-9a-f]+$/.test(h) && /\d/.test(h) && /[a-f]/.test(h)
/** un código de foto conocido suelto, sin comillas (los resúmenes de sección pierden las comillas) */
const CODIGO_SUELTO = /(?<![\p{L}\p{N}_-])[0-9a-f]{8}(?![\p{L}\p{N}_-])/giu
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

/** «A3» y «S1», como palabra entera (no «A3B», no «C1-A3») */
const BORDE_ANTES = String.raw`(?<![\p{L}\p{N}_-])`
const BORDE_DESPUES = String.raw`(?![\p{L}\p{N}_-])`
/** «A1–A3»: un rango de aportes */
const RANGO_DE_APORTES = new RegExp(String.raw`${BORDE_ANTES}A(\d+)\s*[–-]\s*A(\d+)${BORDE_DESPUES}`, "gu")
/** la forma de las citas del brief: «A1 usé:», «A5 usé parcialmente:», «A4 descarté:», «A2 no usé:» */
const CITA_DE_APORTE = new RegExp(String.raw`${BORDE_ANTES}A(\d+)\s+((?:no\s+)?(?:usé|descarté)(?:\s+(?:parcialmente|en\s+parte))?)(?=\s*\**\s*:)`, "gu")
/** «el aporte A3», «los aportes de A5»: la palabra ya está, solo falta de quién */
const PALABRA_APORTE = new RegExp(String.raw`\b([Aa]portes?)\s+(?:de\s+)?A(\d+)${BORDE_DESPUES}`, "gu")
const APORTE_SUELTO = new RegExp(String.raw`${BORDE_ANTES}A(\d+)${BORDE_DESPUES}`, "gu")
const SERIE = new RegExp(String.raw`(\b[Ss]erie\s+)?${BORDE_ANTES}(S\d+)${BORDE_DESPUES}`, "gu")

const conMayuscula = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1)
/** ¿lo que viene va al empezar una frase? (inicio de línea, tras un punto, tras «**» o una viñeta) */
// SIN la bandera «m»: con ella «$» cae al final de CUALQUIER línea y todo documento de varias líneas parecería «al empezar» (sabotaje 10-nov)
const alEmpezar = (antes: string) => /(?:^|\n)[ \t]*(?:[-•*][ \t]+)?(?:\*\*[ \t]*)?$|[.!?][ \t]*(?:\*\*[ \t]*)?$|\*\*[ \t]*$/.test(antes)
const elAporte = (n: string, de: string) => (de ? `el aporte de ${de}` : `el aporte ${Number(n)}`)

/** los aportes CONOCIDOS de ese encargo en palabras; uno que no está en la lista se queda como vino */
function aportesEnPalabras(t: string, aportes: Readonly<Record<string, string>> | undefined): string {
  if (!aportes || !Object.keys(aportes).length) return t
  const de = (n: string): string | undefined => aportes[String(Number(n))]
  const conocido = (n: string) => de(n) !== undefined
  return t
    .replace(RANGO_DE_APORTES, (m, a: string, b: string) => {
      if (!conocido(a) || !conocido(b)) return m
      const quienes = [...new Set(Array.from({ length: Math.max(0, Number(b) - Number(a) + 1) }, (_, k) => de(String(Number(a) + k)) ?? "").filter(Boolean))]
      if (!quienes.length) return `los aportes ${Number(a)} a ${Number(b)}`
      return `los aportes de ${quienes.length > 1 ? `${quienes.slice(0, -1).join(", ")} y ${quienes.at(-1)}` : quienes[0]}`
    })
    .replace(CITA_DE_APORTE, (m, n: string, verbo: string, i: number, s: string) => {
      if (!conocido(n)) return m
      const frase = `${verbo.replace(/\s+/g, " ")} ${elAporte(n, de(n)!)}`
      return alEmpezar(s.slice(0, i)) ? conMayuscula(frase) : frase
    })
    .replace(PALABRA_APORTE, (m, palabra: string, n: string) => {
      if (!conocido(n)) return m
      return de(n) ? `${palabra} de ${de(n)}` : `${palabra} ${Number(n)}`
    })
    .replace(APORTE_SUELTO, (m, n: string, i: number, s: string) => {
      if (!conocido(n)) return m
      const antes = s.slice(0, i)
      // SOLO donde lo escribe el sistema: al empezar una frase, tras «(» o tras una preposición. «papel A4», «modelo A1» (un sustantivo delante) son del
      // cliente y se quedan. Límite declarado: un «de A4» del cliente en un documento cuyo encargo tuvo un aporte 4 se cambiaría
      // tras «(» o tras «/» dentro de una cita entre paréntesis («(A16/A22)»)
      const empieza = alEmpezar(antes) || /\([ \t]*$/.test(antes) || /\([^()\n]*\/[ \t]*$/.test(antes)
      const preposicion = /(?:^|[^\p{L}])(de|en|con|sin|según|por|desde|a)[ \t]+$/iu.exec(antes)?.[1]?.toLowerCase()
      if (!empieza && !preposicion) return m
      // «prompt de A12» → «prompt de design-image-prompt-engineer»; «A5 miró» → «competitive-intelligence-agent miró»; «propuesto en A17» → «propuesto en el aporte de …»
      if (de(n) && (preposicion === "de" || !preposicion)) return de(n)!
      const frase = elAporte(n, de(n)!)
      return alEmpezar(antes) ? conMayuscula(frase) : frase
    })
    // «de el aporte 4» → «del aporte 4»; «a el aporte» → «al aporte» (lo que deja el reemplazo tras una preposición)
    .replace(/\b([Dd])e el aporte\b/g, "$1el aporte")
    .replace(/(^|[^\p{L}])([Aa]) el aporte\b/gu, "$1$2l aporte")
    // «(tiktok-strategist/tiktok-strategist)» → «(tiktok-strategist)»; y si el nombre ya va justo antes, el paréntesis sobra:
    // «El aporte de tiktok-strategist (tiktok-strategist)» → «El aporte de tiktok-strategist»
    .replace(/\(([\p{L}\p{N}_-]+)(?:\/\1)+\)/gu, "($1)")
    .replace(/(?<![\p{L}\p{N}_-])([\p{L}\p{N}_-]+)[ \t]+\(\1\)/gu, "$1")
}

/** las series CONOCIDAS del concepto por su nombre: «S1» → «la serie «La leyenda se confirma»» */
function seriesEnPalabras(t: string, series: Readonly<Record<string, string>> | undefined): string {
  if (!series || !Object.keys(series).length) return t
  return t.replace(SERIE, (m, palabra: string | undefined, id: string, i: number, s: string) => {
    const nombre = series[id]?.trim()
    if (!nombre) return m
    if (palabra) return `${palabra}«${nombre}»`
    return `${alEmpezar(s.slice(0, i)) ? "La" : "la"} serie «${nombre}»`
  })
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
  return seriesEnPalabras(aportesEnPalabras(t, ctx.aportes), ctx.series)
    .replace(DOCUMENTO, "")
    .replace(UUID, "")
    // un código entre comillas: si es una foto conocida, su miniatura; si mezcla letras y números (forma de identificador del sistema), se va;
    // si es solo números o solo letras, es dato del cliente (una referencia de producto, un lote) y se queda (10-nov · 2º cliente)
    .replace(HASH, (m, h: string) => { if (fotos.has(h.toLowerCase().slice(0, 8))) { alFoto?.(h); return "" } return esIdDelSistema(h) ? "" : m })
    .replace(IDEA, (_m, _la: string | undefined, cap: string, num: string) => nombreDeLaIdea(cap, num, ctx))
    .replace(VERSION_SUELTA, versionEnPalabras)
    .replace(CODIGO_SUELTO, (m) => (fotos.has(m.toLowerCase()) ? "" : m))
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

/** las series de los capítulos como código → nombre. Un código que en dos capítulos nombra series distintas («S1» en cada capítulo) es ambiguo y
 *  NO se traduce: se queda como vino antes que poner el nombre equivocado */
export function seriesSinRepetir(capitulos: ReadonlyArray<{ series?: ReadonlyArray<{ id?: string | null; nombre?: string | null }> }>): Record<string, string> {
  const nombres = new Map<string, Set<string>>()
  for (const c of capitulos) for (const s of c.series ?? []) {
    const id = String(s.id ?? "").trim(), nombre = String(s.nombre ?? "").trim()
    if (!id || !nombre) continue
    nombres.set(id, (nombres.get(id) ?? new Set()).add(nombre))
  }
  return Object.fromEntries([...nombres].filter(([, n]) => n.size === 1).map(([id, n]) => [id, [...n][0]]))
}

/** los códigos entre comillas invertidas que podrían ser fotos (prefijos de 8, sin repetir): para preguntar a las fotos del cliente cuáles lo son */
export function codigosEntreComillas(t: string | null | undefined): string[] {
  return [...new Set([...String(t ?? "").matchAll(HASH)].map((m) => m[1].toLowerCase().slice(0, 8)))]
}

/** los códigos de foto citados en un texto, sin repetir (para pedir sus miniaturas) */
export function fotosCitadas(t: string | null | undefined): string[] {
  return [...new Set([...String(t ?? "").matchAll(UNA_FOTO)].map((m) => m[1].toLowerCase()))]
}
