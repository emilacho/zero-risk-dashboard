"use client"

import { useEffect, useRef } from "react"
import { HologramaBusto } from "@/components/nuevo/escena/Holograma"
import { FORMA_LEGIBLE, MINIMO_DE_TAREAS, type Rendimiento } from "@/lib/rendimiento"

/**
 * LA FICHA DE RENDIMIENTO (CC6 · 02-nov · boceto aprobado por Emilio): se abre al TOCAR la flecha de forma del empleado. Sus 10 dimensiones en el orden del diseño,
 * con lo que no tiene dato dicho como «sin dato todavía». Informa: no bloquea ni decide nada sobre el empleado.
 */
export function FichaDeRendimiento({ r, nombre, color, onCerrar }: { r: Rendimiento; nombre: string; color: string; onCerrar: () => void }) {
  const cerrar = useRef<HTMLButtonElement>(null)
  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])
  const f = r.forma ? FORMA_LEGIBLE[r.forma] : null
  return (
    <div className="nv-panel fixed inset-0 z-[76] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" data-ficha-de-rendimiento={r.agente} onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="rendimiento-titulo" className="relative flex max-h-full w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-amber-400/40 bg-[#141210] text-zinc-200 shadow-2xl">
        <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/[0.07]">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        </button>
        <div className="min-h-0 overflow-y-auto p-5">
          <header className="flex items-center gap-4">
            <HologramaBusto semilla={r.agente} color={color} tam={84} />
            <div className="min-w-0">
              <h2 id="rendimiento-titulo" className="text-[19px] font-semibold text-zinc-50">{nombre}</h2>
              <p className="text-[12.5px] text-amber-300">Rendimiento · sus últimas {r.revisadas} entregas revisadas</p>
              {f ? <p data-forma={r.forma} className="mt-0.5 text-[13px]" style={{ color: f.color }}><span className="mr-1 text-[16px]">{`${f.flecha}︎`}</span>{f.texto}{r.puntaje != null && r.puntaje_previo != null ? <span className="text-zinc-500"> · {r.puntaje} frente a {r.puntaje_previo} de las {r.previas} anteriores</span> : null}</p>
                : <p className="mt-0.5 text-[12.5px] text-zinc-500">{r.motivo_sin_flecha ?? "sin flecha"}{r.revisadas < MINIMO_DE_TAREAS ? ` (tiene ${r.revisadas}; hacen falta ${MINIMO_DE_TAREAS})` : ""}</p>}
              <p className="text-[11px] text-zinc-500">Informa; no bloquea ni decide nada sobre el empleado.</p>
            </div>
          </header>
          <ol className="mt-4 grid gap-1.5" aria-label="Las diez dimensiones">
            {r.dimensiones.map((d) => (
              <li key={d.n} data-dimension={d.n} className={`grid grid-cols-[22px_minmax(0,11rem)_1fr] items-baseline gap-2 rounded-lg border border-white/[0.06] px-2.5 py-1.5 ${d.n === 1 ? "bg-amber-400/[0.08]" : "bg-white/[0.02]"}`}>
                <span className="text-[11px] text-zinc-500">{d.n}</span>
                <span className="text-[12.5px] text-zinc-200">{d.nombre}</span>
                <span className="min-w-0">
                  <span className={`text-[13px] font-semibold ${d.valor ? "text-amber-100" : "italic text-zinc-500"}`}>{d.valor ?? "sin dato todavía"}</span>
                  <span className="block text-[11px] leading-snug text-zinc-400">{d.detalle}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  )
}
