"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { GRUPOS_DE_PANTALLAS, LUZ_DE_LA_INTERFAZ, lienzoDelMarco, marcoDeLaForma, type Animacion, type Caja } from "@/lib/pantallas-de-la-oficina"

/**
 * LAS PANTALLAS DE TU OFICINA (sprint 6.14 → 6.16 · Emilio, 1-nov): las 6 pantallas encendidas del ARCO y las 5 chicas del ESCRITORIO, cada una con su MATIZ de
 * naranja y una animación distinta. Tema (6.16): «tecnología del futuro mezclada con empresa»: los tableros de una empresa vistos desde el futuro, en líneas finas
 * de luz clara: ventas por mes · red de la empresa · tablero de indicadores · curva de crecimiento · embudo · mapa de mercados (arco) · cinta de cotizaciones ·
 * pista de reproducción · agenda del día · participación · lista de tareas (escritorio). Primero lo visual; qué función tiene cada una lo decide Emilio después.
 * Solo decoración: no abren nada, no se tocan, no leen nada (la pantalla de música tiene su propio toque en `PantallaDeMusica`, que va encima). Sin letras ni
 * cifras: a este tamaño (≈4 px en pantalla) serían ruido, y un rótulo sería asignar un «uso».
 * Movimiento con animaciones CSS (trazos que se dibujan con `pathLength`, bloques que crecen, luces que respiran) y SMIL para lo que viaja por un atributo (los
 * pulsos de la red, el cabezal de la pista). Se probó framer-motion (6.16): en esta app sus componentes `motion.*` saltan al último cuadro sin animar (el motor
 * imperativo sí anima); CSS+SMIL ya estaban comprobados en el navegador real (6.14b). Con «menos movimiento» del sistema, el CSS se apaga por media query y los
 * SMIL no se montan: todo queda quieto en su estado final visible. Cada dibujo se encaja en el LIENZO de su vidrio (con márgenes), sea alto o apaisado, y
 * (6.16b) se dibuja en el plano propio del vidrio: una matriz lo inclina con la perspectiva de la foto para que quede cuadrado con sus bordes.
 * Tres capas: el tinte (un svg propio con mezcla «matiz» contra la FOTO: dentro de un mismo svg la mezcla solo vería el propio svg y saldría plana), una sombra
 * que apaga un poco el vidrio para que las líneas claras contrasten, y la interfaz recortada a cada vidrio. Coordenadas en píxeles de la foto 2560×1440.
 */
const FOTO = { w: 2560, h: 1440 }

const ESTILO = `
.nv-pantalla{pointer-events:none}
.nv-tintes{mix-blend-mode:hue;opacity:.92}
.nv-tintes .nv-tinte{fill:var(--tono)}
.nv-sombras{mix-blend-mode:multiply;opacity:.34}
.nv-sombras .nv-sombra{fill:#241206}
.nv-pantalla .nv-hud{color:${LUZ_DE_LA_INTERFAZ};filter:drop-shadow(0 0 1.2px var(--tono)) drop-shadow(0 0 3px var(--tono))}
.nv-pantalla .nv-hud [data-anima]{animation-timing-function:ease-in-out;animation-iteration-count:infinite;transform-box:fill-box}/* ojo: con fill-box, un atributo transform="rotate(a cx cy)" gira alrededor de otro centro: los segmentos del anillo vuelven a view-box */
.nv-pantalla .nv-hud [data-anima="crece"]{animation-name:nvCrece;animation-duration:8s;transform-origin:bottom}
.nv-pantalla .nv-hud [data-anima="llena"]{animation-name:nvCrece;animation-duration:8s;transform-origin:top}
.nv-pantalla .nv-hud [data-anima="traza"]{animation-name:nvTraza;animation-duration:9s;stroke-dasharray:1}
.nv-pantalla .nv-hud [data-anima="marca"]{animation-name:nvMarca;animation-duration:9s;stroke-dasharray:1}
.nv-pantalla .nv-hud [data-anima="respira"]{animation-name:nvRespira;animation-duration:9s}
.nv-pantalla .nv-hud [data-anima="aparece"]{animation-name:nvAparece;animation-duration:9s}
.nv-pantalla .nv-hud [data-anima="destella"]{animation-name:nvDestella;animation-duration:9s}
.nv-pantalla .nv-hud [data-anima="enciende"]{animation-name:nvEnciende;animation-duration:9s;transform-box:view-box;transform-origin:0 0}
.nv-pantalla .nv-hud [data-anima="senal"]{animation-name:nvSenal;animation-duration:3.3s;animation-timing-function:ease-out;transform-origin:center}
.nv-pantalla .nv-hud [data-anima="desfila"]{animation-name:nvDesfila;animation-duration:14s;animation-timing-function:linear;transform-box:view-box}
.nv-pantalla .nv-hud [data-anima="recorre"]{animation-name:nvDesfila;animation-duration:10s;animation-timing-function:linear;transform-box:view-box}
.nv-pantalla .nv-hud [data-anima="avanza"]{animation-name:nvAvanza;animation-duration:10s;animation-timing-function:linear;transform-origin:left}
.nv-pantalla .nv-hud [data-anima="avanza-y-vuelve"]{animation-name:nvAvanzaYVuelve;animation-duration:9s;transform-origin:left}
@keyframes nvCrece{0%{transform:scaleY(0)}30%,88%{transform:scaleY(1)}100%{transform:scaleY(0)}}
@keyframes nvTraza{0%{stroke-dashoffset:1}38%,90%{stroke-dashoffset:0}100%{stroke-dashoffset:1}}
@keyframes nvMarca{0%,12%{stroke-dashoffset:1}24%,90%{stroke-dashoffset:0}100%{stroke-dashoffset:1}}
@keyframes nvRespira{0%,100%{opacity:.3}50%{opacity:.9}}
@keyframes nvAparece{0%,34%{opacity:0}48%,90%{opacity:.18}100%{opacity:0}}
@keyframes nvDestella{0%,40%{opacity:0}50%{opacity:1}65%{opacity:.4}88%{opacity:1}100%{opacity:0}}
@keyframes nvEnciende{0%{opacity:.15}16%,90%{opacity:var(--op)}100%{opacity:.15}}
@keyframes nvSenal{0%{transform:scale(1);opacity:.9}78%,100%{transform:scale(4.5);opacity:0}}
@keyframes nvDesfila{from{transform:translateX(0)}to{transform:translateX(var(--recorrido))}}
@keyframes nvAvanza{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes nvAvanzaYVuelve{0%{transform:scaleX(0)}24%,90%{transform:scaleX(1)}100%{transform:scaleX(0)}}
@media (prefers-reduced-motion:reduce){.nv-pantalla .nv-hud [data-anima]{animation:none}}
`

const seg = (s: number) => `${s.toFixed(2)}s`
const retraso = (s: number): CSSProperties => ({ animationDelay: seg(s) })

/* ─── los tableros: cada uno dentro del lienzo de su pantalla (en reposo, cada dibujo muestra su estado final visible) ─── */
function Tablero({ animacion, l, quieto }: { animacion: Animacion; l: Caja; quieto: boolean }) {
  const { x, y, w, h } = l
  const g = Math.max(1.3, Math.min(w, h) * 0.035) // grosor de línea: legible también en las pantallas chicas
  switch (animacion) {
    /* ───── el arco (vidrios altos) ───── */
    case "ventas": { // barras de ventas por mes que crecen una tras otra sobre una rejilla fina, con la línea de meta respirando
      const n = 6, paso = w / n, alturas = [0.35, 0.5, 0.42, 0.68, 0.8, 0.95], base = y + h * 0.8, alto = h * 0.66
      return (
        <g stroke="currentColor" fill="currentColor">
          {[0.25, 0.5, 0.75, 1].map((k) => <line key={k} x1={x} y1={base - alto * k} x2={x + w} y2={base - alto * k} strokeWidth={g * 0.5} opacity={0.18} />)}
          <line x1={x} y1={base} x2={x + w} y2={base} strokeWidth={g} opacity={0.6} />
          <line x1={x} y1={base - alto * 0.8} x2={x + w} y2={base - alto * 0.8} strokeWidth={g * 0.7} strokeDasharray={`${g * 2} ${g * 2}`} opacity={0.6} data-anima="respira" />
          {alturas.map((a, i) => <rect key={i} x={x + i * paso + paso * 0.22} y={base - alto * a} width={paso * 0.56} height={alto * a} rx={g * 0.6} stroke="none" opacity={0.85} data-anima="crece" style={retraso(i * 0.22)} />)}
        </g>
      )
    }
    case "red": { // la red de la empresa: nodos unidos por los que viajan pulsos de luz (SMIL: cada pulso recorre su enlace en su turno)
      const n = [[0.5, 0.1], [0.18, 0.36], [0.82, 0.36], [0.5, 0.52], [0.14, 0.74], [0.5, 0.9], [0.86, 0.74]].map(([a, b]) => [x + w * a, y + h * b] as const)
      const e: Array<[number, number]> = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [3, 6], [1, 4], [2, 6]]
      const ciclo = 9, tramo = 0.2 // cada pulso viaja un 20 % del ciclo, empezando en su turno
      return (
        <g stroke="currentColor" fill="currentColor">
          {e.map(([a, b], i) => <line key={i} x1={n[a][0]} y1={n[a][1]} x2={n[b][0]} y2={n[b][1]} strokeWidth={g * 0.6} opacity={0.35} />)}
          {!quieto && e.map(([a, b], i) => {
            const t0 = (i / e.length) * (1 - tramo), t1 = t0 + tramo, kt = `0;${t0.toFixed(3)};${t1.toFixed(3)};1`
            return (
              <circle key={`p${i}`} r={g * 1.1} stroke="none" opacity={0}>
                <animate attributeName="cx" values={`${n[a][0]};${n[a][0]};${n[b][0]};${n[b][0]}`} keyTimes={kt} dur={`${ciclo}s`} repeatCount="indefinite" />
                <animate attributeName="cy" values={`${n[a][1]};${n[a][1]};${n[b][1]};${n[b][1]}`} keyTimes={kt} dur={`${ciclo}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values={`0;0;1;0;0`} keyTimes={`0;${t0.toFixed(3)};${((t0 + t1) / 2).toFixed(3)};${t1.toFixed(3)};1`} dur={`${ciclo}s`} repeatCount="indefinite" />
              </circle>
            )
          })}
          {n.map(([a, b], i) => <g key={`n${i}`}><circle cx={a} cy={b} r={g * 2.2} fill="none" strokeWidth={g * 0.8} opacity={0.8} /><circle cx={a} cy={b} r={g} stroke="none" opacity={0.9} data-anima="respira" style={retraso(i * 0.7)} /></g>)}
        </g>
      )
    }
    case "indicadores": { // tablero de indicadores: tres tarjetas, cada una con su mini curva que se dibuja y su bloque de dato que respira
      const alto = h * 0.28, hueco = h * 0.08, curvas = [[0.2, 0.6, 0.45, 0.8, 0.7, 1], [0.5, 0.3, 0.6, 0.4, 0.8, 0.9], [0.1, 0.3, 0.2, 0.5, 0.6, 0.95]]
      return (
        <g stroke="currentColor" fill="none">
          {curvas.map((c, i) => {
            const ty = y + i * (alto + hueco), cx0 = x + w * 0.1, cw = w * 0.48, cy0 = ty + alto * 0.78, ch = alto * 0.5
            const curva = c.map((k, j) => `${(cx0 + (cw * j) / (c.length - 1)).toFixed(1)},${(cy0 - ch * k).toFixed(1)}`).join(" L")
            return (
              <g key={i}>
                <rect x={x} y={ty} width={w} height={alto} rx={g * 1.5} strokeWidth={g * 0.7} opacity={0.55} />
                <line x1={x + w * 0.1} y1={ty + alto * 0.26} x2={x + w * 0.42} y2={ty + alto * 0.26} strokeWidth={g * 0.9} opacity={0.4} />
                <path d={`M${curva}`} pathLength={1} strokeDashoffset={0} strokeWidth={g} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} data-anima="traza" style={retraso(i * 0.5)} />
                <rect x={x + w * 0.68} y={ty + alto * 0.2} width={w * 0.22} height={alto * 0.3} rx={g * 0.6} fill="currentColor" stroke="none" opacity={0.85} data-anima="respira" style={retraso(i * 0.5)} />
              </g>
            )
          })}
        </g>
      )
    }
    case "crecimiento": { // la curva de crecimiento: se dibuja, aparece su área bajo la curva y el punto final destella
      const p = [0.1, 0.22, 0.18, 0.36, 0.33, 0.5, 0.62, 0.58, 0.8, 0.95], base = y + h * 0.86, alto = h * 0.74
      const pts = p.map((k, i) => [x + (w * i) / (p.length - 1), base - alto * k] as const)
      const linea = `M${pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" L")}`
      const area = `${linea} L${(x + w).toFixed(1)},${base} L${x},${base} Z`
      const [fx, fy] = pts[pts.length - 1]
      return (
        <g stroke="currentColor" fill="currentColor">
          {[0.33, 0.66, 1].map((k) => <line key={k} x1={x} y1={base - alto * k} x2={x + w} y2={base - alto * k} strokeWidth={g * 0.5} opacity={0.18} />)}
          <line x1={x} y1={base} x2={x + w} y2={base} strokeWidth={g} opacity={0.6} />
          <path d={area} stroke="none" opacity={0.18} data-anima="aparece" />
          <path d={linea} pathLength={1} strokeDashoffset={0} fill="none" strokeWidth={g * 1.2} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} data-anima="traza" />
          <circle cx={fx} cy={fy} r={g * 1.6} stroke="none" opacity={1} data-anima="destella" />
        </g>
      )
    }
    case "embudo": { // el embudo: cuatro etapas que se van llenando de arriba abajo
      const etapas = 4, alto = h * 0.2, hueco = h * 0.045
      return (
        <g stroke="currentColor" fill="currentColor">
          {Array.from({ length: etapas }, (_, i) => {
            const ty = y + i * (alto + hueco), a0 = w * (1 - i * 0.2), a1 = w * (1 - (i + 1) * 0.2), cx = x + w / 2
            const d = `M${cx - a0 / 2},${ty} L${cx + a0 / 2},${ty} L${cx + a1 / 2},${ty + alto} L${cx - a1 / 2},${ty + alto} Z`
            return (
              <g key={i}>
                <path d={d} fill="none" strokeWidth={g * 0.7} opacity={0.6} />
                <path d={d} stroke="none" opacity={0.5} data-anima="llena" style={retraso(i * 0.9)} />
              </g>
            )
          })}
        </g>
      )
    }
    case "mapa": { // el mapa de mercados: una trama de puntos con señales que se expanden en distintos lugares
      const cols = 7, filas = 11, px = w / (cols - 1), py = (h * 0.9) / (filas - 1)
      const hay = (c: number, f: number) => ((c * 7 + f * 13) % 10) > 2 && !(f < 2 && c > 4) && !(f > 8 && c < 2) // una «tierra» irregular y fija
      const señales = [[1, 3], [5, 5], [3, 8]] as const
      return (
        <g fill="currentColor" stroke="currentColor">
          {Array.from({ length: cols * filas }, (_, i) => { const c = i % cols, f = Math.floor(i / cols); return hay(c, f) ? <circle key={i} cx={x + c * px} cy={y + f * py} r={g * 0.55} stroke="none" opacity={0.42} /> : null })}
          {señales.map(([c, f], i) => {
            const sx = x + c * px, sy = y + f * py
            return (
              <g key={i}>
                <circle cx={sx} cy={sy} r={g * 1.1} stroke="none" opacity={0.95} />
                <circle cx={sx} cy={sy} r={g * 1.1} fill="none" strokeWidth={g * 0.7} opacity={quieto ? 0.4 : 0.9} data-anima="senal" style={retraso(i * 1.1)} />
              </g>
            )
          })}
        </g>
      )
    }
    /* ───── el escritorio (vidrios chicos y apaisados) ───── */
    case "cotizaciones": { // la cinta de cotizaciones: bloques con su flecha que pasan de derecha a izquierda, en bucle continuo (dos cintas encadenadas; el recorte del vidrio corta lo que sale)
      const bloque = w * 0.34, hueco = w * 0.1, serie = [1, -1, 1, 1, -1, 1], largo = serie.length * (bloque + hueco), ty = y + h * 0.3, alto = h * 0.4
      const cinta = (dx: number) => serie.map((s, i) => { const bx = x + dx + i * (bloque + hueco); return (
        <g key={`${dx}-${i}`}>
          <rect x={bx} y={ty} width={bloque * 0.62} height={alto} rx={g * 0.8} opacity={0.5} stroke="none" />
          <path d={s > 0 ? `M${bx + bloque * 0.74},${ty + alto * 0.85} L${bx + bloque * 0.87},${ty + alto * 0.15} L${bx + bloque},${ty + alto * 0.85} Z` : `M${bx + bloque * 0.74},${ty + alto * 0.15} L${bx + bloque * 0.87},${ty + alto * 0.85} L${bx + bloque},${ty + alto * 0.15} Z`} stroke="none" opacity={0.95} />
        </g>) })
      return (
        <g fill="currentColor" stroke="currentColor">
          <line x1={x} y1={y + h * 0.1} x2={x + w} y2={y + h * 0.1} strokeWidth={g * 0.5} opacity={0.3} /><line x1={x} y1={y + h * 0.9} x2={x + w} y2={y + h * 0.9} strokeWidth={g * 0.5} opacity={0.3} />
          <g data-anima="desfila" style={{ "--recorrido": `${-largo}px` } as CSSProperties}>{cinta(0)}{cinta(largo)}</g>
        </g>
      )
    }
    case "pista": { // la pista de reproducción (música): la línea avanza y el cabezal recorre las marcas de compás
      const ty = y + h * 0.55
      return (
        <g fill="currentColor" stroke="currentColor">
          <line x1={x} y1={ty} x2={x + w} y2={ty} strokeWidth={g * 0.7} opacity={0.35} />
          {Array.from({ length: 9 }, (_, i) => <line key={i} x1={x + (w * i) / 8} y1={ty - (i % 4 === 0 ? h * 0.2 : h * 0.1)} x2={x + (w * i) / 8} y2={ty + (i % 4 === 0 ? h * 0.2 : h * 0.1)} strokeWidth={g * 0.6} opacity={0.55} />)}
          <line x1={x} y1={ty} x2={x + (quieto ? w * 0.6 : w)} y2={ty} strokeWidth={g * 1.4} strokeLinecap="round" opacity={0.95} data-anima="avanza" />
          <circle cx={x + w * 0.6} cy={ty} r={g * 1.6} stroke="none">{!quieto && <animate attributeName="cx" from={x} to={x + w} dur="10s" repeatCount="indefinite" />}</circle>
        </g>
      )
    }
    case "agenda": { // la agenda del día: bloques en una rejilla de horas y la línea de «ahora» que la recorre
      const cols = 5, filas = 3, cw = w / cols, rh = (h * 0.8) / filas, ty = y + h * 0.15
      const bloques = [[0, 0, 1], [1, 1, 2], [2, 0, 1], [3, 2, 1], [4, 1, 1]] as const // [columna, fila, ancho en columnas]
      return (
        <g fill="currentColor" stroke="currentColor">
          {Array.from({ length: cols + 1 }, (_, i) => <line key={i} x1={x + i * cw} y1={ty} x2={x + i * cw} y2={ty + rh * filas} strokeWidth={g * 0.4} opacity={0.22} />)}
          <line x1={x} y1={ty} x2={x + w} y2={ty} strokeWidth={g * 0.6} opacity={0.5} />
          {bloques.map(([c, f, a], i) => <rect key={i} x={x + c * cw + cw * 0.12} y={ty + f * rh + rh * 0.18} width={cw * a - cw * 0.24} height={rh * 0.64} rx={g * 0.6} stroke="none" opacity={0.7} data-anima="respira" style={retraso((c / cols) * 10 - 4.5)} />)}
          <g data-anima="recorre" style={{ "--recorrido": `${w}px`, ...(quieto ? { transform: `translateX(${w * 0.5}px)` } : {}) } as CSSProperties}><line x1={x} y1={ty - h * 0.08} x2={x} y2={ty + rh * filas + h * 0.05} strokeWidth={g * 1.1} opacity={0.95} /></g>
        </g>
      )
    }
    case "participacion": { // participación: un anillo por segmentos que se van encendiendo y tres barras que se llenan
      const r = h * 0.42, cx = x + r + g, cy = y + h / 2, c = 2 * Math.PI * r, partes = [0.46, 0.28, 0.16, 0.1], bx = cx + r + w * 0.12, bw = x + w - bx
      let acumulado = 0
      return (
        <g fill="none" stroke="currentColor">
          <circle cx={cx} cy={cy} r={r} strokeWidth={g * 1.6} opacity={0.18} />
          {partes.map((p, i) => { const ini = acumulado; acumulado += p; return <circle key={i} cx={cx} cy={cy} r={r} strokeWidth={g * 1.6} strokeDasharray={`${(c * p - g * 1.2).toFixed(1)} ${(c - c * p + g * 1.2).toFixed(1)}`} strokeDashoffset={-c * ini} transform={`rotate(-90 ${cx} ${cy})`} opacity={0.95 - i * 0.2} data-anima="enciende" style={{ "--op": 0.95 - i * 0.2, animationDelay: seg(i * 1.1) } as CSSProperties} /> })}
          {partes.slice(0, 3).map((p, i) => <g key={`b${i}`}><line x1={bx} y1={cy + (i - 1) * h * 0.3} x2={bx + bw} y2={cy + (i - 1) * h * 0.3} strokeWidth={g * 1.2} opacity={0.18} strokeLinecap="round" /><line x1={bx} y1={cy + (i - 1) * h * 0.3} x2={bx + bw * p * 2} y2={cy + (i - 1) * h * 0.3} strokeWidth={g * 1.2} opacity={0.95 - i * 0.2} strokeLinecap="round" data-anima="avanza-y-vuelve" style={retraso(i * 1.1)} /></g>)}
        </g>
      )
    }
    case "tareas": { // la lista de tareas: casillas que se van marcando
      const filas = 3, rh = h / filas, lado = Math.min(rh * 0.5, w * 0.12)
      return (
        <g fill="none" stroke="currentColor">
          {Array.from({ length: filas }, (_, i) => {
            const ty = y + i * rh + rh / 2, bx = x, by = ty - lado / 2
            return (
              <g key={i}>
                <rect x={bx} y={by} width={lado} height={lado} rx={g * 0.5} strokeWidth={g * 0.7} opacity={0.7} />
                <line x1={bx + lado * 1.6} y1={ty} x2={x + w * (0.55 + (i % 2) * 0.3)} y2={ty} strokeWidth={g * 0.9} opacity={0.45} />
                <path d={`M${bx + lado * 0.22},${ty} L${bx + lado * 0.45},${by + lado * 0.74} L${bx + lado * 0.82},${by + lado * 0.24}`} pathLength={1} strokeDashoffset={0} strokeWidth={g * 1.1} strokeLinecap="round" strokeLinejoin="round" data-anima="marca" style={retraso(i * 1.6)} />
              </g>
            )
          })}
        </g>
      )
    }
  }
}

export function PantallasDelArco() {
  const [quieto, setQuieto] = useState(false) // «menos movimiento» del sistema: sin SMIL (el CSS se apaga solo por media query)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setQuieto(mq.matches)
    const f = (e: MediaQueryListEvent) => setQuieto(e.matches)
    mq.addEventListener("change", f)
    return () => mq.removeEventListener("change", f)
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
      {/* 3 · los tableros animados, recortados al vidrio de cada pantalla */}
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>{todas.map(({ id, p }) => <clipPath key={id} id={`nv-pantalla-${id}`}><polygon points={p.forma} /></clipPath>)}</defs>
        {todas.map(({ id, grupo, p }) => (
          <g key={id} className="nv-pantalla" data-grupo={grupo} data-pantalla={p.indice} data-animacion={p.animacion} data-tono={p.nombreDelTono} style={{ "--tono": p.tono } as CSSProperties} clipPath={`url(#nv-pantalla-${id})`}>
            {/* 6.16b · el dibujo se hace en el plano propio del vidrio y la matriz lo lleva a su perspectiva: cuadrado con sus bordes, no recto contra la foto */}
            <g className="nv-hud" transform={`matrix(${marcoDeLaForma(p.forma).matriz.map((v) => v.toFixed(5)).join(" ")})`}><Tablero animacion={p.animacion} l={lienzoDelMarco(marcoDeLaForma(p.forma))} quieto={quieto} /></g>
          </g>
        ))}
      </svg>
    </>
  )
}
