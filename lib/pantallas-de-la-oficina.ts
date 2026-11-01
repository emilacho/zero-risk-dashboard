/**
 * LAS PANTALLAS DEL ARCO DE TU OFICINA (sprint 6.14 · Emilio, 1-nov): «esta oficina es el centro de HITL [revisión humana]. Cada pantalla que tengo al frente debe abrir
 * un centro de comando, con una animación sutil y minimalista; no todo naranja: la variedad de la paleta de los naranjas, para dar a entender que cada una muestra algo
 * diferente». Lógica PURA: las 10 pantallas del arco medidas sobre `oficina-2560.jpg` (2560×1440 · 1-nov), cuáles están ENCENDIDAS en la foto (6) y qué centro abre cada una.
 * Regla (Emilio 31-oct): nada enlaza al dashboard viejo: cada pantalla abre ENCIMA un centro que ya existe en el estilo nuevo. Las 4 pantallas apagadas de la foto quedan
 * reservadas (sin zona) para lo que todavía no llegó al estilo nuevo (Gasto · Alertas…): se encienden cuando exista su centro.
 */
export type ClaveDeCentro = "informes" | "gran_idea" | "bandeja" | "en_vivo" | "equipo" | "calendario"
export type Glifo = "barras" | "chispa" | "tarjetas" | "onda" | "puntos" | "rejilla"

export interface Centro {
  nombre: string
  /** el rótulo con las letras de la marca, encima de la pantalla */
  rotulo: string
  /** su tono dentro de la paleta de naranjas (cada centro, uno distinto) */
  tono: string
  /** qué se ve en la pantalla (el dibujo mínimo animado) */
  glifo: Glifo
  /** qué hay detrás, en una línea */
  que: string
}

/** la paleta de naranjas de la escena: la marca y sus vecinos */
export const TONOS = { marca: "#e8731a", mandarina: "#ff8c42", durazno: "#f5a35c", cobre: "#c9561a", miel: "#ffb86b", ocre: "#d9862b" } as const

export const CENTROS: Record<ClaveDeCentro, Centro> = {
  bandeja: { nombre: "Bandeja", rotulo: "BANDEJA", tono: TONOS.marca, glifo: "tarjetas", que: "Las piezas y revisiones que esperan tu aprobación" },
  gran_idea: { nombre: "Gran idea", rotulo: "GRAN IDEA", tono: TONOS.mandarina, glifo: "chispa", que: "El concepto de campaña que la sala creativa propone y tú apruebas" },
  informes: { nombre: "Informes", rotulo: "INFORMES", tono: TONOS.durazno, glifo: "barras", que: "Lo que las oficinas le reportan al cliente" },
  en_vivo: { nombre: "En vivo", rotulo: "EN VIVO", tono: TONOS.miel, glifo: "onda", que: "Qué está haciendo cada empleado ahora mismo" },
  equipo: { nombre: "Equipo", rotulo: "EQUIPO", tono: TONOS.cobre, glifo: "puntos", que: "Quién trabaja en cada equipo y en qué" },
  calendario: { nombre: "Calendario", rotulo: "CALENDARIO", tono: TONOS.ocre, glifo: "rejilla", que: "Las publicaciones de la campaña, coloreadas por dónde están" },
}

export interface PantallaDelArco {
  /** 1 = extremo izquierdo … 10 = extremo derecho */
  indice: number
  /** el vidrio de la pantalla, en píxeles de la foto 2560×1440 */
  forma: string
  /** encendida en la foto (las apagadas no abren nada todavía) */
  encendida: boolean
  centro: ClaveDeCentro | null
}

/** medidas 1-nov sobre oficina-2560.jpg (arco x 900-1680 · y 246-480). El centro mismo (4 y 7) para lo que más miras: la bandeja y lo que pasa en vivo. */
export const PANTALLAS_DEL_ARCO: readonly PantallaDelArco[] = [
  { indice: 1, forma: "932,356 972,338 972,466 932,470", encendida: true, centro: "informes" },
  { indice: 2, forma: "986,330 1040,312 1040,438 986,426", encendida: false, centro: null },
  { indice: 3, forma: "1052,312 1110,296 1110,406 1052,416", encendida: true, centro: "gran_idea" },
  { indice: 4, forma: "1124,291 1182,276 1182,387 1124,394", encendida: true, centro: "bandeja" },
  { indice: 5, forma: "1202,273 1276,268 1276,380 1202,382", encendida: false, centro: null },
  { indice: 6, forma: "1286,268 1360,273 1360,382 1286,380", encendida: false, centro: null },
  { indice: 7, forma: "1372,276 1432,291 1432,394 1372,387", encendida: true, centro: "en_vivo" },
  { indice: 8, forma: "1450,296 1508,312 1508,416 1450,406", encendida: false, centro: null },
  { indice: 9, forma: "1522,316 1576,336 1576,438 1522,424", encendida: true, centro: "equipo" },
  { indice: 10, forma: "1590,342 1630,358 1630,460 1590,446", encendida: true, centro: "calendario" },
]

export interface Caja { x: number; y: number; w: number; h: number; cx: number; cy: number }

/** la caja que envuelve una forma (para dibujar el glifo adentro y poner el rótulo encima) */
export function cajaDeLaForma(forma: string): Caja {
  const puntos = forma.split(" ").map((p) => p.split(",").map(Number) as [number, number])
  const xs = puntos.map((p) => p[0]), ys = puntos.map((p) => p[1])
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }
}

/** la pantalla que abre un centro (o null si ese centro no tiene pantalla) */
export const pantallaDelCentro = (clave: ClaveDeCentro): PantallaDelArco | null => PANTALLAS_DEL_ARCO.find((p) => p.centro === clave) ?? null

/** las pantallas vivas, de izquierda a derecha */
export const PANTALLAS_VIVAS = PANTALLAS_DEL_ARCO.filter((p): p is PantallaDelArco & { centro: ClaveDeCentro } => p.centro !== null)

/** el matiz (0-360) de un color #rrggbb: sirve para comprobar que todos los tonos viven en la familia de los naranjas */
export function matizDe(hex: string): number {
  const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

/** las cifras vivas que algunas pantallas muestran (una lectura liviana al abrir la oficina; si falla, la pantalla muestra solo su dibujo) */
export interface CifrasDelArco { por_aprobar?: number; hoy?: number }
export function cifraDeLaPantalla(clave: ClaveDeCentro, c: CifrasDelArco): string | null {
  if (clave === "bandeja" && typeof c.por_aprobar === "number") return String(c.por_aprobar)
  if (clave === "en_vivo" && typeof c.hoy === "number") return String(c.hoy)
  return null
}
