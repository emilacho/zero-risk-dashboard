/**
 * LAS APLICACIONES DEL DEPT. MARKETING (sprint 6.2 · Emilio 31-oct): al abrir el pizarrón ya no aparece el calendario de golpe, sino una «pantalla de inicio»
 * como la de un celular: un cuadro por cada cosa que marketing ya tiene para el cliente. Lista cerrada por Emilio («quita solo la 7 y la 8»: fuera oficinas/en vivo y alertas).
 * Regla de Emilio (31-oct, 6.3): «ya no uses el dashboard viejo»: cada cosa se va trayendo al estilo nuevo y se abre ENCIMA (`enlace` = null), sin salir de la
 * oficina. Ya abren encima: Calendario (6.1) · Manual de marca (6.3) · Plan de 90 días (6.5) · Piezas (6.6) · Informes (6.9). Lo que todavía enlaza a una pantalla vieja es deuda que se paga cuadro por cuadro.
 * 6.9 (Emilio, 1-nov): el Cerebro ya NO es un cuadro del departamento: es una estructura de la sala principal (el monolito), como el propio Dept. Marketing.
 * En su lugar va «Informes»: lo que la oficina le reporta al cliente (`client_reports`).
 */
export type ClaveDeAplicacion = "manual" | "plan" | "calendario" | "piezas" | "informes" | "gasto"

export interface Aplicacion {
  clave: ClaveDeAplicacion
  nombre: string
  /** qué hay detrás, en una línea, cuando la lectura no trae un dato mejor */
  descripcion: string
  /** a dónde lleva; `null` = se abre encima, en el estilo nuevo */
  enlace: (clienteId: string | null) => string | null
}


export const APLICACIONES: readonly Aplicacion[] = [
  { clave: "manual", nombre: "Manual de marca", descripcion: "Lo que la marca es, cómo habla y cómo se ve", enlace: () => null },
  { clave: "plan", nombre: "Plan de 90 días", descripcion: "La meta, las fases, las redes y lo que la campaña espera", enlace: () => null },
  { clave: "calendario", nombre: "Calendario", descripcion: "Las publicaciones de la campaña, coloreadas por dónde están", enlace: () => null },
  { clave: "piezas", nombre: "Piezas", descripcion: "La bandeja para aprobar o pedir cambios", enlace: () => null },
  { clave: "informes", nombre: "Informes", descripcion: "Lo que la oficina le reporta al cliente: semanal, mensual, trimestral", enlace: () => null },
  { clave: "gasto", nombre: "Gasto", descripcion: "Lo gastado en los últimos 30 días", enlace: () => "/gasto" },
] as const

/** los apartados de la ficha del cliente a los que apuntan los cuadros (la ficha debe tener estos `id`) */
export const APARTADOS_DE_LA_FICHA = ["piezas", "plan", "gasto", "cerebro", "manual"] as const
