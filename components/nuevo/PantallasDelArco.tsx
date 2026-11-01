"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { PANTALLAS_VIVAS, cajaDeLaForma, type Animacion } from "@/lib/pantallas-de-la-oficina"

/**
 * EL ARCO DE PANTALLAS DE TU OFICINA (sprint 6.14 · corrección 6.14b · Emilio, 1-nov): las 6 pantallas encendidas de la foto, cada una con su MATIZ de naranja
 * (del dorado a la teja) y una animación distinta, sutil, de interfaz futurista: columnas de datos · órbita · radar · pulso · escáner · malla. Solo decoración:
 * no abren nada, no se tocan, no leen nada (qué abre cada pantalla lo decide Emilio después). Coordenadas en píxeles de la foto 2560×1440. Se monta DENTRO de la
 * proyección de tu oficina. El vidrio se tiñe con el matiz de cada pantalla (mezcla «matiz»: la luz y el brillo de la foto se quedan, cambia solo el matiz) y se oscurece apenas
 * para que las líneas finas se lean. Con «menos movimiento» del sistema, todo queda quieto.
 */
const FOTO = { w: 2560, h: 1440 }

const ESTILO = `
.nv-arco{pointer-events:none}
.nv-tintes{mix-blend-mode:hue;opacity:.92}
.nv-tintes .nv-tinte{fill:var(--tono)}
.nv-sombras{mix-blend-mode:multiply;opacity:.22}
.nv-sombras .nv-sombra{fill:#1a0e06}
.nv-arco .nv-hud{color:var(--tono);filter:drop-shadow(0 0 1.5px currentColor)}
.nv-arco .nv-hud [data-anima="columna"]{animation:nvColumna var(--dur,5s) ease-in-out var(--ini,0s) infinite;transform-box:fill-box;transform-origin:bottom}
.nv-arco .nv-hud [data-anima="escanea"]{animation:nvEscanea 6s cubic-bezier(.45,0,.55,1) infinite}
.nv-arco .nv-hud [data-anima="corre"]{animation:nvCorre 4.5s linear infinite}
.nv-arco .nv-hud [data-anima="respira"]{animation:nvRespira 3.2s ease-in-out var(--ini,0s) infinite}
.nv-arco .nv-hud [data-anima="onda"]{animation:nvOnda 4s ease-in-out var(--ini,0s) infinite}
@keyframes nvColumna{0%,100%{transform:scaleY(var(--a,.5))}50%{transform:scaleY(var(--b,1))}}
@keyframes nvEscanea{0%{transform:translateY(0)}50%{transform:translateY(var(--recorrido))}100%{transform:translateY(0)}}
@keyframes nvCorre{to{stroke-dashoffset:-260}}
@keyframes nvRespira{0%,100%{opacity:.25}50%{opacity:.9}}
@keyframes nvOnda{0%,100%{opacity:.12}50%{opacity:.75}}
@media (prefers-reduced-motion:reduce){.nv-arco .nv-hud [data-anima]{animation:none}}
`

/* ─── las animaciones de interfaz: cada una dentro de la caja de su pantalla · u = un décimo del lado corto ─── */
function Hud({ animacion, x, y, w, h, quieto }: { animacion: Animacion; x: number; y: number; w: number; h: number; quieto: boolean }) {
  const cx = x + w / 2, cy = y + h / 2, u = Math.min(w, h) / 10, fino = u * 0.14
  switch (animacion) {
    case "columnas": { // columnas de datos: siete líneas finas que respiran a destiempo sobre una base
      const alturas = [0.45, 0.8, 0.6, 1, 0.7, 0.5, 0.85]
      return (
        <g fill="currentColor">
          <rect x={cx - u * 3.6} y={cy + u * 2.6} width={u * 7.2} height={fino} opacity={0.5} />
          {alturas.map((a, i) => <rect key={i} data-anima="columna" style={{ "--a": (a * 0.45).toFixed(2), "--b": a.toFixed(2), "--dur": `${4 + (i % 3)}s`, "--ini": `${-i * 0.7}s` } as CSSProperties} x={cx - u * 3.3 + i * u} y={cy - u * 3} width={u * 0.32} height={u * 5.6} rx={fino} opacity={0.8} />)}
        </g>
      )
    }
    case "orbita": // órbita: un núcleo y dos anillos inclinados con un satélite cada uno
      return (
        <g fill="none" stroke="currentColor" strokeWidth={fino}>
          <circle cx={cx} cy={cy} r={u * 0.5} fill="currentColor" stroke="none" opacity={0.9} />
          <circle data-anima="respira" cx={cx} cy={cy} r={u * 1.1} opacity={0.5} />
          {[[-28, 3.2, 1.3, 7], [52, 2.4, 0.9, 11]].map(([ang, rx, ry, dur], i) => (
            <g key={i} transform={`translate(${cx} ${cy}) rotate(${ang})`}>
              <ellipse rx={u * rx} ry={u * ry} opacity={0.55} />
              <g>{!quieto && <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur={`${dur}s`} repeatCount="indefinite" />}
                <g transform={`scale(1 ${ry / rx})`}><circle cx={u * rx} cy={0} r={u * 0.28} fill="currentColor" stroke="none" /></g>
              </g>
            </g>
          ))}
        </g>
      )
    case "radar": { // radar: anillos, cruz fina y un barrido que gira con su estela
      const r = u * 3.4
      return (
        <g fill="none" stroke="currentColor" strokeWidth={fino}>
          {[1, 0.66, 0.33].map((k) => <circle key={k} cx={cx} cy={cy} r={r * k} opacity={0.45} />)}
          <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} opacity={0.3} /><line x1={cx} y1={cy - r} x2={cx} y2={cy + r} opacity={0.3} />
          <g>{!quieto && <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="7s" repeatCount="indefinite" />}
            <path d={`M${cx},${cy} L${cx + r},${cy} A${r},${r} 0 0,0 ${(cx + r * Math.cos(-0.9)).toFixed(1)},${(cy + r * Math.sin(-0.9)).toFixed(1)} Z`} fill="currentColor" stroke="none" opacity={0.22} />
            <line x1={cx} y1={cy} x2={cx + r} y2={cy} strokeWidth={fino * 1.6} opacity={0.95} />
          </g>
          <circle data-anima="respira" cx={cx + r * 0.45} cy={cy - r * 0.35} r={u * 0.22} fill="currentColor" stroke="none" />
        </g>
      )
    }
    case "pulso": { // pulso: una línea de latido que se dibuja y se apaga, con su rejilla fina
      const p = [[-4, 0], [-2.4, 0], [-1.8, -0.9], [-1.2, 1.1], [-0.6, -2.8], [0, 2.2], [0.6, -0.6], [1.2, 0], [4, 0]].map(([a, b]) => `${(cx + a * u).toFixed(1)},${(cy + b * u).toFixed(1)}`).join(" ")
      return (
        <g fill="none" stroke="currentColor" strokeWidth={fino}>
          {[-2, -1, 1, 2].map((k) => <line key={k} x1={cx - u * 4} y1={cy + k * u * 1.3} x2={cx + u * 4} y2={cy + k * u * 1.3} opacity={0.14} />)}
          <polyline points={p} opacity={0.22} strokeLinejoin="round" />
          <polyline data-anima="corre" points={p} strokeWidth={fino * 1.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="40 220" opacity={0.95} />
        </g>
      )
    }
    case "escaner": // escáner: una línea de luz que recorre la pantalla de arriba abajo sobre marcas de registro
      return (
        <g stroke="currentColor" fill="currentColor" strokeWidth={fino}>
          {[0, 1, 2, 3].map((i) => <g key={i} opacity={0.4}><line x1={x + u * 0.8} y1={y + u * 1.4 + i * u * 2.2} x2={x + u * 1.8} y2={y + u * 1.4 + i * u * 2.2} /><line x1={x + w - u * 1.8} y1={y + u * 1.4 + i * u * 2.2} x2={x + w - u * 0.8} y2={y + u * 1.4 + i * u * 2.2} /></g>)}
          <g data-anima="escanea" style={{ "--recorrido": `${(h - u * 1.6).toFixed(1)}px` } as CSSProperties}>
            <rect x={x + u * 0.5} y={y + u * 0.8} width={w - u} height={u * 0.9} stroke="none" opacity={0.16} />
            <line x1={x + u * 0.5} y1={y + u * 0.8} x2={x + w - u * 0.5} y2={y + u * 0.8} strokeWidth={fino * 1.8} opacity={0.95} />
          </g>
        </g>
      )
    case "malla": // malla: puntos en rejilla por los que pasa una onda diagonal de luz
      return (
        <g fill="currentColor">{Array.from({ length: 20 }, (_, i) => { const c = i % 4, f = Math.floor(i / 4); return <circle key={i} data-anima="onda" style={{ "--ini": `${-(c + f) * 0.4}s` } as CSSProperties} cx={cx - u * 1.8 + c * u * 1.2} cy={cy - u * 2.4 + f * u * 1.2} r={u * 0.2} /> })}</g>
      )
  }
}

export function PantallasDelArco() {
  // con «menos movimiento» del sistema, las rotaciones (que no son CSS) tampoco giran
  const [quieto, setQuieto] = useState(false)
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)")
    const leer = () => setQuieto(m.matches)
    leer(); m.addEventListener("change", leer)
    return () => m.removeEventListener("change", leer)
  }, [])
  return (
    <>
      <style>{ESTILO}</style>
      {/* 1 · el tinte: un svg aparte cuya mezcla «matiz» actúa contra la FOTO (dentro de un mismo svg la mezcla solo vería el propio svg y saldría plana) */}
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="nv-tintes pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        {PANTALLAS_VIVAS.map((p) => <polygon key={p.indice} className="nv-tinte" points={p.forma} style={{ "--tono": p.tono } as CSSProperties} />)}
      </svg>
      {/* 2 · una sombra apenas, para que las líneas finas se lean sobre la luz */}
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="nv-sombras pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        {PANTALLAS_VIVAS.map((p) => <polygon key={p.indice} className="nv-sombra" points={p.forma} />)}
      </svg>
      {/* 3 · la interfaz animada, recortada al vidrio de cada pantalla */}
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>{PANTALLAS_VIVAS.map((p) => <clipPath key={p.indice} id={`nv-arco-${p.indice}`}><polygon points={p.forma} /></clipPath>)}</defs>
        {PANTALLAS_VIVAS.map((p) => {
          const caja = cajaDeLaForma(p.forma)
          return (
            <g key={p.indice} className="nv-arco" data-pantalla={p.indice} data-animacion={p.animacion} data-tono={p.nombreDelTono} style={{ "--tono": p.tono } as CSSProperties} clipPath={`url(#nv-arco-${p.indice})`}>
              <g className="nv-hud"><Hud animacion={p.animacion} x={caja.x} y={caja.y} w={caja.w} h={caja.h} quieto={quieto} /></g>
            </g>
          )
        })}
      </svg>
    </>
  )
}
