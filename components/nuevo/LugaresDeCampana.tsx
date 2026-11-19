"use client"

/**
 * LOS 3 LUGARES DE CAMPAÑA (19-nov · GO de Lenovo 22:04 Zúrich · boceto aprobado por Emilio 21:45 y 22:03:
 * `raw/evidencia/2026-11-19-boceto-boton-flujo-nombre/` vistas 4, 5 y 6).
 * Debajo de los 9 cuadros, uno debajo del otro y del ancho de los 3: siempre 3 lugares.
 *   · cada campaña viva del cliente ocupa uno, con su botón «Flujo de la campaña», su nombre y su color real (`/api/flujo` → `campanas`)
 *   · los lugares libres dicen «Crear Campaña»: «+» gris, mismo tamaño y estilo, sin color de estado ni textos de uso. Por ahora no abre nada (backlog)
 *   · sin lectura no se pinta nada: nunca 3 «Crear Campaña» inventados cuando la base no contestó
 */
import { useEffect, useState } from "react"
import { BotonFlujo, CLASE_DEL_BOTON, type LecturaDeUnBoton } from "@/components/nuevo/BotonFlujo"
import type { CampanaDelFlujo, FlujoDeCampana } from "@/lib/flujo-de-campana"

export const LUGARES_DE_CAMPANA = 3

/** lo que el Centro ya tiene leído (pruebas e imagen): la última campaña de siempre y, desde el 19-nov, las vivas */
export type FlujoInicial = { campana_id: string | null; flujo: FlujoDeCampana | null; campanas?: CampanaDelFlujo[] }

/** las campañas que ocupan lugar: las vivas con botón, de la más vieja a la más nueva (orden de `/api/flujo`), hasta 3 */
export function campanasConLugar(campanas: CampanaDelFlujo[] | null | undefined): CampanaDelFlujo[] {
  return (campanas ?? []).filter((c) => !!c.campana_id && !!c.flujo).slice(0, LUGARES_DE_CAMPANA)
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

/** 19-nov (Emilio 23:23) · la elegida con el toque: la tocada, si sigue viva con botón; si no (o sin tocar), la de por omisión */
export function campanaElegidaConToque(campanas: CampanaDelFlujo[] | null | undefined, tocada: string | null | undefined): CampanaDelFlujo | null {
  const t = tocada ? (campanas ?? []).find((c) => c.campana_id === tocada && !!c.flujo) : undefined
  return t ?? campanaElegida(campanas)
}

/** lee `/api/flujo` del cliente; `null` mientras no hay lectura (o si la base no contestó) */
export function useCampanasDelFlujo(clienteId: string | null, inicial: FlujoInicial | null = null): CampanaDelFlujo[] | null {
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
  }, [clienteId, inicial])
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

export function LugaresDeCampana({ clienteId, campanas, elegidaId, onElegir }: {
  clienteId: string | null
  campanas: CampanaDelFlujo[] | null
  /** 19-nov (Emilio 23:23) · la campaña elegida del Centro y cómo elegir otra: el 1.er toque sobre una no elegida solo la elige */
  elegidaId?: string | null
  onElegir?: (campanaId: string) => void
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
          elegida={onElegir ? c.campana_id === elegidaId : undefined}
          alElegir={onElegir ? () => onElegir(c.campana_id) : undefined}
        />
      ))}
      {Array.from({ length: libres }, (_, i) => (
        <div key={`crear-${i}`} className="mt-3">
          {/* 19-nov · qué hace al tocarlo está en el backlog: por ahora no abre nada */}
          <button type="button" data-crear-campana aria-disabled="true" className={`${CLASE_DEL_BOTON} border-linea`}>
            <IconoDeCrear />
            <span className="mt-3 block text-cuerpo font-medio text-hueso">Crear Campaña</span>
          </button>
        </div>
      ))}
    </div>
  )
}

/** el subtítulo del Centro: «CAMPAÑA · <nombre>» (como «CLIENTE · <nombre>», pero con los tokens de la guía: la revisión de estilo frena las clases sueltas); el cliente se elige afuera */
export function CampanaComoTexto({ nombre }: { nombre: string }) {
  return (
    <p data-campana-como-texto className="max-w-full truncate text-rotulo uppercase tracking-rotulo text-gris" title={nombre}>
      Campaña · <span data-campana-nombre className="font-medio text-hueso">{nombre}</span>
    </p>
  )
}
