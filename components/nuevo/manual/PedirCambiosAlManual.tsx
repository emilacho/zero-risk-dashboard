"use client"

import { useEffect, useState } from "react"
import { BarraDelPedido, QueCambio } from "@/components/nuevo/pedido/PiezasDelPedido"
import { avisoDeLoValidado, cuerpoDePedirCambiosAlManual, palabrasDelPedidoDelManual, rotuloMientrasSeReescribe, type CicloDelManual } from "@/lib/manual-ciclo"

type Resultado = { ok: true; texto: string; detalle: Record<string, unknown> } | { ok: false; texto: string }
type Accion = (nombre: string, cuerpo: Record<string, unknown>) => Promise<Resultado>
/** una sección pedida desde su apartado: título, las claves de sus campos y cuáles son del dueño (`n` cambia en cada clic) */
export interface PedidoEnSeccion { titulo: string; campos: string[]; validados: string[]; n: number }

/**
 * PEDIR CAMBIOS AL MANUAL (CC6 · 02-nov · encargo pedido por Emilio: «que sean formatos parecidos, así el usuario no tiene que aprender dos veces»).
 * El MISMO patrón del plan: el botón, el cuadro para escribir lo que debe cambiar, «Pedir cambios en esta sección» (antepone «Sección «X»: »), la barra de
 * avance con su animación y «Qué cambió» (campo por campo). Sin aviso de gasto (Emilio, 01-nov): el cuerpo lleva la confirmación y el tope por código.
 * Mientras la plataforma no tenga el pedido de manuales (`ciclo.disponible` falso) no se ofrece nada: la puerta daría 404.
 */
export function PedirCambiosAlManual({ cliente, ciclo, accion, validadosDelManual, pedirEn = null, onResultado }: {
  cliente: string | null
  ciclo: CicloDelManual
  accion: Accion
  /** las etiquetas de los campos que el dueño validó o escribió, en todo el manual (para la línea de la observación general) */
  validadosDelManual: string[]
  pedirEn?: PedidoEnSeccion | null
  onResultado: (r: { ok: boolean; texto: string }) => void
}) {
  const [modo, setModo] = useState<"quieto" | "escribir">("quieto")
  const [observaciones, setObservaciones] = useState("")
  const [seccion, setSeccion] = useState<PedidoEnSeccion | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [barraOculta, setBarraOculta] = useState(false)
  const [reintento, setReintento] = useState<{ texto: string; seccion: PedidoEnSeccion | null } | null>(null)
  const puedePedir = ciclo.disponible && !ciclo.abierto && !!cliente

  // «Pedir cambios en esta sección»: abre el cuadro con el nombre de la sección al comienzo y lo trae a la vista (igual que el plan)
  useEffect(() => {
    if (!pedirEn || !puedePedir) return
    setError(null); setModo("escribir"); setSeccion(pedirEn)
    setObservaciones((o) => (o.trim() ? `${o.trimEnd()}\n\nSección «${pedirEn.titulo}»: ` : `Sección «${pedirEn.titulo}»: `))
    if (typeof document !== "undefined") requestAnimationFrame(() => document.querySelector("[data-pedir-cambios-manual]")?.scrollIntoView({ behavior: "smooth", block: "start" }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedirEn?.n])

  async function mandar(texto: string, sec: PedidoEnSeccion | null) {
    setError(null)
    const cuerpo = cuerpoDePedirCambiosAlManual(cliente, texto, sec ? { titulo: sec.titulo, campos: sec.campos } : null)
    if ("error" in cuerpo) { setError(String(cuerpo.error)); return }
    setEnviando(true)
    const r = palabrasDelPedidoDelManual(await accion("manual-cambios", cuerpo))
    setEnviando(false)
    if (r.ok) { setObservaciones(""); setSeccion(null); setModo("quieto"); setReintento(null) }
    else if (/Reintentar/.test(r.texto)) { setModo("quieto"); setReintento({ texto, seccion: sec }) }
    else setError(r.texto)
    onResultado(r)
  }

  if (!ciclo.disponible) return null
  const rotulo = rotuloMientrasSeReescribe(ciclo)
  const aviso = avisoDeLoValidado(seccion ? seccion.validados : validadosDelManual, !!seccion)
  return (
    <div data-pedir-cambios-manual data-tablero-accion="manual-cambios" className="mt-3 scroll-mt-2">
      {rotulo && <p data-rotulo-reescribiendo className="rounded-md border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-[13px] text-violet-100">{rotulo}</p>}
      {ciclo.avance && barraOculta && <button type="button" data-accion="ver-avance" onClick={() => setBarraOculta(false)} className="mt-2 rounded-full border border-violet-300/50 px-3 py-1 text-[12.5px] text-violet-100 hover:bg-violet-500/15">Ver el avance</button>}
      {ciclo.avance && !barraOculta && <BarraDelPedido avance={ciclo.avance} onOcultar={() => setBarraOculta(true)} />}
      {ciclo.abierto?.texto && <blockquote className="mt-2 border-l-2 border-violet-400/50 pl-3 text-[12.5px] italic text-zinc-300">Lo que pediste: {ciclo.abierto.texto}</blockquote>}
      {ciclo.que_cambio.length > 0 && <QueCambio titulo="Qué cambió en el manual" lineas={ciclo.que_cambio} />}
      {ciclo.aviso_del_pedido && (
        <div data-aviso-campo-validado data-con-campos={ciclo.aviso_del_pedido.campos.length > 0} className="mt-3 rounded-md border border-amber-400/40 bg-amber-400/[0.06] px-3 py-2.5 text-[13px] leading-snug text-amber-50">
          <p>{ciclo.aviso_del_pedido.texto}</p>
          {ciclo.aviso_del_pedido.campos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {ciclo.aviso_del_pedido.campos.map((c) => (
                <button key={c.clave} type="button" data-accion="ir-al-campo-validado" data-campo-ir={c.clave} onClick={() => { if (typeof document !== "undefined") document.querySelector(`[data-campo="${c.clave}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }) }}
                  className="rounded-md border border-amber-300/60 px-3 py-1 text-[12.5px] text-amber-100 hover:bg-amber-400/15">Ir a «{c.etiqueta}»</button>
              ))}
            </div>
          )}
        </div>
      )}

      {modo === "quieto" && puedePedir && !reintento && (
        <button type="button" data-accion="manual-pedir-cambios" disabled={enviando} onClick={() => { setError(null); setSeccion(null); setModo("escribir") }}
          className="mt-3 rounded-md border border-white/25 bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-zinc-50 transition hover:border-violet-300/70 hover:bg-violet-400/10 disabled:opacity-50">Pedir cambios al manual</button>
      )}
      {modo === "quieto" && reintento && (
        <button type="button" data-accion="manual-reintentar" disabled={enviando} onClick={() => void mandar(reintento.texto, reintento.seccion)}
          className="mt-3 rounded-md border border-amber-300/70 bg-black/40 px-4 py-2 text-[13px] text-amber-100 hover:bg-amber-400/15 disabled:opacity-50">{enviando ? "Enviando…" : "Reintentar el pedido"}</button>
      )}
      {modo === "escribir" && (
        <form data-editor="manual-cambios" className="mt-3 rounded-lg border border-violet-400/30 bg-black/30 p-3" onSubmit={(ev) => { ev.preventDefault(); void mandar(observaciones, seccion) }}>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">¿Qué debe cambiar? (el equipo del manual lo lee y reescribe el manual)</span>
            <textarea value={observaciones} onChange={(ev) => setObservaciones(ev.target.value)} rows={4} maxLength={4000} aria-label="Qué debe cambiar en el manual" autoFocus
              className="w-full resize-y rounded-md border border-white/15 bg-black/40 px-3 py-2 text-[14px] leading-relaxed text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400" />
          </label>
          {aviso && <p data-aviso-validados className="mt-1 text-[12px] text-amber-200">{aviso}</p>}
          <p className="mt-1 text-[11px] text-zinc-500">{observaciones.trim().length}/4000</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="submit" data-accion="manual-enviar-pedido" disabled={enviando} className="rounded-md border border-violet-300/60 bg-violet-500/70 px-5 py-2 text-[13.5px] font-medium text-white hover:bg-violet-500 disabled:opacity-50">{enviando ? "Enviando…" : "Enviar el pedido"}</button>
            <button type="button" disabled={enviando} onClick={() => { setModo("quieto"); setSeccion(null) }} className="rounded-md border border-white/10 px-4 py-2 text-[13px] text-zinc-400 hover:bg-white/[0.05]">Cancelar</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-[13px] text-rose-300">{error}</p>}
    </div>
  )
}
