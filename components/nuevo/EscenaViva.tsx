"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
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
 */
// 5.8 · medido con sonda (31-oct): con 650 ms y curva muy «ease-out» la imagen ya tenía el 65 % de su tamaño a los 100 ms y arrancaba invisible (opacidad 0):
// se leía como «montar la imagen encima». Ahora arranca visible sobre la plataforma y crece parejo, más lento.
// 5.9 (Emilio: «no se ve que la oficina se agranda desde su imagen»): DOS tiempos. Primero la oficina APARECE sobre su plataforma con la escena
// quieta (fundido · hasta FRACCION_APARECE); recién después crece hasta su sitio mientras la escena se va a la esquina (la escena espera RETARDO_ESCENA_MS).
const MS_ENTRADA = 1500
const MS_SALIDA = 950
export const FRACCION_APARECE = 0.3
export const RETARDO_ESCENA_MS = Math.round(MS_ENTRADA * FRACCION_APARECE)

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
/** 5.8 · los bordes de las fotos se funden con el negro de la página: solo un degradado corto arriba y abajo (el centro no se toca) */
export const FUNDIDO_BORDES = "linear-gradient(to bottom,transparent 0,#000 8%,#000 92%,transparent 100%)"
/** 5.9 · mientras la oficina aparece chica sobre su plataforma, se ve SOLO la sala en un óvalo suave (sin los márgenes negros de la foto, que dibujaban un rectángulo
 *  sobre el piso gris); la foto completa (con el fundido de arriba/abajo) se funde encima cuando ya creció. Dos copias de la misma imagen: A (óvalo) y B (completa). */
/** 5.10 · la foto grande lleva un HUECO suave en su esquina inferior izquierda (ahí solo tiene margen negro) para que la miniatura de la escena, que queda
 *  debajo, se vea todo el tiempo mientras se encoge y se atenúa: sin cambios de capa ni saltos. El hueco se calcula en píxeles sobre la miniatura real
 *  y va en la CAPA fija (coordenadas de ventana), no en la foto, para que no se mueva ni se encoja con ella mientras crece. */
export const HOLGURA_HUECO = { x: 1.45, y: 1.6, nitido: 0.72 }
export const OVALO_SALA = `radial-gradient(ellipse 40% 46% at ${SALA_EN_LA_FOTO.cx * 100}% ${SALA_EN_LA_FOTO.cy * 100}%,#000 55%,transparent 100%)`

const ESTILO = `
.nv-fondo{transition:opacity .6s ease,transform .6s cubic-bezier(.2,.8,.2,1);transform-origin:0% 100%}
.nv-fondo[data-atenuado="true"]{opacity:${OPACIDAD_FONDO_ABIERTO};transform:scale(${ESCALA_FONDO_ABIERTO});pointer-events:none;position:relative;transition-delay:${RETARDO_ESCENA_MS}ms}
.nv-capa{-webkit-mask-image:var(--nv-hueco,none);mask-image:var(--nv-hueco,none)}
.nv-proy{transform-origin:0 0;will-change:transform,opacity;-webkit-mask-image:${FUNDIDO_BORDES};mask-image:${FUNDIDO_BORDES}}
.nv-proy[data-fase="entra"]{animation:nvEntra ${MS_ENTRADA}ms cubic-bezier(.5,.05,.2,1) both}
.nv-proy[data-fase="sale"]{animation:nvSale ${MS_SALIDA}ms cubic-bezier(.55,0,.6,.6) both}
.nv-foto-a{-webkit-mask-image:${OVALO_SALA};mask-image:${OVALO_SALA}}
.nv-proy[data-fase="entra"] .nv-foto-b{animation:nvFotoBEntra ${MS_ENTRADA}ms linear both}
.nv-proy[data-fase="sale"] .nv-foto-b{animation:nvFotoBSale ${MS_SALIDA}ms linear both}
@keyframes nvFotoBEntra{from{opacity:0}45%{opacity:0}to{opacity:1}}
@keyframes nvFotoBSale{from{opacity:1}35%{opacity:0}to{opacity:0}}
.nv-barrido{position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,transparent 42%,rgba(255,170,60,.22) 50%,transparent 58%);background-size:260% 100%;opacity:0}
.nv-proy[data-fase="entra"] .nv-barrido{animation:nvBarrido 800ms ease-out ${RETARDO_ESCENA_MS + 150}ms both}
@keyframes nvEntra{from{opacity:0;transform:translate(var(--nv-x,0px),var(--nv-y,0px)) scale(var(--nv-s,.3))}${Math.round(FRACCION_APARECE * 100)}%{opacity:1;transform:translate(var(--nv-x,0px),var(--nv-y,0px)) scale(var(--nv-s,.3))}to{opacity:1;transform:none}}
@keyframes nvSale{from{opacity:1;transform:none}${100 - Math.round(FRACCION_APARECE * 100)}%{opacity:1;transform:translate(var(--nv-x,0px),var(--nv-y,0px)) scale(var(--nv-s,.3))}to{opacity:0;transform:translate(var(--nv-x,0px),var(--nv-y,0px)) scale(var(--nv-s,.3))}}
@keyframes nvBarrido{0%{opacity:.9;background-position:130% 0}100%{opacity:0;background-position:-30% 0}}
@media (max-width:700px){
  .nv-fondo{transition:opacity .4s ease}
  @keyframes nvEntra{from{opacity:0}to{opacity:1}}
  @keyframes nvSale{from{opacity:1}to{opacity:0}}
  .nv-barrido{display:none}
}
@media (prefers-reduced-motion:reduce){
  .nv-fondo{transition:none}
  .nv-proy[data-fase="entra"]{animation:nvAparece .15s linear both}
  .nv-proy[data-fase="sale"]{animation:nvDesaparece .15s linear both}
  .nv-proy[data-fase="entra"] .nv-barrido{animation:none}
  .nv-proy[data-fase="entra"] .nv-foto-b,.nv-proy[data-fase="sale"] .nv-foto-b{animation:none}
  @keyframes nvAparece{from{opacity:0}to{opacity:1}}
  @keyframes nvDesaparece{from{opacity:1}to{opacity:0}}
}
`

type Fase = "cerrado" | "entra" | "abierto" | "sale"
type Caja = { x: number; y: number; w: number; h: number }

/** dónde está la plataforma de marketing en la pantalla ahora mismo (la zona del ratón del SVG) */
const cajaDeLaPlataforma = (): Caja | null => {
  const el = document.querySelector('.nv-zona[data-zona="marketing"] polygon')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 ? { x: r.x, y: r.y, w: r.width, h: r.height } : null
}

/** 5.10 · el hueco de la foto grande: dónde va a quedar la miniatura (la escena encogida a ESCALA_FONDO_ABIERTO desde la esquina inferior izquierda de su marco),
 *  en coordenadas de la capa fija, con holgura; se usa como máscara de la capa (lo de adentro del óvalo queda transparente) */
export const huecoParaLaMiniatura = (marco: Caja, escena: { w: number; h: number }, final: Caja, escala = ESCALA_FONDO_ABIERTO) => {
  const ex = marco.x + (marco.w - escena.w) / 2, ey = marco.y + (marco.h - escena.h) / 2 // la escena centrada en su marco, sin transformar
  const mini = { x: marco.x + (ex - marco.x) * escala, y: marco.y + marco.h - (marco.y + marco.h - ey) * escala, w: escena.w * escala, h: escena.h * escala }
  const cx = mini.x + mini.w / 2 - final.x, cy = mini.y + mini.h / 2 - final.y
  const rx = (mini.w / 2) * HOLGURA_HUECO.x, ry = (mini.h / 2) * HOLGURA_HUECO.y
  return `radial-gradient(ellipse ${rx.toFixed(1)}px ${ry.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px,transparent ${Math.round(HOLGURA_HUECO.nitido * 100)}%,#000 100%)`
}

/** 5.8 · la transformación con la que la imagen abierta (en su sitio final) coincide con la plataforma: la sala de la foto, centrada en la plataforma y de su ancho */
export const transformacionDesdeLaPlataforma = (plataforma: Caja, final: Caja) => {
  const s = plataforma.w / (final.w * SALA_EN_LA_FOTO.ancho)
  const x = plataforma.x + plataforma.w / 2 - (final.x + s * final.w * SALA_EN_LA_FOTO.cx)
  const y = plataforma.y + plataforma.h / 2 - (final.y + s * final.h * SALA_EN_LA_FOTO.cy)
  return { x, y, s }
}

export function EscenaViva({ inicial = false }: { inicial?: boolean }) {
  const [fase, setFase] = useState<Fase>(inicial ? "abierto" : "cerrado")
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proy = useRef<HTMLDivElement>(null)
  const origen = useRef<Caja | null>(null)

  const abrir = useCallback((cambiarUrl = true) => {
    origen.current = cajaDeLaPlataforma() // antes de que la escena empiece a irse a la esquina
    if (cambiarUrl) cambiarDireccion("/nuevo/marketing")
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
    }
    if (fase !== "entra" && fase !== "sale") return
    const plataforma = origen.current ?? cajaDeLaPlataforma()
    if (!plataforma) return
    const t = transformacionDesdeLaPlataforma(plataforma, final)
    el.style.setProperty("--nv-x", `${t.x.toFixed(1)}px`)
    el.style.setProperty("--nv-y", `${t.y.toFixed(1)}px`)
    el.style.setProperty("--nv-s", t.s.toFixed(4))
  }, [fase])

  const abierta = fase !== "cerrado" && fase !== "sale"
  // Esc cierra; el «atrás» y «adelante» del navegador abren o cierran según la dirección
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape" && abierta) cerrar() }
    const alVolver = () => {
      const enMarketing = window.location.pathname.startsWith("/nuevo/marketing")
      if (enMarketing && !abierta) abrir(false)
      else if (!enMarketing && abierta) cerrar(false)
    }
    window.addEventListener("keydown", alTeclear)
    window.addEventListener("popstate", alVolver)
    return () => { window.removeEventListener("keydown", alTeclear); window.removeEventListener("popstate", alVolver) }
  }, [abierta, abrir, cerrar])
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current) }, [])

  return (
    <>
      <style>{ESTILO}</style>
      {/* la escena principal: miniatura translúcida en la esquina inferior izquierda mientras el departamento está proyectado */}
      {/* la escena principal SIEMPRE debajo de la foto del departamento (una sola transición continua hasta la esquina); la foto la deja ver por su hueco (5.10) */}
      <div className="nv-fondo flex h-full w-full items-center justify-center" data-atenuado={fase !== "cerrado"} aria-hidden={fase !== "cerrado"} inert={fase !== "cerrado"}>
        <EscenaNuevo alAbrirMarketing={() => abrir()} fondo={<VidaSpline />}><TotemEnVivo /></EscenaNuevo>
      </div>
      {fase !== "cerrado" && (
        <div className="nv-capa fixed inset-0 z-[5] flex items-center justify-center" onClick={() => abierta && cerrar()}>
          <div ref={proy} className="nv-proy relative aspect-video shrink-0" data-fase={fase === "sale" ? "sale" : fase === "entra" ? "entra" : "abierto"}
            style={{ width: ANCHO_MARKETING_ABIERTO }} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nuevo/marketing-2560.jpg" srcSet="/nuevo/marketing-1280.jpg 1280w, /nuevo/marketing-2560.jpg 2560w" sizes="(max-width: 900px) 100vw, 1800px"
              alt="" aria-hidden width={2560} height={1440} decoding="async" className="nv-foto-a absolute inset-0 h-full w-full select-none" draggable={false} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nuevo/marketing-2560.jpg" srcSet="/nuevo/marketing-1280.jpg 1280w, /nuevo/marketing-2560.jpg 2560w" sizes="(max-width: 900px) 100vw, 1800px"
              alt="El interior del departamento de marketing" width={2560} height={1440} decoding="async" className="nv-foto-b absolute inset-0 h-full w-full select-none" draggable={false} />
            <div className="nv-barrido" />
          </div>
        </div>
      )}
      {fase !== "cerrado" && (
        <button type="button" onClick={() => cerrar()} aria-label="Volver a la escena (Esc)"
          className="fixed left-4 top-16 z-10 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] tracking-wide text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8731a] sm:left-5">
          <ArrowLeft size={13} /> Escena
        </button>
      )}
    </>
  )
}
