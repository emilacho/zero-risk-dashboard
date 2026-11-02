"use client"

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"

/**
 * 6.44 · la flecha de regreso (pedido de Emilio): solo la flecha, sin letras, con el mismo marco que los demás botones del encabezado.
 * El nombre de a dónde vuelve va para lectores de pantalla y al pasar el cursor.
 */
export function BotonVolver({ alVolver, a }: { alVolver: () => void; a: string }) {
  return (
    <button type="button" data-volver-flecha onClick={alVolver} aria-label={`Volver a ${a}`} title={`Volver a ${a}`}
      className="flex h-[30px] w-[34px] shrink-0 items-center justify-center rounded-md border border-white/15 text-zinc-200 hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
      <ArrowLeft size={16} weight="bold" />
    </button>
  )
}
