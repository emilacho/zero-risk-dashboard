"use client"

import { useEffect, useRef, useState } from "react"
import { CUERPO } from "@/components/nuevo/manual/niveles"
import { confirmaConEnter, textoDelRenglon } from "@/lib/renglones-del-manual"

/**
 * UN RENGLÓN DE UN CAMPO CON VIÑETAS, CON «Editar» Y «Retirar» SIEMPRE, UNO AL LADO DEL OTRO (CC2 · 03-nov · corrección de Lenovo 18:12Z, Emilio con captura:
 * «no tiene sentido solo restar info; debe ser posible editar una palabra, un detalle pequeño»).
 *  · «Editar» abre ESE renglón en su lugar, con el texto actual listo para corregir una palabra, y «Listo» / «Cancelar».
 *  · Lo editado es directo: no reescribe ni gasta; el panel lo deja en «Tus cambios» y no manda nada hasta «Pedir los cambios».
 *  · Si el renglón ya fue editado (cambio en espera) y se toca «Retirar», avisa antes: se va con su edición.
 */
export function RenglonEditable({ texto, editado, onEditar, onRetirar }: {
  /** el renglón como se lee (limpio) */
  texto: string
  /** true = este renglón ya tiene una edición en espera (no es el guardado) */
  editado: boolean
  /** el renglón corregido (una sola línea, ya sin saltos) */
  onEditar: (nuevo: string) => void
  onRetirar: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [avisar, setAvisar] = useState(false)
  const [valor, setValor] = useState(texto)
  const [error, setError] = useState<string | null>(null)
  const caja = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (editando) caja.current?.focus() }, [editando])

  const abrir = () => { setValor(texto); setError(null); setAvisar(false); setEditando(true) }
  const listo = () => {
    const t = textoDelRenglon(valor)
    if (!t) { setError("Escribe algo, o usa «Retirar»."); return }
    setEditando(false)
    if (t !== texto) onEditar(t)
  }
  const retirar = () => { if (editado) setAvisar(true); else onRetirar() }

  if (editando) {
    return (
      <form data-editor-renglon className="min-w-0 flex-1 rounded-lg border border-amber-400/30 bg-black/30 p-3" onSubmit={(e) => { e.preventDefault(); listo() }}>
        <textarea ref={caja} value={valor} onChange={(e) => setValor(e.target.value)} rows={2} aria-label={`Editar el renglón «${texto.slice(0, 60)}»`}
          onKeyDown={(e) => { if (confirmaConEnter(e.key, e.shiftKey)) { e.preventDefault(); listo() } }}
          className="w-full resize-y rounded-md border border-white/15 bg-black/40 px-3 py-2 text-[15px] leading-relaxed text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400" />
        {error && <p role="alert" className="mt-2 text-[13px] text-rose-300">{error}</p>}
        <div className="mt-2 flex items-center gap-2">
          <button type="submit" data-accion="listo-renglon" className="rounded-lg border border-amber-400/70 bg-amber-400/15 px-4 py-2 text-[14px] text-amber-50 transition hover:bg-amber-400/25">Listo</button>
          <button type="button" data-accion="cancelar-renglon" onClick={() => setEditando(false)} className="rounded-lg border border-white/10 px-4 py-2 text-[14px] text-zinc-300 hover:bg-white/[0.05]">Cancelar</button>
        </div>
      </form>
    )
  }
  return (
    <>
      <span className={`min-w-0 flex-1 ${CUERPO}`}><span aria-hidden className="mr-2 text-zinc-500">•</span>{texto}</span>
      <span className="flex shrink-0 gap-1.5">
        <button type="button" data-accion="editar-renglon" aria-label={`Editar «${texto.slice(0, 60)}»`} onClick={abrir}
          className="rounded-md border border-white/10 px-2 py-0.5 text-[12px] text-zinc-300 transition hover:border-amber-400/60 hover:text-amber-100">Editar</button>
        <button type="button" data-accion="retirar" aria-label={`Retirar «${texto.slice(0, 60)}»`} onClick={retirar}
          className="rounded-md border border-white/10 px-2 py-0.5 text-[12px] text-zinc-400 transition hover:border-rose-400/60 hover:text-rose-200">Retirar</button>
      </span>
      {avisar && (
        <div data-aviso-renglon-editado className="basis-full flex flex-wrap items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/[0.06] px-3 py-2">
          <span className="text-[13.5px] text-zinc-100">Este renglón ya lo editaste. Si lo retiras, se va con tu edición.</span>
          <button type="button" data-accion="confirmar-retirar-renglon" onClick={() => { setAvisar(false); onRetirar() }} className="rounded-md border border-rose-400/60 bg-rose-500/15 px-3 py-1 text-[13px] text-rose-100 hover:bg-rose-500/25">Sí, retirar</button>
          <button type="button" onClick={() => setAvisar(false)} className="rounded-md border border-white/10 px-3 py-1 text-[13px] text-zinc-300 hover:bg-white/[0.05]">Cancelar</button>
        </div>
      )}
    </>
  )
}
