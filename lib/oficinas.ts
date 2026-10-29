/**
 * LAS OFICINAS (CC#1 · 29-oct · parte 2 del dashboard): lógica PURA de la pantalla «¿cómo está cada oficina?». Cada tarjeta dice lo que la base dice HOY (estado real, últimos 7 días,
 * lo que espera de Emilio); si una lectura falla la tarjeta lo dice, nunca inventa un número.
 */
export const DIAS_DE_LA_VENTANA = 7

export type Semaforo = "verde" | "ambar" | "rojo" | "gris"

/** el interruptor de cada oficina: encendida, apagada o en ensayo (con clientes de práctica) */
export function semaforoDelInterruptor(estado: string | null | undefined, ensayo: unknown): { semaforo: Semaforo; texto: string } {
  const e = String(estado ?? "").toLowerCase()
  const hayEnsayo = Array.isArray(ensayo) && ensayo.length > 0
  if (e === "encendida") return hayEnsayo ? { semaforo: "ambar", texto: "Encendida solo para clientes de práctica" } : { semaforo: "verde", texto: "Encendida" }
  if (e === "apagada") return { semaforo: "gris", texto: "Apagada" }
  if (!e) return { semaforo: "rojo", texto: "Sin lectura del interruptor" }
  return { semaforo: "ambar", texto: `Estado: ${e}` }
}

export const haceCuanto = (iso: string | null | undefined, ahora: Date = new Date()): string => {
  if (!iso) return "sin actividad registrada"
  const ms = ahora.getTime() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return "sin actividad registrada"
  if (ms < 90_000) return "hace un momento"
  if (ms < 3_600_000) return `hace ${Math.floor(ms / 60_000)} min`
  if (ms < 86_400_000) return `hace ${Math.floor(ms / 3_600_000)} h`
  return `hace ${Math.floor(ms / 86_400_000)} d`
}

/** cuenta por valor de una columna: `{ cerrado: 22, fallido: 12 }` */
export function agrupar<T extends Record<string, unknown>>(filas: T[], columna: keyof T): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of filas) { const k = String(f[columna] ?? "—"); out[k] = (out[k] ?? 0) + 1 }
  return out
}

export const suma = (filas: Array<Record<string, unknown>>, columna: string): number => {
  let t = 0
  for (const f of filas) { const v = Number(f[columna]); if (Number.isFinite(v)) t += v }
  return Math.round(t * 1e6) / 1e6
}

export const desde = (dias: number, ahora: Date = new Date()): string => new Date(ahora.getTime() - dias * 86_400_000).toISOString()

export const usd = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? "—" : `US$ ${n.toFixed(2)}`)

export interface Dato { etiqueta: string; valor: string; alerta?: boolean }
export interface TarjetaDeOficina {
  clave: "creativa" | "financiera" | "jefatura" | "cerebro" | "planeacion"
  nombre: string
  que_hace: string
  semaforo: Semaforo
  estado_texto: string
  datos: Dato[]
  ultima_actividad: string | null
  espera: string[]
  detalle: string[]
  enlace?: { href: string; texto: string }
  /** si la lectura falló: lo que dijo la base (la tarjeta lo enseña en vez de un número) */
  error?: string
}

export const ORDEN_DE_LAS_OFICINAS: TarjetaDeOficina["clave"][] = ["creativa", "financiera", "jefatura", "cerebro", "planeacion"]

/** la tarjeta que se muestra cuando una oficina no se pudo leer */
export const tarjetaConError = (clave: TarjetaDeOficina["clave"], nombre: string, que_hace: string, error: string): TarjetaDeOficina => ({ clave, nombre, que_hace, semaforo: "rojo", estado_texto: "No pude leerla", datos: [], ultima_actividad: null, espera: [], detalle: [], error })

/** la peor luz de las tarjetas (para el resumen de arriba) */
export function peorSemaforo(t: TarjetaDeOficina[]): Semaforo {
  const orden: Semaforo[] = ["rojo", "ambar", "verde", "gris"]
  for (const s of orden) if (t.some((x) => x.semaforo === s)) return s
  return "gris"
}
