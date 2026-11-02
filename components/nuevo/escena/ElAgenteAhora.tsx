"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { HologramaBusto } from "@/components/nuevo/escena/Holograma"
import { PanelObservabilidad } from "@/components/nuevo/PanelObservabilidad"
import { descripcionDelHolograma } from "@/lib/holograma"
import { nombreCanonico } from "@/lib/organigrama"
import { MESAS, type EscenaDatos, type Sentado } from "@/lib/escena-avatares"
import type { ParticipanteDeLaSala } from "@/lib/escena-sala"
import { haceCuanto } from "@/lib/oficinas"

const AMBAR = "#f5a524"

/** lo que se sabe del empleado tocado, sacado de los datos de la escena (solo lectura, nada nuevo que pedir a la base) */
export interface ElAgenteAhoraDatos {
  agente: string
  nombre: string
  equipo: string | null
  color: string
  /** «en qué está ahora»: null = sin trabajo en curso */
  ahora: { donde: "mesa" | "sala"; cliente: string | null; flujo: string | null; tarea: string | null; paso: string | null; hace: string; fallo: boolean; reunion?: string | null; fase?: string | null } | null
  /** la corrida (ejecución) que se abre en Observabilidad; null = no hay una registrada */
  ejecucion: string | null
  entrega: { titulo: string; hace: string } | null
}

/** junta, de los datos de la escena, lo del empleado tocado: su asiento (o su silla en la sala), su última entrega y su corrida */
export function datosDelAgente(agente: string, d: EscenaDatos | null | undefined, ahora: Date = new Date()): ElAgenteAhoraDatos {
  const k = nombreCanonico(agente)
  const mesas = d?.mesas ?? []
  const asiento: Sentado | undefined = [...mesas.flatMap((m) => m.sentados), ...(d?.sin_mesa ?? [])].find((s) => nombreCanonico(s.agente) === k)
  const reunion = d?.sala?.reunion ?? null
  const p: ParticipanteDeLaSala | undefined = reunion?.participantes.find((x) => nombreCanonico(x.agente) === k)
  const mesaDelAsiento = asiento ? mesas.find((m) => m.clave === asiento.mesa) : mesas.find((m) => m.clave === p?.mesa) ?? mesas.find((m) => m.equipo.some((e) => nombreCanonico(e.agente) === k))
  const e = (d?.entregas?.entregas ?? []).filter((x) => x.agente && nombreCanonico(x.agente) === k).sort((a, b) => (a.cerrado_en < b.cerrado_en ? 1 : -1))[0]
  const color = MESAS.find((m) => m.clave === mesaDelAsiento?.clave)?.color ?? AMBAR
  const base = { agente, nombre: asiento?.nombre ?? p?.nombre ?? e?.nombre ?? agente, equipo: mesaDelAsiento?.nombre ?? p?.equipo ?? null, color, entrega: e ? { titulo: e.titulo, hace: haceCuanto(e.cerrado_en, ahora) } : null }
  if (p && reunion) return { ...base, ahora: { donde: "sala", cliente: reunion.cliente, flujo: reunion.flujo, tarea: null, paso: null, hace: p.hace, fallo: false, reunion: reunion.titulo, fase: p.fase }, ejecucion: reunion.corridas[0] ?? null }
  if (asiento) return { ...base, ahora: { donde: "mesa", cliente: asiento.cliente, flujo: asiento.flujo, tarea: asiento.tarea, paso: asiento.paso, hace: asiento.hace, fallo: asiento.estado === "fallo" }, ejecucion: asiento.ejecucion ?? null }
  return { ...base, ahora: null, ejecucion: null }
}

const Fila = ({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) => (
  <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2"><div className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">{etiqueta}</div><div className="text-[13.5px] text-zinc-100">{children}</div></div>
)

/**
 * AL TOCAR EL CUERPO DE UN EMPLEADO (sprint 4 · CC4 · 03-nov): su tarjeta de «ahora» — en qué está (cliente, tarea, paso, desde cuándo), su última entrega y el enlace a su
 * corrida en Observabilidad. La flecha de forma (CC6) abre la ficha de rendimiento; el currículum completo se abre desde aquí. Dos huecos reservados, sin construir:
 * la barra de rendimiento (métrica por definir con Emilio) y «Preguntarle» (el chat con el agente lo construye CC2). Solo lectura; lleva `nv-panel` (el chat de abajo sigue visible).
 */
export function ElAgenteAhora({ datos, onCerrar, onFicha, onAporte, corridaInicial = false }: { datos: ElAgenteAhoraDatos; onCerrar: () => void; onFicha: () => void; /** solo en la sala: abre su aporte a la reunión */ onAporte?: () => void; /** solo pruebas y el arnés */ corridaInicial?: boolean }) {
  const [corrida, setCorrida] = useState(corridaInicial)
  const cerrar = useRef<HTMLButtonElement>(null)
  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => {
    if (corrida) return
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, corrida])
  const a = datos.ahora
  const cuerpo = (
    <div data-el-agente-ahora={datos.agente} className="nv-panel fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onCerrar() }}>
      <section role="dialog" aria-modal="true" aria-label={`${datos.nombre}: en qué está ahora`} className="relative flex max-h-full w-full max-w-[460px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161412] text-zinc-200 shadow-2xl">
        <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        </button>
        <div className="min-h-0 space-y-3 overflow-y-auto p-5">
          <header className="flex items-center gap-4 pr-8">
            <span title={descripcionDelHolograma(datos.agente)} className="shrink-0"><HologramaBusto semilla={datos.agente} color={datos.color} /></span>
            <div className="min-w-0">
              <h2 className="font-display text-[22px] font-semibold leading-tight text-zinc-50" data-nombre>{datos.nombre}</h2>
              {datos.equipo && <p className="text-[13px]" style={{ color: datos.color }}>{datos.equipo}</p>}
            </div>
          </header>
          <Fila etiqueta="Ahora">
            {!a && <span data-ahora="nada" className="italic text-zinc-400">sin trabajo en curso</span>}
            {a && (
              <div data-ahora={a.donde} className="space-y-0.5">
                {a.donde === "sala" && <p>En la reunión «{a.reunion}»{a.fase ? <span className="text-zinc-400"> · {a.fase}</span> : null}</p>}
                {a.donde === "mesa" && <p>{a.fallo ? "Tuvo un fallo" : "Trabajando"}{a.cliente ? <> para <span className="text-amber-200">{a.cliente}</span></> : null}</p>}
                {a.flujo && <p className="text-[12.5px] text-zinc-400">{a.flujo}</p>}
                {a.tarea && <p data-tarea className="text-[12.5px]">{a.tarea}</p>}
                {a.paso && <p data-paso className="text-[12.5px] text-zinc-400">Paso: {a.paso}</p>}
                <p className="text-[12px] text-zinc-500">{a.hace}</p>
              </div>
            )}
          </Fila>
          <Fila etiqueta="Última entrega">
            {datos.entrega ? <span data-entrega>{datos.entrega.titulo}<span className="text-zinc-500"> · {datos.entrega.hace}</span></span> : <span data-entrega="ninguna" className="italic text-zinc-400">sin entregas en las últimas 24 h</span>}
          </Fila>
          <div className="flex flex-wrap gap-2 text-[12.5px]">
            {datos.ejecucion
              ? <button type="button" data-observabilidad onClick={() => setCorrida(true)} className="rounded-md border border-amber-400/60 px-3 py-1.5 text-amber-200 hover:bg-amber-400/10">Ver su corrida en Observabilidad</button>
              : <span data-observabilidad="sin-corrida" className="rounded-md border border-white/10 px-3 py-1.5 text-zinc-500">Sin corrida registrada</span>}
            <button type="button" data-ficha onClick={onFicha} className="rounded-md border border-white/15 px-3 py-1.5 text-zinc-200 hover:bg-white/[0.07]">Ver su ficha completa</button>
            {onAporte && <button type="button" data-aporte onClick={onAporte} className="rounded-md border border-white/15 px-3 py-1.5 text-zinc-200 hover:bg-white/[0.07]">Ver su aporte a la reunión</button>}
          </div>
          {/* huecos reservados (sin construir): la barra de rendimiento y el chat con el agente */}
          <div className="grid grid-cols-2 gap-2 text-[11.5px] text-zinc-500">
            <div data-reservado="rendimiento" className="rounded-md border border-dashed border-white/10 px-3 py-2">Rendimiento · pronto</div>
            <div data-reservado="preguntarle" aria-disabled className="rounded-md border border-dashed border-white/10 px-3 py-2">Preguntarle · pronto</div>
          </div>
        </div>
      </section>
    </div>
  )
  // la corrida abierta va SOLA (su panel queda debajo de esta tarjeta); al cerrarla se vuelve a la tarjeta
  const salida = corrida && datos.ejecucion ? <PanelObservabilidad onCerrar={() => setCorrida(false)} corridaInicial={datos.ejecucion} /> : cuerpo
  if (typeof document === "undefined") return salida
  return createPortal(salida, document.body)
}
