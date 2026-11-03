/**
 * EL MANUAL LIMPIO PARA EL CLIENTE (CC6 · 03-nov · corrección de Lenovo tras la revisión de Emilio: «ese documento debe verse limpio y presentable a un cliente»).
 * Lógica PURA de presentación: el panel muestra solo el contenido del manual, sin la evidencia ni el «por qué» que los empleados dejan pegado al texto.
 * NO toca lo guardado: lo que el agente escribió sigue en la base tal cual (regla 5 · sin rejas); esto solo decide qué se ve.
 *
 * Las formas reales que se limpian (manuales de Náufrago y ZR SI, 03-nov):
 *  - «Frescos desde la costa» — responde directamente a la objeción…   → Frescos desde la costa
 *  - Frescura — El cliente dice «encebollados frescos»…                 → Frescura            (solo en los campos-lista de rótulos cortos)
 *  - … (Evidencia: bio y publicación de Instagram…)                     → sin el paréntesis
 *  - … [propuesta del agente — umbrales están…]                         → sin el corchete
 *  - El cliente dice: «ven a compartir…» — activa el motivador…          → «ven a compartir…»
 * Lo que NO se corta: «LUZ — Natural costera…» (rótulo en mayúsculas + contenido) ni una raya normal dentro de una frase de un campo de texto (la misión).
 */

/** los campos-lista donde cada elemento es un rótulo corto y lo que va tras la raya es evidencia o un «por qué» */
export const CAMPOS_CON_ROTULO_Y_PORQUE: ReadonlySet<string> = new Set(["valores", "personalidad", "mensajes_clave", "nunca", "propuestas_de_valor"])

const RAYA = /\s+[—–]\s+/
const QUIEN_DICE = /(?:el cliente|la clienta|el dueño|la dueña)\s+(?:dice|dijo|escribe|escribió|usa|comunica|menciona|repite|publica)\b/i

/**
 * Los códigos internos de segmento (S1…S5) y la sigla «ICP» no son del cliente (Emilio, 08:20Z: 27 en el manual de Náufrago): fuera, sin romper la frase.
 *  «S4 (trabajadores)» → «trabajadores» · «(S3/S5 del ICP)» → nada · «la objeción de S1 «…»» → «la objeción «…»» · «según señales ICP» → nada · «del ICP» → nada.
 */
export function sinCodigosDeSegmento(t: string): string {
  const COD = String.raw`S\d(?:\s*[/,]\s*S\d)*(?:\s+y\s+S\d)?`
  return t
    .replace(/\bdel\s+segmento\s+S\d\s*\(([^)]+)\)/g, "de los $1")
    .replace(new RegExp(String.raw`\b(?:segmentos?\s+)?S\d\s*\(([^)]+)\)`, "g"), "$1")
    .replace(new RegExp(String.raw`\s+(?:para|de|del|en|a)\s+(?:los\s+segmentos?\s+|el\s+segmento\s+)?${COD}\b`, "g"), "")
    .replace(/\s+(?:seg[uú]n\s+(?:las\s+)?se[ñn]ales|del|de\s+la|seg[uú]n\s+el)\s+ICP\b/g, "")
    .replace(/\bICP\b/g, "público")
    .replace(new RegExp(String.raw`\b(?:segmentos?\s+)?${COD}\b`, "g"), "")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/\(\s+/g, "(")
}

/** quita del texto lo que no es contenido: paréntesis de evidencia, corchetes de propuesta, el prefijo de propuesta, «El cliente dice:» al empezar y los códigos de segmento */
export function limpiarTexto(t: string): string {
  return sinCodigosDeSegmento(t)
    .replace(/^\s*PROPUESTA\s*\([^)]*\)\s*:\s*/i, "")
    .replace(/\s*\((?:evidencia|observaci[oó]n|fuente|fuentes|dato del cliente|seg[uú]n|deducido|inferido|tomado)[^)]*\)/gi, "")
    .replace(/\s*\[[^\]]*(?:propuesta|evidencia|fuente|nota|verbatim|cliente|dueñ[oa]|agente)[^\]]*\]/gi, "")
    .replace(/\s*[—–]\s*evidencia:[^—–]*[—–]/gi, "")
    // un corchete de propuesta que quedó sin cerrar (el texto llegó cortado) se va hasta el final
    .replace(/\s*\[(?:propuesta|evidencia|fuente|nota)[^\]]*$/i, "")
    .replace(new RegExp(`^\\s*${QUIEN_DICE.source}\\s*:?\\s*`, "i"), "")
    // «el cliente dice: «…»» en medio del texto es evidencia: se va el inciso o la oración entera, sin partir dentro de las comillas (CC3 · 03-nov)
    .replace(new RegExp(`\\s*[—–]\\s*${QUIEN}(?:«[^»]*»|[^—–.«])*[—–]`, "gi"), "")
    .replace(new RegExp(`\\s*[;:,]\\s*${QUIEN}(?:«[^»]*»|[^.;«])*`, "gi"), "")
    .replace(new RegExp(`(^|[.!?»]\\s+)${QUIEN}(?:«[^»]*»|[^.«])*\\.\\s*`, "gi"), "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}
/** «el cliente dice», como pedazo de patrón: la persona y el verbo */
const QUIEN = String.raw`(?:el|la)\s+(?:cliente|clienta|dueño|dueña)\s+(?:dice|dijo|escribe|escribió|usa|comunica|menciona|repite|publica)\b:?`

/** lo que sigue a la raya ES contenido cuando son ejemplos («— ni «estimado cliente», ni …»), no un porqué: se queda su primera oración */
const SON_EJEMPLOS = /^(?:ni\s|p\.\s*ej|por ejemplo|ej\.|como\s+«|tipo\s+«)/i
const primeraOracion = (t: string): string => { const m = /^(?:«[^»]*»|[^.«])*\.?/.exec(t); return (m ? m[0] : t).trim() }

/** una frase entre comillas seguida de su justificación queda en la frase sola (sin comillas: el panel pone las suyas) */
export function soloLaFrase(t: string): string {
  const s = limpiarTexto(t)
  const m = /^[«"“]([^»"”]{1,300})[»"”]\s*(?:[—–:]\s+.*)?$/s.exec(s)
  return m ? m[1].trim() : s
}

const esRotuloEnMayusculas = (cabeza: string) => /[A-ZÁÉÍÓÚÑ]{3}/.test(cabeza) && cabeza === cabeza.toUpperCase()

/** un elemento de una lista del manual, como lo ve el cliente */
export function elementoLimpio(clave: string, item: string): string {
  let s = limpiarTexto(item)
  if (/^[«"“]/.test(s)) s = soloLaFrase(s)
  if (!CAMPOS_CON_ROTULO_Y_PORQUE.has(clave)) return s
  // «… : el cliente dice «…»» al final: se va desde quien lo dice
  const quien = new RegExp(`\\s*[:;,.]?\\s*${QUIEN_DICE.source}.*$`, "is")
  const sinQuien = s.replace(quien, "").trim()
  if (sinQuien.length >= 3) s = sinQuien
  const partes = s.split(RAYA)
  if (partes.length > 1 && partes[0].trim().length >= 3 && !esRotuloEnMayusculas(partes[0])) {
    const cola = partes.slice(1).join(" — ").trim()
    s = SON_EJEMPLOS.test(cola) ? `${partes[0].trim()} — ${primeraOracion(cola)}` : partes[0].trim()
  }
  return s.replace(/[\s:;,—–]+$/, "")
}

/**
 * Una lista del manual en sus elementos, COMO ESTÁ GUARDADA (para retirar uno sin tocar el texto de los demás): se parte en « · » o en salto de línea,
 * pero no dentro de un paréntesis, un corchete o unas comillas; y un trozo que empieza en minúscula o número sigue al anterior
 * («Encebollado Junior a $3,50 · ticket promedio $10,27» es UN elemento).
 */
export function partirLista(valor: string): string[] {
  const trozos: string[] = []
  let hondo = 0, actual = ""
  const abre = "([«“", cierra = ")]»”"
  for (let i = 0; i < valor.length; i++) {
    const ch = valor[i]
    if (abre.includes(ch)) hondo++
    else if (cierra.includes(ch)) hondo = Math.max(0, hondo - 1)
    if (hondo === 0 && (ch === "\n" || valor.startsWith(" · ", i))) { trozos.push(actual); actual = ""; if (ch !== "\n") i += 2; continue }
    actual += ch
  }
  trozos.push(actual)
  const salida: string[] = []
  for (const t of trozos.map((x) => x.trim()).filter(Boolean)) {
    if (salida.length && /^[a-záéíóúñ0-9$]/.test(t)) salida[salida.length - 1] += ` · ${t}`
    else salida.push(t)
  }
  return salida
}

/** la lista vuelve a su forma guardada después de retirar un elemento (una por línea, como la recibe «Editar») */
export const juntarLista = (items: string[]): string => items.join("\n")

/** el valor de un campo de texto (no lista), como lo ve el cliente: limpio y, si es una frase con su justificación, la frase */
export function campoLimpio(clave: string, valor: string): string {
  if (clave === "eslogan") return soloLaFrase(valor)
  return limpiarTexto(valor)
}
