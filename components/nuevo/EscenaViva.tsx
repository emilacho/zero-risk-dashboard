"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { PanelAplicaciones } from "@/components/nuevo/PanelAplicaciones"
import { PanelCerebro } from "@/components/nuevo/PanelCerebro"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr"
import { EscenaNuevo } from "@/components/nuevo/EscenaNuevo"
import { TotemEnVivo } from "@/components/nuevo/TotemEnVivo"
import { VidaSpline } from "@/components/nuevo/VidaSpline"

/**
 * DASHBOARD NUEVO · SPRINT 3 (31-oct): el departamento de marketing se «proyecta» sobre la escena principal, sin cambiar de página a la vista.
 * 5.7: la escena se va a la esquina inferior izquierda como miniatura (reducida un 70 %, al 30 % de su tamaño) y translúcida.
 * 5.8: el interior (marketing-2) SALE DE ADENTRO de la plataforma en la que se hizo clic (se mide dónde está en pantalla y crece desde ahí · ~650 ms),
 * ocupa casi todo el escenario y pasa a ser la imagen principal; al volver se mete otra vez en la plataforma.
 * Volver: Esc, el control «Escena» o clic fuera → animación inversa. La dirección sí cambia (/nuevo/marketing) para que atrás y los enlaces funcionen.
 * 6.9 (Emilio, 1-nov): el CEREBRO es la otra estructura de la sala principal: el monolito del centro abre el explorador del Cerebro encima de la escena
 * (dirección /nuevo/cerebro, atrás y adelante funcionan), con su propio selector de cliente porque aquí no hay departamento que lo enfoque.
 * 6.12 (Emilio, 1-nov: «el monolito central va a ser la oficina del humano; al darle clic, igual que el Dept. Marketing, se expande la oficina; una imagen con el mismo
 * estilo pero que parezca un centro de comando, una nave espacial moderna con pantallas, sencillo y sofisticado»): el monolito proyecta TU OFICINA (/nuevo/oficina) con la
 * MISMA mecánica que el departamento (crece desde el monolito, miniatura, Esc/atrás). La imagen `oficina-2560.jpg` la hizo el mismo generador que las otras dos
 * (edición con la escena y el departamento como referencias de estilo · 1-nov · US$ 0,26 por 2 candidatas). El Cerebro no se pierde: es el arco de pantallas
 * de tu oficina (`PANTALLAS`): se enciende al pasar el ratón y el clic abre el explorador encima (sin cambiar la dirección, como el Centro de campaña en marketing).
 */
// 5.8 · medido con sonda (31-oct): con 650 ms y curva muy «ease-out» la imagen ya tenía el 65 % de su tamaño a los 100 ms y arrancaba invisible (opacidad 0):
// se leía como «montar la imagen encima». Ahora arranca visible sobre la plataforma y crece parejo, más lento.
// 5.11 (Emilio: «no debería aparecer instantáneamente… ir paulatinamente agrandando y dando visibilidad a la imagen, efecto de aparición de acuerdo al momentum»):
// UN solo movimiento continuo desde la plataforma: la oficina crece y se hace visible A LA VEZ, arrancando lento y tomando impulso (curva con salida suave);
// la opacidad sube de a poco a lo largo del crecimiento (no hay fase de «aparece quieta»). La escena arranca apenas después (RETARDO_ESCENA_MS) para que
// el crecimiento se lea primero desde la plataforma. (5.9 tenía dos tiempos: aparecía quieta y luego crecía; se leía como aparición instantánea.)
const MS_ENTRADA = 1700
// 5.13 (Emilio: «al regresar, el dpto. de marketing se va arriba a la derecha en vez de regresar a su destino natural»): la salida dura lo mismo que la vuelta de la
// escena (1,2 s) y se calcula CUADRO A CUADRO hacia donde la plataforma ESTÁ en ese instante (la escena viene creciendo desde la esquina), así la oficina
// acompaña a su plataforma y las dos llegan juntas a su sitio natural. Antes la escena recién volvía cuando la oficina ya había desaparecido, y la oficina se
// encogía hacia el sitio final fijo (arriba a la derecha), donde la plataforma aún no estaba.
const MS_SALIDA = 1200
export const RETARDO_ESCENA_MS = 200

// Cambiar la dirección SIN avisarle al enrutador de Next (si no, la transición de rutas reiniciaría la página y se perdería la animación).
// Con estado nulo, Next ignora el «atrás» y lo atendemos nosotros (popstate).
const cambiarDireccion = (url: string) => History.prototype.pushState.call(window.history, null, "", url)

/** 5.6/5.7 (Emilio, 31-oct): al abrir el departamento, la escena principal se va a la ESQUINA INFERIOR IZQUIERDA como miniatura,
 *  reducida UN 70 % (queda al 30 % de su tamaño) y translúcida, sin desenfoque, para no hacer ruido sobre la imagen del departamento que pasa a ser la principal. */
export const ESCALA_FONDO_ABIERTO = 0.3
export const OPACIDAD_FONDO_ABIERTO = 0.35

/** 5.8 · la imagen del departamento abierta: casi todo el escenario (los márgenes negros de la propia foto pueden salirse de la ventana) */
export const ANCHO_MARKETING_ABIERTO = "min(120vw, calc((100dvh - 4rem) * 16 / 9))"
/** dentro de marketing-2560.jpg la sala ocupa x 270-2230 de 2560 y y 0-1165 de 1440 (medido 31-oct): su ancho y su centro, en fracción de la imagen */
export const SALA_EN_LA_FOTO = { ancho: 0.766, cx: 0.488, cy: 0.405 }
/** 6.12 · dentro de oficina-2560.jpg el centro de comando (losa + satélites) ocupa x 120-2445 de 2560 y y 0-1167 de 1440 (medido 1-nov) */
export const SALA_EN_LA_OFICINA = { ancho: 0.908, cx: 0.501, cy: 0.405 }
/** 5.8 · los bordes de las fotos se funden con el negro de la página: solo un degradado corto arriba y abajo (el centro no se toca) */
export const FUNDIDO_BORDES = "linear-gradient(to bottom,transparent 0,#000 8%,#000 92%,transparent 100%)"
/** 5.9 · mientras la oficina aparece chica sobre su plataforma, se ve SOLO la sala en un óvalo suave (sin los márgenes negros de la foto, que dibujaban un rectángulo
 *  sobre el piso gris); la foto completa (con el fundido de arriba/abajo) se funde encima cuando ya creció. Dos copias de la misma imagen: A (óvalo) y B (completa). */
/** 5.10 · la foto grande lleva un HUECO suave en su esquina inferior izquierda (ahí solo tiene margen negro) para que la miniatura de la escena, que queda
 *  debajo, se vea todo el tiempo mientras se encoge y se atenúa: sin cambios de capa ni saltos. El hueco se calcula en píxeles sobre la miniatura real
 *  y va en la CAPA fija (coordenadas de ventana), no en la foto, para que no se mueva ni se encoja con ella mientras crece. */
/** 5.12 · el hueco es apenas mayor que la miniatura y se cierra de a poco desde el 55 %: la franja exterior de la miniatura queda cubierta por la propia foto
 *  (su margen oscuro), así que sus bordes rectos no se ven; las plataformas (el 70 % central) quedan en la zona limpia. */
export const HOLGURA_HUECO = { x: 1.12, y: 1.15, nitido: 0.55 }
export const ovaloDeLaSala = (sala: { cx: number; cy: number }, rx = 40, ry = 46) => `radial-gradient(ellipse ${rx}% ${ry}% at ${sala.cx * 100}% ${sala.cy * 100}%,#000 55%,transparent 100%)`
export const OVALO_SALA = ovaloDeLaSala(SALA_EN_LA_FOTO)

/** 6.12 · lo que se proyecta sobre la escena: el departamento de marketing (desde su plataforma) o tu oficina (desde el monolito). Misma mecánica, otra foto y otro encaje. */
export type ClaveDeDepartamento = "marketing" | "oficina"
export interface Departamento { clave: ClaveDeDepartamento; url: string; nombre: string; alt: string; src: string; src1280: string; sala: { ancho: number; cx: number; cy: number }; ovalo: string }
export const DEPARTAMENTOS: Record<ClaveDeDepartamento, Departamento> = {
  marketing: { clave: "marketing", url: "/nuevo/marketing", nombre: "Dept. Marketing", alt: "El interior del departamento de marketing", src: "/nuevo/marketing-2560.jpg", src1280: "/nuevo/marketing-1280.jpg", sala: SALA_EN_LA_FOTO, ovalo: OVALO_SALA },
  oficina: { clave: "oficina", url: "/nuevo/oficina", nombre: "Tu oficina", alt: "Tu oficina: el centro de comando", src: "/nuevo/oficina-2560.jpg", src1280: "/nuevo/oficina-1280.jpg", sala: SALA_EN_LA_OFICINA, ovalo: ovaloDeLaSala(SALA_EN_LA_OFICINA, 46, 48) },
}
export const departamentoDeLaRuta = (ruta: string): ClaveDeDepartamento | null => (ruta.startsWith("/nuevo/marketing") ? "marketing" : ruta.startsWith("/nuevo/oficina") ? "oficina" : null)

const ESTILO = `
.nv-fondo{transition:opacity 1.1s ease,transform 1.2s cubic-bezier(.55,0,.15,1);transform-origin:0% 100%}
.nv-fondo[data-atenuado="true"]{opacity:${OPACIDAD_FONDO_ABIERTO};transform:scale(${ESCALA_FONDO_ABIERTO});pointer-events:none;position:relative;transition-delay:${RETARDO_ESCENA_MS}ms}
.nv-fondo[data-atenuado="true"][data-resaltada="true"]{opacity:.6;transition:opacity .3s ease}
.nv-volver{background:transparent;border:0;padding:0;cursor:pointer}
.nv-capa{-webkit-mask-image:var(--nv-hueco,none);mask-image:var(--nv-hueco,none)}
.nv-proy{transform-origin:0 0;will-change:transform,opacity;-webkit-mask-image:${FUNDIDO_BORDES};mask-image:${FUNDIDO_BORDES}}
.nv-proy[data-fase="entra"]{animation:nvEntra ${MS_ENTRADA}ms cubic-bezier(.55,0,.15,1) both}
.nv-proy[data-fase="sale"]{animation:nvSale ${MS_SALIDA}ms linear both}
.nv-foto-a{-webkit-mask-image:var(--nv-ovalo);mask-image:var(--nv-ovalo)}
.nv-proy[data-fase="entra"] .nv-foto-b{animation:nvFotoBEntra ${MS_ENTRADA}ms linear both}
.nv-proy[data-fase="sale"] .nv-foto-b{animation:nvFotoBSale ${MS_SALIDA}ms linear both}
@keyframes nvFotoBEntra{from{opacity:0}50%{opacity:0}to{opacity:1}}
@keyframes nvFotoBSale{from{opacity:1}35%{opacity:0}to{opacity:0}}
.nv-tablero-luz{opacity:0;transition:opacity .45s ease}
.nv-proy:has(.nv-tablero:hover) .nv-tablero-luz,.nv-proy:has(.nv-tablero:focus-visible) .nv-tablero-luz{opacity:1}
.nv-tablero{cursor:pointer;outline:none}
.nv-tablero polygon{fill:rgba(255,140,40,0);stroke:none}
.nv-tablero .nv-rotulo{opacity:0;transform:translateY(5px);transition:opacity .45s ease,transform .45s ease;pointer-events:none}
.nv-tablero:hover .nv-rotulo,.nv-tablero:focus-visible .nv-rotulo{opacity:1;transform:translateY(0)}
.nv-pantallas{cursor:pointer;outline:none}
.nv-pantallas polygon{fill:rgba(255,140,40,0);stroke:none}
.nv-pantallas polygon.nv-luz{fill:url(#nv-luz-oficina);opacity:0;mix-blend-mode:screen;pointer-events:none;transition:opacity .45s ease}
.nv-pantallas:hover polygon.nv-luz,.nv-pantallas:focus-visible polygon.nv-luz{opacity:1}
.nv-pantallas .nv-rotulo{opacity:0;transform:translateY(5px);transition:opacity .45s ease,transform .45s ease;pointer-events:none}
.nv-pantallas:hover .nv-rotulo,.nv-pantallas:focus-visible .nv-rotulo{opacity:1;transform:translateY(0)}
.nv-barrido{position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,transparent 42%,rgba(255,170,60,.22) 50%,transparent 58%);background-size:260% 100%;opacity:0}
.nv-proy[data-fase="entra"] .nv-barrido{animation:nvBarrido 800ms ease-out ${RETARDO_ESCENA_MS + 500}ms both}
@keyframes nvEntra{from{opacity:0;transform:translate(var(--nv-x,0px),var(--nv-y,0px)) scale(var(--nv-s,.3))}20%{opacity:.35}55%{opacity:.85}to{opacity:1;transform:none}}
@keyframes nvSale{from{opacity:1}to{opacity:0}}
@keyframes nvBarrido{0%{opacity:.9;background-position:130% 0}100%{opacity:0;background-position:-30% 0}}
@media (max-width:700px){
  .nv-fondo{transition:opacity .4s ease}
  @keyframes nvEntra{from{opacity:0}to{opacity:1}}
  .nv-barrido{display:none}
}
@media (prefers-reduced-motion:reduce){
  .nv-fondo{transition:none}
  .nv-proy[data-fase="entra"]{animation:nvAparece .15s linear both}
  .nv-proy[data-fase="sale"]{animation:nvDesaparece .15s linear both}
  .nv-proy[data-fase="entra"] .nv-barrido{animation:none}
  .nv-proy[data-fase="entra"] .nv-foto-b,.nv-proy[data-fase="sale"] .nv-foto-b{animation:none}
  .nv-tablero-luz,.nv-tablero .nv-rotulo,.nv-pantallas polygon.nv-luz,.nv-pantallas .nv-rotulo{transition:none}
  @keyframes nvAparece{from{opacity:0}to{opacity:1}}
  @keyframes nvDesaparece{from{opacity:1}to{opacity:0}}
}
`

/** 5.14 (Emilio, 31-oct): dentro de la oficina, el tablero de pantallas del fondo es el CENTRO DE CAMPAÑA (6.9, Emilio 1-nov: «pizarrón de piezas no le hace
 *  justicia a la función» · encargo 01-nov: «Centro de campaña»): la pantalla de inicio de todo lo que marketing tiene del cliente, en el orden de la cadena: al pasar el ratón se encienden sus pantallas
 *  (recorte con alfa hecho de los propios píxeles grises de las baldosas de la foto · sin generador · `marketing-tablero-encendido.webp`) y aparece el rótulo
 *  encima, con las mismas letras que «DEPT. MARKETING». Coordenadas en píxeles de la foto (2560×1440). Uso propuesto: el tablero de producción de la oficina
 *  (cada pantalla = una pieza de la semana con su estado: en producción · en revisión · para tu aprobación · publicada). */
export const TABLERO = {
  clave: "tablero",
  nombre: "Centro de campaña",
  rotulo: { x: 977, y: 250, texto: "CENTRO DE CAMPAÑA" },
  forma: "856,392 1098,286 1098,450 856,548", // la cara del tablero (zona del ratón)
  encendido: { src: "/nuevo/marketing-tablero-encendido.webp", caja: { x: 820, y: 250, w: 320, h: 340 } },
}
/** 6.12 · dentro de TU OFICINA, el arco de pantallas es el CEREBRO: al pasar el ratón se enciende suave (luz recortada a su cara, como las plataformas de la sala) y aparece
 *  su rótulo con las letras de la marca; el clic abre el explorador del Cerebro encima (con selector de cliente). Píxeles de la foto 2560×1440 (medido 1-nov: el arco va de
 *  x 900 a 1680 y de y 246 a 480). Sin recorte encendido del generador: la luz es la misma de la sala principal (gradiente + desenfoque, costo US$ 0). */
export const PANTALLAS = {
  clave: "cerebro",
  nombre: "Cerebro",
  rotulo: { x: 1290, y: 214, texto: "CEREBRO" },
  forma: "900,350 1000,290 1140,258 1290,246 1440,254 1580,284 1680,340 1680,470 1580,440 1440,410 1290,400 1140,408 1000,440 900,480",
}
const FOTO_MKT = { w: 2560, h: 1440 } // las dos fotos proyectadas miden lo mismo
const pct = (n: number, total: number) => `${((n / total) * 100).toFixed(4)}%`
const TAM_ROTULO_TABLERO = 32 // la foto se muestra al 58 % y la escena al 71 %: 32 px aquí ≈ 26 px allá en pantalla

type Fase = "cerrado" | "entra" | "abierto" | "sale"
type Caja = { x: number; y: number; w: number; h: number }

/** dónde está la plataforma del departamento (o el monolito de tu oficina) en la pantalla ahora mismo (la zona del ratón del SVG) */
const cajaDeLaPlataforma = (clave: ClaveDeDepartamento = "marketing"): Caja | null => {
  const el = document.querySelector(`.nv-zona[data-zona="${clave}"] polygon`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 ? { x: r.x, y: r.y, w: r.width, h: r.height } : null
}

/** 5.10 · el hueco de la foto grande: dónde va a quedar la miniatura (la escena encogida a ESCALA_FONDO_ABIERTO desde la esquina inferior izquierda de su marco),
 *  en coordenadas de la capa fija, con holgura; se usa como máscara de la capa (lo de adentro del óvalo queda transparente) */
export const cajaDeLaMiniatura = (marco: Caja, escena: { w: number; h: number }, escala = ESCALA_FONDO_ABIERTO): Caja => {
  const ex = marco.x + (marco.w - escena.w) / 2, ey = marco.y + (marco.h - escena.h) / 2 // la escena centrada en su marco, sin transformar
  return { x: marco.x + (ex - marco.x) * escala, y: marco.y + marco.h - (marco.y + marco.h - ey) * escala, w: escena.w * escala, h: escena.h * escala }
}
export const huecoParaLaMiniatura = (marco: Caja, escena: { w: number; h: number }, final: Caja, escala = ESCALA_FONDO_ABIERTO) => {
  const mini = cajaDeLaMiniatura(marco, escena, escala)
  const cx = mini.x + mini.w / 2 - final.x, cy = mini.y + mini.h / 2 - final.y
  const rx = (mini.w / 2) * HOLGURA_HUECO.x, ry = (mini.h / 2) * HOLGURA_HUECO.y
  return `radial-gradient(ellipse ${rx.toFixed(1)}px ${ry.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px,transparent ${Math.round(HOLGURA_HUECO.nitido * 100)}%,#000 100%)`
}

/** 5.8 · la transformación con la que la imagen abierta (en su sitio final) coincide con la plataforma: la sala de la foto, centrada en la plataforma y de su ancho */
export const transformacionDesdeLaPlataforma = (plataforma: Caja, final: Caja, sala = SALA_EN_LA_FOTO) => {
  const s = plataforma.w / (final.w * sala.ancho)
  const x = plataforma.x + plataforma.w / 2 - (final.x + s * final.w * sala.cx)
  const y = plataforma.y + plataforma.h / 2 - (final.y + s * final.h * sala.cy)
  return { x, y, s }
}

/** 5.13 · la curva de la escena (cubic-bezier(.55,0,.15,1)) resuelta en JS, para que la oficina y la escena se muevan con el mismo impulso */
export const suavizado = (p: number, x1 = 0.55, y1 = 0, x2 = 0.15, y2 = 1) => {
  if (p <= 0) return 0
  if (p >= 1) return 1
  const bez = (t: number, a: number, b: number) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t
  let lo = 0, hi = 1, t = p
  for (let i = 0; i < 24; i++) { // bisección sobre x(t) = p
    const x = bez(t, x1, x2)
    if (Math.abs(x - p) < 1e-5) break
    if (x < p) lo = t; else hi = t
    t = (lo + hi) / 2
  }
  return bez(t, y1, y2)
}
/** 5.13 · la oficina se mantiene visible mientras vuelve a su plataforma y recién se apaga al llegar (último 10 %) */
export const opacidadDeSalida = (p: number) => (p >= 1 ? 0 : p < 0.55 ? 1 : p < 0.9 ? 1 - ((p - 0.55) / 0.35) * 0.25 : Math.max(0, 0.75 * (1 - (p - 0.9) / 0.1)))
const sinMovimiento = () => typeof window !== "undefined" && (window.matchMedia("(prefers-reduced-motion:reduce)").matches || window.matchMedia("(max-width:700px)").matches)

/** `inicial`: `true` (= marketing, compatibilidad) o la clave del departamento ya proyectado (entrada directa a /nuevo/marketing o /nuevo/oficina) */
export function EscenaViva({ inicial = false, cerebroInicial = false }: { inicial?: boolean | ClaveDeDepartamento; cerebroInicial?: boolean }) {
  const [fase, setFase] = useState<Fase>(inicial ? "abierto" : "cerrado")
  const [depto, setDepto] = useState<ClaveDeDepartamento>(inicial === true || !inicial ? "marketing" : inicial) // 6.12 · cuál se proyecta
  const d = DEPARTAMENTOS[depto]
  // 6.9 · el Cerebro abierto sobre la sala principal (sale al <body>, como las aplicaciones); `montado` porque el portal no existe en el servidor
  const [cerebro, setCerebro] = useState(cerebroInicial)
  // 6.12 · si el Cerebro se abrió con su propia dirección (/nuevo/cerebro: desde la sala o entrada directa) o encima de tu oficina sin tocar la dirección
  const cerebroConUrl = useRef(cerebroInicial)
  const [montado, setMontado] = useState(false)
  useEffect(() => { setMontado(true) }, [])
  const [pizarron, setPizarron] = useState(false) // sprint 6 · el pizarrón abierto encima de la oficina (6.2: la pantalla de aplicaciones; el calendario se abre desde ahí)
  const tablero = useRef<SVGGElement>(null)
  const cerrarPizarron = useCallback(() => { setPizarron(false); requestAnimationFrame(() => tablero.current?.focus()) }, [])
  const [sobreLaMiniatura, setSobreLaMiniatura] = useState(false) // 5.12 · la miniatura se aclara un poco al pasar el ratón: avisa que es clicable
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proy = useRef<HTMLDivElement>(null)
  const origen = useRef<Caja | null>(null)

  const abrir = useCallback((clave: ClaveDeDepartamento = "marketing", cambiarUrl = true) => {
    origen.current = cajaDeLaPlataforma(clave) // antes de que la escena empiece a irse a la esquina
    setDepto(clave)
    if (cambiarUrl) cambiarDireccion(DEPARTAMENTOS[clave].url)
    setFase("entra")
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setFase("abierto"), MS_ENTRADA)
  }, [])
  const cerrar = useCallback((cambiarUrl = true) => {
    if (cambiarUrl) cambiarDireccion("/nuevo")
    setFase("sale")
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setFase("cerrado"), MS_SALIDA)
  }, [])
  const abrirCerebro = useCallback((cambiarUrl = true, conUrl = true) => { cerebroConUrl.current = conUrl; if (cambiarUrl) cambiarDireccion("/nuevo/cerebro"); setCerebro(true) }, [])
  const cerrarCerebro = useCallback((cambiarUrl = true) => { if (cambiarUrl && cerebroConUrl.current) cambiarDireccion("/nuevo"); setCerebro(false) }, [])

  // 5.8 · antes de pintar la entrada o la salida, se fija desde dónde sale (o hacia dónde vuelve) la imagen: la plataforma, medida en pantalla
  useLayoutEffect(() => {
    if (fase === "cerrado") return
    const el = proy.current
    if (!el) return
    const padre = el.offsetParent as HTMLElement | null
    const base = padre ? padre.getBoundingClientRect() : { x: 0, y: 0 }
    const final = { x: base.x + el.offsetLeft, y: base.y + el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } // medidas de maqueta: sin la animación
    if (final.w === 0) return
    // 5.10 · el hueco para la miniatura (también al entrar directo a /nuevo/marketing, ya abierta)
    const fondo = document.querySelector<HTMLElement>(".nv-fondo"); const escena = fondo?.querySelector<HTMLElement>(".nv-escena")
    if (fondo && escena && fondo.offsetParent) {
      const m = fondo.offsetParent.getBoundingClientRect()
      const marco = { x: m.x + fondo.offsetLeft, y: m.y + fondo.offsetTop, w: fondo.offsetWidth, h: fondo.offsetHeight }
      const capa = el.parentElement as HTMLElement; const c = capa.getBoundingClientRect()
      capa.style.setProperty("--nv-hueco", huecoParaLaMiniatura(marco, { w: escena.offsetWidth, h: escena.offsetHeight }, { x: c.x, y: c.y, w: c.width, h: c.height }))
      // 5.12 · dónde queda la miniatura, para el botón invisible que la hace clicable (vuelve a la sala principal)
      const mini = cajaDeLaMiniatura(marco, { w: escena.offsetWidth, h: escena.offsetHeight })
      capa.style.setProperty("--nv-mini-x", `${(mini.x - c.x).toFixed(1)}px`); capa.style.setProperty("--nv-mini-y", `${(mini.y - c.y).toFixed(1)}px`)
      capa.style.setProperty("--nv-mini-w", `${mini.w.toFixed(1)}px`); capa.style.setProperty("--nv-mini-h", `${mini.h.toFixed(1)}px`)
    }
    const sala = DEPARTAMENTOS[depto].sala
    if (fase === "entra") {
      const plataforma = origen.current ?? cajaDeLaPlataforma(depto)
      if (!plataforma) return
      const t = transformacionDesdeLaPlataforma(plataforma, final, sala)
      el.style.setProperty("--nv-x", `${t.x.toFixed(1)}px`)
      el.style.setProperty("--nv-y", `${t.y.toFixed(1)}px`)
      el.style.setProperty("--nv-s", t.s.toFixed(4))
      return
    }
    if (fase !== "sale" || sinMovimiento()) return // sin movimiento: queda el fundido de la hoja de estilo
    // 5.13 · cuadro a cuadro hacia donde la plataforma ESTÁ ahora (la escena viene volviendo de la esquina): la oficina acompaña a su plataforma hasta su sitio
    el.style.animation = "none"
    const inicio = performance.now()
    let cuadro = 0
    const paso = (ahora: number) => {
      const p = Math.min(1, (ahora - inicio) / MS_SALIDA), e = suavizado(p)
      const plataforma = cajaDeLaPlataforma(depto)
      if (plataforma) {
        const t = transformacionDesdeLaPlataforma(plataforma, final, sala)
        el.style.transform = `translate(${(e * t.x).toFixed(1)}px,${(e * t.y).toFixed(1)}px) scale(${(1 + e * (t.s - 1)).toFixed(4)})`
      }
      el.style.opacity = opacidadDeSalida(p).toFixed(3)
      if (p < 1) cuadro = requestAnimationFrame(paso)
    }
    cuadro = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(cuadro)
  }, [fase, depto])

  const abierta = fase !== "cerrado" && fase !== "sale"
  // Esc cierra; el «atrás» y «adelante» del navegador abren o cierran según la dirección
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape" && abierta) cerrar() }
    const alVolver = () => {
      const ruta = departamentoDeLaRuta(window.location.pathname) // 6.12 · marketing u oficina (o ninguno)
      if (ruta && (!abierta || ruta !== depto)) abrir(ruta, false)
      else if (!ruta && abierta) cerrar(false)
      const enCerebro = window.location.pathname.startsWith("/nuevo/cerebro")
      if (enCerebro && !cerebro) abrirCerebro(false)
      else if (!enCerebro && cerebro) cerrarCerebro(false)
    }
    window.addEventListener("keydown", alTeclear)
    window.addEventListener("popstate", alVolver)
    return () => { window.removeEventListener("keydown", alTeclear); window.removeEventListener("popstate", alVolver) }
  }, [abierta, abrir, cerrar, cerebro, abrirCerebro, cerrarCerebro, depto])
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current) }, [])

  return (
    <>
      <style>{ESTILO}</style>
      {/* la escena principal: miniatura translúcida en la esquina inferior izquierda mientras el departamento está proyectado */}
      {/* la escena principal SIEMPRE debajo de la foto del departamento (una sola transición continua hasta la esquina); la foto la deja ver por su hueco (5.10) */}
      <div className="nv-fondo flex h-full w-full items-center justify-center" data-atenuado={fase === "entra" || fase === "abierto"} data-resaltada={fase === "abierto" && sobreLaMiniatura} aria-hidden={fase !== "cerrado"} inert={fase !== "cerrado"}>
        <EscenaNuevo alAbrirMarketing={() => abrir("marketing")} alAbrirOficina={() => abrir("oficina")} fondo={<VidaSpline />}><TotemEnVivo /></EscenaNuevo>
      </div>
      {fase !== "cerrado" && (
        <div className="nv-capa fixed inset-0 z-[5] flex items-center justify-center" onClick={() => abierta && cerrar()}>
          {/* 5.12 · la miniatura es clicable: un botón invisible justo encima de ella (medido en el mismo efecto que el hueco) vuelve a la sala principal */}
          {fase === "abierto" && (
            <button type="button" className="nv-volver fixed z-[6] rounded-lg focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8731a]"
              style={{ left: "var(--nv-mini-x)", top: "var(--nv-mini-y)", width: "var(--nv-mini-w)", height: "var(--nv-mini-h)" }}
              aria-label="Volver a la sala principal" title="Volver a la sala principal"
              onMouseEnter={() => setSobreLaMiniatura(true)} onMouseLeave={() => setSobreLaMiniatura(false)}
              onClick={(e) => { e.stopPropagation(); setSobreLaMiniatura(false); cerrar() }} />
          )}
          <div ref={proy} className="nv-proy relative aspect-video shrink-0" data-fase={fase === "sale" ? "sale" : fase === "entra" ? "entra" : "abierto"} data-departamento={depto}
            style={{ width: ANCHO_MARKETING_ABIERTO, "--nv-ovalo": d.ovalo } as CSSProperties} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.src} srcSet={`${d.src1280} 1280w, ${d.src} 2560w`} sizes="(max-width: 900px) 100vw, 1800px"
              alt="" aria-hidden width={2560} height={1440} decoding="async" className="nv-foto-a absolute inset-0 h-full w-full select-none" draggable={false} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.src} srcSet={`${d.src1280} 1280w, ${d.src} 2560w`} sizes="(max-width: 900px) 100vw, 1800px"
              alt={d.alt} width={2560} height={1440} decoding="async" className="nv-foto-b absolute inset-0 h-full w-full select-none" draggable={false} />
            {/* 6.12 · dentro de TU OFICINA: el arco de pantallas es el Cerebro (luz suave + rótulo al pasar el ratón; el clic abre el explorador encima sin cambiar la dirección) */}
            {depto === "oficina" && (
              <svg viewBox={`0 0 ${FOTO_MKT.w} ${FOTO_MKT.h}`} className="absolute inset-0 h-full w-full" role="group" aria-label="Zonas de tu oficina" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <radialGradient id="nv-luz-oficina" cx="50%" cy="50%" r="62%">
                    <stop offset="0%" stopColor="rgba(255,178,86,0.55)" /><stop offset="55%" stopColor="rgba(255,152,52,0.3)" /><stop offset="100%" stopColor="rgba(255,140,40,0.08)" />
                  </radialGradient>
                  <filter id="nv-luz-suave-oficina" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9" /></filter>
                  <clipPath id="nv-sup-pantallas"><polygon points={PANTALLAS.forma} /></clipPath>
                </defs>
                <g className="nv-pantallas" data-zona={PANTALLAS.clave} role="button" tabIndex={0} aria-label={PANTALLAS.nombre} aria-haspopup="dialog" aria-expanded={cerebro}
                  onClick={(e) => { e.stopPropagation(); abrirCerebro(false, false) }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirCerebro(false, false) } }}>
                  <polygon points={PANTALLAS.forma} />
                  <g clipPath="url(#nv-sup-pantallas)"><polygon className="nv-luz" points={PANTALLAS.forma} filter="url(#nv-luz-suave-oficina)" /></g>
                  <text className="nv-rotulo" x={PANTALLAS.rotulo.x} y={PANTALLAS.rotulo.y} textAnchor="middle" fill="none" stroke="#e8731a" strokeWidth={TAM_ROTULO_TABLERO * 0.9 / 16}
                    fontSize={TAM_ROTULO_TABLERO} fontWeight="500" letterSpacing={TAM_ROTULO_TABLERO * 3.4 / 16} fontFamily="system-ui, Arial, sans-serif">{PANTALLAS.rotulo.texto}</text>
                </g>
              </svg>
            )}
            {depto === "marketing" && (<>
            {/* 5.14 · el pizarrón de piezas: pantallas encendidas + rótulo al pasar el ratón (igual que la plataforma en la sala principal) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={TABLERO.encendido.src} alt="" aria-hidden data-encendido={TABLERO.clave} decoding="async" draggable={false}
              className="nv-tablero-luz pointer-events-none absolute select-none"
              style={{ left: pct(TABLERO.encendido.caja.x, FOTO_MKT.w), top: pct(TABLERO.encendido.caja.y, FOTO_MKT.h), width: pct(TABLERO.encendido.caja.w, FOTO_MKT.w), height: pct(TABLERO.encendido.caja.h, FOTO_MKT.h) }} />
            <svg viewBox={`0 0 ${FOTO_MKT.w} ${FOTO_MKT.h}`} className="absolute inset-0 h-full w-full" role="group" aria-label="Zonas de la oficina de marketing" xmlns="http://www.w3.org/2000/svg">
              <g ref={tablero} className="nv-tablero" data-zona={TABLERO.clave} role="button" tabIndex={0} aria-label={TABLERO.nombre} aria-haspopup="dialog" aria-expanded={pizarron}
                onClick={(e) => { e.stopPropagation(); setPizarron(true) }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPizarron(true) } }}>
                <polygon points={TABLERO.forma} />
                <text className="nv-rotulo" x={TABLERO.rotulo.x} y={TABLERO.rotulo.y} textAnchor="middle" fill="none" stroke="#e8731a" strokeWidth={TAM_ROTULO_TABLERO * 0.9 / 16}
                  fontSize={TAM_ROTULO_TABLERO} fontWeight="500" letterSpacing={TAM_ROTULO_TABLERO * 3.4 / 16} fontFamily="system-ui, Arial, sans-serif">{TABLERO.rotulo.texto}</text>
              </g>
            </svg>
            </>)}
            <div className="nv-barrido" />
          </div>
        </div>
      )}
      {/* sprint 6 · el pizarrón sale al <body> (como «En vivo»): la oficina lleva máscaras que lo desvanecerían */}
      {pizarron && fase !== "cerrado" && createPortal(<PanelAplicaciones onCerrar={cerrarPizarron} />, document.body)}
      {/* 6.9 · el Cerebro sobre la sala principal: con selector de cliente (aquí no hay departamento que lo enfoque) */}
      {cerebro && montado && createPortal(<PanelCerebro onCerrar={() => cerrarCerebro()} elegirCliente />, document.body)}
      {fase !== "cerrado" && (
        <button type="button" onClick={() => cerrar()} aria-label="Volver a la escena (Esc)"
          className="fixed left-4 top-16 z-10 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] tracking-wide text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8731a] sm:left-5">
          <ArrowLeft size={13} /> Escena
        </button>
      )}
    </>
  )
}
