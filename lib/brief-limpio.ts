/**
 * LA VISTA LIMPIA DEL BRIEF (GO Lenovo 18-nov 13:08Z · punto 2 de la DECISIÓN de Emilio de las 14:00 · CC5).
 * Solo cambia lo que VE Emilio en «Brief de campaña». La versión interna (`texto_md`) no se toca: los agentes y los chequeos la siguen leyendo entera.
 * Se quita, con regla exacta:
 *   · el id del brief en el título («… · brf-36e661793061-v1»);
 *   · las marcas de fuente en cursiva: `*(fuente: …)*`, `*(Fuente: …)*`, `*(Fundado en: …)*`, `*(resumen, no cita literal …)*`;
 *   · los códigos de aporte de la mesa: «(aporte A6)», «(A6)»;
 *   · dos secciones enteras: «Citas» (el material de la mesa) y «De qué parte del plan sale» (las citas que usa el chequeo).
 * Una fuente nombrada dentro de la prosa («según el plan v3») se queda: solo se quita el paréntesis-marca.
 */

/** las secciones que son material interno, no del brief que lee Emilio */
export const SECCIONES_INTERNAS_DEL_BRIEF = ["Citas", "De qué parte del plan sale"] as const

const ID_EN_EL_TITULO = /\s*·\s*brf-[0-9a-f]+-v\d+\s*$/i
// la marca entera, en cursiva y en una sola línea; termina en el primer «)*»
const MARCA_DE_FUENTE = /\s*\*\((?:fuente|fundado en|resumen, no cita literal)\b[^\n]*?\)\*/gi
const CODIGO_DE_APORTE = /\s*\((?:aporte\s+)?A\d+\)/g
const normal = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()
const INTERNAS = new Set<string>(SECCIONES_INTERNAS_DEL_BRIEF.map(normal))

export function briefLimpio(md: string | null | undefined): string {
  const lineas = String(md ?? "").replace(/\r\n/g, "\n").split("\n")
  const out: string[] = []
  let saltando = false
  let primerTitulo = true
  for (const l of lineas) {
    const titulo = /^(#{1,3})\s+(.+?)\s*$/.exec(l)
    if (titulo) {
      saltando = titulo[1].length === 2 && INTERNAS.has(normal(titulo[2]))
      if (saltando) continue
      if (primerTitulo) { primerTitulo = false; out.push(l.replace(ID_EN_EL_TITULO, "")); continue }
    }
    if (saltando) continue
    out.push(l.replace(MARCA_DE_FUENTE, "").replace(CODIGO_DE_APORTE, "").replace(/[ \t]+$/, ""))
  }
  // las líneas que eran solo una marca quedan vacías: no más de una línea en blanco seguida, y sin separador suelto al final
  return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/(\n\s*---\s*)+$/, "").trim()
}
