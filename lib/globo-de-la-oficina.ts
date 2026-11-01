/**
 * EL GLOBO HOLOGRÁFICO DE TU OFICINA (sprint 6.18 → 6.18b · Emilio, 1-nov: «que la bola del mundo que está como holograma gire lentamente en su propio eje sin
 * dañar los detalles preciosos que contiene» → «se destruye al rotar: se ven líneas sin sentido, se pierden los continentes» → «que quede idéntico al original:
 * colores, iluminación, detalles, todo»).
 * La foto `oficina-2560.jpg` solo trae UNA cara del globo: girar sus píxeles obliga a inventar la otra cara, y los tres intentos de 6.18 (envolver, espejo,
 * repetir la franja nítida) rompían continentes y cuadrícula. 6.18b: el globo se REDIBUJA con un mapa del mundo real (world-atlas, Natural Earth 1:110m) en el
 * estilo del holograma de la foto: cuadrícula y costas en su misma luz, tierras apenas más claras, la cara de atrás tenue en transparencia. De la foto se
 * conserva la iluminación (sus propios píxeles muy desenfocados: el color y la luz sin las líneas viejas), el borde brillante y el anillo de órbita, que no giran.
 * Los valores del trazo se ajustaron comparando contra la foto original lado a lado.
 * Medido sobre la foto ampliada con cuadrícula (1-nov): bordes x 1305-1409 · y 669-771.
 */
export const GLOBO = {
  cx: 1357,
  cy: 720,
  r: 51.5,
  /** el eje se inclina hacia la cámara (la foto mira desde arriba): el centro de la vista queda a esta latitud */
  inclinacion: 18,
  /** segundos por vuelta completa (Emilio, 1-nov: «auméntale 15 %» → 90 / 1,15 ≈ 78) */
  segundosPorVuelta: 78,
  /** longitud de arranque: Ecuador al frente */
  longitudInicial: -78,
  /** cuadrícula cada tantos grados (contada sobre la foto: ~15°) */
  paso: 15,
  /** desde dónde el dibujo se funde con la foto (fracción del radio): el borde brillante y el anillo quedan de la foto */
  fundido: { desde: 0.84, hasta: 0.97 },
  /** desenfoque de la iluminación de la foto, en píxeles de la foto, y cuánto se oscurece (el desenfoque reparte el brillo de las líneas viejas y aclara el
   *  vidrio: el original es más oscuro y translúcido entre líneas) */
  desenfoque: 7,
  brilloDeLaBase: 0.55,
  saturacionDeLaBase: 1.3,
  /** el lienzo cubre un poco más que el disco */
  margen: 1.06,
  /** cuadros por segundo (gira despacio: no hace falta más) */
  cuadros: 30,
} as const

/** el trazo, tomado del holograma de la foto (grosores en píxeles de la foto) */
export const TRAZO_DEL_GLOBO = {
  cuadricula: "rgba(255,222,170,0.92)",
  grosorCuadricula: 0.55,
  costa: "rgba(255,240,215,0.55)",
  grosorCosta: 0.45,
  tierra: "rgba(255,226,180,0.34)",
  atras: 0.25,
  halo: "rgba(255,160,60,1)",
  radioHalo: 5,
  /** el haz de luz vertical del pedestal que atraviesa el globo (en la foto no gira: es la luz del proyector) */
  haz: { ancho: 0.8, arriba: "rgba(255,236,200,0.35)", abajo: "rgba(255,246,225,0.95)" },
} as const

/** la caja del lienzo en píxeles de la foto */
export function cajaDelGlobo() {
  const lado = GLOBO.r * GLOBO.margen
  return { x: GLOBO.cx - lado, y: GLOBO.cy - lado, w: 2 * lado, h: 2 * lado }
}

/** el giro de la proyección (d3 geoOrthographic.rotate) a los `segundos` de empezar: gira hacia el este, con el eje inclinado hacia la cámara */
export function giroDelGlobo(segundos: number): [number, number, number] {
  const lon = GLOBO.longitudInicial + (segundos * 360) / GLOBO.segundosPorVuelta
  const envuelta = (((lon + 180) % 360) + 360) % 360 - 180
  return [-envuelta, -GLOBO.inclinacion, 0]
}
