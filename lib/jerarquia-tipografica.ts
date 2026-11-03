/**
 * LA JERARQUÍA TIPOGRÁFICA POR NIVELES (CC4 · 03-nov · corrección de Emilio y de CC3): el NIVEL define el uso, no la letra.
 * Nivel 1 = la que manda (títulos); cada letra puede subir (▲) o bajar (▼). Al mover, SOLO viaja la letra (con su peso): el rótulo y el uso de cada nivel
 * se quedan donde estaban y todo lo demás del texto (las reglas sueltas) se conserva tal cual. Lo que no se entiende no se ofrece para mover.
 *
 * Dos formas de escribirlo, las dos reales:
 *  · larga (manual v2 de Náufrago): «NIVEL 1 · NOMBRE DE MARCA / IDENTIDAD — Permanent Marker · peso Regular. · uso: logotipo escrito…»
 *  · corta: «Títulos: Alfa Slab One»
 * Cualquier otra línea (una regla: «máximo 2 familias…») es una regla: se muestra y se guarda igual, nunca es un nivel.
 */
import { TOPE_DEL_TEXTO_DEL_MANUAL } from "@/lib/manual"

export const USOS_POR_NIVEL: Array<{ corto: string; practico: string }> = [
  { corto: "Títulos", practico: "Para el nombre de la marca, los títulos grandes y las frases que se quieren recordar." },
  { corto: "Subtítulos", practico: "Para los subtítulos y las frases que acompañan a un título." },
  { corto: "Texto corrido", practico: "Para los párrafos, las descripciones y todo lo que se lee de corrido." },
  { corto: "Etiquetas y datos", practico: "Para botones, etiquetas, precios y datos cortos." },
  { corto: "Notas al pie", practico: "Para las notas pequeñas, los créditos y los detalles legales." },
]
export const usoCortoDelNivel = (nivel: number): string => USOS_POR_NIVEL[nivel - 1]?.corto ?? `Nivel ${nivel}`
export const usoPracticoDelNivel = (nivel: number): string => USOS_POR_NIVEL[nivel - 1]?.practico ?? "Para usos secundarios."

/** una línea del campo: o un nivel (con lo que va antes de la letra, la letra y lo que va después) o una regla suelta */
export type LineaDeJerarquia =
  | { tipo: "nivel"; antes: string; medio: string; despues: string; familia: string; rotulo: string; uso: string | null }
  | { tipo: "regla"; texto: string }
export interface JerarquiaLeida { lineas: LineaDeJerarquia[]; niveles: number; legible: boolean }

const LARGA = /^(\s*NIVEL\s+\d+\s*[·:\-—–]\s*)(.+?)(\s+[—–]\s+)(.+)$/i
const CORTA = /^([^:—–\-]{2,40}\s*[:—–-]\s*)(.+)$/
/** el nombre de una letra: 1 a 4 palabras que empiezan en mayúscula o número («Open Sans», «PT Serif»); una frase de regla («usa blanco sobre púrpura») no lo es */
const PARECE_UNA_LETRA = /^[A-ZÁÉÍÓÚÑ0-9][\p{L}\d]*(\s+[A-ZÁÉÍÓÚÑ0-9][\p{L}\d]*){0,3}$/u
const familiaDe = (medio: string): string => medio.split(/\s*·\s*peso\b/i)[0].replace(/[.\s]+$/, "").trim()

/** lee el campo (una línea por texto, o «a · b» si llegó pegado); nada se inventa: lo que no es un nivel queda como regla */
export function leerJerarquia(texto: string | null): JerarquiaLeida {
  const lineas: LineaDeJerarquia[] = []
  let sinEntender = false
  for (const cruda of (texto ?? "").split(/\r?\n/)) {
    const t = cruda.trim()
    if (!t) continue
    const l = LARGA.exec(t)
    if (l) {
      const partes = l[4].split(/(\s*·?\s*uso:\s*)/i)   // [pre, separador, uso…]
      const medio = partes[0]
      const familia = familiaDe(medio)
      if (!familia || familia.length > 60) { sinEntender = true; lineas.push({ tipo: "regla", texto: t }); continue }
      lineas.push({ tipo: "nivel", antes: l[1] + l[2] + l[3], medio, despues: partes.slice(1).join(""), familia, rotulo: l[2].trim(), uso: partes.length > 2 ? partes.slice(2).join("").trim() : null })
      continue
    }
    if (/^\s*NIVEL\b/i.test(t)) { sinEntender = true; lineas.push({ tipo: "regla", texto: t }); continue }
    const c = t.length <= 80 ? CORTA.exec(t) : null
    if (c && PARECE_UNA_LETRA.test(familiaDe(c[2]))) lineas.push({ tipo: "nivel", antes: c[1], medio: c[2], despues: "", familia: familiaDe(c[2]), rotulo: c[1].replace(/\s*[:—–-]\s*$/, "").trim(), uso: null })
    else lineas.push({ tipo: "regla", texto: t })
  }
  const niveles = lineas.filter((x) => x.tipo === "nivel").length
  return { lineas, niveles, legible: niveles > 0 && !sinEntender }
}

/** sube (-1) o baja (+1) la letra del nivel `n` (0 = el primero); solo viajan la letra y su peso: el rótulo y el uso del nivel se quedan; en los extremos no cambia nada */
export function moverDeNivel(j: JerarquiaLeida, n: number, sentido: -1 | 1): JerarquiaLeida {
  const pos = j.lineas.flatMap((x, i) => (x.tipo === "nivel" ? [i] : []))
  const a = pos[n], b = pos[n + sentido]
  if (a === undefined || b === undefined) return j
  const A = j.lineas[a], B = j.lineas[b]
  if (A.tipo !== "nivel" || B.tipo !== "nivel") return j
  const lineas = [...j.lineas]
  lineas[a] = { ...A, medio: B.medio, familia: B.familia }
  lineas[b] = { ...B, medio: A.medio, familia: A.familia }
  return { ...j, lineas }
}

/** lo que se guarda: las mismas líneas, en el mismo orden; solo cambió la letra de los niveles que se movieron */
export const textoDeLaJerarquia = (j: JerarquiaLeida): string => j.lineas.map((x) => (x.tipo === "nivel" ? x.antes + x.medio + x.despues : x.texto)).join("\n")

/** ¿se ofrece mover los niveles? solo si todo se entendió, hay dos o más, el texto cabe en lo que la puerta acepta (2.000) */
export const puedeMoverNiveles = (texto: string | null): boolean => { const j = leerJerarquia(texto); return j.legible && j.niveles >= 2 && textoDeLaJerarquia(j).length <= TOPE_DEL_TEXTO_DEL_MANUAL }

/** ¿el uso de un nivel nombra una letra concreta? Si es así, al cambiar las letras de nivel ese uso quedaría hablando de la letra anterior: no se muestra (el dato guardado no se toca) */
export const usoNombraUnaLetra = (uso: string | null, letras: string[]): boolean => !!uso && letras.some((f) => !!f && uso.toLowerCase().includes(f.toLowerCase()))
