/**
 * EL PLANTEL DE CADA EQUIPO · reglas puras (CC4 · 02-nov · «Squad Hub» como el de EA FC, boceto aprobado por Emilio 18:23Z).
 * Las tres reglas aprobadas: ROL (cuánto trabaja), MORAL (cuántas entregas le devolvieron) y dónde vive (tocar el equipo abre el plantel; tocar la flecha, el detalle).
 * Todo sale de datos reales; lo que no hay se dice «–» o «sin dato todavía». Informa: no bloquea ni decide nada sobre el empleado.
 */
export type Rol = "Crucial" | "Importante" | "Ocasional" | "Sin estrenar" | "En prueba"
export const VENTANA_DE_TRABAJO_DIAS = 30
export const DIAS_EN_PRUEBA = 14
/** el rol: En prueba (entró hace menos de 14 días) manda sobre las demás; si no, por trabajos en 30 días: Crucial ≥20 · Importante 5–19 · Ocasional 1–4 · Sin estrenar 0 */
export function rolDe(o: { trabajos30d: number; desde: string | null; ahora: Date }): Rol {
  const entro = o.desde ? Date.parse(o.desde) : NaN
  if (!Number.isNaN(entro) && o.ahora.getTime() - entro < DIAS_EN_PRUEBA * 86_400_000) return "En prueba"
  if (o.trabajos30d >= 20) return "Crucial"
  if (o.trabajos30d >= 5) return "Importante"
  if (o.trabajos30d >= 1) return "Ocasional"
  return "Sin estrenar"
}
export const COLOR_DEL_ROL: Record<Rol, string> = { Crucial: "#fde68a", Importante: "#e7e5e4", Ocasional: "#a8a29e", "En prueba": "#93c5fd", "Sin estrenar": "#71717a" }

export type Moral = "verde" | "amarilla" | "roja"
export const MINIMO_PARA_LA_MORAL = 3
/** la moral: de sus entregas contables, cuántas le devolvieron (con 3 o más): ninguna → verde · hasta la mitad → amarilla · más de la mitad → roja; con menos de 3, sin carita */
export function moralDe(devueltas: number, contables: number): Moral | null {
  if (contables < MINIMO_PARA_LA_MORAL) return null
  if (devueltas <= 0) return "verde"
  return devueltas * 2 <= contables ? "amarilla" : "roja"
}
export const CARA: Record<Moral, { color: string; texto: string; boca: string }> = {
  verde: { color: "#4ade80", texto: "Contento", boca: "M7 12.5q4 3.5 8 0" },
  amarilla: { color: "#facc15", texto: "Regular", boca: "M7 13h8" },
  roja: { color: "#f87171", texto: "Molesto", boca: "M7 14q4 -3.5 8 0" },
}

/** el color de un número de valoración, como el juego: verde alto · amarillo medio · naranja/rojo bajo */
export const colorDeNota = (n: number | null): string => (n == null ? "#71717a" : n >= 80 ? "#4ade80" : n >= 70 ? "#a3e635" : n >= 60 ? "#facc15" : n >= 50 ? "#fb923c" : "#f87171")

/** la valoración media del equipo: solo de quienes tienen valoración; sin ninguna, null */
export function mediaDelEquipo(notas: Array<number | null | undefined>): number | null {
  const v = notas.filter((x): x is number => typeof x === "number")
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}

/** las 10 dimensiones agrupadas como los atributos de la carta (no cambian: son las del diseño aprobado) */
export const BLOQUES_DE_DIMENSIONES: Array<[string, number[]]> = [["Calidad", [1, 3, 7]], ["Trabajo", [2, 4, 10]], ["Equipo", [8, 9]], ["Datos", [5, 6]]]

/** la sigla del equipo arriba a la derecha (DIR · EST · CRE …) */
export const siglaDelEquipo = (clave: string): string => clave.slice(0, 3).toUpperCase()

/** lo que el plantel necesita de cada empleado además de su rendimiento */
export interface DatosDelPlantel { trabajos_30d: number; desde: string | null; modelo: string | null; activo: boolean | null; costo_vs_promedio_pct: number | null }
export interface PlantelDeLaOficina { empleados: Record<string, DatosDelPlantel>; leido_en: string }

const mediana = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
/** el costo de su último mes frente a su propia mediana de los tres meses (solo en %, sin dólares: el gasto se ve en Dinero); con menos de 3 trabajos en el mes o sin costo, null */
export function costoFrenteASuPromedio(delMes: Array<number | null>, deTodos: Array<number | null>): number | null {
  const a = delMes.filter((x): x is number => typeof x === "number" && x > 0), b = deTodos.filter((x): x is number => typeof x === "number" && x > 0)
  if (a.length < 3 || !b.length) return null
  const base = mediana(b)!
  return Math.round(((mediana(a)! - base) / base) * 100)
}

/**
 * 03-nov (auditoría punto 15) · POR QUÉ una celda sale sin número: en vez de una raya, cuántas entregas revisadas por la jefatura tiene y cuántas hacen falta.
 * La valoración (VAL) pide 5 revisadas; la forma, 5 recientes y 5 anteriores; la moral, 3 contables. Nada se inventa: si no llega al mínimo, se dice así.
 */
export const FALTAN_PARA_VAL = 5
export const FALTAN_PARA_FORMA = 10
export interface FaltasDeLaFicha { revisadas: number; val: { tiene: number; hace_falta: number; no_cuentan: boolean } | null; forma: { tiene: number; hace_falta: number; no_cuentan: boolean } | null; moral: { tiene: number; hace_falta: number } | null; frase: string | null }
export function faltasDeLaFicha(x: { revisadas: number; previas: number; contables: number; puntaje: number | null; forma: unknown } | null | undefined): FaltasDeLaFicha {
  const revisadas = x?.revisadas ?? 0, previas = x?.previas ?? 0, contables = x?.contables ?? 0
  // con 5 o más entregas revisadas y aun así sin nota: ninguna cuenta (cortadas por tope o fallidas); no se dice «5/5»
  const noCuentanVal = revisadas >= FALTAN_PARA_VAL
  const val = x?.puntaje != null ? null : { tiene: Math.min(revisadas, FALTAN_PARA_VAL), hace_falta: FALTAN_PARA_VAL, no_cuentan: noCuentanVal }
  const forma = x?.forma ? null : { tiene: Math.min(revisadas, 5) + Math.min(previas, 5), hace_falta: FALTAN_PARA_FORMA, no_cuentan: revisadas >= 5 && previas >= 5 }
  const moral = contables >= MINIMO_PARA_LA_MORAL ? null : { tiene: contables, hace_falta: MINIMO_PARA_LA_MORAL }
  const frase = !val ? null
    : noCuentanVal ? `Tiene ${revisadas} entregas revisadas, pero ninguna cuenta para la nota (cortadas por tope o fallidas).`
    : revisadas === 0 ? "Todavía no tiene entregas revisadas por la jefatura: la valoración llega con 5."
    : `Tiene ${revisadas} ${revisadas === 1 ? "entrega revisada" : "entregas revisadas"} por la jefatura; hacen falta 5 para la valoración.`
  return { revisadas, val, forma, moral, frase }
}
