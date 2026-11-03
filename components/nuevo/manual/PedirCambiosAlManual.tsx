"use client"

import { useEffect, useRef, useState } from "react"
import { BarraDelPedido, QueCambio } from "@/components/nuevo/pedido/PiezasDelPedido"
import { avisoDeLoValidado, rotuloMientrasSeReescribe, type CicloDelManual } from "@/lib/manual-ciclo"

/** una sección pedida desde su apartado: título, las claves de sus campos y cuáles son del dueño (`n` cambia en cada clic) */
export interface PedidoEnSeccion { titulo: string; campos: string[]; validados: string[]; n: number }

/** el tope del texto libre: el de la plataforma (100.000 con las observaciones por campo · CC1 #869 · Lenovo 16:57Z) */
export const TOPE_DEL_TEXTO_LIBRE = 100_000

/**
 * PEDIR CAMBIOS AL MANUAL (CC6 · 02-nov · mismo patrón del plan) · 03-nov (corrección de Lenovo 16:40Z): el cuadro del texto libre está
 * SIEMPRE a la vista y lo que se escribe es un cambio pendiente más; no tiene botón propio. Todo sale junto con «Pedir los cambios»
 * (abajo, en «Tus cambios»). «Pedir cambios en esta sección» antepone «Sección «X»: » en este cuadro y lo trae a la vista.
 * Aquí siguen el avance del pedido, «Lo que pediste», «Qué cambió» y el aviso del campo validado.
 * Mientras la plataforma no tenga el pedido de manuales (`ciclo.disponible` falso) no se ofrece nada: la puerta daría 404.
 */
export function PedirCambiosAlManual({ clienteNombre = null, ciclo, validadosDelManual, pedirEn = null, libre, onLibre, onReintentar = null, reintentando = false }: {
  /** «Reintentar»: manda otra vez SOLO lo escrito del pedido que no llegó o no terminó */
  onReintentar?: ((texto: string) => void) | null
  reintentando?: boolean
  ciclo: CicloDelManual
  /** las etiquetas de los campos que el dueño validó o escribió, en todo el manual (para la línea de la observación general) */
  validadosDelManual: string[]
  /** CC6 · 02-nov (corrección urgente): el nombre del cliente, para que el pedido nunca salga sin verlo */
  clienteNombre?: string | null
  pedirEn?: PedidoEnSeccion | null
  /** el texto libre para todo el manual (pendiente hasta «Pedir los cambios») */
  libre: string
  onLibre: (t: string) => void
}) {
  const [seccion, setSeccion] = useState<PedidoEnSeccion | null>(null)
  const [barraOculta, setBarraOculta] = useState(false)
  const caja = useRef<HTMLTextAreaElement>(null)
  const puedeEscribir = ciclo.disponible && !ciclo.abierto

  // «Pedir cambios en esta sección»: antepone el nombre de la sección en el cuadro y lo trae a la vista (igual que el plan)
  useEffect(() => {
    if (!pedirEn || !puedeEscribir) return
    setSeccion(pedirEn)
    onLibre(libre.trim() ? `${libre.trimEnd()}\n\nSección «${pedirEn.titulo}»: ` : `Sección «${pedirEn.titulo}»: `)
    if (typeof document !== "undefined") requestAnimationFrame(() => { document.querySelector("[data-pedir-cambios-manual]")?.scrollIntoView({ behavior: "smooth", block: "start" }); caja.current?.focus() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedirEn?.n])

  if (!ciclo.disponible) return null
  const rotulo = rotuloMientrasSeReescribe(ciclo)
  const aviso = libre.trim() ? avisoDeLoValidado(seccion ? seccion.validados : validadosDelManual, !!seccion) : null
  return (
    <div data-pedir-cambios-manual data-tablero-accion="manual-cambios" className="mt-3 scroll-mt-2">
      {rotulo && <p data-rotulo-reescribiendo className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-100">{rotulo}</p>}
      {ciclo.avance && barraOculta && <button type="button" data-accion="ver-avance" onClick={() => setBarraOculta(false)} className="mt-2 rounded-full border border-amber-300/50 px-3 py-1 text-[12.5px] text-amber-100 hover:bg-amber-500/15">Ver el avance</button>}
      {ciclo.avance && !barraOculta && <BarraDelPedido avance={ciclo.avance} onOcultar={() => setBarraOculta(true)} />}
      {ciclo.abierto?.texto && <blockquote className="mt-2 border-l-2 border-amber-400/50 pl-3 text-[12.5px] italic text-zinc-300">Lo que pediste: {ciclo.abierto.texto}</blockquote>}
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

      {ciclo.reintentar && onReintentar && (
        <button type="button" data-accion="manual-reintentar" disabled={reintentando} onClick={() => onReintentar(ciclo.reintentar!)}
          className="mt-2 min-h-11 rounded-md border border-amber-300/70 bg-black/40 px-4 py-2 text-[13.5px] text-amber-100 hover:bg-amber-400/15 disabled:opacity-50">{reintentando ? "Enviando…" : "Reintentar"}</button>
      )}
      {puedeEscribir && (
        <label data-texto-libre className="mt-3 block">
          <span className="mb-1 block text-[13px] text-zinc-300">Tus observaciones para todo el manual{clienteNombre ? <> de <b data-pedido-para className="text-amber-200">{clienteNombre}</b></> : null} <span className="text-zinc-500">(el equipo del manual las lee y lo reescribe)</span></span>
          <textarea ref={caja} data-accion="manual-texto-libre" value={libre} onChange={(ev) => { onLibre(ev.target.value); if (!ev.target.value.trim()) setSeccion(null) }} rows={4} maxLength={TOPE_DEL_TEXTO_LIBRE} aria-label="Tus observaciones para todo el manual"
            placeholder="Escribe aquí lo que quieras cambiar. Se manda junto con tus otros cambios al tocar «Pedir los cambios»."
            className="w-full resize-y rounded-md border border-white/15 bg-black/40 px-3 py-2 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400" />
          {aviso && <p data-aviso-validados className="mt-1 text-[12px] text-amber-200">{aviso}</p>}
          {libre.trim().length > TOPE_DEL_TEXTO_LIBRE * 0.9 && <p className="mt-1 text-[11px] text-zinc-500">{libre.trim().length.toLocaleString("es-EC")}/{TOPE_DEL_TEXTO_LIBRE.toLocaleString("es-EC")}</p>}
        </label>
      )}
    </div>
  )
}
