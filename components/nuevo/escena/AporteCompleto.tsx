"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { AporteCompleto as Aporte } from "@/lib/escena-aporte-datos"
import type { ParticipanteDeLaSala } from "@/lib/escena-sala"
import { usoLegible } from "@/components/nuevo/escena/SalaDeReuniones"

type Respuesta = ({ ok: true } & Aporte) | { ok: false; error: string }

/** el texto del aporte, legible: párrafos y viñetas (también cuando la base lo guardó en una sola línea: « - **» abre viñeta), negritas, sin «---» ni «#».
 *  No cambia ni recorta lo que dice. */
export type Bloque = { vineta: boolean; titulo: boolean; partes: Array<{ negrita: boolean; t: string }> }
export function bloquesDelTexto(texto: string): Bloque[] {
  const lineas = texto.replace(/\r/g, "").replace(/\s+-{3,}\s+/g, "\n").replace(/ - (?=\*\*)/g, "\n- ").split(/\n+/)
  return lineas.map((l) => l.trim()).filter((l) => l && !/^-{3,}$/.test(l)).map((l) => {
    const titulo = /^#{1,4}\s/.test(l), vineta = /^[-•*]\s/.test(l)
    const cuerpo = l.replace(/^#{1,4}\s+/, "").replace(/^[-•*]\s+/, "")
    const partes = cuerpo.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((t) => (/^\*\*[^*]+\*\*$/.test(t) ? { negrita: true, t: t.slice(2, -2) } : { negrita: false, t }))
    return { vineta, titulo, partes }
  })
}

/**
 * S4 · EL APORTE COMPLETO (CC6): al tocar el avatar de un participante de la sala, su aporte entero (el informe del cerebro, el plan guardado o, si no hay otra
 * cosa, lo que la base guardó recortado: se dice). Encima, qué pasó con él al cerrar y por qué. Solo LECTURA. Lleva `nv-panel`: el chat de abajo sigue visible.
 */
export function AporteCompleto({ p, onCerrar, onFicha, datosIniciales = null }: { p: ParticipanteDeLaSala; onCerrar: () => void; onFicha: () => void; datosIniciales?: Aporte | null }) {
  const [aporte, setAporte] = useState<Aporte | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const cerrar = useRef<HTMLButtonElement>(null)
  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])
  useEffect(() => {
    if (datosIniciales) return
    if (!p.corrida) { setError(p.estado === "hablando" ? "Todavía está preparando su aporte: aparece cuando termine." : "No hay corrida registrada para este aporte."); return }
    let vivo = true
    void (async () => {
      try {
        const r = await fetch(`/api/escena-viva/aporte?corrida=${encodeURIComponent(p.corrida!)}&agente=${encodeURIComponent(p.agente)}`, { cache: "no-store" })
        const j = (await r.json().catch(() => null)) as Respuesta | null
        if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador." : r.status === 404 ? (p.estado === "hablando" ? "Todavía está preparando su aporte: aparece cuando termine." : "Su aporte no está guardado en la base.") : (j && !j.ok && j.error) || `No pude leer el aporte (${r.status}).`)
        if (vivo) setAporte(j)
      } catch (e) { if (vivo) setError(e instanceof Error ? e.message : String(e)) }
    })()
    return () => { vivo = false }
  }, [p.corrida, p.agente, p.estado, datosIniciales])

  const cuerpo = (
    <div data-aporte-completo={p.agente} className="nv-panel fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onCerrar() }}>
      <section role="dialog" aria-modal="true" aria-label={`Aporte de ${p.nombre}`} className="relative flex max-h-full w-full max-w-[820px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161412] text-zinc-200 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[.18em] text-zinc-500">Aporte en la sala · {p.fase}</div>
            <h2 className="text-[17px] font-semibold text-amber-100">{p.nombre}{p.cabecera ? " · dirige" : ""}</h2>
            <p className="text-[12px] text-zinc-400">{p.equipo}{p.aporte ? ` · ${usoLegible(p.aporte.uso)}: ${p.aporte.motivo}` : ""}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={onFicha} className="rounded-md px-2 py-1 text-[12px] text-zinc-300 underline decoration-white/20 decoration-dotted underline-offset-4 hover:text-amber-100">ver su ficha</button>
            <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </button>
          </div>
        </header>
        <div className="min-h-0 overflow-y-auto px-5 py-4">
          {error && <p role="alert" className="text-[13px] text-rose-300">{error}</p>}
          {!aporte && !error && <p className="text-[13px] text-zinc-500">Leyendo el aporte…</p>}
          {aporte && (
            <>
              {aporte.titulo && <h3 className="mb-2 text-[14px] font-semibold text-zinc-100">{aporte.titulo}</h3>}
              {aporte.texto ? (
                <div data-texto-del-aporte className="space-y-1.5 text-[13px] leading-[1.6] text-zinc-200">
                  {bloquesDelTexto(aporte.texto).map((b, i) => {
                    const contenido = b.partes.map((x, k) => (x.negrita ? <b key={k} className="font-semibold text-zinc-50">{x.t}</b> : <span key={k}>{x.t}</span>))
                    return b.titulo ? <h4 key={i} className="pt-2 text-[14px] font-semibold text-amber-100">{contenido}</h4>
                      : b.vineta ? <p key={i} className="relative pl-4"><span aria-hidden className="absolute left-0 text-amber-300/70">•</span>{contenido}</p>
                      : <p key={i}>{contenido}</p>
                  })}
                </div>
              ) : <p className="text-zinc-500">Sin texto guardado.</p>}
              {aporte.recortado && <p className="mt-3 text-[12px] text-amber-200/80">La base guarda este aporte recortado a 2.000 caracteres; no hay una copia entera.</p>}
              <p className="mt-4 text-[10px] text-zinc-600">fuente · {aporte.fuente}{aporte.creado_en ? ` · ${aporte.creado_en.slice(0, 16).replace("T", " ")}Z` : ""}</p>
            </>
          )}
        </div>
      </section>
    </div>
  )
  return typeof document === "undefined" ? cuerpo : createPortal(cuerpo, document.body)
}
