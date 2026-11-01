/**
 * KANBAN (sprint 6.11 · encargo 01-nov ADENDA 3 + ADENDA 7.3): las MISMAS publicaciones del calendario y las MISMAS piezas de la bandeja, vistas por columnas
 * genéricas que sirven para cualquier tipo de campaña. Lógica PURA (sin red ni base). SOLO LECTURA: aquí no se arrastra nada; cada columna sale de un estado
 * real de la plataforma (fila del calendario · encargo de la oficina · revisión de la jefatura · fila de la bandeja), ya resuelto por `lib/pizarron.ts` y `lib/piezas.ts`.
 * «Publicada» NO existe todavía: el sistema no publica en redes (falta conectar la cartera de Meta). La columna se ve, ATENUADA, con su leyenda; no se inventa el estado.
 */
import type { EstadoDelTablero, FilaDelTablero } from "@/lib/pizarron"
import { colorDelEstado, diaDelCalendario, formatoLegible, nombreDelEstado, redDelTablero } from "@/lib/pizarron"
import type { EstadoPieza } from "@/lib/piezas"
import type { FilaDeLaLista } from "@/lib/piezas-datos"
import { ESTADO_DE_PIEZA_LEGIBLE, avisosDeLaFila, tonoDelEstado, type Tono } from "@/lib/bandeja"

export type ClaveDeColumna = "por_hacer" | "en_el_estudio" | "en_revision" | "por_aprobar" | "aprobada" | "publicada" | "vencida"

export interface Columna {
  clave: ClaveDeColumna
  nombre: string
  /** qué significa estar aquí, en una línea */
  descripcion: string
  /** `false` = la plataforma todavía no tiene este estado: la columna se ve atenuada y vacía, con su leyenda */
  activa: boolean
  leyenda: string | null
}

export const LEYENDA_PUBLICADA = "Se activa cuando la publicación esté conectada: el sistema todavía no publica en redes (falta conectar la cartera de Meta)."

/** las 7 columnas de la ADENDA 3, en el orden de la cadena */
export const COLUMNAS: readonly Columna[] = [
  { clave: "por_hacer", nombre: "Por hacer", descripcion: "En el calendario: idea, brief o investigación", activa: true, leyenda: null },
  { clave: "en_el_estudio", nombre: "En el estudio", descripcion: "La oficina creativa la está haciendo o rehaciendo", activa: true, leyenda: null },
  { clave: "en_revision", nombre: "En revisión", descripcion: "La jefatura la revisa antes de que llegue a ti", activa: true, leyenda: null },
  { clave: "por_aprobar", nombre: "Por aprobar", descripcion: "Espera tu decisión", activa: true, leyenda: null },
  { clave: "aprobada", nombre: "Aprobada", descripcion: "La aprobaste; publicarla es un paso aparte", activa: true, leyenda: null },
  { clave: "publicada", nombre: "Publicada", descripcion: "Circulando en redes", activa: false, leyenda: LEYENDA_PUBLICADA },
  { clave: "vencida", nombre: "Vencida / Rechazada", descripcion: "Perdió su fecha, se descartó o la rechazaste", activa: true, leyenda: null },
] as const

/** dónde cae cada estado del calendario (ya resuelto con encargo · jefatura · bandeja por `estadoDelTablero`) */
export const COLUMNA_DEL_TABLERO: Record<EstadoDelTablero, ClaveDeColumna> = {
  idea: "por_hacer",
  mesa: "en_el_estudio",
  jefatura: "en_revision",
  emilio: "por_aprobar",
  aprobada: "aprobada",
  cambios: "en_el_estudio", // pediste cambios: la oficina la rehace
  rechazada: "vencida",
  vencida: "vencida",
  descartada: "vencida",
}

/** dónde cae cada estado de una pieza de la bandeja (la bandeja solo tiene piezas ya entregadas: nada «por hacer» ni «en revisión» sale de aquí) */
export const COLUMNA_DE_LA_PIEZA: Record<EstadoPieza, ClaveDeColumna> = {
  pendiente: "por_aprobar",
  aprobada: "aprobada",
  con_cambios: "en_el_estudio",
  rechazada: "vencida",
  superada: "vencida",
  archivada: "vencida",
  otro: "por_hacer",
}

export interface TarjetaDelKanban {
  /** la clave con la que el panel de origen la elige (calendario: `id|fecha` · bandeja: `id`) */
  id: string
  columna: ClaveDeColumna
  titulo: string
  detalle: string | null
  /** «15 nov · 10:00» o el día en que se entregó */
  cuando: string | null
  color: string
  /** el estado real, en palabras */
  estado: string
  motivo: string | null
  /** espera a Emilio: late */
  destacada: boolean
  /** para ordenar dentro de la columna (texto comparable) */
  orden: string
}

const COLOR_DEL_TONO: Record<Tono, string> = { ambar: "#f5a524", verde: "#34d399", azul: "#2dd4bf", rojo: "#fb7185", neutro: "#7c7c86" }

export function tarjetaDeFila(f: FilaDelTablero): TarjetaDelKanban {
  const red = redDelTablero(f.red)
  return {
    id: `${f.id}|${f.fecha}`,
    columna: COLUMNA_DEL_TABLERO[f.tablero] ?? "por_hacer",
    titulo: f.tema || `${red.nombre} · ${formatoLegible(f.formato)}`,
    detalle: `${red.nombre} · ${formatoLegible(f.formato)}${f.sede ? ` · ${f.sede}` : ""}`,
    cuando: f.fecha ? `${diaDelCalendario(f.fecha)}${f.hora ? ` · ${f.hora}` : ""}` : null,
    color: colorDelEstado(f.tablero),
    estado: nombreDelEstado(f.tablero),
    motivo: f.motivo || null,
    destacada: f.tablero === "emilio",
    orden: `${f.fecha}|${f.hora ?? ""}|${f.id}`,
  }
}

/** la bandeja: las más nuevas arriba */
export function tarjetaDePieza(p: FilaDeLaLista): TarjetaDelKanban {
  const t = Date.parse(p.creada)
  return {
    id: p.id,
    columna: COLUMNA_DE_LA_PIEZA[p.estado] ?? "por_hacer",
    titulo: p.titulo_legible,
    detalle: p.carpeta,
    cuando: Number.isFinite(t) ? diaDelCalendario(p.creada.slice(0, 10)) : null,
    color: COLOR_DEL_TONO[tonoDelEstado(p.estado)],
    estado: ESTADO_DE_PIEZA_LEGIBLE[p.estado] ?? p.estado,
    motivo: avisosDeLaFila(p),
    destacada: p.estado === "pendiente",
    orden: String(Number.isFinite(t) ? 9_999_999_999_999 - t : 9_999_999_999_999).padStart(13, "0") + p.id,
  }
}

export interface ColumnaArmada extends Columna { tarjetas: TarjetaDelKanban[] }

/** las 7 columnas SIEMPRE (una vacía también se ve), cada una con sus tarjetas en orden */
export function armarKanban(tarjetas: TarjetaDelKanban[]): ColumnaArmada[] {
  return COLUMNAS.map((c) => ({ ...c, tarjetas: tarjetas.filter((t) => t.columna === c.clave).sort((a, b) => a.orden.localeCompare(b.orden)) }))
}

/** «2 por aprobar · 81 por hacer · 17 vencidas o rechazadas» (solo lo que tiene algo) */
export function resumenDelKanban(columnas: ColumnaArmada[]): string {
  const partes = columnas.filter((c) => c.tarjetas.length).map((c) => `${c.tarjetas.length} ${c.nombre.toLowerCase()}`)
  return partes.length ? partes.join(" · ") : "sin tarjetas"
}
