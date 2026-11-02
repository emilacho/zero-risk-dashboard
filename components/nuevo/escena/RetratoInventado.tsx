/**
 * EL RETRATO INVENTADO DEL EMPLEADO (CC6 · 02-nov · Emilio: «rostro de persona inventada, con un toque robótico, en nuestro estilo; nada de caras reales»).
 * Dibujado por código (sin generador de imágenes, US$ 0): rasgos simples y geométricos que salen de la huella del identificador del empleado, así que es
 * siempre el mismo para cada uno y no se parece a nadie. El toque robótico: un ojo con lente ámbar, líneas de circuito en la mejilla y un auricular.
 */
import { huella } from "@/lib/escena-empleado"

const PIELES = ["#5a3d2b", "#7a5236", "#9a6a45", "#b98458", "#d2a27a", "#e3bb94", "#6b4a35", "#8c6143"] as const
const PELOS = ["#0f0c0a", "#2a1d14", "#4a3020", "#6e4a2c", "#1d1b1f", "#3b3633", "#8a6a4a", "#b9b2a8"] as const
export interface RasgosDelRetrato {
  piel: string; pelo: string
  /** 0 corto · 1 rapado · 2 largo · 3 moño · 4 rizado */
  peinado: number
  ancho: number; separacionOjos: number; cejas: number
  /** 0 recta · 1 sonrisa · 2 seria */
  boca: number
  lente: "izq" | "der"; circuito: number; auricular: boolean; fondo: number
}
/** los rasgos, estables por empleado (cada uno sale de una parte distinta de la huella) */
export function rasgosDelRetrato(semilla: string): RasgosDelRetrato {
  const h = huella(semilla), g = huella(`${semilla}·rostro`)
  return {
    piel: PIELES[h % PIELES.length], pelo: PELOS[(h >>> 3) % PELOS.length], peinado: (h >>> 6) % 5,
    ancho: 21 + ((h >>> 9) % 5), separacionOjos: 9 + ((h >>> 12) % 3), cejas: (h >>> 14) % 3, boca: (h >>> 16) % 3,
    lente: g % 2 ? "izq" : "der", circuito: (g >>> 1) % 3, auricular: ((g >>> 3) % 3) !== 0, fondo: (g >>> 5) % 3,
  }
}

export function RetratoInventado({ semilla, color, tam = 112 }: { semilla: string; color: string; tam?: number }) {
  const r = rasgosDelRetrato(semilla)
  const cx = 60, cy = 52, ojoY = cy - 2
  const ojoI = cx - r.separacionOjos, ojoD = cx + r.separacionOjos
  const lenteX = r.lente === "izq" ? ojoI : ojoD
  const id = `ret-${huella(semilla).toString(36)}`
  const pelo = [
    `M${cx - r.ancho} ${cy - 6}q2-${r.ancho} ${r.ancho}-${r.ancho + 2}q${r.ancho - 2} 2 ${r.ancho} ${r.ancho + 2}q-6-10-${r.ancho}-11q-${r.ancho - 6} 1-${r.ancho} 11z`, // corto
    `M${cx - r.ancho + 2} ${cy - 10}q${r.ancho - 2}-14 ${2 * r.ancho - 4} 0q-${r.ancho - 2}-6-${2 * r.ancho - 4} 0z`, // rapado
    `M${cx - r.ancho - 2} ${cy + 18}q-4-${r.ancho + 22} ${r.ancho + 2}-${r.ancho + 22}q${r.ancho + 6} 0 ${r.ancho + 2} ${r.ancho + 22}l-4 0q0-${r.ancho + 12}-${r.ancho}-${r.ancho + 14}q-${r.ancho - 4} 2-${r.ancho} ${r.ancho + 14}z`, // largo
    `M${cx - r.ancho} ${cy - 6}q2-${r.ancho} ${r.ancho}-${r.ancho + 2}q${r.ancho - 2} 2 ${r.ancho} ${r.ancho + 2}q-6-9-${r.ancho}-10q-${r.ancho - 6} 1-${r.ancho} 10z M${cx - 8} ${cy - r.ancho - 6}a8 7 0 1 0 16 0a8 7 0 1 0-16 0`, // moño
    Array.from({ length: 9 }, (_, i) => { const a = Math.PI + (i / 8) * Math.PI; const x = cx + Math.cos(a) * (r.ancho + 1), y = cy - 4 + Math.sin(a) * (r.ancho + 1); return `M${x.toFixed(1)} ${y.toFixed(1)}m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0` }).join(" "), // rizado
  ][r.peinado]
  return (
    <svg viewBox="0 0 120 120" width={tam} height={tam} aria-hidden data-retrato={semilla} className="shrink-0 rounded-2xl border border-amber-400/40 bg-[#0d0b09]">
      <defs>
        <radialGradient id={`${id}-luz`} cx=".5" cy=".35" r=".75"><stop offset="0" stopColor={["#ffb347", "#e8731a", "#a08cff"][r.fondo]} stopOpacity=".22" /><stop offset="1" stopColor="#ffb347" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-lente`}><stop offset="0" stopColor="#ffe2a8" /><stop offset=".45" stopColor="#ffb347" /><stop offset="1" stopColor="#b8650e" /></radialGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#${id}-luz)`} />
      {/* cuello con anillos metálicos y hombros */}
      <rect x={cx - 7} y={cy + r.ancho - 4} width="14" height="16" fill={r.piel} />
      {[0, 5, 10].map((k) => <rect key={k} x={cx - 8} y={cy + r.ancho + k} width="16" height="2.2" rx="1" fill="#3a3530" stroke={color} strokeOpacity=".5" strokeWidth=".6" />)}
      <path d={`M16 120c2-22 20-33 44-33s42 11 44 33`} fill="#1b1714" stroke={color} strokeOpacity=".55" strokeWidth="1.5" />
      <path d="M44 96l16 8 16-8" fill="none" stroke={color} strokeOpacity=".7" strokeWidth="1.4" />
      {/* cabeza */}
      {r.peinado === 2 && <path d={pelo} fill={r.pelo} />}
      <ellipse cx={cx} cy={cy} rx={r.ancho} ry={r.ancho + 4} fill={r.piel} />
      {r.peinado !== 2 && <path d={pelo} fill={r.pelo} />}
      {/* orejas y auricular */}
      <ellipse cx={cx - r.ancho} cy={cy + 2} rx="3" ry="5" fill={r.piel} />
      <ellipse cx={cx + r.ancho} cy={cy + 2} rx="3" ry="5" fill={r.piel} />
      {r.auricular && <g><rect x={cx + r.ancho - 2} y={cy - 4} width="6" height="11" rx="2" fill="#2a2622" stroke="#ffb347" strokeOpacity=".8" strokeWidth=".8" /><circle cx={cx + r.ancho + 1} cy={cy - 1} r="1.2" fill="#ffb347" /><path d={`M${cx + r.ancho + 1} ${cy + 7}q-4 10-14 12`} fill="none" stroke="#3a3530" strokeWidth="1.2" /></g>}
      {/* cejas */}
      {[ojoI, ojoD].map((x, k) => <path key={k} d={`M${x - 4} ${ojoY - 6 - (r.cejas === 1 ? 1 : 0)}q4 ${r.cejas === 2 ? -1 : -3} 8 ${r.cejas === 2 ? 1 : 0}`} stroke={r.pelo} strokeWidth="1.6" fill="none" strokeLinecap="round" />)}
      {/* ojos: uno humano, otro con lente ámbar */}
      {[ojoI, ojoD].map((x, k) => (x === lenteX
        ? <g key={k}><circle cx={x} cy={ojoY} r="5" fill="#141210" stroke="#8a8178" strokeWidth="1" /><circle cx={x} cy={ojoY} r="3.2" fill={`url(#${id}-lente)`} /><circle cx={x - 1} cy={ojoY - 1} r=".9" fill="#fff6e0" /></g>
        : <g key={k}><ellipse cx={x} cy={ojoY} rx="3.2" ry="2.2" fill="#f4ede4" /><circle cx={x} cy={ojoY} r="1.6" fill="#2a1d14" /></g>))}
      {/* nariz y boca */}
      <path d={`M${cx} ${ojoY + 3}l-2 8h4`} stroke="#000" strokeOpacity=".25" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d={r.boca === 0 ? `M${cx - 6} ${cy + 15}h12` : r.boca === 1 ? `M${cx - 7} ${cy + 14}q7 5 14 0` : `M${cx - 6} ${cy + 16}q6-2 12 0`} stroke="#5a2a20" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* circuito en la mejilla del lado de la lente */}
      {(() => { const s = r.lente === "izq" ? -1 : 1, x0 = cx + s * (r.separacionOjos + 4), y0 = ojoY + 8; const d = [`M${x0} ${y0}h${s * 6}v6h${s * 4}`, `M${x0} ${y0}v5h${s * 7}`, `M${x0} ${y0}l${s * 5} 4h${s * 5}`][r.circuito]; return <g><path d={d} stroke="#ffb347" strokeOpacity=".75" strokeWidth=".9" fill="none" /><circle cx={x0} cy={y0} r="1.1" fill="#ffb347" /></g> })()}
    </svg>
  )
}
