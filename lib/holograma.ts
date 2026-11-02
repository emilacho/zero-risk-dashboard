/**
 * EL HOLOGRAMA DE CADA EMPLEADO (CC4 · 02-nov · ADENDA 3): la silueta de luz ámbar de la escena Y el busto de la ficha son el MISMO personaje.
 * Cada empleado lleva un toque PROPIO y estable que no se repite con otro: se combinan cabello, accesorio, ropa, contextura y altura (5.760 combinaciones; los
 * 8 detalles de la maqueta eran solo ejemplos). Todo sale de la huella del identificador, así que no cambia entre visitas ni cuando entran empleados nuevos.
 * Una prueba comprueba que nadie del organigrama comparte combinación; si un empleado nuevo choca con otro, se mueve su `SAL` o se fija en `AJUSTES`.
 * Lo comparten `Holograma.tsx` (cuerpo entero en la escena) y el retrato de la ficha (CC6).
 */
import { huella } from "@/lib/escena-empleado"

export const CABELLOS = ["rapado", "corto", "largo", "mono", "coleta", "rizos", "cola_alta", "melena"] as const
export type Cabello = (typeof CABELLOS)[number]
export const ACCESORIOS = ["ninguno", "gorra", "lentes", "auricular", "bufanda", "corbata", "audifonos", "mochila", "portafolio", "tablet", "baston", "sombrero"] as const
export type Accesorio = (typeof ACCESORIOS)[number]
export const ROPAS = ["pantalon", "falda", "vestido", "chaqueta", "chaleco"] as const
export type Ropa = (typeof ROPAS)[number]
export const CONTEXTURAS = ["delgada", "media", "gruesa"] as const
export type Contextura = (typeof CONTEXTURAS)[number]
/** la altura relativa de la silueta (4 niveles bien separados) */
export const ALTURAS = [0.9, 0.97, 1.04, 1.11] as const

export const NOMBRE_DEL_CABELLO: Record<Cabello, string> = { rapado: "rapado", corto: "cabello corto", largo: "cabello largo", mono: "moño", coleta: "coleta", rizos: "rizos", cola_alta: "cola alta", melena: "melena al mentón" }
export const NOMBRE_DEL_ACCESORIO: Record<Accesorio, string> = { ninguno: "sin accesorio", gorra: "gorra", lentes: "lentes", auricular: "auricular", bufanda: "bufanda", corbata: "corbata", audifonos: "audífonos", mochila: "mochila", portafolio: "portafolio", tablet: "tablet", baston: "bastón", sombrero: "sombrero" }
export const NOMBRE_DE_LA_ROPA: Record<Ropa, string> = { pantalon: "pantalón", falda: "falda", vestido: "vestido largo", chaqueta: "chaqueta", chaleco: "chaleco" }
export const NOMBRE_DE_LA_CONTEXTURA: Record<Contextura, string> = { delgada: "contextura delgada", media: "contextura media", gruesa: "contextura más gruesa" }

/** el ancho relativo del cuerpo: la gruesa tiene que verse CLARAMENTE más ancha (~1,5 veces la media, con forma humana redondeada, no una caja) */
export const ANCHO_DE_LA_CONTEXTURA: Record<Contextura, number> = { delgada: 0.9, media: 1.06, gruesa: 1.6 }

/** cambia este número si dos empleados del organigrama llegaran a chocar (la prueba lo avisa) */
export const SAL = "h1"
/** combinaciones fijadas a mano (identificador canónico → índice), por si un empleado nuevo choca con otro */
export const AJUSTES: Record<string, number> = {}
export const TOTAL_DE_COMBINACIONES = CABELLOS.length * ACCESORIOS.length * ROPAS.length * CONTEXTURAS.length * ALTURAS.length

export interface RasgosDelHolograma {
  cabello: Cabello
  accesorio: Accesorio
  ropa: Ropa
  contextura: Contextura
  altura: number
  /** 0,95–1,05 · ajuste fino del ancho de hombros (no cuenta para la combinación) */
  hombros: number
  /** 0 visor corrido · 1 visor de un ojo · 2 dos lentes */
  visor: 0 | 1 | 2
  /** 0 sin antena · 1 antena corta · 2 antena con punta */
  antena: 0 | 1 | 2
  /** 0 placa redonda · 1 placa en banda · 2 placa en rombo */
  placa: 0 | 1 | 2
  /** 0 líneas en el hombro · 1 en el costado · 2 en el cuello */
  circuito: 0 | 1 | 2
  /** 0 cabeza redonda · 1 con casco liso · 2 con cresta */
  cabeza: 0 | 1 | 2
  /** la combinación completa, 0..TOTAL-1 (la identidad visible del empleado) */
  indice: number
}
const canon = (s: string): string => s.trim().toLowerCase().replace(/[_\s]+/g, "-")
export function indiceDeCombinacion(semilla: string): number {
  const k = canon(semilla)
  return k in AJUSTES ? AJUSTES[k] : huella(`${k}·${SAL}`) % TOTAL_DE_COMBINACIONES
}
/** el accesorio manda sobre el cabello cuando se tapan (la gorra y el sombrero cubren el pelo largo de arriba, no el de atrás) */
export function rasgosDelHolograma(semilla: string): RasgosDelHolograma {
  const k = canon(semilla)
  let n = indiceDeCombinacion(k)
  const indice = n
  const cabello = CABELLOS[n % CABELLOS.length]; n = Math.floor(n / CABELLOS.length)
  const accesorio = ACCESORIOS[n % ACCESORIOS.length]; n = Math.floor(n / ACCESORIOS.length)
  const ropa = ROPAS[n % ROPAS.length]; n = Math.floor(n / ROPAS.length)
  const contextura = CONTEXTURAS[n % CONTEXTURAS.length]; n = Math.floor(n / CONTEXTURAS.length)
  const altura = ALTURAS[n % ALTURAS.length]
  const h = huella(`${k}·holograma`), g = huella(`${k}·robot`)
  return {
    cabello, accesorio, ropa, contextura, altura, indice,
    hombros: 0.95 + ((h >>> 5) % 11) / 100,
    visor: ((h >>> 9) % 3) as 0 | 1 | 2, antena: ((g >>> 2) % 3) as 0 | 1 | 2, placa: ((g >>> 5) % 3) as 0 | 1 | 2,
    circuito: ((g >>> 8) % 3) as 0 | 1 | 2, cabeza: ((h >>> 12) % 3) as 0 | 1 | 2,
  }
}
/** en palabras: «cabello largo · lentes · vestido largo · contextura media» (para la etiqueta de accesibilidad y la ficha) */
export function descripcionDelHolograma(semilla: string): string {
  const r = rasgosDelHolograma(semilla)
  return [NOMBRE_DEL_CABELLO[r.cabello], r.accesorio === "ninguno" ? null : NOMBRE_DEL_ACCESORIO[r.accesorio], NOMBRE_DE_LA_ROPA[r.ropa], NOMBRE_DE_LA_CONTEXTURA[r.contextura]].filter(Boolean).join(" · ")
}
export const AMBAR_HOLOGRAMA = "#ffb347"
