"use client"

import type { CSSProperties } from "react"
import type { MetricasDelPizarron } from "@/lib/escena-metricas"

/**
 * LAS REDES DEL PIZARRÓN, COMO BOTONES DE VERDAD (CC4 · 03-nov · encargo de Lenovo, auditoría n.º 16): los cuadros dibujados DENTRO de la foto miden unos pocos píxeles
 * (8×12 en un panel de 668 px), así que aquí van de nuevo como una franja de botones HTML de al menos 44×44 en la zona vacía de arriba del pizarrón (sin taparlo):
 * «General», las 7 redes y la vitrina, de macro a micro, cada uno con su nombre y su estado; tocar abre el mismo panel que el cuadro de la foto.
 */
export const LADO_MINIMO_DEL_BOTON = 44

export interface BotonDeLaFranja { clave: string; nombre: string; sigla: string; estado: string; tiene: boolean }

/** los botones de la franja: los cuadros del pizarrón (General + las 7 redes, todos siempre) y al final la vitrina (su estado es fijo: el título de la pieza ya lo muestra su pantalla); el estado es lo que dice cada cuadro («métricas pronto», el dato o «sin cuenta todavía») */
export function botonesDeLaFranja(metricas: MetricasDelPizarron | undefined): BotonDeLaFranja[] {
  const cuadros = (metricas?.cuadros ?? []).map((c) => ({ clave: c.clave as string, nombre: c.nombre, sigla: c.sigla, estado: c.principal ? `${c.principal}${c.variacion ? ` · ${c.variacion}` : ""}` : c.texto, tiene: c.tiene }))
  return [...cuadros, { clave: "vitrina", nombre: "Vitrina", sigla: "VIT", estado: "mejores piezas", tiene: true }]
}

export function FranjaDeLasRedes({ botones, onAbrir, className = "", style }: { botones: BotonDeLaFranja[]; onAbrir: (clave: string) => void; className?: string; style?: CSSProperties }) {
  if (!botones.length) return null
  return (
    <div data-franja-de-redes role="group" aria-label="Las redes de métricas" style={style} className={`pointer-events-auto flex flex-wrap items-stretch justify-center gap-1 ${className}`}>
      {botones.map((b) => (
        <button key={b.clave} type="button" data-red={b.clave} data-tiene={b.tiene} onClick={() => onAbrir(b.clave)} aria-label={`${b.nombre}: ${b.estado}`} title={`${b.nombre}: ${b.estado}`}
          style={{ minWidth: LADO_MINIMO_DEL_BOTON, minHeight: LADO_MINIMO_DEL_BOTON }}
          className={`flex flex-col items-center justify-center rounded-lg border px-1 text-center leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${b.tiene ? "border-amber-400/50 bg-black/70 text-amber-200 hover:bg-amber-400/20" : "border-white/15 bg-black/55 text-zinc-500 hover:bg-white/10"}`}>
          <span className="text-[12px] font-semibold tracking-wide">{b.sigla}</span>
          <span className="max-w-[4.5rem] truncate text-[9px] leading-none opacity-80">{b.estado}</span>
        </button>
      ))}
    </div>
  )
}

/** 04-nov (Emilio 11:29Z: «no sé qué son y no me gustan ahí»): la franja de redes NO se muestra hasta nuevo aviso. El código queda: para volver, true */
export const MOSTRAR_LA_FRANJA_DE_REDES = false
