"use client"

import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react"
import { GRUPOS_DE_PANTALLAS, LUZ_DE_LA_INTERFAZ, lienzoDelMarco, marcoDeLaForma, type Animacion, type Caja, type TableroDeDireccion } from "@/lib/pantallas-de-la-oficina"
import { ESTILO_DE_DIRECCION, LIENZO_DE_DIRECCION, TableroDeDireccionVivo } from "@/components/nuevo/TablerosDeDireccion"
import type { ResumenDeDecisiones } from "@/lib/direccion-decisiones"
import type { ResumenDeRiesgos } from "@/lib/direccion-riesgos"

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
 * 6.19 (capa 1 de la oficina del humano, aprobada por Emilio «tal como se ve en el boceto»): el arco muestra los 9 TABLEROS DE DIRECCIÓN con su título
 * (`TablerosDeDireccion.tsx`) sobre un velo oscuro, y la 10 conserva el mapa dorado. El escritorio queda reservado a Emilio: sin datos del sistema.
 */
const FOTO = { w: 2560, h: 1440 }

const ESTILO = `
.nv-pantalla{pointer-events:none}
.nv-tintes{mix-blend-mode:hue;opacity:.92}
.nv-tintes .nv-tinte{fill:var(--tono)}
.nv-sombras{mix-blend-mode:multiply;opacity:.34}
.nv-sombras .nv-sombra{fill:#241206}
.nv-pantalla .nv-hud{color:${LUZ_DE_LA_INTERFAZ};opacity:.78;filter:drop-shadow(0 0 1px var(--tono)) drop-shadow(0 0 2px var(--tono))}
.nv-pantalla[data-tono="durazno"] .nv-hud{opacity:.62}/* 6.17b «muy sutil»: menos brillo en todas, y aún menos en los vidrios negros */
.nv-pantalla .nv-hud [data-anima]{animation-timing-function:ease-in-out;animation-iteration-count:infinite;transform-box:fill-box}/* ojo: con fill-box, un atributo transform="rotate(a cx cy)" gira alrededor de otro centro: los segmentos del anillo vuelven a view-box */
.nv-pantalla .nv-hud [data-anima="marca"]{animation-name:nvMarca;animation-duration:9s;stroke-dasharray:1}
.nv-pantalla .nv-hud [data-anima="respira"]{animation-name:nvRespira;animation-duration:9s}
.nv-pantalla .nv-hud [data-anima="enciende"]{animation-name:nvEnciende;animation-duration:9s;transform-box:view-box;transform-origin:0 0}
.nv-pantalla .nv-hud [data-anima="senal"]{animation-name:nvSenal;animation-duration:3.3s;animation-timing-function:ease-out;transform-origin:center}
.nv-pantalla .nv-hud [data-anima="desfila"]{animation-name:nvDesfila;animation-duration:14s;animation-timing-function:linear;transform-box:view-box}
.nv-pantalla .nv-hud [data-anima="recorre"]{animation-name:nvDesfila;animation-duration:10s;animation-timing-function:linear;transform-box:view-box}
.nv-pantalla .nv-hud [data-anima="avanza"]{animation-name:nvAvanza;animation-duration:10s;animation-timing-function:linear;transform-origin:left}
.nv-pantalla .nv-hud [data-anima="avanza-y-vuelve"]{animation-name:nvAvanzaYVuelve;animation-duration:9s;transform-origin:left}
@keyframes nvCrece{0%{transform:scaleY(0)}30%,88%{transform:scaleY(1)}100%{transform:scaleY(0)}}
@keyframes nvMarca{0%,12%{stroke-dashoffset:1}24%,90%{stroke-dashoffset:0}100%{stroke-dashoffset:1}}
@keyframes nvRespira{0%,100%{opacity:.3}50%{opacity:.9}}
@keyframes nvEnciende{0%{opacity:.15}16%,90%{opacity:var(--op)}100%{opacity:.15}}
@keyframes nvSenal{0%{transform:scale(1);opacity:.55}78%,100%{transform:scale(3);opacity:0}}
@keyframes nvDesfila{from{transform:translateX(0)}to{transform:translateX(var(--recorrido))}}
@keyframes nvAvanza{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes nvAvanzaYVuelve{0%{transform:scaleX(0)}24%,90%{transform:scaleX(1)}100%{transform:scaleX(0)}}
@media (prefers-reduced-motion:reduce){.nv-pantalla .nv-hud [data-anima]{animation:none}}
.nv-pantalla .nv-hud{transition:opacity .45s ease}
.nv-toques{pointer-events:none}
.nv-toque polygon.nv-zona-toque{fill:rgba(255,140,40,0);stroke:none;pointer-events:all;cursor:default}
.nv-toque polygon.nv-luz{fill:url(#nv-luz-pantalla);opacity:0;mix-blend-mode:screen;pointer-events:none;transition:opacity .45s ease}
.nv-toque:hover polygon.nv-luz,.nv-toque:active polygon.nv-luz{opacity:1}
.nv-toque:not([data-tono="durazno"]) polygon.nv-luz{fill:url(#nv-luz-clara);stroke:rgba(255,243,226,.8);stroke-width:1.1;stroke-linejoin:round;filter:drop-shadow(0 0 2px rgba(255,236,200,.85))}/* 6.18b · en los vidrios naranjas la luz cálida se perdía: una luz más clara y un filo de luz en el borde, sutil */
@media (prefers-reduced-motion:reduce){.nv-toque polygon.nv-luz,.nv-pantalla .nv-hud{transition:none}}
`
/** 6.18 (Emilio, 1-nov: «al tocar cada pantalla que se ilumine tal cual la oficina de marketing hiciste con el pizarrón»): al pasar el ratón (o tocar) cada
 *  vidrio se enciende con la misma luz que la pantalla de música (degradado cálido en mezcla «trama» que aparece en .45 s) y sus líneas suben a brillo pleno.
 *  No abre nada ni lleva rótulo: qué hace cada pantalla lo decide Emilio. La de música tiene su propia zona (`PantallaDeMusica`); aquí solo sube sus líneas. */
const reglaDeBrillo = (grupo: string, indice: number) => {
  const disparo = grupo === "escritorio" && indice === 2 ? ".nv-musica:hover" : `.nv-toque[data-id="${grupo}-${indice}"]:hover`
  return `.nv-proy:has(${disparo}) .nv-pantalla[data-grupo="${grupo}"][data-pantalla="${indice}"] .nv-hud{opacity:1}`
}
const ESTILO_DEL_BRILLO = GRUPOS_DE_PANTALLAS.flatMap(({ grupo, pantallas }) => pantallas.map((p) => reglaDeBrillo(grupo, p.indice))).join(" ")

const seg = (s: number) => `${s.toFixed(2)}s`
const retraso = (s: number): CSSProperties => ({ animationDelay: seg(s) })

/** el mapa dorado (la 10 del arco): una trama de puntos y señales que se expanden */
function Mapa({ l, g, quieto, semilla, senales }: { l: Caja; g: number; quieto: boolean; semilla: number; senales: ReadonlyArray<readonly [number, number]> }) {
  const { x, y, w, h } = l
  const cols = 7, filas = 11, px = w / (cols - 1), py = (h * 0.9) / (filas - 1)
  const hay = (c: number, f: number) => ((c * 7 + f * 13 + semilla * 3) % 10) > 2 && !(f < 2 && (semilla % 2 ? c < 2 : c > 4)) && !(f > 8 && (semilla % 2 ? c > 4 : c < 2))
  const pt = senales.map(([c, f]) => [x + c * px, y + f * py] as const)
  return (
    <g fill="currentColor" stroke="currentColor">
      {Array.from({ length: cols * filas }, (_, i) => { const c = i % cols, f = Math.floor(i / cols); return hay(c, f) ? <circle key={i} cx={x + c * px} cy={y + f * py} r={g * 0.55} stroke="none" opacity={0.42} /> : null })}
      {pt.map(([sx, sy], i) => (
        <g key={i}>
          <circle cx={sx} cy={sy} r={g * 1.1} stroke="none" opacity={0.95} />
          <circle cx={sx} cy={sy} r={g * 1.1} fill="none" strokeWidth={g * 0.7} opacity={quieto ? 0.4 : 0.9} data-anima="senal" style={retraso(i * (3.3 / senales.length) + semilla * 0.4)} />
        </g>
      ))}
    </g>
  )
}

/* ─── los tableros: cada uno dentro del lienzo de su pantalla (en reposo, cada dibujo muestra su estado final visible) ─── */
function Tablero({ animacion, l, quieto }: { animacion: Animacion; l: Caja; quieto: boolean }) {
  const { x, y, w, h } = l
  const g = Math.max(1.3, Math.min(w, h) * 0.035) // grosor de línea: legible también en las pantallas chicas
  switch (animacion) {
    /* ───── el arco: la 10 conserva el mapa dorado (6.17); los otros 9 son tableros de dirección (6.19, `TablerosDeDireccion`) ───── */
    case "mapa": return <Mapa l={l} g={g} quieto={quieto} semilla={0} senales={[[1, 3], [5, 5], [3, 8]]} />
    default: return null
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

/** 6.20/6.21 · las pantallas del arco que se abren al tocarlas (Decisiones, la 5 · Riesgos, la 6; las demás llegan una por ciclo) */
export const PANTALLA_DE_DECISIONES = "arco-5"
export const PANTALLA_DE_RIESGOS = "arco-6"
export function PantallasDelArco({ decisiones = null, alAbrirDecisiones, riesgos = null, alAbrirRiesgos }: { decisiones?: ResumenDeDecisiones | null; alAbrirDecisiones?: () => void; riesgos?: ResumenDeRiesgos | null; alAbrirRiesgos?: () => void }) {
  const abre: Record<string, { que: string; etiqueta: string; abrir: () => void } | undefined> = {
    [PANTALLA_DE_DECISIONES]: alAbrirDecisiones && { que: "decisiones", etiqueta: "Abrir tus decisiones", abrir: alAbrirDecisiones },
    [PANTALLA_DE_RIESGOS]: alAbrirRiesgos && { que: "riesgos", etiqueta: "Abrir los riesgos y alarmas", abrir: alAbrirRiesgos },
  }
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
      <style>{ESTILO + ESTILO_DE_DIRECCION + ESTILO_DEL_BRILLO}</style>
      {/* 1 · el tinte: un svg aparte cuya mezcla «matiz» actúa contra la FOTO */}
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="nv-tintes pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        {todas.map(({ id, p }) => <polygon key={id} className="nv-tinte" points={p.forma} style={{ "--tono": p.tono } as CSSProperties} />)}
      </svg>
      {/* 2 · una sombra que apaga un poco el vidrio: las líneas claras contrastan */}
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="nv-sombras pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        {todas.map(({ id, p }) => <polygon key={id} className="nv-sombra" points={p.forma} />)}
      </svg>
      {/* 2b · 6.19 · el velo oscuro de los vidrios del arco: los tableros de dirección se leen en luz clara sobre vidrio apagado, como en el boceto */}
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="nv-velos pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        {todas.filter(({ grupo }) => grupo === "arco").map(({ id, p }) => <polygon key={id} points={p.forma} />)}
      </svg>
      {/* 3 · los tableros animados, recortados al vidrio de cada pantalla */}
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>{todas.map(({ id, p }) => <clipPath key={id} id={`nv-pantalla-${id}`}><polygon points={p.forma} /></clipPath>)}</defs>
        {todas.map(({ id, grupo, p }) => (
          <g key={id} className="nv-pantalla" data-grupo={grupo} data-pantalla={p.indice} data-animacion={p.animacion} data-tono={p.nombreDelTono} style={{ "--tono": p.tono } as CSSProperties} clipPath={`url(#nv-pantalla-${id})`}>
            {/* 6.16b · el dibujo se hace en el plano propio del vidrio y la matriz lo lleva a su perspectiva: cuadrado con sus bordes, no recto contra la foto */}
            <g className="nv-hud" transform={`matrix(${marcoDeLaForma(p.forma).matriz.map((v) => v.toFixed(5)).join(" ")})`}>
              {p.titulo
                ? <g transform={`scale(${(marcoDeLaForma(p.forma).W / LIENZO_DE_DIRECCION.w).toFixed(5)} ${(marcoDeLaForma(p.forma).H / LIENZO_DE_DIRECCION.h).toFixed(5)})`}><TableroDeDireccionVivo tablero={p.animacion as TableroDeDireccion} titulo={p.titulo} quieto={quieto} decisiones={decisiones} riesgos={riesgos} /></g>
                : <Tablero animacion={p.animacion} l={lienzoDelMarco(marcoDeLaForma(p.forma))} quieto={quieto} />}
            </g>
          </g>
        ))}
      </svg>
      {/* 4 · 6.18 · el toque: cada vidrio se ilumina al pasar el ratón, como el pizarrón de marketing (la de música ya tiene el suyo) */}
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="nv-toques absolute inset-0 h-full w-full" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="nv-luz-pantalla" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(255,196,120,0.75)" /><stop offset="60%" stopColor="rgba(255,160,70,0.4)" /><stop offset="100%" stopColor="rgba(255,140,40,0.1)" />
          </radialGradient>
          <radialGradient id="nv-luz-clara" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(255,240,215,0.42)" /><stop offset="60%" stopColor="rgba(255,218,170,0.2)" /><stop offset="100%" stopColor="rgba(255,196,130,0.08)" />
          </radialGradient>
        </defs>
        {todas.filter(({ id }) => id !== "escritorio-2").map(({ id, p }) => (
          <g key={id} className="nv-toque" data-id={id} data-tono={p.nombreDelTono}
            {...(abre[id] ? {
              "data-abre": abre[id].que, role: "button", tabIndex: 0, "aria-label": abre[id].etiqueta,
              onClick: abre[id].abrir, onKeyDown: (e: KeyboardEvent<SVGGElement>) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abre[id]?.abrir() } },
            } : {})}>
            <polygon className="nv-zona-toque" points={p.forma} />
            <polygon className="nv-luz" points={p.forma} />
          </g>
        ))}
      </svg>
    </>
  )
}
