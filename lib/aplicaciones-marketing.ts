/**
 * EL CENTRO DE CAMPAÑA DEL DEPT. MARKETING (sprint 6.2 · Emilio 31-oct · encargo 01-nov §2): al abrir la pantalla grande de la oficina aparece una «pantalla de inicio»
 * como la de un celular: un cuadro por cada cosa que marketing ya tiene para el cliente, EN EL ORDEN DE LA CADENA (numerados 1-9).
 * Regla de Emilio (31-oct, 6.3): «ya no uses el dashboard viejo»: cada cosa se va trayendo al estilo nuevo y se abre ENCIMA (`enlace` = null), sin salir de la
 * oficina. Ya abren encima: Calendario (6.1) · Manual de marca (6.3) · Plan de 90 días (6.5) · Piezas (6.6) · Informes (6.9) · Brief · Gran idea · Equipo (6.10).
 * Lo que todavía enlaza a una pantalla vieja (Gasto) es deuda que se paga cuadro por cuadro.
 * 6.9 (Emilio, 1-nov): el Cerebro ya NO es un cuadro del departamento: es una estructura de la sala principal (el monolito). En su lugar va «Informes».
 * 6.10 (encargo 01-nov): 9 botones · 1 Manual · 2 Informes · 3 Plan · 4 Brief · 5 Gran idea · 6 Calendario · 7 Piezas · 8 Equipo · 9 Gasto. Genérico por tipo de
 * campaña: los botones no cambian; lo que cambia es lo que hay detrás de cada uno.
 */
export type ClaveDeAplicacion = "manual" | "informes" | "plan" | "brief" | "gran_idea" | "calendario" | "piezas" | "equipo" | "gasto"

export interface Aplicacion {
  clave: ClaveDeAplicacion
  /** el paso de la cadena (1-9) */
  paso: number
  nombre: string
  /** qué hay detrás, en una línea, cuando la lectura no trae un dato mejor */
  descripcion: string
  /** a dónde lleva; `null` = se abre encima, en el estilo nuevo */
  enlace: (clienteId: string | null) => string | null
}

export const APLICACIONES: readonly Aplicacion[] = [
  { clave: "manual", paso: 1, nombre: "Manual de marca", descripcion: "Lo que la marca es, cómo habla y cómo se ve", enlace: () => null },
  { clave: "informes", paso: 2, nombre: "Informes", descripcion: "Lo que la oficina le reporta al cliente: semanal, mensual, trimestral", enlace: () => null },
  { clave: "plan", paso: 3, nombre: "Plan de 90 días", descripcion: "La meta, las fases, las redes y lo que la campaña espera", enlace: () => null },
  { clave: "brief", paso: 4, nombre: "Brief de campaña", descripcion: "Insight, un mensaje, objetivo, tono y obligatorios: lo que la mesa del brief le entrega a los creativos", enlace: () => null },
  { clave: "gran_idea", paso: 5, nombre: "Gran idea", descripcion: "El concepto de la campaña que la sala creativa propone y tú apruebas", enlace: () => null },
  { clave: "calendario", paso: 6, nombre: "Calendario", descripcion: "Las publicaciones de la campaña, coloreadas por dónde están", enlace: () => null },
  { clave: "piezas", paso: 7, nombre: "Piezas", descripcion: "La bandeja para aprobar o pedir cambios", enlace: () => null },
  { clave: "equipo", paso: 8, nombre: "Equipo", descripcion: "Quién trabaja en cada equipo del departamento y qué está haciendo", enlace: () => null },
  { clave: "gasto", paso: 9, nombre: "Gasto", descripcion: "Lo gastado en los últimos 30 días", enlace: () => "/gasto" },
] as const

/** los apartados de la ficha del cliente a los que apuntan los cuadros (la ficha debe tener estos `id`) */
export const APARTADOS_DE_LA_FICHA = ["piezas", "plan", "gasto", "cerebro", "manual"] as const
