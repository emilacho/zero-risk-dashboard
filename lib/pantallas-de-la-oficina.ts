/**
 * LAS PANTALLAS DE TU OFICINA (sprint 6.14 · Emilio, 1-nov): «cada pantalla … debería tener una especie de animación sutil y minimalista; no todo en color naranja:
 * la variedad de la paleta de los naranjas, para dar a entender que cada una muestra algo diferente». Correcciones de Emilio (1-nov): 6.14b «no te dije que asignaras
 * uso a cada pantalla: quita eso»; «la paleta está toda en el mismo tono; las animaciones deben ser sutiles, futurísticas» · 6.15 «haz lo mismo con las pequeñas
 * pantallas encima del escritorio»; «las animaciones se pierden porque las hiciste del mismo color: piénsalo como un centro de control futurístico».
 * Aquí NO hay centros ni clics (salvo la pantalla de música, que tiene su propia lógica en `lib/musica.ts`): solo las pantallas medidas sobre `oficina-2560.jpg`
 * (2560×1440 · 1-nov), cuáles están ENCENDIDAS y, para cada encendida, un MATIZ distinto de la familia de los naranjas y una animación distinta de interfaz.
 * Qué abre cada pantalla lo decide Emilio después.
 */
/**
 * 6.16 (Emilio, 1-nov): «las animaciones no me gustan: una es un átomo, otra un radar, otra un pulso cardíaco, otra un nivel de volumen; debe ser tema tecnología
 * del futuro mezclado con empresa; primero la parte visual, después decidiremos qué función tiene cada una». Tema: tableros de una empresa vistos desde el futuro.
 */
export type Animacion =
  | "ventas" | "red" | "indicadores" | "crecimiento" | "embudo" | "mapa" // el arco (6): barras de ventas · red de la empresa · tablero de indicadores · curva de crecimiento · embudo · mapa de mercados
  | "bus" | "chip" | "meandro" | "trayecto" // 6.17: los 4 vidrios negros del arco en el dorado de la 10 · 6.17b: tres circuitos de microchip + un trayecto
  | "cotizaciones" | "pista" | "agenda" | "participacion" | "tareas" // el escritorio (5): cinta de cotizaciones · pista de reproducción (música) · agenda del día · participación · lista de tareas

export interface Pantalla {
  /** arco: 1 = extremo izquierdo … 10 = extremo derecho · escritorio: 1 = extremo izquierdo … 5 = extremo derecho */
  indice: number
  /** el vidrio de la pantalla, en píxeles de la foto 2560×1440 */
  forma: string
  /** encendida en la foto (6.17: las apagadas también se animan, en el estilo dorado pálido de la pantalla 10) */
  encendida: boolean
  /** su matiz dentro de la paleta de naranjas (cada encendida, un matiz claramente distinto; con la mezcla «matiz» solo cuenta el matiz, no la saturación) */
  tono: string | null
  /** nombre del tono, para hablar de él */
  nombreDelTono: string | null
  animacion: Animacion | null
}
/** @deprecated nombre viejo (6.14) */
export type PantallaDelArco = Pantalla

/** EL ARCO · medidas 1-nov sobre oficina-2560.jpg (x 900-1680 · y 246-480) · 6.16b: las 6 encendidas re-medidas sobre la foto ampliada con cuadrícula de 10 px (las de 6.14 estaban corridas hasta 9 px) */
export const PANTALLAS_DEL_ARCO: readonly Pantalla[] = [
  { indice: 1, forma: "928,369 971,345 970,450 928,471", encendida: true, tono: "#f7c233", nombreDelTono: "dorado", animacion: "ventas" },
  { indice: 2, forma: "983,333 1038,316 1038,421 984,445", encendida: false, tono: "#ff9a2e", nombreDelTono: "durazno", animacion: "bus" },
  { indice: 3, forma: "1051,311 1111,294 1111,396 1052,416", encendida: true, tono: "#ffad1f", nombreDelTono: "ámbar", animacion: "red" },
  { indice: 4, forma: "1126,291 1191,277 1191,380 1126,393", encendida: true, tono: "#e8731a", nombreDelTono: "naranja de la marca", animacion: "indicadores" },
  { indice: 5, forma: "1206,275 1272,270 1273,373 1206,378", encendida: false, tono: "#ff9a2e", nombreDelTono: "durazno", animacion: "chip" },
  { indice: 6, forma: "1289,270 1356,276 1356,377 1289,373", encendida: false, tono: "#ff9a2e", nombreDelTono: "durazno", animacion: "meandro" },
  { indice: 7, forma: "1371,278 1436,290 1436,391 1371,380", encendida: true, tono: "#ff5e1f", nombreDelTono: "zanahoria", animacion: "crecimiento" },
  { indice: 8, forma: "1451,295 1509,311 1510,416 1451,396", encendida: false, tono: "#ff9a2e", nombreDelTono: "durazno", animacion: "trayecto" },
  { indice: 9, forma: "1523,318 1575,338 1575,444 1523,420", encendida: true, tono: "#e03d1a", nombreDelTono: "teja", animacion: "embudo" },
  { indice: 10, forma: "1586,345 1624,364 1623,470 1586,450", encendida: true, tono: "#ff9a2e", nombreDelTono: "durazno", animacion: "mapa" },
]

/**
 * EL ESCRITORIO · las 5 pantallas chicas sobre la consola (medidas 1-nov). La 2 (inmediatamente a la izquierda de la silla) es la de MÚSICA: misma forma que
 * `PANTALLA_MUSICA.forma` en `lib/musica.ts`; aquí solo recibe su tinte y su animación (el toque y el reproductor viven en `PantallaDeMusica`).
 * La 3 (frente a la silla) queda libre. Cinco matices repartidos por la familia (≥5° entre ellos), intercalados con los del arco.
 */
export const PANTALLAS_DEL_ESCRITORIO: readonly Pantalla[] = [
  { indice: 1, forma: "1075,479 1108,464 1120,479 1078,493", encendida: true, tono: "#ffc94a", nombreDelTono: "miel", animacion: "cotizaciones" },
  { indice: 2, forma: "1141,450 1190,438 1200,460 1150,470", encendida: true, tono: "#ff6d1a", nombreDelTono: "mandarina", animacion: "pista" },
  { indice: 3, forma: "1237,428 1311,428 1311,451 1237,451", encendida: true, tono: "#ff871a", nombreDelTono: "calabaza", animacion: "agenda" },
  { indice: 4, forma: "1370,436 1423,450 1414,471 1361,458", encendida: true, tono: "#e8491a", nombreDelTono: "ladrillo", animacion: "participacion" },
  { indice: 5, forma: "1456,464 1482,476 1478,491 1442,480", encendida: true, tono: "#e8911a", nombreDelTono: "caramelo", animacion: "tareas" },
]

export interface Caja { x: number; y: number; w: number; h: number; cx: number; cy: number }

/** la caja que envuelve una forma (para dibujar la animación adentro) */
export function cajaDeLaForma(forma: string): Caja {
  const puntos = forma.split(" ").map((p) => p.split(",").map(Number) as [number, number])
  const xs = puntos.map((p) => p[0]), ys = puntos.map((p) => p[1])
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }
}

/** el lienzo útil dentro del vidrio (márgenes del 10 % a los lados y 12 % arriba/abajo): ahí se encaja cada dibujo, sea alto (arco) o apaisado (escritorio) */
export function lienzoDeLaForma(forma: string): Caja {
  const c = cajaDeLaForma(forma), mx = c.w * 0.1, my = c.h * 0.12
  return { x: c.x + mx, y: c.y + my, w: c.w - 2 * mx, h: c.h - 2 * my, cx: c.cx, cy: c.cy }
}

/**
 * 6.16b (Emilio, 1-nov: «casi todos están descuadrados»): los vidrios de la foto están en PERSPECTIVA (bordes de arriba y abajo inclinados), y un dibujo recto
 * dentro de la caja que los envuelve queda torcido y cortado. El MARCO de cada pantalla es un plano propio de W×H (los largos medios de sus bordes) y la matriz
 * afín que mejor lleva ese plano a las 4 esquinas del vidrio (mínimos cuadrados: el centro coincide exacto y cada esquina se desvía solo la mitad de lo que sus
 * bordes no son paralelos). La forma va en el orden de la foto: arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda.
 */
export interface Marco { W: number; H: number; matriz: [number, number, number, number, number, number] }
export function marcoDeLaForma(forma: string): Marco {
  const [ai, ad, bd, bi] = forma.split(" ").map((p) => p.split(",").map(Number) as [number, number])
  const largo = (p: [number, number], q: [number, number]) => Math.hypot(q[0] - p[0], q[1] - p[1])
  const W = (largo(ai, ad) + largo(bi, bd)) / 2, H = (largo(ai, bi) + largo(ad, bd)) / 2
  const a = (ad[0] + bd[0] - ai[0] - bi[0]) / (2 * W), b = (ad[1] + bd[1] - ai[1] - bi[1]) / (2 * W)
  const c = (bi[0] + bd[0] - ai[0] - ad[0]) / (2 * H), d = (bi[1] + bd[1] - ai[1] - ad[1]) / (2 * H)
  const mx = (ai[0] + ad[0] + bd[0] + bi[0]) / 4, my = (ai[1] + ad[1] + bd[1] + bi[1]) / 4
  return { W, H, matriz: [a, b, c, d, mx - a * W / 2 - c * H / 2, my - b * W / 2 - d * H / 2] }
}
/** el lienzo útil dentro del plano propio del vidrio (márgenes del 10 % a los lados y 12 % arriba/abajo), en coordenadas del marco */
export function lienzoDelMarco(m: Marco): Caja {
  const mx = m.W * 0.1, my = m.H * 0.12
  return { x: mx, y: my, w: m.W - 2 * mx, h: m.H - 2 * my, cx: m.W / 2, cy: m.H / 2 }
}
/** lleva un punto del marco a la foto */
export function alaFoto(m: Marco, u: number, v: number): [number, number] {
  const [a, b, c, d, e, f] = m.matriz
  return [a * u + c * v + e, b * u + d * v + f]
}

export type PantallaViva = Pantalla & { tono: string; nombreDelTono: string; animacion: Animacion }
const vivas = (ps: readonly Pantalla[]) => ps.filter((p): p is PantallaViva => p.encendida)
/** las pantallas encendidas, de izquierda a derecha */
export const PANTALLAS_VIVAS = vivas(PANTALLAS_DEL_ARCO)
export const ESCRITORIO_VIVO = vivas(PANTALLAS_DEL_ESCRITORIO)
/** los dos grupos, con su nombre */
/** 6.17 · los vidrios NEGROS del arco (apagados en la foto) también se animan, en el estilo dorado pálido de la pantalla 10: mismo tono durazno, variantes del mapa */
export const PANTALLAS_EN_NEGRO = PANTALLAS_DEL_ARCO.filter((p): p is PantallaViva => !p.encendida && p.animacion !== null && p.tono !== null)
/** todo el arco animado, de izquierda a derecha */
export const ARCO_ANIMADO = PANTALLAS_DEL_ARCO.filter((p): p is PantallaViva => p.animacion !== null && p.tono !== null)
export const GRUPOS_DE_PANTALLAS = [{ grupo: "arco", pantallas: ARCO_ANIMADO }, { grupo: "escritorio", pantallas: ESCRITORIO_VIVO }] as const

/** el color de las LÍNEAS de la interfaz: claro y cálido, para que contrasten con el vidrio tintado (6.15: «se pierden porque las hiciste del mismo color») */
export const LUZ_DE_LA_INTERFAZ = "#fff3e2"

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
