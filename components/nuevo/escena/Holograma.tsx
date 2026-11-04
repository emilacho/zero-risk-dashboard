import { ANCHO_DE_LA_CONTEXTURA, rasgosDelHolograma, AMBAR_HOLOGRAMA } from "@/lib/holograma"
import { huella } from "@/lib/escena-empleado"

/**
 * EL HOLOGRAMA (CC4 · 02-nov): la silueta de luz ámbar de cada empleado. Poco detalle a propósito (futurista y elegante): contorno de luz, relleno que se desvanece hacia
 * los pies, líneas de barrido que suben, un visor, una placa en el pecho y, según el empleado, antena y circuitos. `HologramaFigura` es el cuerpo entero de la escena
 * (de pie o sentado, con el origen en los pies / en el asiento); `HologramaBusto` es el retrato de la ficha: el MISMO personaje (mismos rasgos, de `lib/holograma`).
 * Los degradados y el patrón de barrido se declaran una sola vez con `<DefsDelHolograma />` dentro del <svg> que los usa.
 */
export const ID_RELLENO = "nv-holo-relleno"
export const ID_BARRIDO = "nv-holo-barrido"
export const ID_PIE = "nv-holo-pie"

export function DefsDelHolograma() {
  return (
    <>
      <linearGradient id={ID_RELLENO} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={AMBAR_HOLOGRAMA} stopOpacity=".5" /><stop offset=".7" stopColor="#ff9a2e" stopOpacity=".16" /><stop offset="1" stopColor="#ff8c1a" stopOpacity=".02" /></linearGradient>
      <pattern id={ID_BARRIDO} width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.2" fill="#fff3d6" opacity=".5" /></pattern>
      <radialGradient id={ID_PIE}><stop offset="0" stopColor={AMBAR_HOLOGRAMA} stopOpacity=".6" /><stop offset="1" stopColor={AMBAR_HOLOGRAMA} stopOpacity="0" /></radialGradient>
    </>
  )
}

export interface PropsFigura {
  /** el identificador del empleado: de ahí salen sus rasgos y su detalle propio */
  semilla: string
  /** el color de su equipo (un toque en la placa del pecho) */
  color: string
  postura: "sentado" | "de_pie"
  /** `camina` = en recorrido · `falla` = en rojo */
  estado?: "trabajando" | "camina" | "falla"
  /** 04-nov · sentado a la mesa de la sala: las piernas quedan debajo de la mesa y no se dibujan encima de ella */
  sinPiernas?: boolean
}

const P = (...xs: Array<number | string>) => xs.join(" ")
type Trazo = { fill: string; stroke: string; strokeWidth: number; strokeLinejoin: "round"; strokeLinecap: "round" }
type Linea = { fill: "none"; stroke: string; strokeWidth: number; strokeLinecap: "round"; strokeLinejoin: "round" }
const CLARO = "#fff3d6"

/** el cabello que va DETRÁS de la cabeza y los hombros (largo, melena, coleta) */
function PeloDeAtras({ c, yH, yS, rC, w, L, F }: { c: string; yH: number; yS: number; rC: number; w: number; L: Trazo; F: Linea }) {
  if (c === "largo") return <path d={`M${P(-rC - 2.5, yH - 2)} Q${P(-rC - 7, yH + 16)} ${P(-10.5 * w, yS + 14)} L${P(10.5 * w, yS + 14)} Q${P(rC + 7, yH + 16)} ${P(rC + 2.5, yH - 2)} Z`} {...L} opacity={0.8} />
  if (c === "melena") return <path d={`M${P(-rC - 3, yH - 3)} Q${P(-rC - 5, yH + 8)} ${P(-rC - 1, yH + 12)} L${P(rC + 1, yH + 12)} Q${P(rC + 5, yH + 8)} ${P(rC + 3, yH - 3)} Z`} {...L} opacity={0.85} />
  if (c === "coleta") return <path d={`M${P(-rC + 0.5, yH - 3)} Q${P(-rC - 9, yH + 2)} ${P(-rC - 7, yH + 17)}`} {...F} strokeWidth={4.6} opacity={0.9} />
  return null
}
/** el cabello que va ENCIMA de la cabeza */
function PeloDeFrente({ c, yH, rC, L, F }: { c: string; yH: number; rC: number; L: Trazo; F: Linea }) {
  const casquete = `M${P(-rC - 0.8, yH + 0.5)} Q${P(-rC - 1.5, yH - rC - 3.5)} ${P(0, yH - rC - 3)} Q${P(rC + 1.5, yH - rC - 3.5)} ${P(rC + 0.8, yH + 0.5)} Q${P(rC - 1, yH - rC + 1)} ${P(0, yH - rC + 1.5)} Q${P(-rC + 1, yH - rC + 1)} ${P(-rC - 0.8, yH + 0.5)}Z`
  if (c === "corto" || c === "largo" || c === "melena" || c === "coleta") return <path d={casquete} {...L} strokeWidth={1.2} />
  if (c === "mono") return <><path d={casquete} {...L} strokeWidth={1.2} /><circle cx={-rC + 2} cy={yH - rC - 5} r={5.6} {...L} /></>
  if (c === "cola_alta") return <><path d={casquete} {...L} strokeWidth={1.2} /><path d={`M${P(-1, yH - rC - 2)} Q${P(-9, yH - rC - 5)} ${P(-10, yH - rC - 14)}`} {...F} strokeWidth={4.4} /></>
  if (c === "rizos") return <g {...L} strokeWidth={1.1}>{[[-6.4, 1], [-4.2, -rC + 0.4], [0, -rC - 1.2], [4.2, -rC + 0.4], [6.4, 1]].map(([dx, dy], i) => <circle key={i} cx={dx} cy={yH + dy - 1.4} r={3.7} />)}</g>
  return null // rapado
}

/** lo que lleva sobre la cabeza o la cara */
function AccesorioDeArriba({ a, yH, rC, L, F }: { a: string; yH: number; rC: number; L: Trazo; F: Linea }) {
  switch (a) {
    case "gorra": return <path d={`M${P(-rC - 1, yH - 1)} Q0 ${yH - rC - 10} ${P(rC + 1, yH - 1)} L${P(rC + 15, yH + 1.5)} L${P(rC + 15, yH - 2.5)} L${P(rC + 1, yH - 3)}`} {...L} strokeWidth={1.6} />
    case "sombrero": return <><path d={`M${P(-rC - 1.5, yH - 3)} L${P(-rC - 1, yH - rC - 9)} Q0 ${yH - rC - 11} ${P(rC + 1, yH - rC - 9)} L${P(rC + 1.5, yH - 3)}Z`} {...L} strokeWidth={1.5} /><ellipse cx={0} cy={yH - 3} rx={rC + 11} ry={3} {...L} strokeWidth={1.6} /></>
    case "lentes": return <><circle cx={-3.4} cy={yH} r={3} {...F} stroke={CLARO} strokeWidth={1.4} /><circle cx={3.4} cy={yH} r={3} {...F} stroke={CLARO} strokeWidth={1.4} /><path d={`M-0.5 ${yH}h1`} {...F} stroke={CLARO} /></>
    case "auricular": return <path d={`M${P(rC - 0.5, yH - 4)} q5 3 2 10 l-4 3`} {...F} stroke={CLARO} strokeWidth={1.9} />
    case "audifonos": return <><path d={`M${P(-rC - 1.5, yH + 1)} Q0 ${yH - rC - 9} ${P(rC + 1.5, yH + 1)}`} {...F} strokeWidth={2} /><rect x={-rC - 4.5} y={yH - 3} width={4.4} height={8} rx={2} {...L} /><rect x={rC + 0.1} y={yH - 3} width={4.4} height={8} rx={2} {...L} /></>
    default: return null
  }
}
/** lo que lleva en el cuello o el pecho */
function AccesorioDelPecho({ a, yS, w, L, F }: { a: string; yS: number; w: number; L: Trazo; F: Linea }) {
  if (a === "bufanda") return <><path d={`M${P(-7.5 * w, yS - 1)} Q0 ${yS + 4} ${P(7.5 * w, yS - 1)}`} {...F} strokeWidth={5} /><path d={`M${P(3 * w, yS + 1)} L${P(5 * w, yS + 17)} L${P(0.5 * w, yS + 17)} L${P(0, yS + 3)}Z`} {...L} /></>
  if (a === "corbata") return <><path d={`M${P(-2.4, yS + 1)} L${P(2.4, yS + 1)} L${P(1.6, yS + 5)} L${P(-1.6, yS + 5)}Z`} {...L} /><path d={`M${P(-1.6, yS + 5)} L${P(1.6, yS + 5)} L${P(3.4, yS + 19)} L${P(0, yS + 22)} L${P(-3.4, yS + 19)}Z`} {...L} strokeWidth={1.4} /></>
  return null
}
/** lo que carga: se dibuja detrás o junto al cuerpo (el origen sigue siendo los pies / el asiento) */
function Carga({ a, sentado, yS, yC, w, L, F }: { a: string; sentado: boolean; yS: number; yC: number; w: number; L: Trazo; F: Linea }) {
  if (a === "mochila") return <><rect x={7 * w} y={yS + 1} width={9 * w} height={yC - yS + 2} rx={3} {...L} opacity={0.8} /><path d={`M${P(5 * w, yS + 1)} L${P(8 * w, yC - 2)}`} {...F} strokeWidth={1.4} /></>
  if (a === "portafolio") return sentado
    ? <rect x={19 * w} y={yC + 16} width={15} height={10} rx={2} {...L} strokeWidth={1.6} />
    : <><rect x={11 * w} y={yC + 3} width={16} height={11} rx={2} {...L} strokeWidth={1.6} /><path d={`M${P(16 * w, yC + 3)} v-3 h6`} {...F} strokeWidth={1.3} /></>
  if (a === "tablet") return sentado
    ? <path d={`M${P(15 * w, yS + 13)} L${P(27 * w, yS + 10)} L${P(28 * w, yS + 19)} L${P(16 * w, yS + 22)}Z`} {...L} strokeWidth={1.5} />
    : <><rect x={10 * w} y={yC - 12} width={9} height={14} rx={1.6} {...L} strokeWidth={1.6} /><path d={`M${P(11.5 * w, yC - 9)} h6`} {...F} stroke={CLARO} strokeWidth={1.1} /></>
  if (a === "baston") return sentado
    ? <path d={`M${P(19 * w, yC + 6)} L${P(26 * w, 16)}M${P(16 * w, yC + 6)} h7`} {...F} strokeWidth={2.6} />
    : <path d={`M${P(15 * w, yC - 2)} L${P(17 * w, 0)}M${P(12 * w, yC - 2)} q3 -4 6 0`} {...F} strokeWidth={2.6} />
  return null
}

/**
 * Una persona de luz, esbelta: cabeza, cuello, hombros que bajan a la cintura, brazos y piernas (de pie), o torso con el muslo hacia delante y los brazos al escritorio (sentada).
 * Cada empleado combina cabello + accesorio + ropa + contextura + altura (`lib/holograma`), más el visor y la placa del pecho, que son el toque robótico común.
 */
export function HologramaFigura({ semilla, color, postura, estado = "trabajando", sinPiernas = false }: PropsFigura) {
  const r = rasgosDelHolograma(semilla)
  const sentado = postura === "sentado"
  const trazo = estado === "falla" ? "#ff6a55" : AMBAR_HOLOGRAMA
  const w = r.hombros * ANCHO_DE_LA_CONTEXTURA[r.contextura] // ancho relativo
  const L: Trazo = { fill: `url(#${ID_RELLENO})`, stroke: trazo, strokeWidth: 1.3, strokeLinejoin: "round", strokeLinecap: "round" }
  const F: Linea = { fill: "none", stroke: trazo, strokeWidth: 1.1, strokeLinecap: "round", strokeLinejoin: "round" }
  // alturas (de pie, desde los pies; sentada, desde el asiento)
  const yH = sentado ? -44 : -72 // centro de la cabeza
  const yS = sentado ? -34 : -62 // hombros
  const yC = sentado ? -10 : -40 // cintura
  const rC = 6.9 // radio de la cabeza
  const falda = r.ropa === "falda", vestido = r.ropa === "vestido"
  const bajo = falda ? -12 : vestido ? -3 : 0 // dónde termina la tela de pie
  const wf = Math.min(w, 1.5) // el vuelo de la falda y del vestido no crece con la contextura (si no, se vería una carpa)
  const gr = r.contextura === "gruesa" // más ancha pero humana: hombros que caen, vientre y caderas redondeados, extremidades gruesas
  const tronco = gr
    ? `M${P(-8.5 * w, yS)} C${P(-13 * w, yS + 8)} ${P(-13 * w, yC - 9)} ${P(-9.5 * w, yC)} Q0 ${yC + 5} ${P(9.5 * w, yC)} C${P(13 * w, yC - 9)} ${P(13 * w, yS + 8)} ${P(8.5 * w, yS)} Q0 ${yS - 5} ${P(-8.5 * w, yS)}Z`
    : `M${P(-10.5 * w, yS)} Q${P(-11.5 * w, (yS + yC) / 2)} ${P(-8 * w, yC)} Q0 ${yC + 3} ${P(8 * w, yC)} Q${P(11.5 * w, (yS + yC) / 2)} ${P(10.5 * w, yS)} Q0 ${yS - 4} ${P(-10.5 * w, yS)}Z`
  return (
    <g className="nv-holo" data-estado={estado} data-postura={postura} data-contextura={r.contextura} data-cabello={r.cabello} data-accesorio={r.accesorio} data-ropa={r.ropa} transform={`scale(${r.altura.toFixed(3)})`} style={{ transformOrigin: "0 0" }}>
      <ellipse className="nv-holo-pie" cx={0} cy={2} rx={sentado ? 24 : 15} ry={5} fill={`url(#${ID_PIE})`} />
      <g className="nv-holo-cuerpo">
        <PeloDeAtras c={r.cabello} yH={yH} yS={yS} rC={rC} w={w} L={L} F={F} />
        {r.accesorio === "mochila" && <Carga a="mochila" sentado={sentado} yS={yS} yC={yC} w={w} L={L} F={F} />}
        {sentado ? (
          <>
            {/* sentada: el muslo hacia delante, la pantorrilla hacia abajo, el torso erguido y los brazos hacia la computadora */}
            {!sinPiernas && <path d={gr ? `M${P(-8 * w, yC - 1)} Q${P(8 * w, yC - 6)} ${P(16 * w, yC + 2)} Q${P(19 * w, yC + 12)} ${P(17 * w, yC + 26)} L${P(10.5 * w, yC + 26)} L${P(10.5 * w, yC + 12)} Q${P(0, yC + 14)} ${P(-8 * w, yC + 10)}Z` : `M${P(-7 * w, yC - 1)} L${P(16 * w, yC + 1)} L${P(17 * w, yC + 26)} L${P(10.5 * w, yC + 26)} L${P(10.5 * w, yC + 10)} L${P(-7 * w, yC + 10)}Z`} {...L} /> }
            {!sinPiernas && (falda || vestido) && <path d={`M${P(-9 * w, yC - 2)} L${P(17 * w, yC)} L${P((vestido ? 29 : 26) * wf, yC + (vestido ? 22 : 12))} L${P(-12 * wf, yC + (vestido ? 22 : 12))}Z`} {...L} />}
            <path d={tronco} {...L} />
            <path d={`M${P(8 * w, yS + 2)} L${P(14 * w, yS + 14)} L${P(25 * w, yS + 16)}`} {...F} strokeWidth={gr ? 5.2 : 3.8} opacity={0.9} />
          </>
        ) : (
          <>
            {/* de pie: dos piernas (o la tela hasta la rodilla / el tobillo), y los brazos caídos */}
            {falda || vestido
              ? <><path d={`M${P(-8 * w, yC)} L${P(8 * w, yC)} L${P((vestido ? 17 : 19) * wf, bajo)} L${P((vestido ? -17 : -19) * wf, bajo)}Z`} {...L} />{falda && <path d={`M${P(-5 * w, bajo)} L${P(-5 * w, 0)}M${P(5 * w, bajo)} L${P(5 * w, 0)}`} {...F} strokeWidth={3.6} />}</>
              : gr
                ? <><path d={`M${P(-9 * w, yC)} Q${P(-10.5 * w, -20)} ${P(-6.4 * w, 0)} L${P(-1, 0)} Q${P(-1.6, -20)} ${P(-0.6, yC)}Z`} {...L} /><path d={`M${P(9 * w, yC)} Q${P(10.5 * w, -20)} ${P(6.4 * w, 0)} L${P(1, 0)} Q${P(1.6, -20)} ${P(0.6, yC)}Z`} {...L} /></>
                : <><path d={`M${P(-8.4 * w, yC)} L${P(-0.6, yC)} L${P(-1, 0)} L${P(-6.4 * w, 0)}Z`} {...L} /><path d={`M${P(0.6, yC)} L${P(8.4 * w, yC)} L${P(6.4 * w, 0)} L${P(1, 0)}Z`} {...L} /></>}
            <path d={tronco} {...L} />
            <path d={`M${P(-9.5 * w, yS + 2)} L${P(-11 * w, yC + 2)}M${P(9.5 * w, yS + 2)} L${P(11 * w, yC + 2)}`} {...F} strokeWidth={gr ? 5.2 : 3.8} opacity={0.9} />
          </>
        )}
        {/* la ropa de arriba: la chaqueta (solapas y bajo más ancho) y el chaleco (escote y costuras) */}
        {r.ropa === "chaqueta" && <><path d={`M${P(-4 * w, yS + 1)} L${P(0, yS + 15)} L${P(4 * w, yS + 1)}`} {...F} stroke={CLARO} strokeWidth={1.2} opacity={0.9} /><path d={`M${P(-9 * w, yC + 3)} L${P(9 * w, yC + 3)}`} {...F} strokeWidth={1.6} /></>}
        {r.ropa === "chaleco" && <path d={`M${P(-4.5 * w, yS + 1)} L${P(-2.6 * w, yC)}M${P(4.5 * w, yS + 1)} L${P(2.6 * w, yC)}`} {...F} stroke={CLARO} strokeWidth={1.2} opacity={0.9} />}
        {vestido && <path d={`M${P(-8 * w, yC)} L${P(8 * w, yC)}`} {...F} stroke={CLARO} strokeWidth={1.3} opacity={0.8} />}
        {(r.accesorio === "portafolio" || r.accesorio === "tablet" || r.accesorio === "baston") && <Carga a={r.accesorio} sentado={sentado} yS={yS} yC={yC} w={w} L={L} F={F} />}
        {/* el cuello y la cabeza */}
        <path d={`M0 ${yS - 3} L0 ${yH + rC}`} {...F} strokeWidth={4.4} />
        <AccesorioDelPecho a={r.accesorio} yS={yS} w={w} L={L} F={F} />
        <circle cx={0} cy={yH} r={rC} {...L} />
        <PeloDeFrente c={r.cabello} yH={yH} rC={rC} L={L} F={F} />
        {r.accesorio !== "lentes" && <path d={`M-3.6 ${yH}h7.2`} {...F} stroke={CLARO} strokeWidth={1.6} />}
        <AccesorioDeArriba a={r.accesorio} yH={yH} rC={rC} L={L} F={F} />
        {/* la placa del pecho, con el color del equipo (toque robótico común) */}
        {r.accesorio !== "corbata" && <circle cx={0} cy={yS + 9} r={2.1} fill="none" stroke={color} strokeWidth={1.3} />}
        <path className="nv-holo-barrido" d={tronco} fill={`url(#${ID_BARRIDO})`} opacity={0.5} />
      </g>
    </g>
  )
}

/** el retrato de la ficha: el busto de luz del MISMO personaje (mismos rasgos que la figura de la escena) */
export function HologramaBusto({ semilla, color, tam = 112 }: { semilla: string; color: string; tam?: number }) {
  const r = rasgosDelHolograma(semilla)
  const id = `holo-${huella(semilla).toString(36)}`
  const h = r.hombros * (r.contextura === "gruesa" ? 1.35 : r.contextura === "delgada" ? 0.92 : 1)
  const cx = 60, cy = 50
  return (
    <svg viewBox="0 0 120 120" width={tam} height={tam} aria-hidden data-holograma-busto={semilla} className="shrink-0 rounded-2xl border border-amber-400/40 bg-[#0d0b09]">
      <defs>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={AMBAR_HOLOGRAMA} stopOpacity=".55" /><stop offset="1" stopColor="#ff8c1a" stopOpacity=".05" /></linearGradient>
        <pattern id={`${id}-b`} width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="1.4" fill="#fff3d6" opacity=".45" /></pattern>
        <radialGradient id={`${id}-l`} cx=".5" cy=".4" r=".7"><stop offset="0" stopColor={AMBAR_HOLOGRAMA} stopOpacity=".22" /><stop offset="1" stopColor={AMBAR_HOLOGRAMA} stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#${id}-l)`} />
      <path d={`M${60 - 46 * h} 120c0-26 ${14 * h}-38 ${46 * h}-38s${46 * h} 12 ${46 * h} 38z`} fill={`url(#${id}-f)`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.6} />
      <path d={`M${60 - 46 * h} 120c0-26 ${14 * h}-38 ${46 * h}-38s${46 * h} 12 ${46 * h} 38z`} fill={`url(#${id}-b)`} />
      <rect x={cx - 6} y={cy + 20} width={12} height={14} fill={`url(#${id}-f)`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.2} />
      {r.cabeza === 1
        ? <path d={`M${cx - 22} ${cy - 2}a22 24 0 0 1 44 0v10a22 16 0 0 1 -44 0z`} fill={`url(#${id}-f)`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.8} />
        : <ellipse cx={cx} cy={cy} rx={21} ry={25} fill={`url(#${id}-f)`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.8} />}
      <ellipse cx={cx} cy={cy} rx={21} ry={25} fill={`url(#${id}-b)`} opacity={0.6} />
      {r.cabeza === 2 && <path d={`M${cx} ${cy - 25}v-9`} stroke={AMBAR_HOLOGRAMA} strokeWidth={3} strokeLinecap="round" />}
      {r.accesorio !== "lentes" && r.visor === 0 && <path d={`M${cx - 13} ${cy - 2}h26`} stroke="#fff3d6" strokeWidth={3.4} strokeLinecap="round" />}
      {r.accesorio !== "lentes" && r.visor === 1 && <circle cx={cx + (r.altura > 1 ? 6 : -6)} cy={cy - 2} r={4.4} fill="#fff3d6" />}
      {r.accesorio !== "lentes" && r.visor === 2 && <><circle cx={cx - 8} cy={cy - 2} r={3.2} fill="#fff3d6" /><circle cx={cx + 8} cy={cy - 2} r={3.2} fill="#fff3d6" /></>}
      {r.antena > 0 && <path d={`M${cx + 14} ${cy - 22}l6 -${r.antena === 2 ? 15 : 10}`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.8} strokeLinecap="round" />}
      {r.antena === 2 && <circle cx={cx + 20} cy={cy - 38} r={2.4} fill="#fff3d6" />}
      {(r.cabello === "largo" || r.cabello === "melena") && <path d={`M${cx - 24} ${cy - 4}q-6 ${r.cabello === "largo" ? 30 : 18} -4 ${r.cabello === "largo" ? 52 : 34}h8q-2 -${r.cabello === "largo" ? 26 : 16} 2 -${r.cabello === "largo" ? 46 : 28}zM${cx + 24} ${cy - 4}q6 ${r.cabello === "largo" ? 30 : 18} 4 ${r.cabello === "largo" ? 52 : 34}h-8q2 -${r.cabello === "largo" ? 26 : 16} -2 -${r.cabello === "largo" ? 46 : 28}z`} fill={`url(#${id}-f)`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.4} />}
      {r.cabello === "mono" && <circle cx={cx - 6} cy={cy - 32} r={7} fill={`url(#${id}-f)`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.6} />}
      {r.cabello === "coleta" && <path d={`M${cx - 20} ${cy - 10}q-16 4 -14 30`} fill="none" stroke={AMBAR_HOLOGRAMA} strokeWidth={5} strokeLinecap="round" />}
      {r.cabello === "cola_alta" && <path d={`M${cx - 4} ${cy - 25}q-14 -4 -16 -20`} fill="none" stroke={AMBAR_HOLOGRAMA} strokeWidth={5} strokeLinecap="round" />}
      {r.cabello === "rizos" && [-14, -7, 0, 7, 14].map((dx, i) => <circle key={i} cx={cx + dx} cy={cy - 24 + Math.abs(dx) * 0.35} r={6} fill={`url(#${id}-f)`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.4} />)}
      {(r.cabello === "corto" || r.cabello === "largo" || r.cabello === "melena" || r.cabello === "coleta") && <path d={`M${cx - 22} ${cy - 6}q0 -24 22 -24q22 0 22 24q-10 -12 -22 -12q-12 0 -22 12z`} fill={`url(#${id}-f)`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.4} />}
      {r.accesorio === "gorra" && <path d={`M${cx - 23} ${cy - 8}q23 -34 46 0M${cx + 20} ${cy - 10}h22`} fill="none" stroke={AMBAR_HOLOGRAMA} strokeWidth={2.4} strokeLinecap="round" />}
      {r.accesorio === "sombrero" && <><path d={`M${cx - 15} ${cy - 20}q15 -22 30 0z`} fill={`url(#${id}-f)`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.8} /><path d={`M${cx - 34} ${cy - 19}h68`} stroke={AMBAR_HOLOGRAMA} strokeWidth={3.4} strokeLinecap="round" /></>}
      {r.accesorio === "lentes" && <g fill="none" stroke="#fff3d6" strokeWidth={2}><circle cx={cx - 8} cy={cy - 2} r={6} /><circle cx={cx + 8} cy={cy - 2} r={6} /><path d={`M${cx - 2} ${cy - 2}h4`} /></g>}
      {r.accesorio === "auricular" && <path d={`M${cx + 21} ${cy - 8}q8 4 4 14l-6 4`} fill="none" stroke="#fff3d6" strokeWidth={2.2} strokeLinecap="round" />}
      {r.accesorio === "audifonos" && <g fill="none" stroke={AMBAR_HOLOGRAMA} strokeWidth={2.4} strokeLinecap="round"><path d={`M${cx - 23} ${cy - 2}q23 -40 46 0`} /><rect x={cx - 29} y={cy - 8} width={9} height={18} rx={3.5} fill={`url(#${id}-f)`} /><rect x={cx + 20} y={cy - 8} width={9} height={18} rx={3.5} fill={`url(#${id}-f)`} /></g>}
      {r.accesorio === "bufanda" && <path d={`M${cx - 20} ${cy + 30}q20 12 40 0`} fill="none" stroke={AMBAR_HOLOGRAMA} strokeWidth={7} strokeLinecap="round" />}
      {r.accesorio === "corbata" && <path d={`M${cx - 4} ${cy + 36}h8l3 24l-7 5l-7 -5z`} fill={`url(#${id}-f)`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.6} />}
      {r.accesorio === "mochila" && <path d={`M${cx - 30 * h} ${cy + 42}v34M${cx + 30 * h} ${cy + 42}v34`} stroke={AMBAR_HOLOGRAMA} strokeWidth={3} strokeLinecap="round" />}
      {r.accesorio === "portafolio" && <g fill={`url(#${id}-f)`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.8}><rect x={cx + 20} y={cy + 56} width={34} height={22} rx={4} /><path d={`M${cx + 31} ${cy + 56}v-6h12v6`} fill="none" /></g>}
      {r.accesorio === "tablet" && <g fill={`url(#${id}-f)`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.8}><rect x={cx + 24} y={cy + 44} width={24} height={32} rx={3} /><path d={`M${cx + 29} ${cy + 52}h14`} stroke="#fff3d6" fill="none" /></g>}
      {r.accesorio === "baston" && <path d={`M${cx + 40} ${cy + 80}v-40q0 -8 -8 -8`} fill="none" stroke={AMBAR_HOLOGRAMA} strokeWidth={3} strokeLinecap="round" />}
      {r.placa === 0 && <circle cx={cx} cy={cy + 52} r={6} fill="none" stroke={color} strokeWidth={2.2} />}
      {r.placa === 1 && <path d={`M${cx - 10} ${cy + 52}h20`} stroke={color} strokeWidth={4} strokeLinecap="round" />}
      {r.placa === 2 && <path d={`M${cx} ${cy + 44}l8 8l-8 8l-8 -8z`} fill="none" stroke={color} strokeWidth={2.2} />}
      {r.circuito === 0 && <path d={`M${cx - 30 * h} ${cy + 40}h10v10`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.4} fill="none" />}
      {r.circuito === 1 && <path d={`M${cx + 30 * h} ${cy + 46}v14h-6`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.4} fill="none" />}
      {r.circuito === 2 && <path d={`M${cx - 8} ${cy + 30}v8h16v-8`} stroke={AMBAR_HOLOGRAMA} strokeWidth={1.4} fill="none" />}
    </svg>
  )
}
