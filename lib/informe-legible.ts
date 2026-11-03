/**
 * UN INFORME QUE SE LEE COMO DOCUMENTO (CC6 · 03-nov · encargo «textos de los paneles de campaña», punto 1 · mismo criterio que el manual limpio).
 * Lógica PURA: quita del texto los códigos de ficha («[6a0f94b0…]», «(ficha 6a0f94b0)», «[ficha 6a0f…, 9b1c…]») y la palabra «ficha» que los acompaña;
 * el formato (títulos, viñetas, negritas) lo pinta el componente. Lo guardado no se toca.
 */

/** un código de ficha: 6 o más caracteres hexadecimales CON letras y números a la vez (un teléfono «593123» o una palabra «decade» no lo son), quizá cortado con «…» */
const COD = String.raw`(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{6,}(?:-[0-9a-f]{2,})*(?:…|\.{3})?`
const LISTA = String.raw`(?:fichas?\s*:?\s*)?${COD}(?:\s*[,;y]\s*(?:fichas?\s*:?\s*)?${COD})*`

export function sinCodigosDeFicha(t: string): string {
  return t
    .replace(new RegExp(String.raw`\s*\[${LISTA}\]`, "gi"), "")
    .replace(new RegExp(String.raw`\s*\(${LISTA}\)`, "gi"), "")
    .replace(new RegExp(String.raw`\s*\b(?:según|ver|en)\s+(?:la\s+)?fichas?\s+${COD}(?:\s*[,;y]\s*${COD})*`, "gi"), "")
    .replace(new RegExp(String.raw`\bfichas?\s+${COD}`, "gi"), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:)])/g, "$1")
    .trim()
}

/** el texto listo para pintar: sin el rótulo de arriba («[informe de análisis …]»), sin códigos de ficha */
export const textoDelInforme = (t: string): string => sinCodigosDeFicha(t.replace(/^\s*\[informe de an[aá]lisis[^\]]*\]\s*/i, ""))
