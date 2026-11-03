/**
 * UN INFORME QUE SE LEE COMO DOCUMENTO (CC6 · 03-nov · encargo «textos de los paneles de campaña», punto 1 · mismo criterio que el manual limpio).
 * Lógica PURA: quita del texto los códigos de ficha («[6a0f94b0…]», «(ficha 6a0f94b0)», «[ficha 6a0f…, 9b1c…]») y la palabra «ficha» que los acompaña;
 * el formato (títulos, viñetas, negritas) lo pinta el componente. Lo guardado no se toca.
 * Reservas de CC3 (03-nov): un código suelto entre PARÉNTESIS solo se quita si va con «ficha» o termina en «…» (un «(ab1234)» de producto se queda);
 * un código mide 8 o más (el principio de la ficha); «Ver [ficha …].» se va entero (no queda «Ver.»).
 */

/** un código de ficha: 8 o más caracteres hexadecimales CON letras y números a la vez (un teléfono «593123» o una palabra no lo son), quizá cortado con «…» */
const COD = String.raw`(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{8,}(?:-[0-9a-f]{2,})*(?:…|\.{3})?`
const VARIOS = String.raw`${COD}(?:\s*[,;y]\s*(?:fichas?\s*:?\s*)?${COD})*`
const LISTA = String.raw`(?:fichas?\s*:?\s*)?${VARIOS}`
/** entre paréntesis hace falta una señal de que es una ficha: la palabra o el «…» del final */
const EN_PARENTESIS = String.raw`(?:fichas?\s*:?\s*${VARIOS}|${COD.replace("(?:…|\\.{3})?", "(?:…|\\.{3})")}(?:\s*[,;y]\s*${COD})*)`
const VERBO = String.raw`(?:ver|v[ée]ase|seg[uú]n|fuente:?|fuentes:?)`

export function sinCodigosDeFicha(t: string): string {
  return t
    // la cita que es TODA la oración («Ver [ficha …].», «Fuente: [6a0f…].») se va con su punto; en medio de una oración, solo el verbo y la cita
    .replace(new RegExp(String.raw`(^|[.!?]\s+)${VERBO}\s*(?:\[${LISTA}\]|\(${EN_PARENTESIS}\))\s*\.\s*`, "gi"), "$1")
    .replace(new RegExp(String.raw`\s*\b${VERBO}\s*(?:\[${LISTA}\]|\(${EN_PARENTESIS}\))`, "gi"), "")
    .replace(new RegExp(String.raw`\s*\[${LISTA}\]`, "gi"), "")
    .replace(new RegExp(String.raw`\s*\(${EN_PARENTESIS}\)`, "gi"), "")
    .replace(new RegExp(String.raw`\s*\b(?:según|ver|en)\s+(?:la\s+)?fichas?\s+${VARIOS}`, "gi"), "")
    .replace(new RegExp(String.raw`\bfichas?\s+${VARIOS}`, "gi"), "")
    .replace(/\s*\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/([.!?])\.+/g, "$1")
    .replace(/([,;])\s*[,;]/g, "$1")
    .trim()
}

/** el texto listo para pintar: sin el rótulo de arriba («[informe de análisis …]»), sin códigos de ficha */
export const textoDelInforme = (t: string): string => sinCodigosDeFicha(t.replace(/^\s*\[informe de an[aá]lisis[^\]]*\]\s*/i, ""))
