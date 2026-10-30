"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr"
import { EscenaNuevo, ORIGEN_MARKETING } from "@/components/nuevo/EscenaNuevo"
import { TotemEnVivo } from "@/components/nuevo/TotemEnVivo"

/**
 * DASHBOARD NUEVO · SPRINT 3 (31-oct): el departamento de marketing se «proyecta» sobre la escena principal, sin cambiar de página a la vista.
 * La escena se atenúa y se desenfoca al fondo; el interior (marketing-2) entra desde la plataforma con un leve zoom + fundido + un barrido ámbar fino (~650 ms).
 * Volver: Esc, el control «Escena» o clic fuera → animación inversa. La dirección sí cambia (/nuevo/marketing) para que atrás y los enlaces funcionen.
 */
const MS_ENTRADA = 650
const MS_SALIDA = 450

// Cambiar la dirección SIN avisarle al enrutador de Next (si no, la transición de rutas reiniciaría la página y se perdería la animación).
// Con estado nulo, Next ignora el «atrás» y lo atendemos nosotros (popstate).
const cambiarDireccion = (url: string) => History.prototype.pushState.call(window.history, null, "", url)

const ESTILO = `
.nv-fondo{transition:opacity .6s ease,filter .6s ease}
.nv-fondo[data-atenuado="true"]{opacity:.2;filter:blur(6px);pointer-events:none}
.nv-proy{transform-origin:${ORIGEN_MARKETING.x.toFixed(1)}% ${ORIGEN_MARKETING.y.toFixed(1)}%;will-change:transform,opacity}
.nv-proy[data-fase="entra"]{animation:nvEntra ${MS_ENTRADA}ms cubic-bezier(.2,.8,.2,1) both}
.nv-proy[data-fase="sale"]{animation:nvSale ${MS_SALIDA}ms cubic-bezier(.4,0,.8,.4) both}
.nv-barrido{position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,transparent 42%,rgba(255,170,60,.5) 50%,transparent 58%);background-size:260% 100%;opacity:0}
.nv-proy[data-fase="entra"] .nv-barrido{animation:nvBarrido ${MS_ENTRADA + 150}ms ease-out both}
@keyframes nvEntra{from{opacity:0;transform:scale(.55);filter:brightness(1.8)}60%{opacity:1}to{opacity:1;transform:scale(1);filter:brightness(1)}}
@keyframes nvSale{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.55)}}
@keyframes nvBarrido{0%{opacity:.9;background-position:130% 0}100%{opacity:0;background-position:-30% 0}}
@media (max-width:700px){
  .nv-fondo{transition:opacity .4s ease;filter:none!important}
  @keyframes nvEntra{from{opacity:0}to{opacity:1}}
  @keyframes nvSale{from{opacity:1}to{opacity:0}}
  .nv-barrido{display:none}
}
@media (prefers-reduced-motion:reduce){
  .nv-fondo{transition:none}
  .nv-proy[data-fase="entra"]{animation:nvAparece .15s linear both}
  .nv-proy[data-fase="sale"]{animation:nvDesaparece .15s linear both}
  .nv-proy[data-fase="entra"] .nv-barrido{animation:none}
  @keyframes nvAparece{from{opacity:0}to{opacity:1}}
  @keyframes nvDesaparece{from{opacity:1}to{opacity:0}}
}
`

type Fase = "cerrado" | "entra" | "abierto" | "sale"

export function EscenaViva({ inicial = false }: { inicial?: boolean }) {
  const [fase, setFase] = useState<Fase>(inicial ? "abierto" : "cerrado")
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const abrir = useCallback((cambiarUrl = true) => {
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
      {/* la escena principal: queda detrás en tercer plano mientras el departamento está proyectado */}
      <div className="nv-fondo flex h-full w-full items-center justify-center" data-atenuado={fase !== "cerrado"} aria-hidden={fase !== "cerrado"} inert={fase !== "cerrado"}>
        <EscenaNuevo alAbrirMarketing={() => abrir()}><TotemEnVivo /></EscenaNuevo>
      </div>
      {fase !== "cerrado" && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center px-4 sm:px-16" onClick={() => abierta && cerrar()}>
          <div className="nv-proy relative mx-auto aspect-video" data-fase={fase === "sale" ? "sale" : fase === "entra" ? "entra" : "abierto"}
            style={{
              width: "min(100%, 76vw, calc((100dvh - 15rem) * 16 / 9))",
              WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 55%, transparent 100%)", maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 55%, transparent 100%)",
            }} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nuevo/marketing-2560.jpg" srcSet="/nuevo/marketing-1280.jpg 1280w, /nuevo/marketing-2560.jpg 2560w" sizes="(max-width: 900px) 100vw, 1400px"
              alt="El interior del departamento de marketing" width={2560} height={1440} decoding="async" className="absolute inset-0 h-full w-full select-none" draggable={false} />
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
