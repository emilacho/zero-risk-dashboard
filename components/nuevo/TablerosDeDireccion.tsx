import type { CSSProperties, ReactNode } from "react"
import type { TableroDeDireccion } from "@/lib/pantallas-de-la-oficina"

/**
 * 6.19 · LOS 9 TABLEROS DE DIRECCIÓN del arco de Tu oficina (capa 1 del encargo «oficina del humano», aprobada por Emilio el 1-nov «tal como se ve en tu
 * boceto», `raw/evidencia/dashboard-nuevo/oficina-del-humano-capa-1/boceto-capa-1.png`). Cada uno con su lenguaje visual propio y su animación; SIN DATOS:
 * son la forma de lo que mostrará cada pantalla (capa 2, una por ciclo, empezando por Decisiones).
 * Se dibujan en un plano de 100×160 (el vidrio entero, vertical); `PantallasDelArco` lo lleva a la perspectiva de su vidrio. Movimiento con CSS (clases del
 * estilo de `PantallasDelArco`) y SMIL para lo que viaja o gira (el pulso de la tubería, el barrido del radar). Con «menos movimiento» el CSS se apaga por media
 * query y los SMIL no se montan: cada dibujo queda quieto en su estado final visible, igual que el boceto.
 */
export const LIENZO_DE_DIRECCION = { w: 100, h: 160 } as const

const T = 1.1 // grosor de línea del boceto
const r = (s: number): CSSProperties => ({ animationDelay: `${s.toFixed(2)}s` })
const linea = { fill: "none", stroke: "currentColor", strokeWidth: T, strokeLinecap: "round", strokeLinejoin: "round" } as const

function Titulo({ lineas }: { lineas: readonly string[] }) {
  return <g className="nv-titulo" fill="currentColor" stroke="none">{lineas.map((l, i) => <text key={i} x={50} y={16 + i * 10} textAnchor="middle" fontSize={8.5} fontWeight={600} letterSpacing={0.4}>{l}</text>)}</g>
}
const Nota = ({ x, y, children }: { x: number; y: number; children: ReactNode }) => <text x={x} y={y} textAnchor="middle" fontSize={6} fontWeight={500} opacity={0.8} fill="currentColor" stroke="none">{children}</text>

/** 1 · GOBIERNO · consola de interruptores (solo lectura): cada tanto un interruptor cambia de posición */
function Gobierno() {
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 40 + i * 22, encendido = i % 2 === 0, mueve = i === 1 || i === 3
        return (
          <g key={i}>
            <rect {...linea} x={24} y={y} width={26} height={12} rx={6} />
            <circle cx={encendido ? 44 : 30} cy={y + 6} r={4.2} fill="currentColor" data-anima={mueve ? "conmuta" : undefined} style={mueve ? { "--dx": encendido ? "-14px" : "14px", ...r(i * 3.5) } as CSSProperties : undefined} />
            <line {...linea} x1={58} y1={y + 4} x2={80} y2={y + 4} />
            <line {...linea} x1={58} y1={y + 9} x2={72} y2={y + 9} opacity={0.5} />
          </g>
        )
      })}
    </g>
  )
}

/** 2 · IDEAS Y PROYECTOS · la tubería idea → operando: un pulso de luz la recorre y cada etapa se enciende al pasar */
const ETAPAS = ["idea", "evaluación", "plan", "aprobado", "construcción", "operando"] as const
function Proyectos({ quieto }: { quieto: boolean }) {
  return (
    <g>
      {ETAPAS.map((n, i) => {
        const y = 36 + i * 20, w = 70 - i * 7
        return (
          <g key={n}>
            <rect {...linea} x={50 - w / 2} y={y} width={w} height={13} rx={3} strokeDasharray={i > 1 ? "3 3" : undefined} />
            <rect x={50 - w / 2} y={y} width={w} height={13} rx={3} fill="currentColor" opacity={0.14} data-anima="etapa" style={r(i * 1)} />
            <Nota x={50} y={y + 9}>{n}</Nota>
            {i < 5 && <path {...linea} d={`M50 ${y + 14} l0 4 m-3 -3 l3 3 3 -3`} />}
          </g>
        )
      })}
      {!quieto && (
        <circle cx={50} r={2.2} fill="currentColor">
          <animate attributeName="cy" values="30;150;150" keyTimes="0;0.6;1" dur="6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.05;0.55;0.62;1" dur="6s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  )
}

/** 3 · PORTAFOLIO · constelación de negocios (tamaño = peso; el color del semáforo llega con los datos): los astros laten */
const ASTROS = [[50, 78, 16], [24, 52, 8], [78, 58, 10], [30, 112, 11], [72, 118, 7], [54, 138, 5], [20, 86, 4]] as const
const LAZOS = [[0, 1], [0, 2], [0, 3], [0, 4], [4, 5], [3, 6]] as const
function Portafolio() {
  return (
    <g>
      {LAZOS.map(([i, j], k) => <line key={k} {...linea} opacity={0.45} x1={ASTROS[i][0]} y1={ASTROS[i][1]} x2={ASTROS[j][0]} y2={ASTROS[j][1]} />)}
      {ASTROS.map(([x, y, rr], k) => (
        <g key={k} data-anima="late" style={r(k * 0.6)}>
          <circle {...linea} cx={x} cy={y} r={rr} />
          <circle cx={x} cy={y} r={Math.max(1.4, rr * 0.28)} fill="currentColor" opacity={k % 3 ? 0.55 : 1} />
        </g>
      ))}
    </g>
  )
}

/** 4 · DINERO · el río de proveedores → departamentos → negocios, contra el presupuesto del mes: la corriente fluye por los cauces */
function Dinero() {
  const arriba = [14, 30, 46, 62, 78], medio = [24, 50, 76], abajo = [32, 68]
  const cauces: Array<{ d: string; ancho: number }> = [
    ...arriba.map((x, i) => { const m = medio[Math.min(2, Math.floor((i * 3) / 5))]; return { d: `M${x} 39 C${x} 62 ${m} 62 ${m} 82`, ancho: 2.6 - i * 0.3 } }),
    ...medio.map((x, i) => { const b = abajo[i < 2 ? 0 : 1]; return { d: `M${x} 88 C${x} 108 ${b} 108 ${b} 126`, ancho: 3 } }),
  ]
  return (
    <g>
      {arriba.map((x) => <rect key={x} x={x - 5} y={34} width={10} height={4} rx={1} fill="currentColor" />)}
      {medio.map((x) => <rect key={x} x={x - 7} y={83} width={14} height={4} rx={1} fill="currentColor" />)}
      {abajo.map((x) => <rect key={x} x={x - 9} y={127} width={18} height={5} rx={1} fill="currentColor" />)}
      {cauces.map((c, i) => (
        <g key={i}>
          <path {...linea} d={c.d} strokeWidth={c.ancho} opacity={0.4} />
          <path {...linea} d={c.d} strokeWidth={c.ancho * 0.7} opacity={0.9} pathLength={1} strokeDasharray="0.08 0.14" data-anima="fluye" style={r(-i * 0.7)} />
        </g>
      ))}
      <line {...linea} x1={10} y1={140} x2={90} y2={140} strokeDasharray="3 3" />
      <Nota x={50} y={150}>presupuesto del mes</Nota>
    </g>
  )
}

/** 5 · DECISIONES (la principal) · la mesa del director: tarjetas apiladas y la más urgente llega al frente */
function Decisiones() {
  return (
    <g>
      {[0.35, 0.55, 0.8].map((o, i) => <rect key={i} {...linea} opacity={o} x={14 + i * 3} y={36 + i * 12} width={72 - i * 6} height={70} rx={4} />)}
      <g data-anima="apila">
        <rect x={20} y={60} width={60} height={78} rx={4} className="nv-velo-tarjeta" />
        <rect {...linea} x={20} y={60} width={60} height={78} rx={4} strokeWidth={1.5} />
        <circle cx={30} cy={71} r={3} fill="currentColor" data-anima="urge" />
        <line {...linea} x1={38} y1={71} x2={70} y2={71} />
        {[[84, 72], [92, 64], [100, 68]].map(([y, x2]) => <line key={y} {...linea} x1={28} y1={y} x2={x2} y2={y} opacity={0.6} />)}
        <rect {...linea} x={28} y={114} width={20} height={12} rx={3} />
        <rect {...linea} x={52} y={114} width={20} height={12} rx={3} opacity={0.6} />
      </g>
    </g>
  )
}

/** 6 · RIESGOS Y ALARMAS · radar: el haz barre y cada punto se enciende al pasar (lo grave, más cerca del centro) */
const AMENAZAS = [[66, 80, 2.6], [36, 72, 2], [58, 112, 3.4], [28, 104, 1.6], [74, 98, 2]] as const
const VUELTA = 6 // segundos por vuelta del haz
function Riesgos({ quieto }: { quieto: boolean }) {
  const inicio = -30 // el haz arranca apuntando a (88,68)
  return (
    <g>
      {[44, 32, 20, 8].map((rr) => <circle key={rr} {...linea} opacity={0.55} cx={50} cy={90} r={rr} />)}
      <line {...linea} opacity={0.4} x1={6} y1={90} x2={94} y2={90} />
      <line {...linea} opacity={0.4} x1={50} y1={46} x2={50} y2={134} />
      <g>
        <path d="M50 90 L88 68 A44 44 0 0 1 94 90 Z" fill="currentColor" opacity={0.22} />
        <line {...linea} x1={50} y1={90} x2={88} y2={68} />
        {!quieto && <animateTransform attributeName="transform" type="rotate" from="0 50 90" to="360 50 90" dur={`${VUELTA}s`} repeatCount="indefinite" />}
      </g>
      {AMENAZAS.map(([x, y, rr], i) => {
        const angulo = (Math.atan2(y - 90, x - 50) * 180) / Math.PI, paso = ((((angulo - inicio) % 360) + 360) % 360) / 360 * VUELTA
        return <circle key={i} cx={x} cy={y} r={rr} fill="currentColor" data-anima="detecta" style={r(paso)} />
      })}
    </g>
  )
}

/** 7 · ORGANIZACIÓN · el organigrama vivo: los departamentos son edificios y sus plantas se encienden */
function Organizacion() {
  const torres = [[16, 54], [38, 70], [62, 46], [84, 62]] as const
  return (
    <g>
      <rect {...linea} x={40} y={34} width={20} height={12} rx={2} />
      <line {...linea} x1={50} y1={46} x2={50} y2={56} />
      <line {...linea} x1={16} y1={56} x2={84} y2={56} />
      {torres.map(([x, h], i) => (
        <g key={x}>
          <line {...linea} x1={x} y1={56} x2={x} y2={140 - h} />
          <rect {...linea} x={x - 9} y={140 - h} width={18} height={h} rx={1.5} />
          {Array.from({ length: Math.floor(h / 10) * 2 }, (_, k) => {
            const piso = Math.floor(k / 2), c = k % 2, viva = (piso + c + i) % 3 !== 0
            return <rect key={k} x={x - 6 + c * 7} y={140 - h + 5 + piso * 10} width={5} height={5} fill="currentColor" opacity={viva ? 0.85 : 0.18} data-anima={viva ? "planta" : undefined} style={viva ? { "--op": 0.85, ...r(i * 0.9 + (Math.floor(h / 10) - piso) * 0.45) } as CSSProperties : undefined} />
          })}
        </g>
      ))}
    </g>
  )
}

/** 8 · AGENDA EJECUTIVA · la línea de tiempo (vertical, como el vidrio) con sus hitos y «hoy» cruzándola: lo recorrido se llena y «hoy» late */
function Agenda() {
  const hitos = [42, 58, 74, 104, 120, 136]
  return (
    <g>
      <line {...linea} x1={30} y1={34} x2={30} y2={146} opacity={0.5} />
      <line {...linea} x1={30} y1={34} x2={30} y2={89} strokeWidth={T * 1.6} data-anima="recorrido" />
      {hitos.map((y, i) => (
        <g key={y}>
          <circle cx={30} cy={y} r={i === 2 ? 3.4 : 2.6} {...(i === 2 ? { fill: "currentColor" } : linea)} />
          <line {...linea} opacity={0.6} x1={38} y1={y} x2={60 + ((i * 13) % 26)} y2={y} data-anima="hito" style={r(i * 0.6)} />
        </g>
      ))}
      <line {...linea} strokeWidth={1.6} x1={12} y1={89} x2={90} y2={89} />
      <circle {...linea} cx={30} cy={89} r={3.4} data-anima="senal" />
      <Nota x={80} y={85}>hoy</Nota>
    </g>
  )
}

/** 9 · OBSERVABILIDAD · la cascada de trazas: el árbol de cada corrida se despliega paso a paso (un paso destacado: el más caro o con falla) */
const PASOS = [[0, 10, 80], [1, 12, 22], [2, 14, 10], [2, 24, 8], [1, 34, 30], [2, 36, 12], [2, 48, 14], [1, 64, 18], [2, 66, 10], [1, 82, 12]] as const
function Observabilidad() {
  return (
    <g>
      {PASOS.map(([n, x, w], i) => {
        const y = 36 + i * 11
        return (
          <g key={i}>
            <circle cx={8 + n * 6} cy={y + 3} r={1.4} fill="currentColor" />
            <rect x={x + 14} y={y} width={w * 0.8} height={6} rx={1.5} {...(i === 6 ? { fill: "currentColor", opacity: 0.9 } : { ...linea, opacity: 0.85 })} data-anima="despliega" style={r(i * 0.35)} />
          </g>
        )
      })}
      <line {...linea} opacity={0.5} x1={14} y1={148} x2={94} y2={148} strokeDasharray="3 3" />
    </g>
  )
}

const DIBUJO: Record<TableroDeDireccion, (p: { quieto: boolean }) => ReactNode> = {
  gobierno: () => <Gobierno />, proyectos: ({ quieto }) => <Proyectos quieto={quieto} />, portafolio: () => <Portafolio />, dinero: () => <Dinero />,
  decisiones: () => <Decisiones />, riesgos: ({ quieto }) => <Riesgos quieto={quieto} />, organizacion: () => <Organizacion />,
  "agenda-ejecutiva": () => <Agenda />, observabilidad: () => <Observabilidad />,
}

/** un tablero de dirección en el plano 100×160 del vidrio (con el mismo respiro del boceto: 5 % y 90 %) */
export function TableroDeDireccionVivo({ tablero, titulo, quieto }: { tablero: TableroDeDireccion; titulo: readonly string[]; quieto: boolean }) {
  return (
    <g transform="translate(5 4) scale(0.9)" data-tablero={tablero}>
      <Titulo lineas={titulo} />
      {DIBUJO[tablero]({ quieto })}
    </g>
  )
}

/** las animaciones de los tableros de dirección (se suman al estilo de `PantallasDelArco`) */
export const ESTILO_DE_DIRECCION = `
.nv-pantalla[data-grupo="arco"] .nv-hud{opacity:.86}
.nv-velos polygon{fill:rgba(14,9,5,.8)}
.nv-velo-tarjeta{fill:rgba(20,12,6,.72)}
.nv-pantalla .nv-hud [data-anima="conmuta"]{animation-name:nvConmuta;animation-duration:14s}
.nv-pantalla .nv-hud [data-anima="etapa"]{animation-name:nvEtapa;animation-duration:6s}
.nv-pantalla .nv-hud [data-anima="late"]{animation-name:nvLate;animation-duration:4.2s;transform-origin:center}
.nv-pantalla .nv-hud [data-anima="fluye"]{animation-name:nvFluye;animation-duration:5s;animation-timing-function:linear}
.nv-pantalla .nv-hud [data-anima="apila"]{animation-name:nvApila;animation-duration:10s}
.nv-pantalla .nv-hud [data-anima="urge"]{animation-name:nvRespira;animation-duration:2.4s}
.nv-pantalla .nv-hud [data-anima="detecta"]{animation-name:nvDetecta;animation-duration:6s;animation-timing-function:ease-out}
.nv-pantalla .nv-hud [data-anima="planta"]{animation-name:nvEnciende;animation-duration:9s}
.nv-pantalla .nv-hud [data-anima="recorrido"]{animation-name:nvCrece;animation-duration:9s;transform-origin:top}
.nv-pantalla .nv-hud [data-anima="hito"]{animation-name:nvHito;animation-duration:9s;transform-origin:left}
.nv-pantalla .nv-hud [data-anima="despliega"]{animation-name:nvAvanzaYVuelve;animation-duration:9s;transform-origin:left}
@keyframes nvConmuta{0%,42%{transform:translateX(0)}50%,92%{transform:translateX(var(--dx))}100%{transform:translateX(0)}}
@keyframes nvEtapa{0%,100%{opacity:.08}8%{opacity:.5}30%{opacity:.14}}
@keyframes nvLate{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
@keyframes nvFluye{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes nvApila{0%{transform:translateY(-22px);opacity:0}14%,88%{transform:translateY(0);opacity:1}100%{transform:translateY(0);opacity:0}}
@keyframes nvDetecta{0%{opacity:1}35%,100%{opacity:.3}}
@keyframes nvHito{0%{transform:scaleX(0)}22%,90%{transform:scaleX(1)}100%{transform:scaleX(0)}}
@media (prefers-reduced-motion:reduce){.nv-pantalla .nv-hud [data-anima]{animation:none}}
`
