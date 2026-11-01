/**
 * PIZARRÓN DE PIEZAS (CC5 · 31-oct · sprint 6 de /nuevo · propuesta de Emilio): el tablero de la campaña dentro de la oficina de marketing.
 * Lógica PURA (sin red ni base). Arriba la gran idea y la fase activa; la cuadrícula son las publicaciones del calendario coloreadas por dónde está cada una
 * (idea/brief · mesa · jefatura · esperando la aprobación de Emilio · aprobada · vencida). SOLO LECTURA: el tablero no decide nada; abre la pieza en su ventana.
 * Cada estado sale de una tabla real (fila del calendario · encargo de la oficina · revisión de la jefatura · fila de la bandeja); lo que no existe se dice.
 */
import type { FasesDelPlan } from "@/lib/clientes"
import { estadoDeLaPieza, type EstadoPieza } from "@/lib/piezas"

export type EstadoDelTablero = "idea" | "mesa" | "jefatura" | "emilio" | "aprobada" | "cambios" | "rechazada" | "vencida" | "descartada"

/** los colores del pizarrón: uno por estado; «esperando a Emilio» va destacado (ámbar, la luz de la casa) */
export const ESTADOS_DEL_TABLERO: ReadonlyArray<{ clave: EstadoDelTablero; nombre: string; color: string; destacada?: boolean }> = [
  { clave: "idea", nombre: "Idea / brief", color: "#7c7c86" },
  { clave: "mesa", nombre: "En la mesa creativa", color: "#5b9cf6" },
  { clave: "jefatura", nombre: "En la jefatura", color: "#a78bfa" },
  { clave: "emilio", nombre: "Esperando tu aprobación", color: "#f5a524", destacada: true },
  { clave: "aprobada", nombre: "Aprobada", color: "#34d399" },
  { clave: "cambios", nombre: "Con cambios pedidos", color: "#2dd4bf" },
  { clave: "rechazada", nombre: "Rechazada", color: "#fb7185" },
  { clave: "vencida", nombre: "Vencida", color: "#ef4444" },
  { clave: "descartada", nombre: "Descartada", color: "#3f3f46" },
]
export const colorDelEstado = (e: EstadoDelTablero): string => ESTADOS_DEL_TABLERO.find((x) => x.clave === e)?.color ?? "#7c7c86"
export const nombreDelEstado = (e: EstadoDelTablero): string => ESTADOS_DEL_TABLERO.find((x) => x.clave === e)?.nombre ?? e

/** los estados de una fila del calendario (CHECK de `cadena_calendario_filas.estado`), en palabras */
export const ESTADO_DE_FILA_LEGIBLE: Record<string, string> = {
  esquema: "en el esquema del calendario",
  propuesta: "propuesta por el estratega",
  validada: "validada",
  en_investigacion: "en investigación (buscando fuentes)",
  lista_para_brief: "lista para el brief",
  briefeada: "con brief, esperando turno en la oficina",
  en_oficina: "en la oficina creativa",
  aprobada: "aprobada",
  cancelada: "cancelada",
  espera_video: "espera su turno en el brazo de video",
  vencida_sin_brazo: "venció sin que el brazo de video la hiciera a tiempo",
  perdio_su_fecha: "perdió su fecha",
  descartada_sin_fuente: "descartada: no tenía fuente",
}
export const estadoDeFilaLegible = (e: unknown): string => ESTADO_DE_FILA_LEGIBLE[String(e ?? "")] ?? String(e ?? "sin estado").replace(/_/g, " ")

export interface EncargoDelTablero { id: string; familia: string; estado: string; gasto_usd: number; creado_en: string }
export interface RevisionDelTablero { estado: string; resultado: string | null }
export interface PiezaDelTablero { id: string; status: string; estado: EstadoPieza; expires_at: string | null; created_at: string }

export interface FilaDelTablero {
  id: string
  fecha: string
  hora: string | null
  red: string
  formato: string
  pilar: string | null
  tema: string
  sede: string | null
  pieza_fija: boolean
  tanda: number | null
  semana: number | null
  estado_fila: string
  avisos: string[]
  pendientes: string[]
  encargo: EncargoDelTablero | null
  jefatura: RevisionDelTablero | null
  pieza: PiezaDelTablero | null
  tablero: EstadoDelTablero
  motivo: string
}

/** dónde está una publicación: la bandeja manda (si Emilio ya la tiene o la decidió), luego la oficina, luego el calendario */
export function estadoDelTablero(x: { estado_fila: string; encargo?: EncargoDelTablero | null; jefatura?: RevisionDelTablero | null; pieza?: { status: string; decision?: unknown } | null }): { tablero: EstadoDelTablero; motivo: string } {
  if (x.pieza) {
    const e = estadoDeLaPieza(x.pieza.status, x.pieza.decision)
    const d = (x.pieza.decision ?? null) as Record<string, unknown> | null
    if (e === "pendiente") return { tablero: "emilio", motivo: "la pieza está en tu bandeja" }
    if (e === "aprobada") return { tablero: "aprobada", motivo: "la aprobaste" }
    if (e === "con_cambios") return { tablero: "cambios", motivo: "pediste cambios; la oficina la rehace" }
    if (e === "superada") return { tablero: "descartada", motivo: "la reemplazó otra pieza" }
    if (e === "archivada") return { tablero: "descartada", motivo: "archivada" }
    if (d && d.vencida === true) return { tablero: "vencida", motivo: "venció en la bandeja sin decisión" }
    if (e === "rechazada") return { tablero: "rechazada", motivo: "la rechazaste" }
    return { tablero: "idea", motivo: "pieza en un estado que no conozco" }
  }
  if (x.encargo) {
    const est = x.encargo.estado
    if (est === "fallido") return { tablero: "idea", motivo: "la oficina falló al hacerla; vuelve a la fila" }
    if (est === "aprobada") return { tablero: "aprobada", motivo: "la aprobaste (el encargo quedó aprobado)" }
    if (est === "abierto" || est === "en_paso") return { tablero: "mesa", motivo: "la oficina creativa la está haciendo" }
    if (x.jefatura && x.jefatura.estado !== "cerrada") return { tablero: "jefatura", motivo: "la jefatura la está revisando" }
    if (x.jefatura) return { tablero: "jefatura", motivo: `la jefatura la revisó (${x.jefatura.resultado ?? "sin resultado"}); camino a tu bandeja` }
    return { tablero: "jefatura", motivo: "la oficina la entregó; esperando la revisión" }
  }
  const f = x.estado_fila
  if (f === "aprobada") return { tablero: "aprobada", motivo: "aprobada en el calendario" }
  if (f === "perdio_su_fecha" || f === "vencida_sin_brazo") return { tablero: "vencida", motivo: estadoDeFilaLegible(f) }
  if (f === "cancelada" || f === "descartada_sin_fuente") return { tablero: "descartada", motivo: estadoDeFilaLegible(f) }
  if (f === "en_oficina") return { tablero: "mesa", motivo: estadoDeFilaLegible(f) }
  return { tablero: "idea", motivo: estadoDeFilaLegible(f) }
}

export interface FaseActiva { situacion: "antes" | "en_curso" | "despues" | "sin_fases" | "sin_fecha"; fase: FasesDelPlan | null; dia: number | null; dias_para_empezar: number | null }

const DIA_MS = 86_400_000
const fechaUTC = (f: string): Date => new Date(`${f}T00:00:00Z`)
/** «AAAA-MM-DD» de un instante en hora de Ecuador (UTC−5, sin cambio de hora) */
export const hoyEnEcuador = (ahora: Date): string => new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 10)

/** la fase de la estrategia en la que está la campaña hoy (día 1 = fecha de inicio); antes de empezar, dice cuánto falta y cuál es la primera */
export function faseActiva(fases: FasesDelPlan[], fecha_inicio: string | null, hoy: string): FaseActiva {
  if (!fecha_inicio) return { situacion: "sin_fecha", fase: null, dia: null, dias_para_empezar: null }
  if (!fases.length) return { situacion: "sin_fases", fase: null, dia: null, dias_para_empezar: null }
  const dia = Math.round((fechaUTC(hoy).getTime() - fechaUTC(fecha_inicio).getTime()) / DIA_MS) + 1
  const ordenadas = [...fases].sort((a, b) => a.dia_desde - b.dia_desde)
  if (dia < 1) return { situacion: "antes", fase: ordenadas[0], dia, dias_para_empezar: 1 - dia }
  const f = ordenadas.find((x) => dia >= x.dia_desde && dia <= x.dia_hasta) ?? null
  if (f) return { situacion: "en_curso", fase: f, dia, dias_para_empezar: null }
  return { situacion: "despues", fase: ordenadas[ordenadas.length - 1], dia, dias_para_empezar: null }
}

export const DIAS_DE_LA_SEMANA = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const
export interface DiaDelTablero { fecha: string; publicaciones: FilaDelTablero[] }
export interface SemanaDelTablero { desde: string; hasta: string; dias: DiaDelTablero[] }

const sumarDias = (f: string, n: number): string => new Date(fechaUTC(f).getTime() + n * DIA_MS).toISOString().slice(0, 10)
const lunesDe = (f: string): string => sumarDias(f, -((fechaUTC(f).getUTCDay() + 6) % 7))

/** la cuadrícula: semanas de lunes a domingo desde la primera fecha hasta la última, cada día con sus publicaciones por hora */
export function semanasDelTablero(filas: FilaDelTablero[]): SemanaDelTablero[] {
  const fechas = filas.map((f) => f.fecha).filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)).sort()
  if (!fechas.length) return []
  const porFecha = new Map<string, FilaDelTablero[]>()
  for (const f of filas) porFecha.set(f.fecha, [...(porFecha.get(f.fecha) ?? []), f])
  const semanas: SemanaDelTablero[] = []
  for (let lunes = lunesDe(fechas[0]); lunes <= fechas[fechas.length - 1]; lunes = sumarDias(lunes, 7)) {
    const dias: DiaDelTablero[] = []
    for (let i = 0; i < 7; i++) {
      const fecha = sumarDias(lunes, i)
      dias.push({ fecha, publicaciones: (porFecha.get(fecha) ?? []).slice().sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? "") || a.id.localeCompare(b.id)) })
    }
    semanas.push({ desde: lunes, hasta: sumarDias(lunes, 6), dias })
  }
  return semanas
}

/** cuántas publicaciones hay en cada estado (para la leyenda y el resumen) */
export function totalesDelTablero(filas: FilaDelTablero[]): Partial<Record<EstadoDelTablero, number>> {
  const t: Partial<Record<EstadoDelTablero, number>> = {}
  for (const f of filas) t[f.tablero] = (t[f.tablero] ?? 0) + 1
  return t
}

const REDES: Array<[RegExp, string, string]> = [
  [/instagram/i, "Instagram", "IG"], [/facebook/i, "Facebook", "FB"], [/tiktok/i, "TikTok", "TT"], [/linkedin/i, "LinkedIn", "LI"], [/youtube/i, "YouTube", "YT"],
  [/whatsapp/i, "WhatsApp", "WA"], [/google/i, "Google", "G"], [/email|correo|mail/i, "Correo", "@"], [/web|landing|sitio/i, "Web", "W"],
]
export function redDelTablero(red: unknown): { nombre: string; sigla: string } {
  const r = String(red ?? "")
  for (const [re, nombre, sigla] of REDES) if (re.test(r)) return { nombre, sigla }
  return { nombre: r || "—", sigla: (r.slice(0, 2) || "—").toUpperCase() }
}
export const formatoLegible = (f: unknown): string => { const s = String(f ?? "").replace(/_/g, " ").trim(); return s ? s[0].toUpperCase() + s.slice(1) : "Pieza" }

/** «15 nov» a partir de «AAAA-MM-DD» (sin zona horaria: la fecha del calendario es un día, no un instante) */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
export const diaDelCalendario = (f: string): string => { const d = fechaUTC(f); return Number.isNaN(d.getTime()) ? f : `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}` }

/** la ventana de una pieza (solo lectura aquí; ahí se aprueba o se piden cambios) */
export const enlaceDeLaPieza = (id: string): string => `/piezas?id=${encodeURIComponent(id)}&estado=todas`
