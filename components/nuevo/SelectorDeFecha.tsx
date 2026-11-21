"use client"

/**
 * LA CASILLA DE FECHA CON CALENDARIO (21-nov · GO Lenovo 00:57Z · Emilio: «inicio» y «fin» no dejaban escribir las fechas).
 * Se escribe la fecha (dd/mm/aaaa, las barras se ponen solas) o se elige en el calendario que se abre al tocar la casilla:
 * el mes con flechas, el día de hoy marcado en dorado y, si hay rango, de inicio a fin pintado. Sin librerías: solo el estilo base.
 * El calendario se abre EN el formulario (en `sitio`, debajo de las casillas), no flotando: el panel recortaba la última semana y en el celular
 * no cabía al lado. Esc o un clic afuera cierran SOLO el calendario (no el formulario).
 */
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { DIAS_DE_LA_SEMANA, MESES, escribirFecha, fechaCorta, fechaDelTexto, semanasDelMes, textoDeFecha } from "@/lib/crear-campana"

const mesDe = (iso: string) => ({ anio: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) - 1 })

export function SelectorDeFecha({ valor, onCambio, etiqueta, hoy, rango, desde, clase, sitio }: {
  valor: string
  onCambio: (iso: string) => void
  etiqueta: string
  hoy: string
  /** el rango que se pinta (inicio → fin de la campaña) */
  rango?: { inicio: string; fin: string }
  /** el primer día que se puede elegir en el calendario */
  desde?: string
  /** la letra y el color de la casilla */
  clase: string
  /** dónde se abre el calendario (un lugar del formulario a todo lo ancho); sin él, justo debajo de la casilla */
  sitio?: HTMLElement | null
}) {
  const [texto, setTexto] = useState(textoDeFecha(valor))
  const [abierto, setAbierto] = useState(false)
  const [vista, setVista] = useState(() => mesDe(fechaDelTexto(textoDeFecha(valor)) ?? (rango?.inicio || hoy)))
  const caja = useRef<HTMLDivElement>(null)
  const casilla = useRef<HTMLInputElement>(null)
  const calendario = useRef<HTMLDivElement>(null)

  // si la fecha cambia desde afuera, la casilla la muestra; lo que se está escribiendo (todavía sin fecha) no se borra
  useEffect(() => { setTexto((t) => ((fechaDelTexto(t) ?? "") === valor ? t : textoDeFecha(valor))) }, [valor])
  // un clic afuera cierra el calendario
  useEffect(() => {
    if (!abierto) return
    const afuera = (e: MouseEvent) => { const t = e.target as Node; if (!caja.current?.contains(t) && !calendario.current?.contains(t)) setAbierto(false) }
    document.addEventListener("mousedown", afuera)
    return () => document.removeEventListener("mousedown", afuera)
  }, [abierto])

  const abrir = () => { if (!abierto) { setVista(mesDe(fechaDelTexto(texto) ?? (valor || rango?.inicio || hoy))); setAbierto(true) } }
  const escribir = (t: string) => { const s = escribirFecha(t); setTexto(s); onCambio(fechaDelTexto(s) ?? "") }
  const elegir = (iso: string) => { setTexto(textoDeFecha(iso)); onCambio(iso); setAbierto(false) }
  // 21-nov (falla de CC5 en #365: el Tab dejaba dos calendarios abiertos) · el foco que se va fuera de la casilla y de su calendario lo cierra
  const siSeVa = (e: React.FocusEvent) => { const a = e.relatedTarget as Node | null; if (a && (caja.current?.contains(a) || calendario.current?.contains(a))) return; setAbierto(false) }
  const mover = (n: number) => setVista(({ anio, mes }) => { const m = mes + n; return { anio: anio + Math.floor(m / 12), mes: ((m % 12) + 12) % 12 } })

  const cuadro = (
    <div ref={calendario} data-calendario role="dialog" aria-label={`Calendario · ${etiqueta}`} onBlur={siSeVa} onMouseDown={(e) => e.preventDefault()}
      onKeyDown={(e) => { if (e.key === "Escape") { setAbierto(false); casilla.current?.focus() } }}
      className="mx-auto mt-3 w-full max-w-[320px] rounded-tarjeta border border-linea-oro bg-grafito p-3 text-left">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Mes anterior" onMouseDown={(e) => e.preventDefault()} onClick={() => mover(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-control text-oro hover:bg-grafito-2 focus-visible:shadow-none">‹</button>
        <span data-mes className="text-dato font-medio text-hueso">{MESES[vista.mes]} {vista.anio}</span>
        <button type="button" aria-label="Mes siguiente" onMouseDown={(e) => e.preventDefault()} onClick={() => mover(1)}
          className="flex h-8 w-8 items-center justify-center rounded-control text-oro hover:bg-grafito-2 focus-visible:shadow-none">›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-rotulo text-apagado">
        {DIAS_DE_LA_SEMANA.map((d, i) => <span key={i} className="py-1">{d}</span>)}
      </div>
      {semanasDelMes(vista.anio, vista.mes).map((semana, s) => (
        <div key={s} className="grid grid-cols-7">
          {semana.map((iso, i) => {
            if (!iso) return <span key={i} />
            const elegido = iso === valor
            const enRango = !!rango?.inicio && !!rango?.fin && iso > rango.inicio && iso < rango.fin
            const extremo = !!rango && (iso === rango.inicio || iso === rango.fin)
            const antes = !!desde && iso < desde
            return (
              <button key={iso} type="button" data-dia={iso} aria-label={fechaCorta(iso)} aria-pressed={elegido} disabled={antes}
                {...(iso === hoy ? { "data-hoy": "" } : {})} {...(enRango ? { "data-en-rango": "" } : {})}
                onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(iso)}
                className={`m-0.5 flex h-9 items-center justify-center rounded-control text-dato [font-variant-numeric:tabular-nums] focus-visible:shadow-none ${
                  elegido || extremo ? "bg-oro font-medio text-carbon" : enRango ? "bg-linea-oro text-hueso" : antes ? "text-apagado" : "text-hueso hover:bg-grafito-2"
                } disabled:cursor-not-allowed`}>
                {/* hoy: el aro dorado va en el número (el botón del día no es un botón de acción) */}
                <span className={`flex h-full w-full items-center justify-center rounded-control ${iso === hoy && !elegido ? "border border-oro" : ""}`}>{Number(iso.slice(8))}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )

  return (
    <div ref={caja} className="relative" data-selector-de-fecha {...(abierto ? { "data-calendario-abierto": "" } : {})}>
      <input ref={casilla} aria-label={etiqueta} value={texto} placeholder="dd/mm/aaaa" inputMode="numeric" maxLength={10} autoComplete="off"
        aria-haspopup="dialog" aria-expanded={abierto}
        onChange={(e) => escribir(e.target.value)} onFocus={abrir} onClick={abrir} onBlur={siSeVa}
        onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") setAbierto(false) }}
        className={`w-full min-w-0 bg-transparent placeholder:text-apagado focus:outline-none focus-visible:shadow-none ${clase}`} />
      {abierto && (sitio ? createPortal(cuadro, sitio) : cuadro)}
    </div>
  )
}
