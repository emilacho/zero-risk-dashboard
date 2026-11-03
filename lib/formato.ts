/**
 * FORMATO ÚNICO DEL DASHBOARD (sprint 3-nov): dinero, hora y cantidades grandes se escriben en UN solo lugar.
 * Dinero con coma decimal · horas en 24 h · cantidades grandes en palabras.
 */
export { usdES as dinero, usdFinoES as dineroFino } from "./lenguaje"

/** opciones de hora en 24 h para toLocaleString/toLocaleTimeString: «14:29», nunca «02:29 p. m.» */
export const HORA_24 = { hour: "2-digit", minute: "2-digit", hour12: false } as const

/** «3 millones», «3,5 millones», «820 mil», «950»: para tokens y otras cantidades grandes */
export function cantidadEnPalabras(n: number): string {
  if (!Number.isFinite(n)) return "—"
  const a = Math.abs(n)
  const fino = (v: number) => (Math.round(v * 10) / 10).toLocaleString("es-EC", { maximumFractionDigits: 1 })
  if (a >= 1_000_000) {
    const m = a / 1_000_000
    const t = fino(m)
    return `${n < 0 ? "-" : ""}${t} ${t === "1" ? "millón" : "millones"}`
  }
  if (a >= 10_000) return `${n < 0 ? "-" : ""}${Math.round(a / 1000).toLocaleString("es-EC")} mil`
  return Math.round(n).toLocaleString("es-EC")
}

/** «3 millones de tokens» */
export const tokensEnPalabras = (n: number): string => `${cantidadEnPalabras(n)} de tokens`
