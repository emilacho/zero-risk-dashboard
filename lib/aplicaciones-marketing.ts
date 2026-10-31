/**
 * LAS APLICACIONES DEL DEPT. MARKETING (sprint 6.2 · Emilio 31-oct): al abrir el pizarrón ya no aparece el calendario de golpe, sino una «pantalla de inicio»
 * como la de un celular: un cuadro por cada cosa que marketing ya tiene para el cliente. Lista cerrada por Emilio («quita solo la 7 y la 8»: fuera oficinas/en vivo y alertas).
 * Cada cuadro es un atajo a una pantalla que YA existe (nada nuevo que escribir); solo «Calendario» se abre encima, sin salir de la oficina.
 */
export type ClaveDeAplicacion = "manual" | "plan" | "calendario" | "piezas" | "cerebro" | "gasto"

export interface Aplicacion {
  clave: ClaveDeAplicacion
  nombre: string
  /** qué hay detrás, en una línea, cuando la lectura no trae un dato mejor */
  descripcion: string
  /** a dónde lleva; `null` = se abre encima (el calendario) */
  enlace: (clienteId: string | null) => string | null
}

const ficha = (clienteId: string | null, apartado: string) => (clienteId ? `/clientes/${clienteId}#${apartado}` : "/clientes")

export const APLICACIONES: readonly Aplicacion[] = [
  { clave: "manual", nombre: "Manual de marca", descripcion: "Propósito, misión, voz, eslogan y quién lo validó", enlace: (c) => ficha(c, "manual") },
  { clave: "plan", nombre: "Plan de 90 días", descripcion: "Las fases de la campaña y lo que espera", enlace: (c) => ficha(c, "plan") },
  { clave: "calendario", nombre: "Calendario", descripcion: "Las publicaciones de la campaña, coloreadas por dónde están", enlace: () => null },
  { clave: "piezas", nombre: "Piezas", descripcion: "La bandeja para aprobar o pedir cambios", enlace: () => "/piezas" },
  { clave: "cerebro", nombre: "Cerebro", descripcion: "Las fichas y los trozos de conocimiento del cliente", enlace: (c) => ficha(c, "cerebro") },
  { clave: "gasto", nombre: "Gasto", descripcion: "Lo gastado en los últimos 30 días", enlace: () => "/gasto" },
] as const

/** los apartados de la ficha del cliente a los que apuntan los cuadros (la ficha debe tener estos `id`) */
export const APARTADOS_DE_LA_FICHA = ["piezas", "plan", "gasto", "cerebro", "manual"] as const
