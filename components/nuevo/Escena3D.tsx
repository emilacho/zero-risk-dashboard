"use client"

/**
 * DASHBOARD NUEVO · SPRINT 4 (31-oct): la escena de inicio en 3D REAL (React Three Fiber + drei + postprocessing), al estilo de la variante-14:
 * fondo oscuro, plataformas isométricas negras con detalles ámbar, el monolito central (cerebro) y seis departamentos alrededor.
 * Vida sutil: luz y sombras reales, pulsos de datos por las líneas ámbar, cámara que respira. Solo «Dept. Marketing» tiene enlace:
 * al pasar el ratón se ilumina y aparece su rótulo; al hacer clic la cámara vuela hasta la plataforma y entonces se abre la vista de marketing.
 * Todo son formas hechas en código (sin modelos descargados ni recursos externos).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { Edges, Line } from "@react-three/drei"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import * as THREE from "three"
import { PanelEnVivo } from "@/components/nuevo/PanelEnVivo"
import {
  CAMARA_REPOSO, CEREBRO, DEPARTAMENTOS, LADO, LADO_CENTRAL, PULSOS, camaraSobre, largoDeRuta, puntoEnRuta, rutaAlCerebro, suave,
  type Departamento, type Punto,
} from "@/lib/escena-3d"

const CARBON = "#1c1c1e"
const CARBON_OSCURO = "#141416"
const AMBAR = "#e8731a"
const AMBAR_LINEA = "#9a4f16"
/** colores por encima de 1 para que el brillo (bloom) los recoja; el resto de la escena no brilla */
const BRILLO: [number, number, number] = [2.1, 1.05, 0.3]
/** las pantallas llevan un degradado ámbar → claro (como las de la referencia), multiplicado para que brille un poco */
const BRILLO_PANTALLA: [number, number, number] = [1.55, 1.55, 1.55]
let texturaPantalla: THREE.CanvasTexture | null = null
function texturaDePantalla() {
  if (texturaPantalla) return texturaPantalla
  const c = document.createElement("canvas"); c.width = 4; c.height = 64
  const g = c.getContext("2d")!
  const grad = g.createLinearGradient(0, 0, 0, 64)
  grad.addColorStop(0, "#ffe3c2"); grad.addColorStop(0.5, "#ffb257"); grad.addColorStop(1, "#ff7a1e")
  g.fillStyle = grad; g.fillRect(0, 0, 4, 64)
  texturaPantalla = new THREE.CanvasTexture(c)
  texturaPantalla.colorSpace = THREE.SRGBColorSpace
  return texturaPantalla
}
const MS_VUELO = 800

/* ───────────── piezas pequeñas (formas en código) ───────────── */

function Material({ color = CARBON }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.88} metalness={0.12} />
}

/** una luz ámbar pequeña (punta de antena, lámpara) */
function Lucecita({ position, r = 0.055 }: { position: Punto; r?: number }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[r, 10, 10]} />
      <meshBasicMaterial color={BRILLO} toneMapped={false} />
    </mesh>
  )
}

function Antena({ position, alto = 1.6 }: { position: Punto; alto?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, alto / 2, 0]} castShadow><cylinderGeometry args={[0.025, 0.035, alto, 6]} /><Material color="#2a2a2d" /></mesh>
      <Lucecita position={[0, alto + 0.04, 0]} />
    </group>
  )
}

/** una pantalla vertical fina, encendida en degradado ámbar */
function Pantalla({ position, rotacion = 0, ancho = 0.62, alto = 0.95 }: { position: Punto; rotacion?: number; ancho?: number; alto?: number }) {
  return (
    <group position={position} rotation={[0, rotacion, 0]}>
      <mesh position={[0, alto / 2 + 0.04, 0]} castShadow><boxGeometry args={[ancho, alto, 0.06]} /><Material color="#232326" /></mesh>
      <mesh position={[0, alto / 2 + 0.04, 0.034]}>
        <planeGeometry args={[ancho - 0.08, alto - 0.08]} />
        <meshBasicMaterial map={texturaDePantalla()} color={BRILLO_PANTALLA} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.02, 0]}><boxGeometry args={[ancho * 0.5, 0.04, 0.22]} /><Material color="#2a2a2d" /></mesh>
    </group>
  )
}

/** un cubo con una etiqueta ámbar (como los de la referencia) */
function Cubo({ position, lado = 0.42 }: { position: Punto; lado?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, lado / 2, 0]} castShadow><boxGeometry args={[lado, lado, lado]} /><Material /></mesh>
      <mesh position={[0, lado * 0.55, lado / 2 + 0.002]}><planeGeometry args={[lado * 0.42, lado * 0.12]} /><meshBasicMaterial color={BRILLO} toneMapped={false} /></mesh>
    </group>
  )
}

function Cilindro({ position, r = 0.26, alto = 0.5 }: { position: Punto; r?: number; alto?: number }) {
  return <mesh position={[position[0], position[1] + alto / 2, position[2]]} castShadow><cylinderGeometry args={[r, r, alto, 20]} /><Material color="#202023" /></mesh>
}

/** torre de celosía: cuatro montantes + travesaños + «linterna» de luz arriba */
function Celosia({ position, alto = 2.2, lado = 0.7 }: { position: Punto; alto?: number; lado?: number }) {
  const m = lado / 2
  const niveles = [0.35, 0.65, 0.95].map((f) => f * alto)
  return (
    <group position={position}>
      {[[-m, -m], [m, -m], [-m, m], [m, m]].map(([x, z], i) => (
        <mesh key={i} position={[x, alto / 2, z]} castShadow><boxGeometry args={[0.05, alto, 0.05]} /><Material color="#2a2a2d" /></mesh>
      ))}
      {niveles.map((y, i) => (
        <group key={i} position={[0, y, 0]}>
          <mesh position={[0, 0, -m]}><boxGeometry args={[lado, 0.035, 0.035]} /><Material color="#2a2a2d" /></mesh>
          <mesh position={[0, 0, m]}><boxGeometry args={[lado, 0.035, 0.035]} /><Material color="#2a2a2d" /></mesh>
          <mesh position={[-m, 0, 0]}><boxGeometry args={[0.035, 0.035, lado]} /><Material color="#2a2a2d" /></mesh>
          <mesh position={[m, 0, 0]}><boxGeometry args={[0.035, 0.035, lado]} /><Material color="#2a2a2d" /></mesh>
        </group>
      ))}
      <mesh position={[0, alto * 0.72, 0]}><cylinderGeometry args={[0.11, 0.11, 0.5, 12]} /><meshBasicMaterial color={BRILLO} toneMapped={false} /></mesh>
      <Lucecita position={[0, alto + 0.05, 0]} />
    </group>
  )
}

/** el proyector del departamento de marketing */
function Proyector({ position }: { position: Punto }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.55, 0.6, 0.4]} /><Material color="#232326" /></mesh>
      <mesh position={[0, 0.78, 0]} castShadow><boxGeometry args={[0.38, 0.32, 0.46]} /><Material /></mesh>
      <mesh position={[0, 0.78, 0.26]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.12, 0.08, 16]} /><meshBasicMaterial color={BRILLO} toneMapped={false} /></mesh>
    </group>
  )
}

/** las cinco barras que suben (finanzas), con la tapa ámbar */
function Barras({ position }: { position: Punto }) {
  const alturas = [0.35, 0.55, 0.75, 1.0, 1.25]
  return (
    <group position={position}>
      {alturas.map((h, i) => (
        <group key={i} position={[(i - 2) * 0.32, 0, 0]}>
          <mesh position={[0, h / 2, 0]} castShadow><boxGeometry args={[0.22, h, 0.22]} /><Material /></mesh>
          <mesh position={[0, h + 0.012, 0]}><boxGeometry args={[0.22, 0.024, 0.22]} /><meshBasicMaterial color={BRILLO} toneMapped={false} /></mesh>
        </group>
      ))}
    </group>
  )
}

/** rack de servidores (IT) con ranuras encendidas */
function Rack({ position }: { position: Punto }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.8, 0]} castShadow><boxGeometry args={[0.8, 1.6, 0.8]} /><Material color="#202023" /></mesh>
      {[0.3, 0.55, 0.8, 1.05, 1.3].map((y, i) => (
        <mesh key={i} position={[0, y, 0.402]}><planeGeometry args={[0.5, 0.028]} /><meshBasicMaterial color={BRILLO} toneMapped={false} /></mesh>
      ))}
    </group>
  )
}

function Cono({ position }: { position: Punto }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[0.5, 0.4, 0.5]} /><Material /></mesh>
      <mesh position={[0, 0.95, 0]} rotation={[Math.PI, 0, 0]} castShadow><coneGeometry args={[0.5, 1.0, 24, 1, true]} /><meshStandardMaterial color="#26262a" roughness={0.8} metalness={0.2} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.47, 0]}><torusGeometry args={[0.1, 0.012, 8, 24]} /><meshBasicMaterial color={BRILLO} toneMapped={false} /></mesh>
    </group>
  )
}

/** tres cápsulas (recursos humanos) */
function Capsulas({ position }: { position: Punto }) {
  return (
    <group position={position}>
      {[-0.45, 0, 0.45].map((x, i) => (
        <mesh key={i} position={[x, 0.42, 0]} castShadow><capsuleGeometry args={[0.16, 0.5, 4, 12]} /><Material color="#222225" /></mesh>
      ))}
      <mesh position={[0, 0.02, 0.5]}><boxGeometry args={[1.4, 0.04, 0.3]} /><Material color="#2a2a2d" /></mesh>
    </group>
  )
}

/* ───────────── plataformas ───────────── */

/** lo que va encima de cada plataforma (objetos pequeños, nada recargado) */
function Adornos({ clave }: { clave: Departamento["clave"] }) {
  switch (clave) {
    case "marketing": return <><Proyector position={[-0.7, 0, -0.5]} /><Pantalla position={[0.75, 0, -0.9]} rotacion={-0.35} /><Pantalla position={[0.4, 0, 0.6]} rotacion={0.25} ancho={0.5} alto={0.75} /><Cubo position={[-0.9, 0, 0.8]} lado={0.34} /></>
    case "finanzas": return <><Barras position={[0.1, 0, 0.2]} /><Cilindro position={[-1.1, 0, -0.9]} /><Antena position={[1.2, 0, -1.0]} alto={1.2} /></>
    case "rrhh": return <><Capsulas position={[0, 0, -0.2]} /><Cubo position={[1.0, 0, 0.9]} lado={0.3} /><Antena position={[-1.2, 0, 0.9]} alto={1.4} /></>
    case "otro": return <><Celosia position={[0.2, 0, 0.1]} /><Cilindro position={[-1.2, 0, 0.9]} r={0.2} alto={0.35} /></>
    case "it": return <><Rack position={[-0.3, 0, 0]} /><Antena position={[0.9, 0, -0.9]} alto={1.9} /><Cubo position={[1.0, 0, 0.9]} lado={0.3} /></>
    case "ventas": return <><Cono position={[-0.3, 0, -0.2]} /><Pantalla position={[0.9, 0, 0.7]} rotacion={0.5} ancho={0.5} alto={0.7} /><Antena position={[-1.2, 0, 1.0]} alto={1.1} /></>
  }
}

/** la losa (dos escalones) con su borde ámbar; `resaltada` la ilumina poco a poco */
function Losa({ lado, resaltada, interactiva }: { lado: number; resaltada: boolean; interactiva: boolean }) {
  const luz = useRef<THREE.PointLight>(null)
  const velo = useRef<THREE.MeshBasicMaterial>(null)
  const borde = useRef<THREE.LineBasicMaterial>(null)
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 7) // ~0,4 s de transición, suave
    const objetivo = resaltada ? 1 : 0
    if (velo.current) velo.current.opacity += (objetivo * 0.28 - velo.current.opacity) * k
    if (luz.current) luz.current.intensity += (objetivo * 9 - luz.current.intensity) * k
  })
  return (
    <group>
      <mesh position={[0, 0.07, 0]} receiveShadow castShadow><boxGeometry args={[lado + 0.6, 0.14, lado + 0.6]} /><Material color={CARBON_OSCURO} /></mesh>
      <mesh position={[0, 0.14 + 0.16, 0]} receiveShadow castShadow>
        <boxGeometry args={[lado, 0.32, lado]} />
        <Material />
        <Edges threshold={20} color={AMBAR_LINEA}><lineBasicMaterial ref={borde} color={AMBAR_LINEA} transparent opacity={0.9} /></Edges>
      </mesh>
      {interactiva && (
        <>
          <mesh position={[0, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[lado, lado]} />
            <meshBasicMaterial ref={velo} color={AMBAR} transparent opacity={0} depthWrite={false} />
          </mesh>
          <pointLight ref={luz} position={[0, 1.6, 0]} color={AMBAR} intensity={0} distance={6} decay={2} />
        </>
      )}
    </group>
  )
}

function Plataforma({ d, resaltada, alEntrar, alSalir, alClic, children }: {
  d: Departamento; resaltada: boolean; alEntrar?: () => void; alSalir?: () => void; alClic?: () => void; children?: ReactNode
}) {
  const interactiva = Boolean(d.href)
  return (
    <group position={[d.x, 0, d.z]}
      onPointerOver={interactiva ? (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); alEntrar?.() } : undefined}
      onPointerOut={interactiva ? () => alSalir?.() : undefined}
      onClick={interactiva ? (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); alClic?.() } : undefined}>
      <Losa lado={LADO} resaltada={resaltada} interactiva={interactiva} />
      <group position={[0, 0.46, 0]}><Adornos clave={d.clave} /></group>
      {children}
    </group>
  )
}

/** el monolito central (cerebro) sobre la plataforma grande */
function Monolito({ resaltado, alEntrar, alSalir, alClic }: { resaltado: boolean; alEntrar: () => void; alSalir: () => void; alClic: () => void }) {
  return (
    <group onPointerOver={(e) => { e.stopPropagation(); alEntrar() }} onPointerOut={alSalir} onClick={(e) => { e.stopPropagation(); alClic() }}>
      <Losa lado={LADO_CENTRAL} resaltada={resaltado} interactiva />
      <group position={[0, 0.46, 0]}>
        <mesh position={[0, 2.0, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 4.0, 1.6]} />
          <meshStandardMaterial color="#1f1f22" roughness={0.75} metalness={0.2} />
          <Edges threshold={20} color="#3a3a3e" />
        </mesh>
        {[2.9, 3.1, 3.3].map((y, i) => (
          <mesh key={i} position={[0.802, y, 0.25]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[0.7, 0.03]} /><meshBasicMaterial color="#5a5a60" /></mesh>
        ))}
        <mesh position={[0.802, 1.2, -0.3]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[0.34, 0.1]} /><meshBasicMaterial color={BRILLO} toneMapped={false} /></mesh>
        <Cubo position={[1.5, 0, 1.3]} lado={0.36} />
        <Pantalla position={[-1.35, 0, 1.2]} rotacion={0.6} ancho={0.5} alto={0.8} />
        <Cilindro position={[-1.5, 0, -1.2]} r={0.22} alto={0.4} />
        <Cilindro position={[1.4, 0, -1.3]} r={0.18} alto={0.3} />
      </group>
    </group>
  )
}

/** el tótem de «En vivo» (la pantalla de pie suelta, delante del cerebro) */
function Totem({ resaltado, alEntrar, alSalir, alClic }: { resaltado: boolean; alEntrar: () => void; alSalir: () => void; alClic: () => void }) {
  const velo = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((_, dt) => { if (velo.current) velo.current.opacity += ((resaltado ? 0.35 : 0) - velo.current.opacity) * (1 - Math.exp(-dt * 7)) })
  return (
    <group position={[1.6, 0, 4.6]} onPointerOver={(e) => { e.stopPropagation(); alEntrar() }} onPointerOut={alSalir} onClick={(e) => { e.stopPropagation(); alClic() }}>
      <mesh position={[0, 0.05, 0]} receiveShadow><boxGeometry args={[0.9, 0.1, 0.9]} /><Material color={CARBON_OSCURO} /></mesh>
      <Pantalla position={[0, 0.1, 0]} rotacion={0.78} ancho={0.5} alto={1.1} />
      <mesh position={[0, 0.72, 0]} rotation={[0, 0.78, 0]}><planeGeometry args={[0.7, 1.3]} /><meshBasicMaterial ref={velo} color={AMBAR} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

/* ───────────── rutas y pulsos ───────────── */

function Pulso({ ruta, cadaSegundos, desfase, haciaElCerebro, velocidad }: { ruta: Punto[]; cadaSegundos: number; desfase: number; haciaElCerebro: boolean; velocidad: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const largo = useMemo(() => largoDeRuta(ruta), [ruta])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = ((clock.elapsedTime + desfase) % cadaSegundos) * velocidad / largo
    if (t > 1) { m.visible = false; return }
    m.visible = true
    const p = puntoEnRuta(ruta, haciaElCerebro ? t : 1 - t)
    m.position.set(p[0], p[1] + 0.05, p[2])
  })
  return (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[0.065, 10, 10]} />
      <meshBasicMaterial color={BRILLO} toneMapped={false} />
    </mesh>
  )
}

function Rutas({ quieto }: { quieto: boolean }) {
  const rutas = useMemo(() => DEPARTAMENTOS.map((d) => ({ clave: d.clave, puntos: rutaAlCerebro(d) })), [])
  return (
    <group>
      {rutas.map((r) => (
        <group key={r.clave}>
          <Line points={r.puntos} color={AMBAR_LINEA} lineWidth={1} transparent opacity={0.85} />
          {r.puntos.slice(1, -1).map((p, i) => (
            <mesh key={i} position={[p[0], p[1] + 0.01, p[2]]}><boxGeometry args={[0.14, 0.02, 0.14]} /><meshBasicMaterial color={AMBAR_LINEA} /></mesh>
          ))}
          {!quieto && <Pulso ruta={r.puntos} {...PULSOS.find((p) => p.clave === r.clave)!} />}
        </group>
      ))}
    </group>
  )
}

/* ───────────── cámara ───────────── */

function Camara({ destino, instantaneo, quieto, alLlegar }: { destino: "reposo" | "marketing"; instantaneo: boolean; quieto: boolean; alLlegar: () => void }) {
  const { camera, pointer } = useThree()
  const desde = useRef({ posicion: new THREE.Vector3(...CAMARA_REPOSO.posicion), mira: new THREE.Vector3(...CAMARA_REPOSO.mira) })
  const actual = useRef({ posicion: new THREE.Vector3(...CAMARA_REPOSO.posicion), mira: new THREE.Vector3(...CAMARA_REPOSO.mira) })
  const inicio = useRef<number | null>(null)
  const llegado = useRef(false)
  const marketing = useMemo(() => camaraSobre(DEPARTAMENTOS[0]), [])

  useEffect(() => {
    desde.current.posicion.copy(actual.current.posicion); desde.current.mira.copy(actual.current.mira)
    inicio.current = instantaneo ? -Infinity : performance.now()
    llegado.current = false
  }, [destino, instantaneo])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const hasta = destino === "marketing" ? marketing : CAMARA_REPOSO
    const objetivo = new THREE.Vector3(...hasta.posicion)
    const mira = new THREE.Vector3(...hasta.mira)
    if (destino === "reposo" && !quieto) {
      // la cámara respira: un vaivén muy leve, más una pizca de paralaje con el puntero
      objetivo.x += Math.sin(t * 0.17) * 0.4 + pointer.x * 0.35
      objetivo.y += Math.sin(t * 0.11) * 0.18 + pointer.y * 0.15
      objetivo.z += Math.cos(t * 0.14) * 0.4 - pointer.x * 0.35
    }
    const p = inicio.current === null ? 1 : suave((performance.now() - inicio.current) / MS_VUELO)
    actual.current.posicion.lerpVectors(desde.current.posicion, objetivo, p)
    actual.current.mira.lerpVectors(desde.current.mira, mira, p)
    camera.position.copy(actual.current.posicion)
    camera.lookAt(actual.current.mira)
    // se avisa la llegada solo tras un vuelo de verdad: si la cámara se colocó de golpe (entrada directa a marketing), la vista ya está abierta
    if (p >= 1 && !llegado.current) { llegado.current = true; if (destino === "marketing" && !instantaneo) alLlegar() }
  })
  return null
}

/**
 * El vigilante de rendimiento (propio: el de la biblioteca cuenta cada «va rápido» como un vaivén y en monitores de 120/144 Hz se rendía y ponía la foto).
 * Mide ventanas de 2 s tras 3 s de calentamiento: si dos ventanas seguidas bajan de 24 cuadros por segundo avisa que va lento (se pasa a la foto);
 * por debajo de 40 baja la resolución a 1×. Un hueco largo sin cuadros (pestaña oculta) no cuenta.
 */
function Vigilante({ alLento, alAjustar }: { alLento: () => void; alAjustar: (dpr: number) => void }) {
  const cuadros = useRef(0), desde = useRef(-1), arranque = useRef(-1), lentas = useRef(0)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (arranque.current < 0) { arranque.current = t; desde.current = t; return }
    const ventana = t - desde.current
    if (ventana > 4) { cuadros.current = 0; desde.current = t; return }
    cuadros.current++
    if (ventana < 2) return
    const fps = cuadros.current / ventana
    cuadros.current = 0; desde.current = t
    if (t - arranque.current < 3) return
    if (fps < 24) { lentas.current++; if (lentas.current >= 2) alLento() } else lentas.current = 0
    alAjustar(fps < 40 ? 1 : 1.5)
  })
  return null
}

/** mueve un elemento de fuera del lienzo hasta donde cae un punto 3D en pantalla (el rótulo de un departamento) */
function SeguirPunto({ punto, el }: { punto: Punto; el: React.RefObject<HTMLDivElement | null> }) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const d = el.current
    if (!d) return
    v.set(punto[0], punto[1], punto[2]).project(camera)
    d.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`
  })
  return null
}

/* ───────────── la escena ───────────── */

interface Props {
  /** se llama cuando la cámara ya llegó a la plataforma de marketing: ahí se abre la vista de marketing */
  alAbrirMarketing: () => void
  /** la vista de marketing está abierta (la cámara se queda sobre la plataforma; al cerrarse, vuelve) */
  marketingAbierto: boolean
  /** no dibujar (la escena está tapada por la vista de marketing) */
  pausado?: boolean
  /** la escena va demasiado lenta en este equipo: quien la monta cambia a la foto */
  onLento?: () => void
}

export function Escena3D({ alAbrirMarketing, marketingAbierto, pausado = false, onLento }: Props) {
  const [resaltado, setResaltado] = useState<"marketing" | "cerebro" | "en-vivo" | null>(null)
  const [destino, setDestino] = useState<"reposo" | "marketing">(marketingAbierto ? "marketing" : "reposo")
  const [instantaneo, setInstantaneo] = useState(marketingAbierto)
  const [dpr, setDpr] = useState(1.5)
  const [quieto, setQuieto] = useState(false)
  const [enVivo, setEnVivo] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const rotulo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)")
    setQuieto(m.matches)
    const f = () => setQuieto(m.matches)
    m.addEventListener("change", f)
    return () => m.removeEventListener("change", f)
  }, [])
  // al cerrarse la vista de marketing (que estuvo abierta), la cámara vuelve a su sitio; durante el vuelo de ida marketing aún no está abierto y NO hay que volver
  const estuvoAbierto = useRef(marketingAbierto)
  useEffect(() => {
    if (marketingAbierto) estuvoAbierto.current = true
    else if (estuvoAbierto.current) { estuvoAbierto.current = false; setInstantaneo(false); setDestino("reposo") }
  }, [marketingAbierto])
  useEffect(() => { document.body.style.cursor = resaltado ? "pointer" : ""; return () => { document.body.style.cursor = "" } }, [resaltado])

  const volarAMarketing = useCallback(() => { setInstantaneo(false); setDestino("marketing") }, [])
  const irAlCerebro = useCallback(() => { window.location.assign(CEREBRO.href) }, [])
  const entrar = (q: typeof resaltado) => () => setResaltado(q)
  const salir = () => setResaltado(null)
  const marketing = DEPARTAMENTOS[0]

  return (
    <div ref={contenedor} className="relative h-full w-full" data-escena="3d">
      <Canvas
        shadows dpr={dpr} frameloop={pausado ? "never" : "always"} camera={{ position: CAMARA_REPOSO.posicion, fov: CAMARA_REPOSO.fov, near: 0.5, far: 80 }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }} style={{ background: "transparent" }}
        onPointerMissed={salir}
      >
        <Vigilante alLento={() => onLento?.()} alAjustar={setDpr} />
        <fog attach="fog" args={["#0d0d0e", 40, 64]} />
        <ambientLight intensity={0.22} color="#dcd6ff" />
        <directionalLight position={[9, 16, 7]} intensity={2.2} color="#ffe6cf" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}
          shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-camera-near={1} shadow-camera-far={45} />
        {/* el foco de estudio: un charco de luz gris detrás y arriba a la derecha, como en la referencia */}
        <spotLight position={[5, 14, -8]} angle={0.55} penumbra={1} intensity={220} color="#9a9aa4" distance={40} decay={2} />
        <pointLight position={[0, 3.2, 0]} intensity={6} color={AMBAR} distance={9} decay={2} />

        {/* el piso */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
          <planeGeometry args={[90, 90]} />
          <meshStandardMaterial color="#111112" roughness={0.95} metalness={0} />
        </mesh>

        <Monolito resaltado={resaltado === "cerebro"} alEntrar={entrar("cerebro")} alSalir={salir} alClic={irAlCerebro} />
        {DEPARTAMENTOS.map((d) => (
          <Plataforma key={d.clave} d={d} resaltada={resaltado === "marketing" && d.clave === "marketing"}
            alEntrar={entrar("marketing")} alSalir={salir} alClic={volarAMarketing} />
        ))}
        <Totem resaltado={resaltado === "en-vivo"} alEntrar={entrar("en-vivo")} alSalir={salir} alClic={() => setEnVivo(true)} />
        <Rutas quieto={quieto} />
        <SeguirPunto punto={[marketing.x, 2.7, marketing.z]} el={rotulo} />
        <Camara destino={destino} instantaneo={instantaneo} quieto={quieto} alLlegar={alAbrirMarketing} />

        <EffectComposer multisampling={4} enableNormalPass={false}>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={0.55} radius={0.5} />
        </EffectComposer>
      </Canvas>
      {/* el rótulo de marketing: aparece poco a poco al pasar el ratón, sobre la plataforma */}
      <div ref={rotulo} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 whitespace-nowrap text-[13px] font-light tracking-[0.3em] text-[#ffb347]"
        style={{ opacity: resaltado === "marketing" ? 1 : 0, transition: quieto ? "none" : "opacity .45s ease", textShadow: "0 0 12px rgba(255,140,40,.55)" }}>
        {marketing.nombre.toUpperCase()}
      </div>

      {/* lo mismo, accesible con teclado y lector de pantalla */}
      <div className="sr-only">
        <a href={marketing.href} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); volarAMarketing() }}>{marketing.nombre}</a>
        <a href={CEREBRO.href}>{CEREBRO.nombre}</a>
        <button type="button" onClick={() => setEnVivo(true)} aria-haspopup="dialog" aria-expanded={enVivo}>En vivo</button>
      </div>
      {enVivo && createPortal(<PanelEnVivo onCerrar={() => setEnVivo(false)} />, document.body)}
    </div>
  )
}
