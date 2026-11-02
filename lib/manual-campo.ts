/**
 * EL CAMPO DEL MANUAL EN UNA TARJETA (CC6 · 02-nov · Emilio: «que esté bien segmentado… él va a revisar, corregir y certificar»).
 * Lógica PURA: de dónde salió cada campo y si está validado, en palabras. Nada se inventa: el origen sale de quién lo escribió (`_field_meta.fuente`
 * = dueño, o lo aceptó al validar) o de la nota de fuente que dejó la corrida; si no hay nota, se dice «sin dato de origen».
 */
import type { CampoLeido } from "@/lib/manual-lector"

export type OrigenDelCampo = "dueno" | "aceptado" | "sitio_redes" | "propuesta" | "sistema" | "sin_dato"
export const ORIGEN_LEGIBLE: Record<OrigenDelCampo, string> = {
  dueno: "dicho por el dueño",
  aceptado: "aceptado por el dueño",
  sitio_redes: "encontrado en sitio y redes",
  propuesta: "propuesta del agente",
  sistema: "del análisis del sistema",
  sin_dato: "sin dato de origen",
}
/** de dónde salió el valor de un campo */
export function origenDelCampo(c: Pick<CampoLeido, "origen" | "estado" | "valor"> & { fuente?: string | null }): OrigenDelCampo {
  if (c.origen === "dueno") return "dueno"
  if (c.origen === "aceptado") return "aceptado"
  const f = String(c.fuente ?? "").toLowerCase()
  if (c.estado === "propuesta" || /^propuesta|propuesta editorial|inferid/.test(f)) return "propuesta"
  // una nota que empieza por el análisis del sistema es eso, aunque mencione «sitio web» o «Instagram» en su texto
  if (/^(discovery|an[aá]lisis|icp|resumen de descubrimiento)/.test(f.trim())) return "sistema"
  if (/(instagram|facebook|tiktok|linkedin|youtube|sitio|web|perfil|redes|mapas?|google|rese[ñn]a|cita[s]? (directa|del cliente))/.test(f)) return "sitio_redes"
  if (f.trim()) return "sistema"
  return "sin_dato"
}
/** validado: lo escribió o lo aceptó el dueño, o el manual entero está validado (por el dueño o la jefatura) */
export function campoValidado(c: Pick<CampoLeido, "origen" | "valor">, validadoPor: "jefatura" | "dueno" | "propuesta"): boolean {
  if (!c.valor) return false
  return c.origen === "dueno" || c.origen === "aceptado" || validadoPor !== "propuesta"
}
/** «Validar» un campo = el dueño lo da por bueno tal cual: se guarda como escrito por él (misma puerta que «Editar», sin cambiar el texto) */
export const PORQUE_DE_VALIDAR = "validado por el dueño sin cambios"
/** el valor recortado para la tarjeta: hasta `n` caracteres, cortando en palabra */
export function valorCorto(v: string | null, n = 280): { texto: string; recortado: boolean } {
  const t = (v ?? "").trim()
  if (t.length <= n) return { texto: t, recortado: false }
  return { texto: `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…`, recortado: true }
}
