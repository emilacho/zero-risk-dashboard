/** LAS NOTAS DE UN DATO DEL MANUAL, discretas, bajo el campo (CC6 · 02-nov · SEÑAL de Lenovo): no es una alarma ni toca el texto; Emilio decide qué hacer con cada una. */
import { QUIEN_MARCO, type NotaDelCampo } from "@/lib/manual-notas"

export function NotasDelCampo({ notas }: { notas?: NotaDelCampo[] }) {
  if (!notas?.length) return null
  return (
    <ul data-notas-del-campo className="mt-2 space-y-1 border-l-2 border-amber-400/40 pl-2.5 text-[12px] leading-snug text-zinc-400" aria-label="Notas sobre datos de este campo">
      {notas.map((n, i) => (
        <li key={i} data-nota={n.quien}>
          <span className="text-amber-200/90">«{n.dato}»</span>{n.motivo ? <> — {n.motivo}</> : null}
          <span className="text-zinc-500"> · {QUIEN_MARCO[n.quien]}</span>
        </li>
      ))}
    </ul>
  )
}
