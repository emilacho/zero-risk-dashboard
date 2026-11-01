import type { CSSProperties } from "react"
import { estadoDePantalla, matrizDeLaPantalla, oficioDeLaMesa, puntosDeLaPantalla, type MesaViva } from "@/lib/escena-avatares"

/**
 * LA PANTALLA DE UNA MESA (CC6 · Sprint A · pedido de Emilio, 01-nov): el monitor de la foto se cubre con su propia pantalla.
 *  · nadie trabaja (o la mesa está por activar) → NEGRA, como apagada;
 *  · alguien trabaja → contenido que se mueve según el oficio (código que avanza, barras que suben, bloques de diseño, mensajes, tarjetas que pasan) y un
 *    brillo ámbar que respira;
 *  · lo último fue un fallo → rojo que late.
 * El contenido se dibuja en un cuadro de 100 × 100 y una matriz lo lleva al paralelogramo del monitor (la vista es isométrica). Respeta «reducir movimiento».
 */
export const ESTILO_PANTALLAS = `
.nv-av .nv-pa-respira{animation:nvPaRespira 2.6s ease-in-out infinite}
.nv-av .nv-pa-sube{animation:nvPaSube 12s linear infinite}
.nv-av .nv-pa-barra{transform-box:fill-box;transform-origin:50% 100%;animation:nvPaBarra 2.4s ease-in-out infinite}
.nv-av .nv-pa-parpadea{animation:nvPaParpadea 1.8s ease-in-out infinite}
.nv-av .nv-pa-fallo{animation:nvPaFallo 1.2s ease-in-out infinite}
@keyframes nvPaRespira{0%,100%{opacity:.35}50%{opacity:.75}}
@keyframes nvPaSube{from{transform:translateY(0)}to{transform:translateY(-100px)}}
@keyframes nvPaBarra{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
@keyframes nvPaParpadea{0%,100%{opacity:.15}50%{opacity:1}}
@keyframes nvPaFallo{0%,100%{opacity:.45}50%{opacity:.95}}
@media (prefers-reduced-motion:reduce){.nv-av .nv-pa-respira,.nv-av .nv-pa-sube,.nv-av .nv-pa-barra,.nv-av .nv-pa-parpadea,.nv-av .nv-pa-fallo{animation:none}}
`
const AMBAR = "#ffb347", CLARO = "#ffe2b8", TENUE = "#b8742a"
const retraso = (s: number): CSSProperties => ({ animationDelay: `${s}s` })

/** lo que se ve en la pantalla de quien trabaja, por oficio (coordenadas 0–100) */
function Contenido({ oficio }: { oficio: ReturnType<typeof oficioDeLaMesa> }) {
  if (oficio === "codigo") {
    const lineas = [62, 40, 78, 30, 55, 70, 24, 66, 48, 36]
    return <g className="nv-pa-sube">{[0, 1].map((copia) => lineas.map((w, i) => <rect key={`${copia}-${i}`} x={8 + (i % 3) * 6} y={8 + i * 10 + copia * 100} width={w} height={4} rx={1} fill={i % 4 === 0 ? CLARO : i % 2 ? AMBAR : TENUE} opacity={0.9} />))}</g>
  }
  if (oficio === "grafico") {
    return <g>{[0, 1, 2, 3, 4].map((i) => <rect key={i} className="nv-pa-barra" style={retraso(i * 0.35)} x={10 + i * 17} y={30} width={11} height={60} fill={i === 3 ? CLARO : AMBAR} />)}<polyline points="8,70 28,52 46,60 64,34 92,22" fill="none" stroke={CLARO} strokeWidth={3} className="nv-pa-parpadea" /></g>
  }
  if (oficio === "diseno") {
    return <g>{[[8, 8, AMBAR], [52, 8, TENUE], [8, 52, CLARO], [52, 52, AMBAR]].map(([x, y, c], i) => <rect key={i} className="nv-pa-parpadea" style={retraso(i * 0.45)} x={x as number} y={y as number} width={40} height={40} rx={4} fill={c as string} opacity={0.8} />)}<circle cx={70} cy={70} r={5} fill="#fff" className="nv-pa-parpadea" style={retraso(0.2)} /></g>
  }
  if (oficio === "mensajes") {
    return <g className="nv-pa-sube">{[0, 1].map((copia) => [0, 1, 2, 3, 4].map((i) => <rect key={`${copia}-${i}`} x={i % 2 ? 34 : 8} y={8 + i * 20 + copia * 100} width={58} height={12} rx={6} fill={i % 2 ? CLARO : AMBAR} opacity={0.85} />))}</g>
  }
  // tablero de dirección: tres columnas con tarjetas que se encienden por turno
  return <g>{[0, 1, 2].map((c) => [0, 1, 2].map((f) => <rect key={`${c}-${f}`} className="nv-pa-parpadea" style={retraso((c * 3 + f) * 0.2)} x={8 + c * 30} y={10 + f * 28} width={24} height={20} rx={2} fill={(c + f) % 2 ? AMBAR : CLARO} opacity={0.85} />))}</g>
}

export function PantallaDeLaMesa({ m }: { m: MesaViva }) {
  const estado = estadoDePantalla(m)
  const id = `nv-pa-${m.clave}`
  return (
    <g data-pantalla={estado} data-pantalla-mesa={m.clave} aria-hidden="true">
      <defs><clipPath id={id}><polygon points={puntosDeLaPantalla(m.clave)} /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        <g transform={matrizDeLaPantalla(m.clave)}>
          {/* el fondo: negro apagado o la pantalla encendida */}
          <rect x={-4} y={-4} width={108} height={108} fill={estado === "apagada" ? "#030303" : estado === "fallo" ? "#2a0503" : "#1a0c02"} />
          {estado === "apagada" && <rect x={-4} y={-4} width={60} height={108} fill="url(#nv-pa-reflejo)" opacity={0.5} />}
          {estado === "fallo" && <rect x={-4} y={-4} width={108} height={108} fill="#ff3a2a" className="nv-pa-fallo" />}
          {estado === "trabajando" && (
            <>
              <rect x={-4} y={-4} width={108} height={108} fill={AMBAR} className="nv-pa-respira" opacity={0.5} />
              <Contenido oficio={oficioDeLaMesa(m.clave)} />
            </>
          )}
        </g>
      </g>
    </g>
  )
}
