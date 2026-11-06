"use client"

/**
 * LAS PIEZAS DEL ESTILO BASE (aprobado por Emilio 2026-11-05 · guía zr-vault `00-meta/ESTILO-DASHBOARD.md` · tokens `app/estilo-base.css`).
 * Cada pantalla migrada se arma con estas piezas, para que todas se vean y se comporten igual (regla 9: como un iPhone):
 *  - `PanelBase`: el velo, el panel grafito con su hilo dorado, el título centrado en oro y la ✕ alineada con él (44 px).
 *  - `Recuadros`: los números grandes con su rótulo debajo; SON los filtros (no se repiten como pestañas).
 *  - `Pares`: rótulo fijo en oro arriba, valor variable en hueso abajo, de a dos y centrados.
 *  - `Acciones`: botones del mismo ancho, a pares; el principal (ámbar, uno solo) siempre a la derecha.
 *  - `Rotulo`, `Aviso` (la línea fina de alarma arriba y abajo, nunca un recuadro de color) y `Paginas` («‹ 1 de N ›»).
 */
import { useEffect, useRef, type ReactNode } from "react"

export const ROTULO = "text-rotulo font-medio uppercase tracking-rotulo text-oro"
const TOCABLE = "min-h-11 focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro"

export function Rotulo({ children, tono = "oro", className = "" }: { children: ReactNode; tono?: "oro" | "gris" | "alarma"; className?: string }) {
  const color = tono === "oro" ? "text-oro" : tono === "alarma" ? "text-alarma" : "text-gris font-normal"
  return <p className={`text-rotulo font-medio uppercase tracking-rotulo ${color} ${className}`}>{children}</p>
}

/** `lado`: una columna a la izquierda (en escritorio), fuera de la columna con el título; p. ej. el radar de Riesgos (Lenovo 06-nov) */
export function PanelBase({ titulo, id, seccion, onCerrar, etiquetaCerrar, ancho = "max-w-[480px]", lado, children }: {
  titulo: string; id: string; seccion: string; onCerrar: () => void; etiquetaCerrar: string; ancho?: string; lado?: ReactNode; children: ReactNode
}) {
  const cerrar = useRef<HTMLButtonElement>(null)
  useEffect(() => { cerrar.current?.focus() }, [])
  const cabecera = (
    <header className="mb-1 grid shrink-0 grid-cols-[44px_1fr_44px] items-center">
      <h2 id={id} className="col-start-2 text-center text-titulo font-medio uppercase tracking-titulo text-oro">{titulo}</h2>
      <button ref={cerrar} type="button" data-cerrar onClick={onCerrar} aria-label={etiquetaCerrar} className={`col-start-3 flex h-11 w-11 items-center justify-center justify-self-end rounded-control text-gris hover:text-hueso ${TOCABLE}`}>
        <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </header>
  )
  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-velo p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <section role="dialog" aria-modal="true" aria-labelledby={id} data-seccion={seccion} data-estilo="base"
        className={`zr-hilo-oro flex max-h-full w-full ${ancho} flex-col overflow-y-auto rounded-panel border border-linea bg-grafito p-6 text-cuerpo text-hueso`}>
        {lado ? (
          <div className="grid gap-12 lg:grid-cols-2">
            <div data-columna="lado" className="flex min-w-0 flex-col">{lado}</div>
            <div data-columna="principal" className="flex min-w-0 flex-col">{cabecera}{children}</div>
          </div>
        ) : <>{cabecera}{children}</>}
      </section>
    </div>
  )
}

export interface Recuadro { clave: string; numero: number | string; rotulo: string; activo: boolean; alarma?: boolean }
/** los números del panel: grandes, en recuadro, con su rótulo debajo; tocar uno filtra (tocar el activo no hace nada) */
export function Recuadros({ items, alElegir, etiqueta }: { items: Recuadro[]; alElegir: (clave: string) => void; etiqueta: string }) {
  const columnas = items.length >= 3 ? "grid-cols-3" : items.length === 2 ? "grid-cols-2" : "grid-cols-1"
  return (
    <div role="group" aria-label={etiqueta} className={`mt-2 mb-6 grid shrink-0 gap-3 ${columnas}`}>
      {items.map((x) => (
        <button key={x.clave} type="button" data-recuadro={x.clave} aria-pressed={x.activo} onClick={() => alElegir(x.clave)}
          className={`rounded-tarjeta border bg-grafito-2 px-2 py-4 text-center ${x.activo ? "border-linea-oro" : "border-linea hover:border-linea-oro"} ${TOCABLE}`}>
          <span className={`block text-numero font-medio [font-variant-numeric:tabular-nums] ${x.activo ? "text-oro" : x.alarma ? "text-alarma" : "text-hueso"}`}>{x.numero}</span>
          <span className="mt-1.5 block truncate text-rotulo uppercase tracking-rotulo text-gris">{x.rotulo}</span>
        </button>
      ))}
    </div>
  )
}

/** rótulo fijo arriba (oro) y valor variable abajo (hueso), de a dos, centrados; con una sola columna, ocupa todo el ancho */
export function Pares({ pares, valor = "text-cuerpo font-medio" }: { pares: Array<{ rotulo: string; valor: ReactNode; dato?: string }>; valor?: string }) {
  const dos = pares.length > 1
  return (
    <dl className={`grid ${dos ? "grid-cols-2" : "grid-cols-1"}`}>
      {pares.map((p, k) => (
        <div key={p.rotulo} data-par={p.rotulo} className={`min-w-0 px-2 py-1 text-center ${dos && k % 2 === 1 ? "border-l border-linea" : ""}`}>
          <dt className={`mb-1 ${ROTULO}`}>{p.rotulo}</dt>
          <dd className={`break-words text-hueso ${valor}`}>{p.valor}</dd>
          {p.dato && <dd className="text-dato text-gris">{p.dato}</dd>}
        </div>
      ))}
    </dl>
  )
}

/** la línea fina de alarma arriba y abajo: el aviso se ve sin pintar un recuadro de color */
export function Aviso({ rotulo, children, dato }: { rotulo: string; children: ReactNode; dato?: ReactNode }) {
  return (
    <div data-aviso-de-tarjeta className="my-4 border-y border-linea-alarma py-4 text-center">
      <Rotulo tono="alarma">{rotulo}</Rotulo>
      <div className="mt-1.5 text-cuerpo font-medio text-hueso">{children}</div>
      {dato && <div className="text-dato text-gris">{dato}</div>}
    </div>
  )
}

export const BOTON_SECUNDARIO = `zr-apagable rounded-control border border-linea-oro px-3 text-cuerpo font-medio text-oro hover:border-oro ${TOCABLE}`
export const BOTON_PRINCIPAL = `zr-apagable rounded-control border border-ambar bg-ambar px-3 text-cuerpo font-medio text-sobre-ambar ${TOCABLE}`
/** los botones de la tarjeta: mismo ancho, a pares; el principal va último (a la derecha). Uno solo ocupa todo el ancho */
export function Acciones({ children }: { children: ReactNode }) {
  const n = (Array.isArray(children) ? children.flat().filter(Boolean) : [children].filter(Boolean)).length
  return <div data-acciones className={`mt-6 grid gap-3 ${n > 1 ? "grid-cols-2" : "grid-cols-1"}`}>{children}</div>
}

export function Paginas({ actual, total, alMover, etiqueta }: { actual: number; total: number; alMover: (paso: number) => void; etiqueta: string }) {
  const flecha = `flex h-11 w-11 items-center justify-center rounded-control text-oro disabled:text-apagado ${TOCABLE}`
  return (
    <nav aria-label={etiqueta} className="mt-4 grid shrink-0 grid-cols-[44px_1fr_44px] items-center text-center">
      <button type="button" data-anterior aria-label="Anterior" onClick={() => alMover(-1)} disabled={total < 2} className={flecha}><svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>
      <span data-posicion className="text-rotulo uppercase tracking-rotulo text-gris [font-variant-numeric:tabular-nums]">{`${actual} de ${total}`}</span>
      <button type="button" data-siguiente aria-label="Siguiente" onClick={() => alMover(1)} disabled={total < 2} className={flecha}><svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg></button>
    </nav>
  )
}
