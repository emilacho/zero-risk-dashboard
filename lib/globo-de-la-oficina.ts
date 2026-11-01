/**
 * EL GLOBO HOLOGRÁFICO DE TU OFICINA (sprint 6.18 · Emilio, 1-nov: «que la bola del mundo que está como holograma gire lentamente en su propio eje sin dañar
 * los detalles preciosos que contiene»). El globo es parte de la foto `oficina-2560.jpg`: no se redibuja, se hacen CORRER SUS PROPIOS PÍXELES sobre la esfera.
 * Cada punto del disco se lleva a 3D (esfera vista de frente, eje inclinado hacia la cámara porque la foto mira desde arriba), se gira la longitud alrededor del
 * eje y se vuelve a la foto. La foto solo trae la cara de frente, y cerca del canto solo tiene el brillo del borde, comprimido: por eso se toma la FRANJA NÍTIDA
 * (±55° del meridiano central) y se repite alrededor de la esfera; donde una copia empalma con la siguiente se funden en 10°. Así no hay espejo, ni estiramiento,
 * ni píxeles del canto (6.18: envolver cada 180° dejaba una franja rayada; plegar en espejo dejaba una «mariposa»). El borde brillante (y el anillo de órbita que
 * lo cruza) se queda quieto: del 74 al 90 % del radio se funde con la foto original.
 * Medido sobre la foto ampliada con cuadrícula (1-nov): bordes x 1305-1409 · y 669-771.
 */
export const GLOBO = {
  cx: 1357,
  cy: 720,
  r: 51.5,
  /** inclinación del eje hacia la cámara (los paralelos se ven combados hacia abajo) */
  inclinacion: (12 * Math.PI) / 180,
  /** media franja nítida que se repite (se toma hasta nitido + empalme) */
  nitido: (55 * Math.PI) / 180,
  /** ancho del empalme entre copias */
  empalme: (10 * Math.PI) / 180,
  /** segundos por vuelta completa: lento (Emilio, 1-nov: «se movía muy lento: auméntale 15 %» → 90 / 1,15 ≈ 78) */
  segundosPorVuelta: 78,
  /** desde dónde se funde con la foto original (fracción del radio) */
  fundido: { desde: 0.74, hasta: 0.9 },
  /** el lienzo cubre un poco más que el disco */
  margen: 1.06,
} as const

/** la caja del lienzo en píxeles de la foto */
export function cajaDelGlobo() {
  const lado = GLOBO.r * GLOBO.margen
  return { x: GLOBO.cx - lado, y: GLOBO.cy - lado, w: 2 * lado, h: 2 * lado }
}

/**
 * De dónde sale el color de un punto del disco tras girar `theta` radianes (misma cuenta que el sombreador). Entra y sale en unidades del radio (y hacia abajo).
 * Devuelve el punto principal, el de la copia vecina y el peso del principal (1 fuera del empalme). Fuera del 90 % devuelve el mismo punto (el borde no gira).
 */
export function origenesDelPunto(px: number, py: number, theta: number, inclinacion: number = GLOBO.inclinacion) {
  const rr = Math.hypot(px, py)
  if (rr >= GLOBO.fundido.hasta) return { principal: [px, py] as [number, number], vecino: [px, py] as [number, number], peso: 1 }
  const z = Math.sqrt(1 - rr * rr), c = Math.cos(inclinacion), s = Math.sin(inclinacion)
  const gy = c * py - s * z, gz = s * py + c * z
  const lam = Math.atan2(px, gz), cphi = Math.sqrt(Math.max(0, 1 - gy * gy))
  const L = GLOBO.nitido, W = GLOBO.empalme
  let l1 = lam - theta + L
  l1 = l1 - 2 * L * Math.floor(l1 / (2 * L)) - L // -L … L
  const l2 = l1 - 2 * L * Math.sign(l1) // la misma longitud en la copia vecina
  const peso = 0.5 + 0.5 * Math.min(1, Math.max(0, (L - Math.abs(l1)) / W))
  const alaFoto = (l: number): [number, number] => { const hx = cphi * Math.sin(l), hz = cphi * Math.cos(l); return [hx, c * gy + s * hz] }
  return { principal: alaFoto(l1), vecino: alaFoto(l2), peso, longitudes: [l1, l2] as [number, number] }
}

export const SOMBREADOR_DE_VERTICES = `
attribute vec2 a_pos;
uniform float u_margen;
varying vec2 v_p;
void main() { v_p = vec2(a_pos.x, -a_pos.y) * u_margen; gl_Position = vec4(a_pos, 0.0, 1.0); }
`

export const SOMBREADOR_DE_COLOR = `
precision highp float;
uniform sampler2D u_img;
uniform vec2 u_tam;
uniform vec3 u_globo;
uniform float u_theta;
uniform float u_inclinacion;
uniform vec2 u_fundido;
uniform float u_nitido;
uniform float u_empalme;
varying vec2 v_p;
const float PI = 3.14159265;
void main() {
  vec2 p = v_p;
  float rr = length(p);
  if (rr > 0.995) { gl_FragColor = vec4(0.0); return; }
  vec3 original = texture2D(u_img, (u_globo.xy + p * u_globo.z) / u_tam).rgb;
  vec3 girado = original;
  if (rr < u_fundido.y) {
    float z = sqrt(1.0 - rr * rr);
    float c = cos(u_inclinacion), s = sin(u_inclinacion);
    float gy = c * p.y - s * z, gz = s * p.y + c * z;
    float lam = atan(p.x, gz);
    float cphi = sqrt(max(0.0, 1.0 - gy * gy));
    float L = u_nitido;
    float l1 = mod(lam - u_theta + L, 2.0 * L) - L;
    float l2 = l1 - 2.0 * L * sign(l1);
    float peso = 0.5 + 0.5 * clamp((L - abs(l1)) / u_empalme, 0.0, 1.0);
    vec2 q1 = vec2(cphi * sin(l1), c * gy + s * cphi * cos(l1));
    vec2 q2 = vec2(cphi * sin(l2), c * gy + s * cphi * cos(l2));
    vec3 a1 = texture2D(u_img, (u_globo.xy + q1 * u_globo.z) / u_tam).rgb;
    vec3 a2 = texture2D(u_img, (u_globo.xy + q2 * u_globo.z) / u_tam).rgb;
    girado = mix(a2, a1, peso);
  }
  vec3 color = mix(original, girado, smoothstep(u_fundido.y, u_fundido.x, rr));
  float a = smoothstep(0.995, 0.97, rr);
  gl_FragColor = vec4(color * a, a);
}
`
