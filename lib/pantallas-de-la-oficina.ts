/**
 * LAS PANTALLAS DEL ARCO DE TU OFICINA (sprint 6.14 · Emilio, 1-nov): «cada pantalla … debería tener una especie de animación sutil y minimalista; no todo en color
 * naranja: la variedad de la paleta de los naranjas, para dar a entender que cada una muestra algo diferente». Corrección de Emilio (1-nov, 6.14b): «no te dije que
 * asignaras uso a cada pantalla: quita eso»; «la paleta está toda en el mismo tono; las animaciones deben ser sutiles, futurísticas». Así que aquí NO hay centros ni
 * clics: solo las 10 pantallas medidas sobre `oficina-2560.jpg` (2560×1440 · 1-nov), cuáles están ENCENDIDAS en la foto (6) y, para cada encendida, un MATIZ distinto
 * de la familia de los naranjas y una animación distinta de interfaz futurista. Qué abre cada pantalla lo decide Emilio después.
 */
export type Animacion = "radar" | "escaner" | "columnas" | "orbita" | "pulso" | "malla"

export interface PantallaDelArco {
  /** 1 = extremo izquierdo … 10 = extremo derecho */
  indice: number
  /** el vidrio de la pantalla, en píxeles de la foto 2560×1440 */
  forma: string
  /** encendida en la foto (las apagadas no muestran nada) */
  encendida: boolean
  /** su matiz dentro de la paleta de naranjas (cada encendida, un matiz claramente distinto: del dorado a la teja; con la mezcla «matiz» solo cuenta el matiz, no la saturación) */
  tono: string | null
  /** nombre del tono, para hablar de él */
  nombreDelTono: string | null
  animacion: Animacion | null
}

/** medidas 1-nov sobre oficina-2560.jpg (arco x 900-1680 · y 246-480) */
export const PANTALLAS_DEL_ARCO: readonly PantallaDelArco[] = [
  { indice: 1, forma: "932,356 972,338 972,466 932,470", encendida: true, tono: "#f7c233", nombreDelTono: "dorado", animacion: "columnas" },
  { indice: 2, forma: "986,330 1040,312 1040,438 986,426", encendida: false, tono: null, nombreDelTono: null, animacion: null },
  { indice: 3, forma: "1052,312 1110,296 1110,406 1052,416", encendida: true, tono: "#ffad1f", nombreDelTono: "ámbar", animacion: "orbita" },
  { indice: 4, forma: "1124,291 1182,276 1182,387 1124,394", encendida: true, tono: "#e8731a", nombreDelTono: "naranja de la marca", animacion: "radar" },
  { indice: 5, forma: "1202,273 1276,268 1276,380 1202,382", encendida: false, tono: null, nombreDelTono: null, animacion: null },
  { indice: 6, forma: "1286,268 1360,273 1360,382 1286,380", encendida: false, tono: null, nombreDelTono: null, animacion: null },
  { indice: 7, forma: "1372,276 1432,291 1432,394 1372,387", encendida: true, tono: "#ff5e1f", nombreDelTono: "zanahoria", animacion: "pulso" },
  { indice: 8, forma: "1450,296 1508,312 1508,416 1450,406", encendida: false, tono: null, nombreDelTono: null, animacion: null },
  { indice: 9, forma: "1522,316 1576,336 1576,438 1522,424", encendida: true, tono: "#e03d1a", nombreDelTono: "teja", animacion: "escaner" },
  { indice: 10, forma: "1590,342 1630,358 1630,460 1590,446", encendida: true, tono: "#ff9a2e", nombreDelTono: "durazno", animacion: "malla" },
]

export interface Caja { x: number; y: number; w: number; h: number; cx: number; cy: number }

/** la caja que envuelve una forma (para dibujar la animación adentro) */
export function cajaDeLaForma(forma: string): Caja {
  const puntos = forma.split(" ").map((p) => p.split(",").map(Number) as [number, number])
  const xs = puntos.map((p) => p[0]), ys = puntos.map((p) => p[1])
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }
}

/** las pantallas encendidas, de izquierda a derecha */
export const PANTALLAS_VIVAS = PANTALLAS_DEL_ARCO.filter((p): p is PantallaDelArco & { tono: string; nombreDelTono: string; animacion: Animacion } => p.encendida)

/** el matiz (0-360) y la saturación (0-1) de un color #rrggbb: sirven para comprobar que los tonos son naranjas y DISTINTOS entre sí */
export function matizYSaturacion(hex: string): { matiz: number; saturacion: number } {
  const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d === 0) return { matiz: 0, saturacion: 0 }
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  const l = (max + min) / 2
  return { matiz: (h * 60 + 360) % 360, saturacion: d / (1 - Math.abs(2 * l - 1)) }
}
export const matizDe = (hex: string): number => matizYSaturacion(hex).matiz
