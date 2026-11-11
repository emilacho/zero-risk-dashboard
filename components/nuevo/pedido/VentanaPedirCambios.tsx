"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { ARTICULO_DEL_DOCUMENTO, letrasDeLaNota, lineaDelMinimo, notaAlcanza, trozosConNombres, type DocumentoDelPedido, type TextoConNombres } from "@/lib/pedir-cambios"

/**
 * LA VENTANA «PEDIR CAMBIOS» (GO Lenovo 21:59 · Emilio aprobó el boceto y sus 3 variantes · A1 + B1). Una sola ventana para el plan, el manual,
 * la gran idea y las piezas: el título con la sección, la línea, la caja, el recuadro «Qué pasa después» y los dos botones. Cada panel le pasa su
 * texto de «Qué pasa después», su mínimo y su acción de siempre: la ventana solo cambia lo que se ve; las puertas de la plataforma no cambian.
 * Reglas (CC7): un clic = un pedido (el botón se apaga al primer clic y un segundo no llama otra vez); si el envío falla, la ventana queda abierta
 * con el texto y el error; `Esc` es «Cancelar»; el foco no sale de la ventana mientras está abierta. Sin precios ni avisos de gasto.
 */
export const DATO_DE_LA_VENTANA = "data-ventana-pedir-cambios"
/** ¿hay una ventana abierta? Los paneles lo miran para que `Esc` cierre la ventana y no el panel */
export const hayVentanaDePedirCambios = (): boolean => typeof document !== "undefined" && !!document.querySelector(`[${DATO_DE_LA_VENTANA}]`)

/** lo que devuelve la acción del panel: si salió, el panel cierra la ventana; si no, el error queda a la vista */
export type ResultadoDelPedido = { ok: true } | { ok: false; error: string }

const NOMBRE = "underline decoration-linea-oro decoration-1 underline-offset-4"
export function ConSubrayado({ t }: { t: TextoConNombres }) {
  return <>{trozosConNombres(t).map((p, k) => (p.nombre ? <span key={k} data-nombre-propio className={NOMBRE}>{p.texto}</span> : <span key={k}>{p.texto}</span>))}</>
}

export function VentanaPedirCambios({ documento, seccion = null, minimo, quePasaDespues, onConfirmar, onCancelar, botonConfirmar = "Confirmar y pedir cambios", notaOpcional = false, extra = null, debajoDeLaCaja = null, notaInicial = "", maximo = 4000, panel }: {
  /** «Plan» · «Manual» · «Gran idea» · «Pieza» (va subrayado en el título) */
  documento: DocumentoDelPedido
  /** la sección o la pieza («Insight», «Carrusel 2»); sin sección, el título es solo el documento */
  seccion?: string | null
  /** cuántas letras pide (1 = basta que haya texto) */
  minimo: number
  quePasaDespues: TextoConNombres
  /** la acción de siempre del panel, con la nota tal cual se escribió */
  onConfirmar: (nota: string) => Promise<ResultadoDelPedido> | ResultadoDelPedido
  /** cerrar sin mandar: no borra lo marcado en el panel (eso lo cuida el panel) */
  onCancelar: () => void
  botonConfirmar?: string
  /** piezas con textos editados: la nota puede ir vacía (los textos ya son el pedido) */
  notaOpcional?: boolean
  /** lo que va entre la caja y «Qué pasa después» (la elección de la gran idea · lo que viaja con la nota en las piezas) */
  extra?: ReactNode
  /** lo que va pegado bajo la caja (p. ej. el aviso de los campos validados del manual) */
  debajoDeLaCaja?: ReactNode
  notaInicial?: string
  maximo?: number
  /** para las pruebas y la certificación: qué panel la abrió */
  panel: string
}) {
  const [nota, setNota] = useState(notaInicial)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enVuelo = useRef(false)
  const caja = useRef<HTMLTextAreaElement>(null)
  const marco = useRef<HTMLDivElement>(null)
  const titulo = useId()
  const alcanza = notaOpcional ? true : notaAlcanza(nota, minimo)
  const ayuda = lineaDelMinimo(minimo)

  useEffect(() => { caja.current?.focus() }, [])
  // Esc = Cancelar · Tab no sale de la ventana (los paneles no se cierran: miran `hayVentanaDePedirCambios`)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); if (!enVuelo.current) onCancelar(); return }
      if (e.key !== "Tab" || !marco.current) return
      const focos = [...marco.current.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled]), input:not([disabled])")]
      if (!focos.length) return
      const i = focos.indexOf(document.activeElement as HTMLElement)
      if (e.shiftKey && i <= 0) { e.preventDefault(); focos[focos.length - 1].focus() }
      else if (!e.shiftKey && (i === -1 || i === focos.length - 1)) { e.preventDefault(); focos[0].focus() }
    }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCancelar])

  async function confirmar() {
    if (enVuelo.current || !alcanza) return // un clic = un pedido
    enVuelo.current = true; setEnviando(true); setError(null)
    try {
      const r = await onConfirmar(nota)
      if (!r.ok) setError(r.error) // la ventana queda abierta con el texto
    } catch (e) { setError(`No se pudo contactar al servidor: ${e instanceof Error ? e.message : String(e)}`) } finally { enVuelo.current = false; setEnviando(false) }
  }

  return (
    <div {...{ [DATO_DE_LA_VENTANA]: panel }} role="dialog" aria-modal="true" aria-labelledby={titulo} className="fixed inset-0 z-[90] grid place-items-center bg-velo p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !enVuelo.current) onCancelar() }}>
      <div ref={marco} className="w-full max-w-[44rem] rounded-tarjeta border border-linea bg-grafito-2 p-6 sm:p-8">
        <h3 id={titulo} data-titulo-ventana className="text-titulo font-medio leading-snug text-hueso">
          Pedir cambios {ARTICULO_DEL_DOCUMENTO[documento]} <span data-nombre-propio data-documento className={NOMBRE}>{documento}</span>{seccion ? <> · <span data-seccion-ventana>{seccion}</span></> : null}
        </h3>
        <p className="mt-1 text-cuerpo text-gris">Escribe qué quieres distinto. El equipo lo reescribe con tu nota.</p>
        <textarea ref={caja} data-caja-pedir-cambios value={nota} onChange={(e) => setNota(e.target.value)} rows={5} maxLength={maximo} disabled={enviando} placeholder="¿Qué quieres distinto?" aria-label="¿Qué quieres distinto?"
          className="mt-5 w-full resize-y rounded-control border border-linea-oro bg-grafito px-4 py-3 text-cuerpo leading-relaxed text-hueso placeholder:text-apagado focus:border-oro focus:outline-none" />
        {ayuda && <p data-minimo-ventana className="mt-1.5 text-dato text-apagado">{ayuda}</p>}
        {debajoDeLaCaja}
        {extra && <div className="mt-4">{extra}</div>}
        <div data-que-pasa-despues className="mt-5 rounded-control border border-linea px-5 py-4">
          <p className="text-rotulo font-medio uppercase tracking-[0.08em] text-oro">Qué pasa después</p>
          <p className="mt-1.5 text-cuerpo leading-relaxed text-hueso"><ConSubrayado t={quePasaDespues} /></p>
        </div>
        {error && <p role="alert" data-error-ventana className="mt-4 text-cuerpo text-alarma">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" data-accion="ventana-cancelar" disabled={enviando} onClick={onCancelar} className="min-h-11 rounded-control border border-linea px-6 text-boton font-medio text-hueso hover:border-linea-oro disabled:opacity-50">Cancelar</button>
          <button type="button" data-accion="ventana-confirmar" disabled={enviando || !alcanza} onClick={() => void confirmar()} className="min-h-11 rounded-control border border-linea-oro bg-grafito px-6 text-boton font-medio text-oro hover:border-oro disabled:opacity-50">{enviando ? "Enviando…" : botonConfirmar}</button>
        </div>
        <span className="sr-only" aria-live="polite">{letrasDeLaNota(nota)} letras</span>
      </div>
    </div>
  )
}
