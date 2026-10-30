/**
 * DASHBOARD NUEVO · PASO 1 (30-oct): el primer plano 3D isométrico. Dibujo ORIGINAL de Zero Risk (SVG, sin imágenes ni recursos de terceros, sin JavaScript en el navegador):
 * una plataforma por oficina del sistema, cada una con su edificio y su nombre discreto, y cada una es un enlace a su oficina. Al pasar el ratón se ilumina.
 * La referencia de Emilio solo fija el estilo (fondo oscuro, líneas finas, acentos naranja); la composición y las formas son propias.
 */
import type { ReactNode } from "react"

const S = 30
const C = Math.cos(Math.PI / 6)
/** del mundo (x, y, altura) a la pantalla */
const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * C * S, (x + y) * 0.5 * S - z * S]
const pts = (v: Array<[number, number, number]>) => v.map(([x, y, z]) => P(x, y, z).map((n) => n.toFixed(1)).join(",")).join(" ")

interface Colores { arriba: string; izq: string; der: string }
const PLATAFORMA: Colores = { arriba: "#17171a", izq: "#0e0e10", der: "#131315" }
const EDIFICIO: Colores = { arriba: "#2a2a2e", izq: "#16161a", der: "#202024" }
const NARANJA = "#ff6a1a"

/** una caja: x,y = esquina de menor valor; w (hacia x), d (hacia y), z0 = base, h = alto */
function Caja({ x, y, z0 = 0, w, d, h, c = EDIFICIO, borde = "#3b3b42", acento = false }: { x: number; y: number; z0?: number; w: number; d: number; h: number; c?: Colores; borde?: string; acento?: boolean }) {
  const z1 = z0 + h
  const stroke = acento ? NARANJA : borde
  return (
    <g strokeLinejoin="round" strokeWidth={acento ? 1.1 : 0.8} stroke={stroke} className="nv-forma">
      <polygon points={pts([[x, y + d, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x, y + d, z1]])} fill={c.izq} />
      <polygon points={pts([[x + w, y, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x + w, y, z1]])} fill={c.der} />
      <polygon points={pts([[x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1]])} fill={c.arriba} />
    </g>
  )
}

/** una tira luminosa naranja sobre la cara derecha (lado +x) de una caja */
function TiraDerecha({ x, y, w, d, z, alto = 0.18, desde = 0.2, hasta = 0.8 }: { x: number; y: number; w: number; d: number; z: number; alto?: number; desde?: number; hasta?: number }) {
  return <polygon points={pts([[x + w, y + d * desde, z], [x + w, y + d * hasta, z], [x + w, y + d * hasta, z + alto], [x + w, y + d * desde, z + alto]])} fill={NARANJA} opacity={0.95} className="nv-luz" />
}
/** idem sobre la cara izquierda (lado +y) */
function TiraIzquierda({ x, y, w, d, z, alto = 0.18, desde = 0.2, hasta = 0.8 }: { x: number; y: number; w: number; d: number; z: number; alto?: number; desde?: number; hasta?: number }) {
  return <polygon points={pts([[x + w * desde, y + d, z], [x + w * hasta, y + d, z], [x + w * hasta, y + d, z + alto], [x + w * desde, y + d, z + alto]])} fill={NARANJA} opacity={0.95} className="nv-luz" />
}

/** plataforma baja con el borde superior en naranja fino */
function Plataforma({ cx, cy, lado }: { cx: number; cy: number; lado: number }) {
  const x = cx - lado / 2, y = cy - lado / 2
  return (
    <g>
      <Caja x={x} y={y} w={lado} d={lado} h={0.3} c={PLATAFORMA} borde="#2c2c32" />
      <polygon points={pts([[x + 0.25, y + 0.25, 0.3], [x + lado - 0.25, y + 0.25, 0.3], [x + lado - 0.25, y + lado - 0.25, 0.3], [x + 0.25, y + lado - 0.25, 0.3]])} fill="none" stroke={NARANJA} strokeWidth={0.7} opacity={0.55} />
    </g>
  )
}

interface Oficina { clave: string; nombre: string; cx: number; cy: number; lado: number; dibujo: ReactNode }

/** cada dibujo está en coordenadas LOCALES (el centro de su plataforma es 0,0); después se traslada a su lugar */
const OFICINAS: Oficina[] = [
  {
    // marketing: una torre alta con su cartel
    clave: "creativa", nombre: "Oficina creativa", cx: -5, cy: 6, lado: 4,
    dibujo: (
      <>
        <Caja x={-1.4} y={-0.7} z0={0.3} w={1.4} d={1.4} h={4.6} />
        <TiraDerecha x={-1.4} y={-0.7} w={1.4} d={1.4} z={1.2} />
        <TiraDerecha x={-1.4} y={-0.7} w={1.4} d={1.4} z={2.6} desde={0.2} hasta={0.55} />
        <Caja x={0.6} y={-1.2} z0={0.3} w={0.16} d={2.0} h={1.3} c={{ arriba: NARANJA, izq: "#3a1c0a", der: "#7a360f" }} acento />
      </>
    ),
  },
  {
    // finanzas: barras que suben
    clave: "financiera", nombre: "Oficina financiera", cx: 17, cy: 6, lado: 4,
    dibujo: (
      <>
        <Caja x={-1.7} y={-1.6} z0={0.3} w={1.1} d={1.1} h={1.2} />
        <Caja x={-0.5} y={-1.6} z0={0.3} w={1.1} d={1.1} h={2.2} />
        <Caja x={0.7} y={-1.6} z0={0.3} w={1.1} d={1.1} h={3.3} c={{ arriba: "#33333a", izq: "#16161a", der: "#202024" }} />
        <TiraDerecha x={0.7} y={-1.6} w={1.1} d={1.1} z={0.7} />
        <Caja x={-1.7} y={0.0} z0={0.3} w={3.5} d={1.1} h={0.5} acento />
      </>
    ),
  },
  {
    // cerebro: el bloque grande del centro, con su núcleo
    clave: "cerebro", nombre: "Cerebro", cx: 6, cy: 6, lado: 6.2,
    dibujo: (
      <>
        <Caja x={-1.6} y={-1.6} z0={0.3} w={3.2} d={3.2} h={3.4} />
        <TiraDerecha x={-1.6} y={-1.6} w={3.2} d={3.2} z={1.0} alto={0.14} desde={0.1} hasta={0.9} />
        <TiraIzquierda x={-1.6} y={-1.6} w={3.2} d={3.2} z={2.2} alto={0.14} desde={0.1} hasta={0.9} />
        <Caja x={-0.8} y={-0.8} z0={3.7} w={1.6} d={1.6} h={0.7} c={{ arriba: "#33333a", izq: "#17171b", der: "#222226" }} />
        <Caja x={-0.25} y={-0.25} z0={4.4} w={0.5} d={0.5} h={0.45} c={{ arriba: NARANJA, izq: "#7a360f", der: "#b34a12" }} acento />
        <Caja x={1.9} y={-1.4} z0={0.3} w={0.7} d={0.7} h={0.8} />
        <Caja x={-2.3} y={1.7} z0={0.3} w={0.7} d={0.7} h={0.5} />
      </>
    ),
  },
  {
    // jefatura: tres columnas con su frontón
    clave: "jefatura", nombre: "Jefatura", cx: 6, cy: -5, lado: 4,
    dibujo: (
      <>
        <Caja x={-1.6} y={-0.4} z0={0.3} w={0.8} d={0.8} h={2.6} />
        <Caja x={-0.4} y={-0.4} z0={0.3} w={0.8} d={0.8} h={2.6} />
        <Caja x={0.8} y={-0.4} z0={0.3} w={0.8} d={0.8} h={2.6} />
        <Caja x={-1.8} y={-0.7} z0={2.9} w={3.6} d={1.4} h={0.45} acento />
        <TiraDerecha x={0.8} y={-0.4} w={0.8} d={0.8} z={1.1} alto={0.5} desde={0.25} hasta={0.75} />
      </>
    ),
  },
  {
    // planeación: un tablero de casillas bajas, una en alto
    clave: "planeacion", nombre: "Planeación", cx: 6, cy: 17, lado: 4,
    dibujo: (
      <>
        <Caja x={-1.5} y={-1.5} z0={0.3} w={1.2} d={1.2} h={0.5} />
        <Caja x={0.3} y={-1.5} z0={0.3} w={1.2} d={1.2} h={0.5} />
        <Caja x={-1.5} y={0.3} z0={0.3} w={1.2} d={1.2} h={0.5} />
        <Caja x={0.3} y={0.3} z0={0.3} w={1.2} d={1.2} h={1.9} />
        <TiraDerecha x={0.3} y={0.3} w={1.2} d={1.2} z={0.8} alto={0.16} />
        <polygon points={pts([[-1.5, -1.5, 0.8], [-0.3, -1.5, 0.8], [-0.3, -0.3, 0.8], [-1.5, -0.3, 0.8]])} fill="none" stroke={NARANJA} strokeWidth={0.8} />
      </>
    ),
  },
]

/** las vías naranjas que unen el cerebro con cada oficina (a ras de plataforma, de borde a borde) */
const VIAS: Array<Array<[number, number]>> = [
  [[3, 6], [-3, 6]],
  [[6, 3], [6, -3]],
  [[6, 9], [6, 15]],
  [[9, 6], [15, 6]],
]

const ESTILO = `
.nv-of{cursor:pointer;outline:none}
.nv-of .nv-edificio{transition:transform .25s ease,filter .25s ease}
.nv-of .nv-forma{transition:stroke .25s ease}
.nv-of .nv-nombre{transition:fill .25s ease}
.nv-of:hover .nv-edificio,.nv-of:focus-visible .nv-edificio{transform:translateY(-6px);filter:drop-shadow(0 0 12px rgba(255,106,26,.55))}
.nv-of:hover .nv-forma,.nv-of:focus-visible .nv-forma{stroke:${NARANJA}}
.nv-of:hover .nv-nombre,.nv-of:focus-visible .nv-nombre{fill:${NARANJA}}
@media (max-width:640px){.nv-of .nv-nombre{font-size:25px;letter-spacing:1px}}
@media (prefers-reduced-motion:reduce){.nv-of .nv-edificio,.nv-of .nv-forma,.nv-of .nv-nombre{transition:none}}
`

export function MapaIsometrico() {
  const pos = (o: Oficina) => P(o.cx, o.cy, 0)
  return (
    <svg viewBox="-470 -210 940 700" role="group" aria-label="Las oficinas de Zero Risk" className="h-auto w-full max-w-[1100px]" xmlns="http://www.w3.org/2000/svg">
      <style>{ESTILO}</style>
      <defs>
        <radialGradient id="nv-piso" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff6a1a" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#ff6a1a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="0" cy={P(6, 6)[1] + 40} rx="460" ry="260" fill="url(#nv-piso)" />
      {OFICINAS.map((o) => <g key={`p-${o.clave}`} transform={`translate(${pos(o).join(" ")})`}><Plataforma cx={0} cy={0} lado={o.lado} /></g>)}
      {VIAS.map((v, i) => (
        <polyline key={i} points={v.map(([x, y]) => P(x, y, 0.3).map((n) => n.toFixed(1)).join(",")).join(" ")} fill="none" stroke={NARANJA} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.7} />
      ))}
      {[...OFICINAS].sort((a, b) => a.cx + a.cy - (b.cx + b.cy)).map((o) => {
        const [tx, ty] = pos(o)
        const [lx, ly] = P(o.lado / 2, o.lado / 2, 0)
        return (
          // un enlace de SVG: next/link no vive dentro de un <svg>
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a key={o.clave} href={`/oficinas#${o.clave}`} className="nv-of" aria-label={o.nombre}>
            <g transform={`translate(${tx.toFixed(1)} ${ty.toFixed(1)})`}>
            <rect x={-130} y={-190} width={260} height={ly + 230} fill="transparent" />
            <g className="nv-edificio">{o.dibujo}</g>
            <text x={lx - lx} y={ly + 24} textAnchor="middle" fill="#8a8a93" fontSize={15} letterSpacing="2.5" className="nv-nombre" style={{ textTransform: "uppercase", fontFamily: "var(--font-inter), system-ui, sans-serif" }}>{o.nombre}</text>
            </g>
          </a>
        )
      })}
    </svg>
  )
}
