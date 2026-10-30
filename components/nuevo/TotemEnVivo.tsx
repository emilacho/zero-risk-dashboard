"use client"

import { useCallback, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { PanelEnVivo } from "@/components/nuevo/PanelEnVivo"

/** la pantalla suelta de pie (abajo al centro de la escena), en las mismas coordenadas de la imagen que ZONAS de EscenaNuevo */
export const TOTEM = { clave: "en-vivo", nombre: "En vivo", forma: "1068,642 1116,642 1116,736 1068,736" } as const
const VISTA = { x: 150, y: 40, w: 1700, h: 920 } // el recorte de la escena (ver VISTA en EscenaNuevo)

const ESTILO = `
.nv-totem{cursor:pointer;outline:none}
.nv-totem polygon{fill:rgba(255,140,40,0);stroke:rgba(255,160,50,0);stroke-width:2.5;stroke-linejoin:round;transition:fill .2s ease,stroke .2s ease}
.nv-totem:hover polygon,.nv-totem:focus-visible polygon{fill:rgba(255,140,40,.16);stroke:rgba(255,170,60,.95)}
.nv-totem:hover,.nv-totem:focus-visible{filter:drop-shadow(0 0 10px rgba(255,140,40,.6))}
@media (prefers-reduced-motion:reduce){.nv-totem polygon{transition:none}}
`

/**
 * DASHBOARD NUEVO · SPRINT 2: el tótem abre la vista «En vivo» DENTRO de /nuevo (una capa a pantalla casi completa, cerrable, sin salir de la escena).
 * La capa se saca al <body> porque la escena lleva una viñeta (máscara) que la desvanecería.
 */
export function TotemEnVivo() {
  const [abierto, setAbierto] = useState(false)
  const origen = useRef<SVGGElement>(null)
  const cerrar = useCallback(() => { setAbierto(false); requestAnimationFrame(() => origen.current?.focus()) }, [])
  const abrir = () => setAbierto(true)
  return (
    <>
      <svg viewBox={`${VISTA.x} ${VISTA.y} ${VISTA.w} ${VISTA.h}`} className="pointer-events-none absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <style>{ESTILO}</style>
        <g
          ref={origen} className="nv-totem pointer-events-auto" role="button" tabIndex={0} aria-label={TOTEM.nombre} aria-haspopup="dialog" aria-expanded={abierto}
          onClick={abrir} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir() } }}
        >
          <polygon points={TOTEM.forma} />
        </g>
      </svg>
      {abierto && createPortal(<PanelEnVivo onCerrar={cerrar} />, document.body)}
    </>
  )
}
