/**
 * MAPA (CC#1 · 29-oct · parte 5 del dashboard): el recorrido de una pieza, de izquierda a derecha: Brief → Oficina creativa → Mesa → Jefatura → Bandeja.
 * Cada estación cuenta lo que pasó por ella en 7 días (solo trabajo real, sin ensayos); cada pieza se coloca donde la base dice que está, nunca donde «debería».
 */
export type Estacion = "brief" | "oficina" | "mesa" | "jefatura" | "bandeja"

export const ESTACIONES: Array<{ clave: Estacion; nombre: string; que_hace: string }> = [
  { clave: "brief", nombre: "Brief", que_hace: "Se pide la pieza: tema, familia y cliente." },
  { clave: "oficina", nombre: "Oficina creativa", que_hace: "Arma las láminas y el texto." },
  { clave: "mesa", nombre: "Mesa de especialistas", que_hace: "Discuten la idea y la afinan." },
  { clave: "jefatura", nombre: "Jefatura", que_hace: "Revisa antes de que llegue a Emilio." },
  { clave: "bandeja", nombre: "Bandeja", que_hace: "Espera la decisión de Emilio." },
]

export type DondeEsta = "oficina" | "bandeja" | "fallo"

/** dónde está un encargo: en la bandeja si ya tiene su fila de revisión; fallida si terminó mal; si no, sigue en la oficina */
export function dondeEstaElEncargo(e: { estado?: unknown; hitl_queue_id?: unknown }): DondeEsta {
  if (e.hitl_queue_id) return "bandeja"
  const est = String(e.estado ?? "")
  if (est === "fallido") return "fallo"
  return "oficina"
}

export const humanizar = (s: unknown): string => String(s ?? "—").replace(/_/g, " ")

export interface Paso { clave: Estacion; cuantos: number; detalle: string[]; ultimo: string | null }
export interface PiezaEnElMapa { id: string; hitl_queue_id: string | null; brief: string; familia: string; donde: DondeEsta; estado: string; creado_en: string; gasto_usd: number }

/** cuenta en singular/plural: «1 brief», «3 briefs» */
export const contarCosas = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`
