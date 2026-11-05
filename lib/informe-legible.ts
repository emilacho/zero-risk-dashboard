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

/**
 * EL TEXTO DE UN INFORME DE LA MESA DE ANÁLISIS, SIN CÓDIGOS NI LA PALABRA «FICHA» (GO de Lenovo, 05-nov · CC6 midió 12 códigos y 8 «ficha» en un solo informe).
 * Solo para estos informes: sus analistas citan el cerebro de varias formas que el limpiador general no ve y, en ellos, «ficha» habla del cerebro.
 * Formas reales: «[ficha:1c91df08 · ficha:6733fe3e]» · «[6a9f94b0 · 2026-11-02] y [e8f664a3 · 2026-11-03]» · «[79396597]» (solo números) · el código completo ·
 * y el código suelto en la frase («Las reseñas 113f3e02 y 2cad4b07 son copias»). Lo guardado no se toca y los saltos de línea se respetan.
 * Reserva: un código suelto entre paréntesis se queda («(ab12cd34)» puede ser de un producto), igual que en el limpiador general.
 */
const HEX = String.raw`[0-9a-f]{8,}(?:-[0-9a-f]{2,})*(?:…|\.{3})?`
const CITA = String.raw`(?:fichas?[ \t]*:?[ \t]*)?${HEX}(?:[ \t]*·[ \t]*\d{4}-\d{2}-\d{2})?`
const CORCHETES = String.raw`\[${CITA}(?:[ \t]*[·,;][ \t]*${CITA})*\]`
const CADENA = new RegExp(String.raw`[ \t]*(?:·[ \t]*)?${CORCHETES}(?:[ \t]*(?:[·,;]|\by\b)?[ \t]*${CORCHETES})*`, "gi")
const FICHA_CON_CODIGO = new RegExp(String.raw`[ \t]*\bfichas?[ \t]*:?[ \t]*${HEX}`, "gi")
/** suelto en la frase: 8 caracteres (o el código completo) con letras y números a la vez, para no llevarse una palabra ni una cifra. Pegado a «/ # @ .» es parte de una dirección, un archivo o una cuenta (CC6, 05-nov): se queda */
const SUELTO = String.raw`(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{8}(?:-[0-9a-f]{4}){0,3}(?:-[0-9a-f]{12})?(?![0-9a-zA-Z/@]|\.[a-zA-Z])`
const SUELTOS = new RegExp(String.raw`[ \t]*(?<![(\w/#@.-])${SUELTO}(?:[ \t]*(?:,|\by\b)[ \t]*${SUELTO})*`, "gi")
/** lo que queda colgando al quitar un código al final de la frase: «igual que .» */
const COLGANDO = /[ \t]*,?[ \t]*(?<![\p{L}\p{N}])(?:igual que|como|según|de|en|con|y|o)(?=[ \t]*[.;](?:\s|$))/giu
/** la ficha del mundo real (la de Google Maps, la técnica de un producto) se queda; la del cerebro se dice «fuente», que concuerda igual («ninguna de las fichas leídas») */
const FICHA = /(?<![\p{L}\p{N}/#@._-])(f)icha(s?)(?![\p{L}\p{N}])(?![/_-]|\.[\p{L}\p{N}])(?![ \t]+(?:de[ \t]+(?:Google|Mapas?|Maps|producto)|t[ée]cnicas?))/giu

/**
 * LO QUE NO SE TOCA (arreglo de raíz, Lenovo 05-nov tras la certificación de CC6 a #287): direcciones, correos, rutas, archivos, cuentas y etiquetas
 * se apartan ENTEROS antes de limpiar y se devuelven tal cual después. Así un código o la palabra «ficha» dentro de ellos no se toca, venga como venga.
 */
const APARTAR = new RegExp(
  [
    String.raw`(?:https?:\/\/|www\.)[^\s<>()\[\]{}"'«»]+`, // dirección web, con sus parámetros
    String.raw`[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+`, // correo
    String.raw`[A-Za-z]:\\[^\s<>()\[\]"'«»]+`, // ruta de Windows
    String.raw`(?<![\p{L}\p{N}@])[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*\.(?:com|net|org|ec|co|io|app|es|info|biz|gob|edu)(?:\.[a-z]{2})?\b(?:\/[^\s<>()\[\]"'«»]*)?`, // dominio sin «https://»
    String.raw`[\p{L}\p{N}_-]+\.(?:jpe?g|png|gif|webp|svg|heic|pdf|mp4|mov|webm|mp3|wav|docx?|xlsx?|pptx?|csv|txt|zip)\b`, // archivo
    String.raw`(?<![\p{L}\p{N}])[@#][\p{L}\p{N}_.]*[\p{L}\p{N}_]`, // cuenta o etiqueta
  ].join("|"),
  "giu",
)
/** la marca que ocupa el lugar de lo apartado: ningún limpiador la reconoce (sin letras, sin hexadecimal de 8, sin espacios) */
const marca = (i: number) => `\uE000${i}\uE001`
const MARCA = /\uE000(\d+)\uE001/g

export function textoDeLaMesa(t: string): string {
  const apartado: string[] = []
  const limpio = t.replace(APARTAR, (m) => marca(apartado.push(m) - 1))
  // primero las formas de la mesa: el limpiador general se lleva los corchetes pero no el «·» que los separa, y quedaría «· ·»
  return textoDelInforme(
    limpio
      .replace(CADENA, "")
      .replace(FICHA_CON_CODIGO, "")
      .replace(SUELTOS, "")
      .replace(COLGANDO, "")
      .replace(/\ben ficha\b(?![ \t]+de\b)/gi, "en una fuente")
      .replace(FICHA, (_, f: string, s: string) => `${f}uente${s}`),
  ).replace(MARCA, (_, i: string) => apartado[Number(i)] ?? "")
}
