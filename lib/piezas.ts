/**
 * LA VENTANA DE PIEZAS (CC#1 · 29-oct · GO «construir el dashboard»): lógica PURA (sin red ni base) de lo que Emilio ve y decide.
 * Lo que se muestra sale del MANIFIESTO y de los artefactos de la oficina, nunca del resumen de la bandeja (el resumen del 28-oct decía «6 imágenes generadas»
 * cuando no había ninguna). Aprobar NO publica todavía: la plataforma lo ensaya.
 */

/** el único tipo de la bandeja que se aprueba aquí; los demás se listan en solo lectura */
export const TIPO_PIEZA = "content_piece_review"
/** límite de rondas de cambios por pieza (decisión de Emilio, 29-oct). NO lo hace cumplir el tablero: lo hace la ruta de la plataforma `POST /api/oficina/cambios` (CC#2); aquí solo se muestra en el aviso al dueño. Si cambia, cambia en los dos lados. */
export const RONDAS_MAXIMAS_DE_CAMBIOS = 5
export const COMENTARIO_MINIMO = 10
export const MOTIVO_MINIMO = 5
export const COMENTARIO_MAXIMO = 2000

export type EstadoPieza = "pendiente" | "aprobada" | "con_cambios" | "rechazada" | "superada" | "archivada" | "otro"
export const ESTADOS_DE_LA_BANDEJA: Record<string, EstadoPieza> = { pending: "pendiente", approved: "aprobada", edited: "con_cambios", rejected: "rechazada" }
/**
 * Una fila «rechazada» que la limpieza o la plataforma marcó como `superada` (la reemplazó otra vigente) o `archivada` (resto de práctica)
 * NO la rechazó Emilio: se dice lo que es. Solo cambia las rechazadas; ninguna otra fila se reinterpreta.
 */
export function estadoDeLaPieza(status: string, decision?: unknown): EstadoPieza {
  const base = ESTADOS_DE_LA_BANDEJA[status] ?? "otro"
  if (base !== "rechazada" || typeof decision !== "object" || decision === null) return base
  const d = decision as Record<string, unknown>
  if (d.superada === true) return "superada"
  if (d.archivada === true) return "archivada"
  return base
}

/** de dónde sale la imagen de fondo de una lámina: no hay (solo tipografía), la generó la IA, es foto propia del cliente, o hay imagen pero no se sabe cuál */
export type OrigenDeLaImagen = "tipografia" | "generada" | "propia" | "con_imagen"
/** dirección de la imagen de fondo → su origen real (lo que eligió la oficina: `imagenes_elegidas.por_ref`) */
export type MapaDeOrigenes = Record<string, "generada" | "propia" | string>

export interface Lamina {
  n: number
  nombre: string
  ancho: number | null
  alto: number | null
  origen: OrigenDeLaImagen
  eyebrow: string | null
  titular: string | null
  cuerpo: string | null
  pie: string | null
  /** el texto lleva signos que el dibujo no sabe pintar (✔ ✗ y emojis salen como «NO GLYPH») */
  glifos_riesgosos: boolean
}

export interface ArchivoDelManifiesto { nombre: string; ancho?: number; alto?: number; tipo?: string }
export interface SlideDeLaOficina { eyebrow?: string | null; headline?: string | null; body?: string | null; pie?: string | null; cta?: string | null; background_image_url?: string | null }

/** ✔ ✗ y cualquier emoji: el dibujo de la oficina los pinta como cuadros «NO GLYPH» */
export const tieneGlifosRiesgosos = (t: string | null | undefined): boolean => !!t && /[✓-✘✅❌⭐]|\p{Extended_Pictographic}/u.test(t)

const esPng = (a: ArchivoDelManifiesto): boolean => /\.(png|jpe?g|webp)$/i.test(a.nombre)

/** une el manifiesto (qué láminas hay de verdad) con los textos de la oficina (qué dice cada una) */
export function origenDeLaLamina(url: string | null | undefined, origenes: MapaDeOrigenes | undefined): OrigenDeLaImagen {
  if (!url) return "tipografia"
  const o = origenes?.[url]
  return o === "generada" ? "generada" : o === "propia" ? "propia" : "con_imagen"
}

export function laminasDeLaPieza(archivos: ArchivoDelManifiesto[] | null | undefined, slides: SlideDeLaOficina[] | null | undefined, origenes?: MapaDeOrigenes): Lamina[] {
  const imgs = (archivos ?? []).filter(esPng)
  return imgs.map((a, i) => {
    const s = slides?.[i]
    const textos = [s?.eyebrow, s?.headline, s?.body, s?.pie, s?.cta]
    return {
      n: i + 1,
      nombre: a.nombre,
      ancho: a.ancho ?? null,
      alto: a.alto ?? null,
      origen: origenDeLaLamina(s?.background_image_url, origenes),
      eyebrow: s?.eyebrow ?? null,
      titular: s?.headline ?? null,
      cuerpo: s?.body ?? null,
      pie: s?.pie ?? null,
      glifos_riesgosos: textos.some((t) => tieneGlifosRiesgosos(t)),
    }
  })
}

export const ROTULO_DE_ORIGEN: Record<OrigenDeLaImagen, string> = {
  tipografia: "Solo tipografía de marca · sin foto ni imagen generada",
  generada: "Imagen de fondo generada con IA",
  propia: "Foto propia del cliente como fondo",
  con_imagen: "Lámina con imagen de fondo (no se pudo saber si es generada o propia)",
}

export interface Aviso { nivel: "rojo" | "ambar" | "info"; texto: string }

export interface DatosDeLaFila {
  output_preview?: string | null
  metadata?: Record<string, unknown> | null
}

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : [])

/** el resumen de la bandeja afirma imágenes generadas: ¿lo respalda el manifiesto? */
export function resumenDiceImagenesGeneradas(preview: string | null | undefined): number {
  const m = /(\d+)\s+im[aá]gen(?:es)?\s+generadas?/i.exec(preview ?? "")
  return m ? Number(m[1]) : 0
}

export function avisosDeLaPieza(fila: DatosDeLaFila, laminas: Lamina[]): Aviso[] {
  const meta = fila.metadata ?? {}
  const out: Aviso[] = []
  const conImagen = laminas.filter((l) => l.origen !== "tipografia").length
  const generadas = laminas.filter((l) => l.origen === "generada").length
  const dice = resumenDiceImagenesGeneradas(fila.output_preview)
  if (dice > 0 && conImagen === 0) out.push({ nivel: "rojo", texto: `El resumen de la bandeja decía «${dice} imágenes generadas con IA», pero la pieza no trae ninguna: las láminas son solo tipografía.` })
  else if (dice > 0 && dice !== conImagen && dice !== generadas) out.push({ nivel: "rojo", texto: `El resumen de la bandeja dice ${dice} imágenes generadas y la pieza muestra ${generadas > 0 ? generadas : conImagen}.` })
  if (laminas.length === 0) out.push({ nivel: "rojo", texto: "Sin dibujo: esta pieza no tiene láminas dibujadas (un ensayo, o el dibujo falló). No hay nada que mirar." })
  if (meta.revision_incompleta === true || meta.jefatura_resultado === "incompleta_por_tope") out.push({ nivel: "ambar", texto: "La revisión de la jefatura no terminó: se cortó por el límite de gasto." })
  const desac = lista(meta.desacuerdos)
  if (desac.length > 0) out.push({ nivel: "ambar", texto: `${desac.length} desacuerdo${desac.length === 1 ? "" : "s"} abierto${desac.length === 1 ? "" : "s"} en la revisión.` })
  const glifos = laminas.filter((l) => l.glifos_riesgosos).map((l) => l.n)
  if (glifos.length > 0) out.push({ nivel: "ambar", texto: `Las láminas ${glifos.join(", ")} llevan signos (✔ ✗ o emojis) que el dibujo pinta como cuadros vacíos. Mira la imagen antes de aprobar.` })
  if (meta.sin_dibujar === true) out.push({ nivel: "rojo", texto: "Cerrada SIN DIBUJAR: es solo el texto del equipo, decide una persona." })
  return out
}

/** aprobar con la revisión incompleta o con desacuerdos exige la casilla «entiendo» */
export function exigeCasilla(fila: DatosDeLaFila): boolean {
  const meta = fila.metadata ?? {}
  return meta.revision_incompleta === true || meta.jefatura_resultado === "incompleta_por_tope" || meta.con_desacuerdo === true || lista(meta.desacuerdos).length > 0 || meta.sin_dibujar === true
}

export type AccionDeLaPieza = "aprobar" | "cambios" | "rechazar"

export interface PedidoDeDecision {
  accion: AccionDeLaPieza
  comentario?: string
  laminas?: number[]
  casilla?: boolean
  /** el estado que Emilio tenía en pantalla: si ya cambió (otra decisión, vencida) la respuesta es 409 */
  estado_visto?: string
}

export type Validacion = { ok: true; pedido: PedidoDeDecision } | { ok: false; error: string; detalle: string }

/** valida lo que llega al servidor; `total` = láminas de la pieza, `casillaExigida` = la pieza exige «entiendo» */
export function validarDecision(raw: unknown, total: number, casillaExigida: boolean): Validacion {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const accion = b.accion
  if (accion !== "aprobar" && accion !== "cambios" && accion !== "rechazar") return { ok: false, error: "accion_invalida", detalle: "la acción es aprobar, cambios o rechazar" }
  const comentario = typeof b.comentario === "string" ? b.comentario.trim() : ""
  if (comentario.length > COMENTARIO_MAXIMO) return { ok: false, error: "comentario_largo", detalle: `el comentario pasa de ${COMENTARIO_MAXIMO} caracteres` }
  const estado_visto = typeof b.estado_visto === "string" ? b.estado_visto : undefined
  if (accion === "aprobar") {
    if (casillaExigida && b.casilla !== true) return { ok: false, error: "casilla_requerida", detalle: "esta pieza tiene la revisión incompleta o desacuerdos: marca «entiendo» para aprobar" }
    return { ok: true, pedido: { accion, casilla: b.casilla === true, estado_visto } }
  }
  if (accion === "rechazar") {
    if (comentario.length < MOTIVO_MINIMO) return { ok: false, error: "motivo_requerido", detalle: `el motivo del rechazo lleva al menos ${MOTIVO_MINIMO} caracteres` }
    return { ok: true, pedido: { accion, comentario, estado_visto } }
  }
  if (comentario.length < COMENTARIO_MINIMO) return { ok: false, error: "comentario_requerido", detalle: `el comentario del cambio lleva al menos ${COMENTARIO_MINIMO} caracteres` }
  const crudas = Array.isArray(b.laminas) ? b.laminas : []
  const laminas = [...new Set(crudas.map((x) => Number(x)))].sort((a, c) => a - c)
  if (laminas.some((n) => !Number.isInteger(n) || n < 1 || n > total)) return { ok: false, error: "lamina_invalida", detalle: `las láminas marcadas deben estar entre 1 y ${total}` }
  return { ok: true, pedido: { accion, comentario, laminas, estado_visto } }
}

/** la dirección de una lámina solo es válida si cuelga del almacén de la oficina (no se baja cualquier dirección que alguien meta en una fila) */
export const CUBO_DE_LA_OFICINA = "oficina-creativos"
export function direccionDeLaLamina(enlaceDelManifiesto: string | null | undefined, nombre: string, urlBase: string | null | undefined): string | null {
  if (!enlaceDelManifiesto || !urlBase) return null
  try {
    const base = new URL(urlBase)
    const m = new URL(enlaceDelManifiesto)
    if (m.origin !== base.origin) return null
    const prefijo = `/storage/v1/object/public/${CUBO_DE_LA_OFICINA}/`
    if (!m.pathname.startsWith(prefijo)) return null
    if (nombre.includes("/") || nombre.includes("\\") || nombre.includes("..")) return null
    const carpeta = m.pathname.slice(0, m.pathname.lastIndexOf("/") + 1)
    return `${m.origin}${carpeta}${encodeURIComponent(nombre)}`
  } catch {
    return null
  }
}

/** los números de la fila que el visor enseña */
export function gastoDeLaFila(meta: Record<string, unknown> | null | undefined): number | null {
  const v = Number(meta?.costo_usd)
  return Number.isFinite(v) ? v : null
}
