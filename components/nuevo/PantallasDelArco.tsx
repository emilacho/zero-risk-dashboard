"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { GRUPOS_DE_PANTALLAS, LUZ_DE_LA_INTERFAZ, cajaDeLaForma, type Animacion } from "@/lib/pantallas-de-la-oficina"

/**
 * LAS PANTALLAS DE TU OFICINA (sprint 6.14 · correcciones 6.14b y 6.15 · Emilio, 1-nov): las 6 pantallas encendidas del ARCO y las 5 chicas del ESCRITORIO,
 * cada una con su MATIZ de naranja y una animación distinta, sutil, de interfaz de centro de control: columnas · órbita · radar · pulso · escáner · malla (arco) ·
 * telemetría · espectro · retícula · anillo · cadena (escritorio). Las líneas van en un color CLARO y cálido, no en el tono del vidrio, para que se vean.
 * Solo decoración: no abren nada, no se tocan, no leen nada (la pantalla de música tiene su propio toque en `PantallaDeMusica`, que va encima). Coordenadas en
 * píxeles de la foto 2560×1440. Tres capas: el tinte (un svg propio con mezcla «matiz» contra la FOTO: dentro de un mismo svg la mezcla solo vería el propio svg y
 * saldría plana), una sombra que apaga un poco el vidrio para que las líneas claras contrasten, y la interfaz recortada a cada vidrio. Con «menos movimiento» del
 * sistema, todo queda quieto.
 */
const FOTO = { w: 2560, h: 1440 }

const ESTILO = `
.nv-pantalla{pointer-events:none}
.nv-tintes{mix-blend-mode:hue;opacity:.92}
.nv-tintes .nv-tinte{fill:var(--tono)}
.nv-sombras{mix-blend-mode:multiply;opacity:.34}
.nv-sombras .nv-sombra{fill:#241206}
.nv-pantalla .nv-hud{color:${LUZ_DE_LA_INTERFAZ};filter:drop-shadow(0 0 1.2px var(--tono)) drop-shadow(0 0 3px var(--tono))}
.nv-pantalla .nv-hud [data-anima="columna"]{animation:nvColumna var(--dur,5s) ease-in-out var(--ini,0s) infinite;transform-box:fill-box;transform-origin:bottom}
.nv-pantalla .nv-hud [data-anima="escanea"]{animation:nvEscanea 6s cubic-bezier(.45,0,.55,1) infinite}
.nv-pantalla .nv-hud [data-anima="barre"]{animation:nvBarre 3.4s cubic-bezier(.45,0,.55,1) infinite}
.nv-pantalla .nv-hud [data-anima="corre"]{animation:nvCorre 4.5s linear infinite}
.nv-pantalla .nv-hud [data-anima="desfila"]{animation:nvDesfila 3s linear infinite}
.nv-pantalla .nv-hud [data-anima="respira"]{animation:nvRespira 3.2s ease-in-out var(--ini,0s) infinite}
.nv-pantalla .nv-hud [data-anima="onda"]{animation:nvOnda 4s ease-in-out var(--ini,0s) infinite}
.nv-pantalla .nv-hud [data-anima="teclea"]{animation:nvTeclea 5.4s steps(1,end) var(--ini,0s) infinite}
@keyframes nvColumna{0%,100%{transform:scaleY(var(--a,.5))}50%{transform:scaleY(var(--b,1))}}
@keyframes nvEscanea{0%{transform:translateY(0)}50%{transform:translateY(var(--recorrido))}100%{transform:translateY(0)}}
@keyframes nvBarre{0%{transform:translateX(0)}50%{transform:translateX(var(--recorrido))}100%{transform:translateX(0)}}
@keyframes nvCorre{to{stroke-dashoffset:-260}}
@keyframes nvDesfila{to{stroke-dashoffset:var(--paso,-20)}}
@keyframes nvRespira{0%,100%{opacity:.25}50%{opacity:.95}}
@keyframes nvOnda{0%,100%{opacity:.12}50%{opacity:.85}}
@keyframes nvTeclea{0%{opacity:0}18%{opacity:.9}70%{opacity:.9}88%{opacity:0}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.nv-pantalla .nv-hud [data-anima]{animation:none}}
`

/* ─── las animaciones de interfaz: cada una dentro de la caja de su pantalla · u = un décimo del lado corto ─── */
function Hud({ animacion, x, y, w, h, quieto }: { animacion: Animacion; x: number; y: number; w: number; h: number; quieto: boolean }) {
  const cx = x + w / 2, cy = y + h / 2, u = Math.min(w, h) / 10, fino = u * 0.14
  switch (animacion) {
    /* ───── el arco ───── */
    case "columnas": { // columnas de datos: siete líneas finas que respiran a destiempo sobre una base
      const alturas = [0.45, 0.8, 0.6, 1, 0.7, 0.5, 0.85]
      return (
        <g fill="currentColor">
          <rect x={cx - u * 3.6} y={cy + u * 2.6} width={u * 7.2} height={fino} opacity={0.5} />
          {alturas.map((a, i) => <rect key={i} data-anima="columna" style={{ "--a": (a * 0.45).toFixed(2), "--b": a.toFixed(2), "--dur": `${4 + (i % 3)}s`, "--ini": `${-i * 0.7}s` } as CSSProperties} x={cx - u * 3.3 + i * u} y={cy - u * 3} width={u * 0.32} height={u * 5.6} rx={fino} opacity={0.85} />)}
        </g>
      )
    }
    case "orbita": // órbita: un núcleo y dos anillos inclinados con un satélite cada uno
      return (
        <g fill="none" stroke="currentColor" strokeWidth={fino}>
          <circle cx={cx} cy={cy} r={u * 0.5} fill="currentColor" stroke="none" opacity={0.95} />
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
    /* ───── el escritorio (pantallas chicas y apaisadas: pocos trazos, grandes) ───── */
    case "telemetria": // telemetría: renglones de datos que aparecen y se borran, como una consola
      return (
        <g fill="currentColor">{[0.9, 0.55, 0.75, 0.4].map((l, i) => <rect key={i} data-anima="teclea" style={{ "--ini": `${-i * 1.35}s` } as CSSProperties} x={x + w * 0.12} y={y + h * (0.2 + i * 0.18)} width={w * 0.76 * l} height={Math.max(fino * 2, h * 0.07)} rx={fino} />)}</g>
      )
    case "espectro": { // espectro: barras de música que respiran (la pantalla de música)
      const n = 9, paso = (w * 0.76) / n
      return (
        <g fill="currentColor">{Array.from({ length: n }, (_, i) => { const a = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.3)); return <rect key={i} data-anima="columna" style={{ "--a": (a * 0.35).toFixed(2), "--b": a.toFixed(2), "--dur": `${1.6 + (i % 4) * 0.5}s`, "--ini": `${-i * 0.23}s` } as CSSProperties} x={x + w * 0.12 + i * paso} y={y + h * 0.18} width={paso * 0.45} height={h * 0.64} rx={fino} opacity={0.9} /> })}</g>
      )
    }
    case "reticula": { // retícula: un visor con cruz y una marca que barre de lado a lado (la pantalla frente a la silla)
      const r = h * 0.3
      return (
        <g fill="none" stroke="currentColor" strokeWidth={fino * 1.1}>
          <circle cx={cx} cy={cy} r={r} opacity={0.6} />
          <line x1={x + w * 0.1} y1={cy} x2={x + w * 0.9} y2={cy} opacity={0.35} /><line x1={cx} y1={y + h * 0.12} x2={cx} y2={y + h * 0.88} opacity={0.35} />
          {[-1, 1].map((k) => <line key={k} x1={cx + k * r * 1.3} y1={cy - r * 0.4} x2={cx + k * r * 1.3} y2={cy + r * 0.4} opacity={0.5} />)}
          <g data-anima="barre" style={{ "--recorrido": `${(w * 0.64).toFixed(1)}px` } as CSSProperties}>
            <line x1={x + w * 0.18} y1={y + h * 0.2} x2={x + w * 0.18} y2={y + h * 0.8} strokeWidth={fino * 1.8} opacity={0.95} />
          </g>
        </g>
      )
    }
    case "anillo": { // anillo: un arco de progreso que gira, con un segundo anillo quieto
      const r = h * 0.32, c = 2 * Math.PI * r
      return (
        <g fill="none" stroke="currentColor" strokeWidth={fino * 1.4}>
          <circle cx={cx} cy={cy} r={r * 0.62} opacity={0.4} />
          <g>{!quieto && <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="5s" repeatCount="indefinite" />}
            <circle cx={cx} cy={cy} r={r} strokeDasharray={`${(c * 0.28).toFixed(1)} ${(c * 0.72).toFixed(1)}`} strokeLinecap="round" opacity={0.95} />
            <circle cx={cx} cy={cy} r={r} strokeDasharray={`${(c * 0.08).toFixed(1)} ${(c * 0.92).toFixed(1)}`} strokeDashoffset={-c * 0.55} opacity={0.6} />
          </g>
          <circle cx={cx} cy={cy} r={u * 0.35} fill="currentColor" stroke="none" opacity={0.9} />
        </g>
      )
    }
    case "cadena": // cadena: una fila de segmentos que desfila, como datos que pasan
      return (
        <g fill="none" stroke="currentColor">
          {[0.3, 0.5, 0.7].map((k, i) => <line key={i} data-anima="desfila" style={{ "--paso": `${-u * (2.4 + i * 0.8)}px` } as CSSProperties} x1={x + w * 0.1} y1={y + h * k} x2={x + w * 0.9} y2={y + h * k} strokeWidth={Math.max(fino * 2, h * 0.07)} strokeDasharray={`${(u * (0.9 + i * 0.3)).toFixed(1)} ${(u * (0.5 + i * 0.2)).toFixed(1)}`} opacity={0.5 + i * 0.2} />)}
        </g>
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
  const todas = GRUPOS_DE_PANTALLAS.flatMap(({ grupo, pantallas }) => pantallas.map((p) => ({ grupo, p, id: `${grupo}-${p.indice}` })))
  return (
    <>
      <style>{ESTILO}</style>
      {/* 1 · el tinte: un svg aparte cuya mezcla «matiz» actúa contra la FOTO */}
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="nv-tintes pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        {todas.map(({ id, p }) => <polygon key={id} className="nv-tinte" points={p.forma} style={{ "--tono": p.tono } as CSSProperties} />)}
      </svg>
      {/* 2 · una sombra que apaga un poco el vidrio: las líneas claras contrastan */}
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="nv-sombras pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        {todas.map(({ id, p }) => <polygon key={id} className="nv-sombra" points={p.forma} />)}
      </svg>
      {/* 3 · la interfaz animada, recortada al vidrio de cada pantalla */}
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>{todas.map(({ id, p }) => <clipPath key={id} id={`nv-pantalla-${id}`}><polygon points={p.forma} /></clipPath>)}</defs>
        {todas.map(({ id, grupo, p }) => {
          const caja = cajaDeLaForma(p.forma)
          return (
            <g key={id} className="nv-pantalla" data-grupo={grupo} data-pantalla={p.indice} data-animacion={p.animacion} data-tono={p.nombreDelTono} style={{ "--tono": p.tono } as CSSProperties} clipPath={`url(#nv-pantalla-${id})`}>
              <g className="nv-hud"><Hud animacion={p.animacion} x={caja.x} y={caja.y} w={caja.w} h={caja.h} quieto={quieto} /></g>
            </g>
          )
        })}
      </svg>
    </>
  )
}
