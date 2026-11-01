"use client"

import type { ColumnaArmada } from "@/lib/kanban"

/**
 * EL KANBAN (sprint 6.11 · ADENDA 3): 7 columnas genéricas, SOLO LECTURA (nada se arrastra: cada tarjeta está donde la plataforma dice que está).
 * Se usa dentro del Calendario (Centro de campaña · Calendario ↔ Kanban) y dentro de Piezas. «Publicada» viene atenuada con su leyenda mientras el sistema no publique.
 * Tocar una tarjeta la elige en el panel de origen (el calendario abre su detalle; la bandeja abre la pieza).
 */
const ESTILO = `
.kb-tarjeta{transition:transform .15s ease,border-color .15s ease,background .15s ease}
.kb-tarjeta:hover,.kb-tarjeta:focus-visible{transform:translateY(-1px);border-color:rgba(245,165,36,.55);background:rgba(245,165,36,.06)}
.kb-tarjeta[data-elegida="true"]{outline:1px solid #fff;outline-offset:1px}
.kb-tarjeta[data-destacada="true"]{box-shadow:0 0 12px rgba(245,165,36,.35)}
.kb-columna[data-activa="false"]{opacity:.45}
@media (prefers-reduced-motion:reduce){.kb-tarjeta{transition:none}}
`
const MAXIMO_POR_COLUMNA = 60

export function Kanban({ columnas, elegida = null, onElegir, etiqueta }: {
  columnas: ColumnaArmada[]
  elegida?: string | null
  onElegir?: (id: string) => void
  etiqueta: string
}) {
  return (
    <div data-kanban role="list" aria-label={etiqueta} className="flex gap-2.5 overflow-x-auto pb-2">
      <style>{ESTILO}</style>
      {columnas.map((c) => (
        <section key={c.clave} role="listitem" data-columna={c.clave} data-activa={c.activa} data-total={c.tarjetas.length} aria-label={`${c.nombre}: ${c.tarjetas.length}`} className="kb-columna flex w-[196px] shrink-0 flex-col rounded-lg border border-white/10 bg-black/25">
          <header className="border-b border-white/10 px-2.5 py-2">
            <div className="flex items-center gap-2">
              <h4 className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-zinc-100">{c.nombre}</h4>
              <span className={`num shrink-0 rounded-full px-1.5 text-[10.5px] ${c.clave === "por_aprobar" && c.tarjetas.length ? "bg-amber-400/20 text-amber-200" : "bg-white/[0.06] text-zinc-400"}`}>{c.tarjetas.length}</span>
            </div>
            <p className="mt-0.5 truncate text-[10.5px] text-zinc-500" title={c.descripcion}>{c.descripcion}</p>
          </header>
          <div className="flex max-h-[52vh] flex-col gap-1.5 overflow-y-auto p-1.5">
            {!c.activa && <p data-leyenda className="rounded-md border border-dashed border-white/15 px-2 py-2 text-[11px] leading-snug text-zinc-400">{c.leyenda}</p>}
            {c.activa && c.tarjetas.length === 0 && <p className="px-2 py-2 text-[11px] text-zinc-600">Nada aquí</p>}
            {c.tarjetas.slice(0, MAXIMO_POR_COLUMNA).map((t) => (
              <button key={t.id} type="button" data-tarjeta={t.id} data-columna-tarjeta={t.columna} data-elegida={t.id === elegida} data-destacada={t.destacada} onClick={() => onElegir?.(t.id)} disabled={!onElegir}
                title={`${t.estado}${t.motivo ? ` · ${t.motivo}` : ""}`} aria-label={`${t.titulo} · ${t.estado}`} aria-pressed={t.id === elegida}
                className="kb-tarjeta flex w-full flex-col gap-0.5 rounded-md border border-white/10 border-l-[3px] bg-[#1c1c1c] px-2 py-1.5 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400 disabled:cursor-default" style={{ borderLeftColor: t.color }}>
                <span className="line-clamp-2 text-[12px] leading-snug text-zinc-100">{t.titulo}</span>
                {t.detalle && <span className="truncate text-[10.5px] text-zinc-400">{t.detalle}</span>}
                <span className="flex items-center gap-1.5 text-[10.5px] text-zinc-500"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: t.color }} aria-hidden />{t.estado}{t.cuando ? ` · ${t.cuando}` : ""}</span>
              </button>
            ))}
            {c.tarjetas.length > MAXIMO_POR_COLUMNA && <p className="px-2 py-1 text-[11px] text-zinc-500">+{c.tarjetas.length - MAXIMO_POR_COLUMNA} más (míralas en el calendario)</p>}
          </div>
        </section>
      ))}
    </div>
  )
}
