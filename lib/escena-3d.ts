/**
 * DASHBOARD NUEVO · SPRINT 4: la disposición de la escena 3D (pura, sin three): el monolito central (cerebro) y los seis departamentos
 * alrededor, las rutas de los pulsos de datos y la decisión de cuándo mostrar la foto de respaldo en vez del 3D.
 * Coordenadas del mundo: el piso es y = 0; x crece hacia la derecha de la cámara y z hacia la cámara (la cámara mira desde +x +y +z).
 */
export type ClaveDeDepartamento = "marketing" | "ventas" | "finanzas" | "it" | "rrhh" | "otro"

export interface Departamento {
  clave: ClaveDeDepartamento
  nombre: string
  /** centro de la plataforma en el piso */
  x: number
  z: number
  /** adónde lleva el clic; sin `href` no hay enlace ni resaltado todavía */
  href?: string
}

/** radio del anillo de plataformas alrededor del monolito */
export const RADIO = 7.4
/** lado de cada plataforma (cuadrada) y de la central */
export const LADO = 3.6
export const LADO_CENTRAL = 4.6

const en = (angulo: number) => ({ x: Number((RADIO * Math.sin(angulo)).toFixed(3)), z: Number((-RADIO * Math.cos(angulo)).toFixed(3)) })
const g = Math.PI / 180

/** los seis departamentos, en el orden del anillo (empezando arriba a la derecha de la pantalla y siguiendo el reloj) */
export const DEPARTAMENTOS: Departamento[] = [
  { clave: "marketing", nombre: "Dept. Marketing", href: "/nuevo/marketing", ...en(30 * g) },
  { clave: "finanzas", nombre: "Finanzas", ...en(90 * g) },
  { clave: "rrhh", nombre: "Recursos Humanos", ...en(150 * g) },
  { clave: "otro", nombre: "Por asignar", ...en(210 * g) },
  { clave: "it", nombre: "IT", ...en(270 * g) },
  { clave: "ventas", nombre: "Ventas", ...en(330 * g) },
]

export const CEREBRO = { clave: "cerebro", nombre: "Cerebro", href: "/oficinas#cerebro" } as const

export type Punto = [number, number, number]

/**
 * La ruta de datos entre un departamento y el cerebro: un trazo en ángulo recto a ras del piso (como los de la referencia),
 * que sale del borde de la plataforma y llega al borde de la central.
 */
export function rutaAlCerebro(d: Pick<Departamento, "x" | "z">): Punto[] {
  const y = 0.03
  const medioCentral = LADO_CENTRAL / 2 + 0.2
  const medio = LADO / 2 + 0.2
  // el tramo largo va por el eje dominante; el corto, por el otro
  const porX = Math.abs(d.x) >= Math.abs(d.z)
  const sx = Math.sign(d.x) || 1, sz = Math.sign(d.z) || 1
  if (porX) {
    const inicio: Punto = [d.x - sx * medio, y, d.z]
    const codo: Punto = [sx * (medioCentral + 1.2), y, d.z]
    const codo2: Punto = [sx * (medioCentral + 1.2), y, sz * Math.min(Math.abs(d.z), medioCentral - 0.6)]
    const fin: Punto = [sx * medioCentral, y, codo2[2]]
    return [inicio, codo, codo2, fin]
  }
  const inicio: Punto = [d.x, y, d.z - sz * medio]
  const codo: Punto = [d.x, y, sz * (medioCentral + 1.2)]
  const codo2: Punto = [sx * Math.min(Math.abs(d.x), medioCentral - 0.6), y, sz * (medioCentral + 1.2)]
  const fin: Punto = [codo2[0], y, sz * medioCentral]
  return [inicio, codo, codo2, fin]
}

export function largoDeRuta(ruta: Punto[]): number {
  let l = 0
  for (let i = 1; i < ruta.length; i++) l += Math.hypot(ruta[i][0] - ruta[i - 1][0], ruta[i][1] - ruta[i - 1][1], ruta[i][2] - ruta[i - 1][2])
  return l
}

/** el punto de la ruta a la fracción `t` (0 = plataforma, 1 = cerebro), a velocidad constante por el largo */
export function puntoEnRuta(ruta: Punto[], t: number): Punto {
  const total = largoDeRuta(ruta)
  let restante = Math.min(1, Math.max(0, t)) * total
  for (let i = 1; i < ruta.length; i++) {
    const a = ruta[i - 1], b = ruta[i]
    const tramo = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    if (restante <= tramo || i === ruta.length - 1) {
      const f = tramo === 0 ? 0 : Math.min(1, restante / tramo)
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
    }
    restante -= tramo
  }
  return ruta[ruta.length - 1]
}

/** los pulsos: cuántos viajan por cada ruta, cada cuánto y en qué sentido; sutil, no recargado */
export const PULSOS = DEPARTAMENTOS.map((d, i) => ({
  clave: d.clave,
  cadaSegundos: 5.5 + (i % 3) * 1.5,
  desfase: i * 1.1,
  haciaElCerebro: i % 2 === 0,
  velocidad: 2.4, // unidades por segundo
}))

/** suavizado de 0→1 (entrada y salida suaves) para el vuelo de la cámara */
export const suave = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x) }

/** la cámara en reposo y adónde vuela al abrir un departamento (se queda a una distancia fija, mirando la plataforma) */
export const CAMARA_REPOSO = { posicion: [21, 16.5, 21] as Punto, mira: [0, -0.4, 0] as Punto, fov: 25 }

export function camaraSobre(d: Pick<Departamento, "x" | "z">): { posicion: Punto; mira: Punto } {
  // se acerca desde el mismo lado en que está la cámara en reposo, para no cruzar la escena
  const hacia = CAMARA_REPOSO.posicion
  const l = Math.hypot(hacia[0], hacia[2]) || 1
  return { posicion: [d.x + (hacia[0] / l) * 6.4, 4.6, d.z + (hacia[2] / l) * 6.4], mira: [d.x, 0.4, d.z] }
}

export interface Equipo {
  webgl: boolean
  anchoPantalla: number
  nucleos?: number
  memoriaGB?: number
}

/**
 * Cuándo se muestra la foto (variante-14) en vez de la escena 3D: sin WebGL, en pantallas de teléfono o en equipos muy justos.
 * Además, el vigilante de rendimiento dentro del 3D cambia a la foto si los cuadros por segundo caen de verdad.
 */
export function usarRespaldo(e: Equipo): boolean {
  if (!e.webgl) return true
  if (e.anchoPantalla < 700) return true
  if (e.nucleos !== undefined && e.nucleos <= 2) return true
  if (e.memoriaGB !== undefined && e.memoriaGB < 2) return true
  return false
}
