/**
 * EL CALENDARIO POR DÍA (CC6 · 02-nov · boceto aprobado por Emilio): el mismo patrón del plan y el manual. Las publicaciones agrupadas por día con su estado en
 * palabras cortas, y una barra fija con el resumen de la semana, la fase y lo que te toca. Solo lectura: el calendario no se firma.
 */
import type { FilaDelTablero, SemanaDelTablero } from "@/lib/pizarron"
import { esFilaEnEsquema, nombreDelEstado } from "@/lib/pizarron"

/** el estado de la fila en pocas palabras (para la etiqueta de cada publicación) */
const CORTO_DE_LA_FILA: Record<string, string> = {
  esquema: "próxima", propuesta: "propuesta", validada: "validada", en_investigacion: "se investiga un dato", lista_para_brief: "lista para el brief",
  briefeada: "con brief", en_oficina: "en la oficina", aprobada: "aprobada", cancelada: "cancelada", espera_video: "espera video",
  vencida_sin_brazo: "venció sin video", perdio_su_fecha: "perdió su fecha", descartada_sin_fuente: "descartada: sin fuente",
}

/** la etiqueta: si ya hay pieza o encargo manda eso (dónde está la pieza); si no, el estado de la fila del calendario */
export function estadoCortoDeLaPublicacion(f: Pick<FilaDelTablero, "estado_fila" | "tablero" | "pieza" | "encargo">): string {
  if (f.pieza || f.encargo) { const n = nombreDelEstado(f.tablero); return n.charAt(0).toLowerCase() + n.slice(1) }
  return CORTO_DE_LA_FILA[f.estado_fila] ?? (f.estado_fila ? f.estado_fila.replace(/_/g, " ") : "sin estado")
}

/** de dónde sale la publicación, en palabras (la base no guarda qué empleado la propuso: no se inventa un nombre) */
export function origenDeLaPublicacion(origen: unknown): string | null {
  const o = String(origen ?? "")
  if (o === "patron") return "el patrón de publicación del plan"
  if (o === "agente") return "la propuso un empleado al armar el calendario"
  return o ? o.replace(/_/g, " ") : null
}

/** la semana que se abre de entrada: la de hoy; si hoy no cae en el calendario, la próxima; si ya pasó todo, la última */
export function semanaInicial(semanas: SemanaDelTablero[], hoy: string): number {
  if (!semanas.length) return 0
  const deHoy = semanas.findIndex((s) => s.desde <= hoy && hoy <= s.hasta)
  if (deHoy >= 0) return deHoy
  const proxima = semanas.findIndex((s) => s.desde > hoy)
  return proxima >= 0 ? proxima : semanas.length - 1
}

/** el resumen de una semana: cuántas publicaciones y cuántas en cada estado, en el orden en que aparecen («20 publicaciones · se investiga un dato ×7 · validada ×6») */
// GO Lenovo 10-nov 20:30Z (punto 4): las filas en esquema no son publicaciones: `total` las deja fuera y van aparte en `en_esquema` (no se repiten en `partes`)
export function resumenDeLaSemana(s: SemanaDelTablero | undefined): { total: number; en_esquema: number; partes: string[] } {
  const todas = (s?.dias ?? []).flatMap((d) => d.publicaciones)
  const filas = todas.filter((f) => !esFilaEnEsquema(f.estado_fila))
  const cuenta = new Map<string, number>()
  for (const f of filas) { const e = estadoCortoDeLaPublicacion(f); cuenta.set(e, (cuenta.get(e) ?? 0) + 1) }
  return { total: filas.length, en_esquema: todas.length - filas.length, partes: [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([e, n]) => (n > 1 ? `${e} ×${n}` : e)) }
}

/** lo que te toca en el calendario: nada se firma aquí; si hay piezas en tu bandeja, se abren desde su publicación */
export function loQueTeTocaEnElCalendario(porAprobar: number): string {
  if (porAprobar <= 0) return "Nada: el calendario no se firma."
  return `${porAprobar === 1 ? "1 pieza espera" : `${porAprobar} piezas esperan`} tu aprobación: ábrela${porAprobar === 1 ? "" : "s"} desde su publicación (en ámbar).`
}

/** el día de la semana con su fecha («lun 2 nov») */
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
export function diaConNombre(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? fecha : `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
}
