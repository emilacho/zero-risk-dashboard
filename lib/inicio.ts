/**
 * INICIO (CC#1 · 29-oct · parte 4 del dashboard): lógica PURA de «lo que necesita a Emilio hoy». Estado primero, 3 cifras, una línea por oficina, los 5 hechos de negocio más recientes.
 * Nada técnico: ni llamadas de agentes ni identificadores. Lo que no se pudo leer se dice; nunca se rellena con un cero.
 */
import { haceCuanto, peorSemaforo, type Semaforo, type TarjetaDeOficina } from "@/lib/oficinas"

/** tope diario de gasto de la agencia (canon: umbral de $10/día; los vigías de una pieza llevan su propio tope) */
export const TOPE_DIARIO_USD = 10

export interface Pendiente { clave: string; titulo: string; cuantos: number; href: string; nota?: string }

/** «Te necesitan»: solo lo que tiene al menos uno; vacío = «Todo al día» */
export function teNecesitan(p: { piezas: number; revisiones: number; preguntas: number }): Pendiente[] {
  const todo: Pendiente[] = [
    { clave: "piezas", titulo: p.piezas === 1 ? "pieza por aprobar" : "piezas por aprobar", cuantos: p.piezas, href: "/piezas" },
    { clave: "preguntas", titulo: p.preguntas === 1 ? "pregunta de la oficina financiera" : "preguntas de la oficina financiera", cuantos: p.preguntas, href: "/oficinas#financiera", nota: "se responden en #buzon-de-preguntas" },
    { clave: "revisiones", titulo: p.revisiones === 1 ? "otra revisión pendiente" : "otras revisiones pendientes", cuantos: p.revisiones, href: "/piezas?estado=todas", nota: "planes, competidores y escalaciones: de solo lectura aquí" },
  ]
  return todo.filter((x) => x.cuantos > 0)
}

export interface EstadoDelSistema { semaforo: Semaforo; texto: string; href: string }

/** UNA línea con semáforo, calculada de las tarjetas de oficina (la pantalla de Alertas la alimenta aparte) */
export function estadoDelSistema(tarjetas: TarjetaDeOficina[], alertasAbiertas: number | null): EstadoDelSistema {
  const rojas = tarjetas.filter((t) => t.semaforo === "rojo").length
  const peor = peorSemaforo(tarjetas)
  if (alertasAbiertas != null && alertasAbiertas > 0) return { semaforo: "rojo", texto: alertasAbiertas === 1 ? "1 alerta abierta" : `${alertasAbiertas} alertas abiertas`, href: "/alertas" }
  if (rojas > 0) return { semaforo: "rojo", texto: rojas === 1 ? "1 oficina con problema" : `${rojas} oficinas con problema`, href: "/oficinas" }
  if (peor === "ambar") return { semaforo: "ambar", texto: "Hay algo que mirar en una oficina", href: "/oficinas" }
  if (peor === "gris") return { semaforo: "gris", texto: "Todas las oficinas están apagadas", href: "/oficinas" }
  return { semaforo: "verde", texto: "Todo funcionando", href: "/oficinas" }
}

export interface Hecho { cuando: string; texto: string; href?: string }

/** los N hechos más recientes, del más nuevo al más viejo; los de fecha ilegible se descartan */
export function ultimosHechos(hechos: Hecho[], n = 5): Hecho[] {
  return hechos.filter((h) => Number.isFinite(new Date(h.cuando).getTime())).sort((a, b) => new Date(b.cuando).getTime() - new Date(a.cuando).getTime()).slice(0, n)
}

export const cuando = (iso: string, ahora: Date = new Date()): string => haceCuanto(iso, ahora)

/** porcentaje del tope diario usado (para la barra); nunca pasa de 100 ni baja de 0 */
export const porcentajeDelTope = (gasto: number, tope: number = TOPE_DIARIO_USD): number => (tope > 0 && Number.isFinite(gasto) ? Math.max(0, Math.min(100, Math.round((gasto / tope) * 100))) : 0)
