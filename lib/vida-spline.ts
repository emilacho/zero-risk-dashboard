/**
 * DASHBOARD NUEVO · SPRINT 5 (31-oct, CC5 · corrección 5.1 el mismo día): la «vida» de la escena. La foto (variante-14) NO cambia: encima va
 * una capa 3D transparente hecha en Spline con pulsos de datos que recorren los circuitos ámbar impresos en el suelo de la foto. Nada más:
 * sin polvo flotando, sin discos sobre las ventanas, sin halos (Emilio, 31-oct: «las bolas se pasean por toda la imagen, no por los
 * circuitos», «hay piezas dobladas», «el negro profundo cambió»). Todo el movimiento se calcula aquí (puro, sin React, probado con vitest)
 * y se aplica cuadro a cuadro desde `VidaSpline` sobre los objetos de la escena de Spline (que solo aporta las esferas, la luz y el brillo).
 *
 * Coordenadas: las rutas se miden en las MISMAS coordenadas de la foto que las zonas clicables (VISTA, 2000×1125); `aMundo` las pasa al
 * mundo de Spline (origen en el centro de la escena, y hacia arriba). La cámara de Spline («Camara») mira de frente y se coloca a la
 * distancia exacta para que 920 unidades de alto llenen el lienzo: así 1 unidad = 1 unidad de VISTA a cualquier tamaño de ventana.
 */
import { VISTA } from "@/components/nuevo/EscenaNuevo"

/** la escena exportada desde Spline (archivo «Zero Risk · vida sobre la escena» · cuenta de Emilio) */
export const ESCENA_SPLINE = "https://prod.spline.design/O812XdclGIvJKMgW/scene.splinecode"

/** distancia de la cámara al plano de la escena para que el alto visible sea exactamente VISTA.h (920) · calibrada con las cuatro marcas azules */
export const CAMARA_Z = 1110

export type Punto = [number, number]

/** coordenadas de la foto (VISTA) → mundo de Spline (centro en 0,0 · y hacia arriba) */
export const aMundo = (x: number, y: number) => ({ x: x - (VISTA.x + VISTA.w / 2), y: VISTA.y + VISTA.h / 2 - y })

/** píxel de la foto original (2560×1385) → VISTA (la foto llena el recorte 150,40 · 1700×920) */
export const deFoto = (px: number, py: number): Punto => [Math.round(VISTA.x + (px * VISTA.w) / 2560), Math.round(VISTA.y + (py * VISTA.h) / 1385)]

/**
 * Los trazos de circuito ámbar del SUELO de la foto por los que viajan los pulsos. Salen del esqueleto de los píxeles ámbar finos de
 * `escena-2560.jpg` (máscara HSV → adelgazamiento → polilíneas, 31-oct) y se eligieron a ojo SOLO los que van por el piso entre
 * plataformas (los bordes de las losas y los marcos de las ventanas también son ámbar y se descartaron). Están en VISTA.
 * El orden es el de los objetos «Pulso 1»…«Pulso 10» de la escena de Spline.
 */
export const RUTAS: Punto[][] = [
  [[1035, 294], [1137, 344]], // de la plataforma pequeña de arriba hacia Dept. Marketing
  [[560, 377], [707, 461], [724, 453], [778, 484]], // trazo largo de la izquierda hacia el cerebro, con su cajita
  [[936, 382], [866, 419], [876, 430]], // entre la plataforma de la torre y el cerebro
  [[785, 535], [754, 512], [786, 490], [801, 492], [857, 462]], // zigzag a la izquierda del cerebro
  [[1226, 475], [1315, 526], [1323, 538], [1374, 566]], // del cerebro hacia la plataforma de la derecha
  [[1307, 501], [1317, 508], [1330, 509], [1371, 486], [1381, 486], [1416, 505], [1381, 528]], // el lazo rectangular frente a la plataforma derecha
  [[1171, 668], [1112, 632], [1127, 625], [1137, 628], [1301, 536]], // de la torre de abajo hacia la derecha
  [[688, 610], [534, 691], [539, 702], [524, 708], [508, 722], [580, 771]], // trazo largo abajo a la izquierda, con su cajita
  [[942, 733], [954, 732], [1017, 694], [926, 637]], // entre la plataforma de abajo-izquierda y el cerebro
  [[1009, 785], [975, 762], [985, 758], [1085, 819], [1096, 817]], // la cajita de abajo, al centro
]

/** segundos por recorrido de cada pulso (≈ 30 unidades/s, cada uno distinto para que nunca vayan al unísono) */
export const PERIODOS = [4.1, 8.3, 4.4, 5.2, 5.8, 5.5, 9.5, 10.2, 6.4, 6.0]

/** cada pulso arranca en un momento distinto (segundos de desfase) */
export const DESFASES = PERIODOS.map((_, i) => i * 1.3)

const suave = (p: number) => 0.5 - Math.cos(Math.PI * p) / 2 // ease-in-out

export function largoRuta(r: Punto[]): number {
  let L = 0
  for (let i = 1; i < r.length; i++) L += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1])
  return L
}

/** el punto a la fracción `u` (0..1) del recorrido, a velocidad constante por el largo */
export function puntoEnRuta(r: Punto[], u: number): Punto {
  const L = largoRuta(r)
  let resto = Math.min(1, Math.max(0, u)) * L
  for (let i = 1; i < r.length; i++) {
    const d = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1])
    if (resto <= d || i === r.length - 1) {
      const f = d === 0 ? 0 : Math.min(1, resto / d)
      return [r[i - 1][0] + (r[i][0] - r[i - 1][0]) * f, r[i - 1][1] + (r[i][1] - r[i - 1][1]) * f]
    }
    resto -= d
  }
  return r[r.length - 1]
}

/**
 * dónde está el pulso `i` en el segundo `t` (en VISTA) y su tamaño (se enciende al salir y se apaga al llegar); alterna el sentido en cada
 * viaje. El pulso siempre está SOBRE su ruta: nunca sale del trazo.
 */
export function poseDePulso(t: number, i: number): { x: number; y: number; s: number } {
  const ruta = RUTAS[i]
  const P = PERIODOS[i % PERIODOS.length]
  const tt = Math.max(0, t - DESFASES[i % DESFASES.length])
  const viaje = Math.floor(tt / P)
  const f = tt / P - viaje
  const u0 = suave(f)
  const u = viaje % 2 === 0 ? u0 : 1 - u0
  const [x, y] = puntoEnRuta(ruta, u)
  const s = Math.max(0.001, Math.sin(Math.PI * f)) // 0 → 1 → 0
  return { x, y, s }
}

/** distancia de un punto a una polilínea (en VISTA) · para comprobar que los pulsos van por sus trazos */
export function distanciaARuta(r: Punto[], x: number, y: number): number {
  let mejor = Infinity
  for (let i = 1; i < r.length; i++) {
    const [ax, ay] = r[i - 1], [bx, by] = r[i]
    const dx = bx - ax, dy = by - ay
    const l2 = dx * dx + dy * dy
    const u = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / l2))
    mejor = Math.min(mejor, Math.hypot(x - (ax + dx * u), y - (ay + dy * u)))
  }
  return mejor
}

/** nombres de los objetos de la escena de Spline: los que esta capa mueve y los que deja OCULTOS (quedaron en el archivo, no se usan) */
export const NOMBRES = {
  camara: "Camara",
  pulsos: RUTAS.map((_, i) => `Pulso ${i + 1}`),
  marcas: ["Marca TL", "Marca TR", "Marca BL", "Marca BR"],
  /** grupos del archivo de Spline cuyo transform se resetea al cargar (los hijos se posicionan en coordenadas del grupo) */
  grupos: ["Pulsos", "Marcas"],
  ocultos: [
    ...Array.from({ length: 7 }, (_, i) => `Brillo ${i + 1}`),
    ...Array.from({ length: 36 }, (_, i) => `Polvo ${i + 1}`),
    "Halo Cerebro",
    "Halo Marketing",
  ],
}

/** la capa 3D solo se monta donde vale la pena: pantalla de escritorio (≥ 700 px), con WebGL y sin «reducir movimiento» (si no, queda la foto sola) */
export function conviene(anchoVentana: number, hayWebGL: boolean, reducirMovimiento: boolean): boolean {
  return anchoVentana >= 700 && hayWebGL && !reducirMovimiento
}
