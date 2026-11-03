"use client"

import { useState } from "react"
import { HORA_24 } from "@/lib/formato"
import { bloquesDelTexto, type RevisionDelEditor } from "@/lib/revisiones-del-manual"
import { botonesDeRevision } from "@/lib/revisiones"
import { cuerpoDeResolucion } from "@/lib/plan"

type Accion = (nombre: string, cuerpo: Record<string, unknown>) => Promise<{ ok: boolean; texto: string }>
const usd = (v: number) => `US$ ${v.toFixed(2).replace(".", ",")}`
const fecha = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("es-EC", { day: "numeric", month: "short", ...HORA_24, timeZone: "America/Guayaquil" }) }

/**
 * UNA REVISIÓN DEL EDITOR DENTRO DE SU SECCIÓN DEL MANUAL (CC6 · 02-nov · auditoría, punto 3): el texto con formato y en español, lo que costó producirlo
 * (regla del costo en la tarjeta) y la decisión de siempre («Dar por revisada» · «Devolver al equipo», la misma acción que tenía en Piezas).
 */
export function TarjetaDeRevisionDelEditor({ r, accion, onHecho }: { r: RevisionDelEditor; accion: Accion; onHecho?: (texto: string) => void }) {
  const b = botonesDeRevision("editor_escalation")
  const [abierta, setAbierta] = useState(false)
  const [devolver, setDevolver] = useState(false)
  const [comentario, setComentario] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bloques = bloquesDelTexto(r.texto)
  async function decidir(d: "aprobar" | "rechazar") {
    const c = cuerpoDeResolucion(r.id, d, comentario)
    if ("error" in c) { setError(c.error); return }
    setEnviando(true); setError(null)
    const res = await accion("revision-resolver", c)
    setEnviando(false)
    if (!res.ok) { setError(res.texto); return }
    onHecho?.(d === "aprobar" ? "Revisión dada por revisada." : "Revisión devuelta al equipo.")
  }
  return (
    <article data-revision-del-editor={r.id} className="mt-3 rounded-lg border border-violet-400/40 bg-violet-500/[0.05] p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 data-titulo-revision className="text-[13.5px] font-medium text-violet-200">Lo revisó <span aria-hidden>👤</span> Editor en Jefe: esto cambió y por qué{fecha(r.creada) ? <span className="ml-2 text-[11.5px] font-normal text-zinc-400">{fecha(r.creada)}</span> : null}</h4>
        <span data-costo className="text-[12px] text-zinc-300">{r.costo_usd != null ? `costó ${usd(r.costo_usd)}` : "costo sin dato registrado"}</span>
      </div>
      {r.pista && <p className="mt-1 text-[12px] text-zinc-400">{r.pista}</p>}
      <div className={`mt-2 space-y-1 text-[13px] leading-relaxed text-zinc-200 ${abierta ? "" : "max-h-40 overflow-hidden"}`}>
        {bloques.map((x, i) => {
          const contenido = x.trozos.map((t, j) => (t.negrita ? <strong key={j} className="font-semibold text-zinc-50">{t.texto}</strong> : <span key={j}>{t.texto}</span>))
          return x.tipo === "vineta" ? <p key={i} className="pl-4 -indent-3">• {contenido}</p> : <p key={i}>{contenido}</p>
        })}
      </div>
      {bloques.length > 4 && <button type="button" onClick={() => setAbierta((v) => !v)} className="mt-1 text-[12.5px] text-violet-200 underline decoration-dotted underline-offset-4 hover:text-violet-100">{abierta ? "Ver menos" : "Leer todo"}</button>}
      {error && <p role="alert" className="mt-2 text-[12.5px] text-rose-300">{error}</p>}
      {!devolver ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" data-accion="revision-aprobar" disabled={enviando} onClick={() => void decidir("aprobar")} className="rounded-md border border-violet-300/60 bg-violet-500/70 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-violet-500 disabled:opacity-50">{enviando ? "Enviando…" : `✓ ${b.aprobar}`}</button>
          <button type="button" data-accion="revision-rechazar" disabled={enviando} onClick={() => setDevolver(true)} className="rounded-md border border-violet-300/50 px-4 py-1.5 text-[13px] text-violet-100 hover:bg-violet-500/15 disabled:opacity-50">✗ {b.rechazar}…</button>
        </div>
      ) : (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); void decidir("rechazar") }}>
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} aria-label="Qué debe cambiar" placeholder="Qué debe cambiar (mínimo 5 letras)" className="w-full rounded-md border border-violet-400/30 bg-black/40 px-2.5 py-2 text-[13px] text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-violet-300" />
          <div className="flex gap-2">
            <button type="submit" data-accion="confirmar-revision-rechazar" disabled={enviando} className="rounded-md border border-violet-300/60 bg-violet-500/70 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-violet-500 disabled:opacity-50">{enviando ? "Enviando…" : `✗ ${b.rechazar}`}</button>
            <button type="button" onClick={() => setDevolver(false)} className="rounded-md border border-white/10 px-3 py-1.5 text-[12.5px] text-zinc-400">Cancelar</button>
          </div>
        </form>
      )}
    </article>
  )
}
