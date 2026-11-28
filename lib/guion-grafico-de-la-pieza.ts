/**
 * 28-nov · GO Lenovo 09:54Z (Emilio aprobó el boceto `raw/evidencia/2026-11-27-boceto-ver-piezas-como-propuestas/`) · «GUION GRÁFICO · LA PIEZA».
 * La pieza de video terminada se mira como su propuesta: las mismas escenas (los planos del guion elegido) con fotos sacadas del VIDEO TERMINADO.
 * Fotos por escena, para cualquier cliente: segundos ÷ 20 redondeado hacia arriba, de 1 a 6 (la misma regla que aplica la plataforma al sacarlas).
 * Las fotos las saca la plataforma (US$ 0, ffmpeg) en `cuadros_video.guion_grafico`; un reel de antes que solo tiene los 3 cuadros por plano de la mirada
 * (inicio, medio, final) usa esos, elegidos por la misma regla. Nunca se inventa un cuadro: sin fotos del video, no hay guion gráfico y queda el aviso de hoy.
 * Puro: sin red ni base.
 */
import { direccionDeLaLamina } from "@/lib/piezas"
import type { PlanoDePropuesta } from "@/lib/propuestas"

export const SEGUNDOS_POR_FOTO = 20
export const FOTOS_POR_ESCENA_MAX = 6

/** cuántas fotos lleva cada escena de una pieza de `segundos` · sin duración legible, 1 */
export function fotosPorEscena(segundos: number | null | undefined): number {
  const s = Number(segundos)
  if (!Number.isFinite(s) || s <= 0) return 1
  return Math.max(1, Math.min(FOTOS_POR_ESCENA_MAX, Math.ceil(s / SEGUNDOS_POR_FOTO)))
}

/** una escena de la pieza: el plano del guion (con la forma del de la propuesta, para dibujarlo igual) y sus fotos del video terminado, en orden */
export type EscenaDeLaPieza = PlanoDePropuesta & { /** las fotos con su segundo en el video (las mismas de `imagenes`, en orden) */ fotos: Array<{ url: string; segundo: number }> }
/** las escenas y cuántas fotos lleva cada una (la regla) */
export interface GuionGraficoDeLaPieza { escenas: EscenaDeLaPieza[]; fotos_por_escena: number; segundos: number | null }

/** cuál de los 3 cuadros de la mirada usar con `n` fotos por escena (reels de antes del guion gráfico) */
const PARTES: Record<number, string[]> = { 1: ["medio"], 2: ["inicio", "final"] }
const partesPara = (n: number) => PARTES[n] ?? ["inicio", "medio", "final"]

const texto = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x.trim() : null)
const numero = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null)
type Foto = { plano: number; segundo: number; url: string; parte?: string }
const fotosDe = (x: unknown, base: string | null | undefined): Foto[] =>
  (Array.isArray(x) ? x : [])
    .map((f) => f as Record<string, unknown>)
    .filter((f) => numero(f.plano) !== null && typeof f.url === "string" && !!direccionDeLaLamina(f.url as string, "x.jpg", base))
    .map((f) => ({ plano: f.plano as number, segundo: numero(f.segundo) ?? 0, url: f.url as string, ...(typeof f.parte === "string" ? { parte: f.parte } : {}) }))

/**
 * las escenas de la pieza con sus fotos · `guion` = el artefacto `guion` del encargo (sus planos), `cuadros` = el artefacto `cuadros_video`.
 * Solo fotos del almacén de la oficina (`base` = la dirección de la base). null si no hay planos o ninguna escena tiene foto del video (queda el aviso de hoy)
 */
export function guionGraficoDeLaPieza(guion: unknown, cuadros: unknown, base: string | null | undefined, segundos?: number | null): GuionGraficoDeLaPieza | null {
  const planos = (guion as { planos?: unknown } | null)?.planos
  if (!Array.isArray(planos) || !planos.length) return null
  const cv = (cuadros ?? {}) as { guion_grafico?: unknown; cuadros?: unknown; duracion_s?: unknown; fotos_por_escena?: unknown }
  const propias = fotosDe(cv.guion_grafico, base)
  const total = numero(cv.duracion_s) ?? segundos ?? null
  const n = numero(cv.fotos_por_escena) ?? fotosPorEscena(total)
  // un reel de antes del guion gráfico: los cuadros de la mirada, elegidos por la regla
  const fotos = propias.length ? propias : fotosDe(cv.cuadros, base).filter((f) => partesPara(n).includes(f.parte ?? ""))
  const escenas: EscenaDeLaPieza[] = planos
    .map((p) => p as Record<string, unknown>)
    .filter((p) => numero(p.n) !== null)
    .map((p) => {
      const suyas = fotos.filter((f) => f.plano === p.n).sort((a, b) => a.segundo - b.segundo)
      return {
      n: p.n as number,
      desde: numero(p.desde),
      hasta: numero(p.hasta),
      rol: texto(p.rol),
      dice: texto(p.dice),
      se_ve: texto(p.se_ve),
      texto_en_pantalla: texto(p.texto_en_pantalla),
      producto: null,
      imagenes: suyas.map((f) => f.url),
      fotos: suyas.map((f) => ({ url: f.url, segundo: f.segundo })),
      foto_propia: null,
      origen_de_la_foto: null,
      }
    })
  return escenas.some((e) => e.imagenes.length) ? { escenas, fotos_por_escena: n, segundos: total } : null
}
