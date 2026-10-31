/**
 * DASHBOARD NUEVO · SPRINT 5 (31-oct, CC5): la «vida» de la escena. La foto (variante-14) NO cambia: encima va una capa 3D transparente hecha en
 * Spline con pulsos de datos que recorren los circuitos ámbar de la foto, polvo de luz flotando, las ventanas encendidas que respiran y un halo
 * que aparece al pasar el ratón por un departamento. Todo el movimiento se calcula aquí (puro, sin React, probado con vitest) y se aplica
 * cuadro a cuadro desde `VidaSpline` sobre los objetos de la escena de Spline (que solo aporta las formas, las luces y el brillo).
 *
 * Coordenadas: las rutas y los puntos se miden en las MISMAS coordenadas de la foto que las zonas clicables (VISTA, 2000×1125); `aMundo` las pasa
 * al mundo de Spline (origen en el centro de la escena, y hacia arriba). La cámara de Spline («Camara») mira de frente y se coloca a la distancia
 * exacta para que 920 unidades de alto llenen el lienzo: así 1 unidad = 1 unidad de VISTA a cualquier tamaño de ventana.
 */
import { VISTA } from "@/components/nuevo/EscenaNuevo"

/** la escena exportada desde Spline (archivo «Zero Risk · vida sobre la escena» · cuenta de Emilio) */
export const ESCENA_SPLINE = "https://prod.spline.design/O812XdclGIvJKMgW/scene.splinecode"

/** distancia de la cámara al plano de la escena para que el alto visible sea exactamente VISTA.h (920) · calibrada con las cuatro marcas azules */
export const CAMARA_Z = 1110

export type Punto = [number, number]
type Vec3 = { x: number; y: number; z: number }

/** coordenadas de la foto (VISTA) → mundo de Spline (centro en 0,0 · y hacia arriba) */
export const aMundo = (x: number, y: number) => ({ x: x - (VISTA.x + VISTA.w / 2), y: VISTA.y + VISTA.h / 2 - y })

/**
 * Los tramos de circuito ámbar de la foto por los que viajan los pulsos (medidos sobre los píxeles ámbar de `escena-2560.jpg`, 31-oct).
 * El orden es el de los objetos «Pulso 1»…«Pulso 10» de la escena de Spline.
 */
export const RUTAS: Punto[][] = [
  [[609, 405], [745, 481]], // de la torre (arriba a la izquierda) hacia el cerebro
  [[747, 514], [894, 436]], // entrada izquierda del cerebro
  [[936, 642], [1024, 697], [946, 735], [1018, 779]], // del cerebro a la plataforma de abajo (zigzag)
  [[1004, 631], [1112, 571]], // salida derecha-abajo del cerebro
  [[1117, 638], [1238, 571]], // hacia la plataforma de la derecha
  [[1103, 615], [1183, 662]], // hacia abajo a la derecha
  [[1290, 534], [1377, 482]], // hacia Dept. Marketing / derecha
  [[538, 698], [623, 653]], // plataforma de abajo a la izquierda
  [[491, 714], [561, 759]], // su borde inferior
  [[1255, 712], [1316, 747]], // plataforma de abajo a la derecha
]

/** segundos por recorrido de cada pulso (distintos para que nunca vayan al unísono) */
export const PERIODOS = [7.5, 9, 8, 6.5, 7, 8.5, 6, 9.5, 7.2, 8.2]

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

/** dónde está el pulso `i` en el segundo `t` (en VISTA) y su tamaño (se enciende al salir y se apaga al llegar); alterna el sentido en cada viaje */
export function poseDePulso(t: number, i: number): { x: number; y: number; s: number } {
  const ruta = RUTAS[i]
  const P = PERIODOS[i % PERIODOS.length]
  const viaje = Math.floor(t / P)
  const f = t / P - viaje
  const u0 = suave(f)
  const u = viaje % 2 === 0 ? u0 : 1 - u0
  const [x, y] = puntoEnRuta(ruta, u)
  const s = Math.max(0.001, Math.sin(Math.PI * f)) // 0 → 1 → 0
  return { x, y, s }
}

/** el polvo flota: vaivén pequeño y lento alrededor de donde nació, cada mota con su propio ritmo */
export function poseDePolvo(t: number, i: number, base: Vec3): Vec3 {
  const w = 0.25 + (i % 7) * 0.045
  const fase = i * 1.7
  return {
    x: base.x + Math.cos(t * w * 0.8 + fase) * 7,
    y: base.y + Math.sin(t * w + fase) * 11 + Math.sin(t * 0.11 + i) * 4,
    z: base.z + Math.sin(t * w * 0.6 + fase * 0.5) * 12,
  }
}

/** las ventanas encendidas respiran: entre 0,84 y 1,16 de su tamaño, cada una a su ritmo */
export function escalaDeBrillo(t: number, i: number): number {
  const w = 0.8 + (i % 5) * 0.15
  return 1 + 0.16 * Math.sin(t * w + i * 2.1)
}

/** el halo de hover late apenas (±5 %) mientras está visible */
export const escalaDeHalo = (t: number) => 1 + 0.05 * Math.sin(t * 2.2)

/** qué halo de la escena de Spline corresponde a cada zona clicable (`data-zona` de la foto) */
export const HALOS: Record<string, string> = { cerebro: "Halo Cerebro", marketing: "Halo Marketing" }

/** nombres de los objetos de la escena de Spline que esta capa mueve */
export const NOMBRES = {
  camara: "Camara",
  pulsos: RUTAS.map((_, i) => `Pulso ${i + 1}`),
  brillos: Array.from({ length: 7 }, (_, i) => `Brillo ${i + 1}`),
  polvo: Array.from({ length: 36 }, (_, i) => `Polvo ${i + 1}`),
  marcas: ["Marca TL", "Marca TR", "Marca BL", "Marca BR"],
}

/** la capa 3D solo se monta donde vale la pena: pantalla de escritorio (≥ 700 px), con WebGL y sin «reducir movimiento» (si no, queda la foto sola) */
export function conviene(anchoVentana: number, hayWebGL: boolean, reducirMovimiento: boolean): boolean {
  return anchoVentana >= 700 && hayWebGL && !reducirMovimiento
}
