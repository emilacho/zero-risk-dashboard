"use client"

/**
 * LOS 3 LUGARES DE CAMPAÑA (19-nov · GO de Lenovo 22:04 Zúrich · boceto aprobado por Emilio 21:45 y 22:03:
 * `raw/evidencia/2026-11-19-boceto-boton-flujo-nombre/` vistas 4, 5 y 6).
 * Debajo de los 9 cuadros, uno debajo del otro y del ancho de los 3: siempre 3 lugares.
 *   · cada campaña viva del cliente ocupa uno, con su botón «Flujo de la campaña», su nombre y su color real (`/api/flujo` → `campanas`)
 *   · los lugares libres dicen «Crear Campaña»: «+» gris, mismo tamaño y estilo, sin color de estado ni textos de uso.
 *     20-nov (GO Lenovo 22:05 Zúrich · boceto aprobado por Emilio 22:03): con `onCrear` se puede tocar y abre el formulario (al pasar encima, el hilo dorado de los cuadros);
 *     sin `onCrear` sigue como antes, marcado `aria-disabled` y sin hacer nada
 *   · sin lectura no se pinta nada: nunca 3 «Crear Campaña» inventados cuando la base no contestó
 *   · 21-nov (Emilio 10:28–10:30Z · GO Lenovo 10:31Z): los lugares ya NO eligen la campaña; se elige con la flecha ▾ del subtítulo (`CampanaComoTexto`)
 */
import { useEffect, useRef, useState } from "react"
import { BotonFlujo, CLASE_DEL_BOTON, type LecturaDeUnBoton } from "@/components/nuevo/BotonFlujo"
import type { CampanaDelFlujo, FlujoDeCampana } from "@/lib/flujo-de-campana"

export const LUGARES_DE_CAMPANA = 3

/** lo que el Centro ya tiene leído (pruebas e imagen): la última campaña de siempre y, desde el 19-nov, las vivas */
export type FlujoInicial = { campana_id: string | null; flujo: FlujoDeCampana | null; campanas?: CampanaDelFlujo[] }

/**
 * las campañas que ocupan lugar: las 3 vivas con botón MÁS NUEVAS (LENOVO 20-nov 23:53: así la elegida por omisión siempre tiene su lugar),
 * de la más vieja a la más nueva entre ellas (orden de `/api/flujo`). Una 4.ª o más queda para «varias campañas completo» (backlog).
 */
export function campanasConLugar(campanas: CampanaDelFlujo[] | null | undefined): CampanaDelFlujo[] {
  return (campanas ?? []).filter((c) => !!c.campana_id && !!c.flujo).slice(-LUGARES_DE_CAMPANA)
}

/** si lo leído no trae `campanas` (lectura de antes del 19-nov), la última campaña con botón ocupa el 1.er lugar, sin nombre */
export function campanasDeLaLectura(l: FlujoInicial | null | undefined): CampanaDelFlujo[] | null {
  if (!l) return null
  if (Array.isArray(l.campanas)) return l.campanas
  return l.campana_id && l.flujo ? [{ campana_id: l.campana_id, nombre: null, flujo: l.flujo }] : []
}

/**
 * la campaña elegida del Centro, sin `?campana=`: la viva MÁS NUEVA (LENOVO 22:24 · la misma regla 2 de `elegirCampana`, #358),
 * para que el subtítulo nombre la MISMA campaña que muestran los cuadros. `/api/flujo` las trae de la más vieja a la más nueva:
 * es la última con botón, aunque no tenga lugar (una 4.ª). Si no tiene nombre, el subtítulo sigue «CLIENTE ·»: nunca el nombre de otra.
 */
export function campanaElegida(campanas: CampanaDelFlujo[] | null | undefined): CampanaDelFlujo | null {
  const conBoton = (campanas ?? []).filter((c) => !!c.campana_id && !!c.flujo)
  return conBoton[conBoton.length - 1] ?? null
}

/** la elegida con la flecha (antes, 19-nov, con el toque): la tocada, si sigue viva con botón y lugar (LENOVO 20-nov 23:53); si no (o sin tocar), la de por omisión */
export function campanaElegidaConToque(campanas: CampanaDelFlujo[] | null | undefined, tocada: string | null | undefined): CampanaDelFlujo | null {
  const t = tocada ? campanasConLugar(campanas).find((c) => c.campana_id === tocada) : undefined
  return t ?? campanaElegida(campanas)
}

/** lee `/api/flujo` del cliente; `null` mientras no hay lectura (o si la base no contestó) */
/** `vuelta` (20-nov): al cambiar, se vuelve a leer (después de «Crear Campaña») */
export function useCampanasDelFlujo(clienteId: string | null, inicial: FlujoInicial | null = null, vuelta = 0): CampanaDelFlujo[] | null {
  const [campanas, setCampanas] = useState<CampanaDelFlujo[] | null>(() => campanasDeLaLectura(inicial))
  useEffect(() => {
    if (inicial || !clienteId) return
    let vivo = true
    setCampanas(null)
    void (async () => {
      try {
        const r = await fetch(`/api/flujo?cliente=${encodeURIComponent(clienteId)}`, { cache: "no-store" })
        const j = (await r.json().catch(() => null)) as ({ ok: true } & FlujoInicial) | { ok: false } | null
        if (vivo && r.ok && j && j.ok) setCampanas(campanasDeLaLectura(j))
      } catch { /* sin lectura no se pintan los lugares */ }
    })()
    return () => { vivo = false }
  }, [clienteId, inicial, vuelta])
  return campanas
}

function IconoDeCrear() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="h-9 w-9 text-gris">
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth={2} />
      <path d="M16 11v10M11 16h10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

export function LugaresDeCampana({ clienteId, campanas, onCrear, onCambio }: {
  clienteId: string | null
  campanas: CampanaDelFlujo[] | null
  /** 20-nov · tocar «Crear Campaña» abre el formulario de las 5 preguntas */
  onCrear?: () => void
  /** 26-nov · una campaña se archivó o se eliminó desde su botón: el Centro vuelve a leer las campañas (su lugar queda libre) */
  onCambio?: () => void
}) {
  if (!campanas) return null
  const conLugar = campanasConLugar(campanas)
  const libres = LUGARES_DE_CAMPANA - conLugar.length
  return (
    <div data-lugares-de-campana>
      {conLugar.map((c) => (
        <BotonFlujo
          key={c.campana_id}
          clienteId={clienteId}
          inicial={{ campana_id: c.campana_id, flujo: c.flujo, nombre: c.nombre } satisfies LecturaDeUnBoton}
          onQuitada={onCambio}
        />
      ))}
      {Array.from({ length: libres }, (_, i) => (
        <div key={`crear-${i}`} className="mt-3">
          {/* 20-nov · con `onCrear` abre el formulario; sin él, como antes: marcado deshabilitado y sin hacer nada */}
          <button type="button" data-crear-campana {...(onCrear ? { "aria-haspopup": "dialog" as const, onClick: onCrear } : { "aria-disabled": true })}
            className={`${CLASE_DEL_BOTON} border-linea${onCrear ? " hover:border-linea-oro" : ""}`}>
            <IconoDeCrear />
            <span className="mt-3 block text-cuerpo font-medio text-hueso">Crear Campaña</span>
          </button>
        </div>
      ))}
    </div>
  )
}

/** 21-nov · lo que dice el subtítulo cuando no hay un nombre que mostrar: NUNCA «CLIENTE» (Emilio 10:28–10:30Z) ni el nombre de otra campaña */
export const SIN_NOMBRE = "sin nombre"
export const SIN_CAMPANA_ABIERTA = "ninguna abierta"
export const LEYENDO = "Leyendo…"

/** el nombre que muestra el subtítulo: el de la elegida; sin lectura «Leyendo…»; sin campaña viva «ninguna abierta»; sin nombre «sin nombre» */
export function nombreDelSubtitulo(campanas: CampanaDelFlujo[] | null | undefined, elegida: CampanaDelFlujo | null | undefined): string {
  if (!campanas) return LEYENDO
  if (!elegida) return SIN_CAMPANA_ABIERTA
  return elegida.nombre?.trim() || SIN_NOMBRE
}

/**
 * el subtítulo del Centro: «CAMPAÑA · <nombre>» (con los tokens de la guía: la revisión de estilo frena las clases sueltas); el cliente se elige afuera.
 * 21-nov (Emilio 10:28–10:30Z · GO Lenovo 10:31Z · «es algo muy sencillo», sin boceto): con `opciones` y `onElegir`, al lado va la flecha ▾. Al tocarla se
 * despliegan las campañas abiertas (las que tienen lugar abajo, la misma regla que `campanaElegidaConToque`); elegir una alinea el Centro a ella.
 * Esc cierra solo la lista (no el Centro); un clic fuera también la cierra. Sin opciones, el subtítulo queda como antes: solo texto.
 */
export function CampanaComoTexto({ nombre, opciones, elegidaId = null, onElegir }: {
  nombre: string
  opciones?: CampanaDelFlujo[]
  elegidaId?: string | null
  onElegir?: (campanaId: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); setAbierto(false) }
    document.addEventListener("mousedown", fuera); window.addEventListener("keydown", tecla, true)
    return () => { document.removeEventListener("mousedown", fuera); window.removeEventListener("keydown", tecla, true) }
  }, [abierto])
  const texto = (
    <p data-campana-como-texto className="max-w-full truncate text-rotulo uppercase tracking-rotulo text-gris" title={nombre}>
      Campaña · <span data-campana-nombre className="font-medio text-hueso">{nombre}</span>
    </p>
  )
  if (!onElegir || !opciones?.length) return texto
  const elegir = (id: string) => { setAbierto(false); if (id !== elegidaId) onElegir(id) }
  return (
    <div ref={caja} data-elegir-campana className="relative flex max-w-full items-center gap-1.5">
      {texto}
      <button type="button" data-flecha-de-campanas aria-haspopup="menu" aria-expanded={abierto} aria-label={`Campaña: ${nombre}. Elegir otra`} onClick={() => setAbierto((a) => !a)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-gris hover:text-hueso focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro">
        <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {abierto && (
        <div role="menu" data-lista-de-campanas className="absolute left-1/2 top-full z-[80] mt-1 min-w-[300px] -translate-x-1/2 rounded-control border border-linea bg-grafito-2 p-1">
          {opciones.map((c) => {
            const marcada = c.campana_id === elegidaId
            return (
              <button key={c.campana_id} type="button" role="menuitemradio" aria-checked={marcada} data-campana-de-la-lista={c.campana_id} onClick={() => elegir(c.campana_id)}
                className={`flex w-full items-center justify-between gap-4 rounded-control px-3 py-2 text-left text-dato hover:bg-grafito ${marcada ? "text-hueso" : "text-gris"}`}>
                <span className="min-w-0 truncate">{c.nombre?.trim() || SIN_NOMBRE}</span>
                {marcada && <span aria-hidden className="text-oro">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
