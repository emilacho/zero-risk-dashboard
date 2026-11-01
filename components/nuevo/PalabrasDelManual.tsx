"use client"

import { useState } from "react"
import { agruparPalabras, decisionesPara, decisionLegible, fuenteLegible, type DecisionSobreLaPalabra, type PalabraDelManual } from "@/lib/manual-palabras"

/**
 * TABLERO DEL DUEÑO · LAS PALABRAS DEL MANUAL (CC6 · 01-nov · encargo del equipo del manual firmado por Emilio, §1). Dentro del manual de marca de /nuevo.
 * Tres filas de fichas: prohibidas por una norma · prohibidas por el dueño · estilo de la marca. Al tocar una ficha aparecen sus decisiones (prohibirla,
 * dejarla como estilo o quitarla); cada decisión se confirma, con un porqué opcional. Al final, un campo para prohibir una palabra nueva.
 * Cada decisión pasa por la puerta del tablero (`manual-palabra`): la plataforma crea una versión nueva del manual (la anterior queda) y el campo queda como
 * del dueño, así una corrida no le devuelve lo que quitó. No llama a ningún modelo.
 */
type Resultado = { ok: true; texto: string; detalle: Record<string, unknown> } | { ok: false; texto: string }
type Accion = (nombre: string, cuerpo: Record<string, unknown>) => Promise<Resultado>

const TONO: Record<PalabraDelManual["intencion"], string> = {
  legal: "border-rose-400/40 bg-rose-400/[0.08] text-rose-100",
  del_dueno: "border-amber-400/45 bg-amber-400/[0.08] text-amber-100",
  estilo: "border-white/15 bg-white/[0.03] text-zinc-200",
}
const confirmacion = (texto: string, d: DecisionSobreLaPalabra) =>
  d === "prohibir" ? `Prohibir «${texto}»: ninguna pieza la usará.` : d === "contexto" ? `«${texto}» queda como estilo: ya no frena piezas.` : `Quitar «${texto}» del manual.`

export function PalabrasDelManual({ palabras, cliente, accion, onGuardado, elegidaInicial = null }: {
  palabras: PalabraDelManual[]; cliente: string | null; accion: Accion; onGuardado: (r: Resultado) => void
  /** solo pruebas y el arnés: abrir con esta palabra tocada */ elegidaInicial?: string | null
}) {
  const [elegida, setElegida] = useState<string | null>(elegidaInicial)
  const [decision, setDecision] = useState<DecisionSobreLaPalabra | null>(null)
  const [porque, setPorque] = useState("")
  const [nueva, setNueva] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const elegir = (t: string | null) => { setElegida(t); setDecision(null); setPorque(""); setError(null) }
  async function decidir(texto: string, d: DecisionSobreLaPalabra, comentario: string) {
    if (!cliente || enviando) return
    setEnviando(true); setError(null)
    const r = await accion("manual-palabra", { client_id: cliente, texto, decision: d, ...(comentario.trim() ? { comentario: comentario.trim().slice(0, 1000) } : {}) })
    setEnviando(false)
    if (r.ok) { elegir(null); setNueva("") } else setError(r.texto)
    onGuardado(r)
  }

  return (
    <div data-tablero-palabras data-accion="manual-palabra" className="mb-3 space-y-3">
      {agruparPalabras(palabras).map((g) => {
        const p = g.palabras.find((x) => x.texto === elegida) ?? null
        const fuente = p ? fuenteLegible(p) : null
        return (
          <div key={g.intencion} data-grupo={g.intencion}>
            <h4 className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">{g.titulo}</h4>
            <p className="mb-1.5 text-[11px] text-zinc-600">{g.nota}</p>
            {g.palabras.length === 0 ? <p className="text-[12px] italic text-zinc-600">Ninguna.</p> : (
              <ul className="flex flex-wrap gap-1.5">
                {g.palabras.map((x) => (
                  <li key={x.texto} data-palabra={x.texto} data-intencion={x.intencion}>
                    <button type="button" aria-pressed={elegida === x.texto} onClick={() => elegir(elegida === x.texto ? null : x.texto)} title={fuenteLegible(x) ?? "toca para decidir"}
                      className={`rounded-md border px-2 py-0.5 text-[12.5px] transition hover:border-amber-300/70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400 ${TONO[x.intencion]} ${elegida === x.texto ? "ring-1 ring-amber-300/80" : ""}`}>{x.texto}</button>
                  </li>
                ))}
              </ul>
            )}
            {p && (
              <div data-decisiones={p.texto} className="mt-2 rounded-md border border-white/10 bg-black/25 p-2">
                {fuente && <p className="mb-1.5 text-[11.5px] text-zinc-400">{fuente}</p>}
                {!decision ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12px] text-zinc-300">«{p.texto}»:</span>
                    {decisionesPara(p).map((d) => (
                      <button key={d} type="button" data-decidir={d} disabled={!cliente || enviando} onClick={() => setDecision(d)}
                        className="rounded-md border border-white/10 px-2 py-0.5 text-[11.5px] text-zinc-300 transition hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-40">{decisionLegible(d)}</button>
                    ))}
                    <button type="button" onClick={() => elegir(null)} className="ml-auto rounded-md px-2 py-0.5 text-[11.5px] text-zinc-500 hover:text-zinc-200">Cerrar</button>
                  </div>
                ) : (
                  <form data-confirmar={decision} className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void decidir(p.texto, decision, porque) }}>
                    <span className="text-[12px] text-zinc-200">{confirmacion(p.texto, decision)}</span>
                    <input value={porque} onChange={(e) => setPorque(e.target.value)} maxLength={1000} placeholder="Por qué (opcional)" aria-label="Por qué"
                      className="min-w-[12rem] flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[12px] text-zinc-100 outline-none focus:border-amber-400/60" />
                    <button type="submit" disabled={enviando} className="rounded-md bg-amber-500/90 px-2.5 py-1 text-[12px] font-medium text-black hover:bg-amber-400 disabled:opacity-50">{enviando ? "Guardando…" : "Confirmar"}</button>
                    <button type="button" onClick={() => setDecision(null)} className="rounded-md px-2 py-1 text-[12px] text-zinc-400 hover:text-zinc-200">Volver</button>
                  </form>
                )}
              </div>
            )}
          </div>
        )
      })}
      <form data-agregar-palabra className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3" onSubmit={(e) => { e.preventDefault(); if (nueva.trim()) void decidir(nueva.trim(), "prohibir", "") }}>
        <label className="text-[11px] uppercase tracking-[0.08em] text-zinc-500" htmlFor="nv-palabra-nueva">Prohibir otra palabra</label>
        <input id="nv-palabra-nueva" value={nueva} onChange={(e) => setNueva(e.target.value)} maxLength={200} placeholder="la palabra o frase"
          className="min-w-[10rem] flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[12px] text-zinc-100 outline-none focus:border-amber-400/60" />
        <button type="submit" disabled={!cliente || enviando || !nueva.trim()} className="rounded-md border border-amber-400/50 px-2.5 py-1 text-[12px] text-amber-200 hover:bg-amber-400/10 disabled:opacity-40">Prohibir</button>
      </form>
      {error && <p role="alert" className="text-[12px] text-rose-300">{error}</p>}
    </div>
  )
}
