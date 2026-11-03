"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { miniaturaDe, siguienteFoto, accionDeTecla, siguienteEnLaTrampa } from "@/lib/visor-de-fotos"

/**
 * VER UNA FOTO EN GRANDE (CC4 · 03-nov · corrección de Emilio 18:09Z sobre la barra del manual): fondo oscuro, la foto al máximo que quepa, ✕ de 44 px,
 * Esc cierra, flechas del teclado o deslizar para pasar a la siguiente del mismo grupo. La grande se pide solo al abrirla; las miniaturas van livianas.
 * Sirve para cualquier grupo de fotos de cualquier documento (manual, plan…): recibe la lista y nada más.
 */
export interface FotoDelVisor { url: string; texto: string | null }

const BOTON = "flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/60 text-[20px] leading-none text-zinc-100 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"

export function VisorDeFotos({ fotos, inicial = 0, onCerrar }: { fotos: FotoDelVisor[]; inicial?: number; onCerrar: () => void }) {
  const [i, setI] = useState(Math.min(Math.max(inicial, 0), Math.max(fotos.length - 1, 0)))
  const cerrar = useRef<HTMLButtonElement>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const toque = useRef<number | null>(null)
  const ir = useCallback((d: 1 | -1) => setI((x) => siguienteFoto(x, fotos.length, d)), [fotos.length])
  // el foco entra en ✕ al abrir y VUELVE a la miniatura que lo abrió al cerrar (quien navega con teclado no se pierde)
  useEffect(() => {
    const antes = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null
    cerrar.current?.focus()
    return () => { antes?.focus?.() }
  }, [])
  // en captura: la oficina de abajo no debe recibir Esc ni las flechas mientras la foto está abierta
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      // Tab da la vuelta DENTRO del visor: no llega a los botones del panel de atrás
      if (e.key === "Tab" && raiz.current) {
        const botones = [...raiz.current.querySelectorAll<HTMLElement>("button")]
        if (!botones.length) return
        e.preventDefault()
        const actual = botones.indexOf(document.activeElement as HTMLElement)
        botones[siguienteEnLaTrampa(actual, botones.length, e.shiftKey)]?.focus()
        return
      }
      const a = accionDeTecla(e.key)
      if (!a) return
      e.stopPropagation(); e.preventDefault()
      if (a === "cerrar") onCerrar(); else ir(a === "siguiente" ? 1 : -1)
    }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, ir])
  const f = fotos[i]
  if (!f) return null
  const varias = fotos.length > 1
  return (
    <div ref={raiz} data-visor-de-fotos role="dialog" aria-modal="true" aria-label="Foto en grande" className="nv-panel fixed inset-0 z-[95] flex flex-col bg-black/95" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}
      onTouchStart={(e) => { toque.current = e.touches[0]?.clientX ?? null }}
      onTouchEnd={(e) => { const x0 = toque.current; toque.current = null; const x1 = e.changedTouches[0]?.clientX; if (varias && x0 != null && x1 != null && Math.abs(x1 - x0) > 50) ir(x1 < x0 ? 1 : -1) }}>
      <div className="flex items-center justify-between gap-3 p-3">
        <span data-visor-contador className="text-[13px] text-zinc-300">{varias ? `${i + 1} de ${fotos.length}` : ""}</span>
        <button ref={cerrar} type="button" data-visor-cerrar aria-label="Cerrar la foto" onClick={onCerrar} className={BOTON}>✕</button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-3 sm:px-16" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img data-visor-foto src={f.url} alt={f.texto ?? "Foto del cliente"} className="max-h-full max-w-full rounded-md object-contain" />
        {varias && <button type="button" data-visor-anterior aria-label="Foto anterior" onClick={() => ir(-1)} className={`${BOTON} absolute left-2 top-1/2 -translate-y-1/2`}>‹</button>}
        {varias && <button type="button" data-visor-siguiente aria-label="Foto siguiente" onClick={() => ir(1)} className={`${BOTON} absolute right-2 top-1/2 -translate-y-1/2`}>›</button>}
      </div>
      {f.texto && <p className="px-4 pb-4 text-center text-[13px] text-zinc-300">{f.texto}</p>}
    </div>
  )
}

/** una cuadrícula de miniaturas livianas; tocar una abre el visor en esa foto. */
export function FotosConVisor({ fotos, className = "grid grid-cols-4 gap-1.5" }: { fotos: FotoDelVisor[]; className?: string }) {
  const [abierta, setAbierta] = useState<number | null>(null)
  if (!fotos.length) return null
  return (
    <>
      <div className={className} data-fotos-con-visor>
        {fotos.map((f, k) => (
          <button key={`${f.url}#${k}`} type="button" data-foto={k} aria-label={`Ver en grande: ${f.texto ?? "foto del cliente"}`} title={f.texto ?? undefined} onClick={() => setAbierta(k)} className="group aspect-square w-full overflow-hidden rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={miniaturaDe(f.url)} alt={f.texto ?? "Foto del cliente"} loading="lazy" decoding="async" onError={(e) => { const im = e.currentTarget; if (im.src !== f.url) im.src = f.url }} className="h-full w-full object-cover transition group-hover:opacity-85" />
          </button>
        ))}
      </div>
      {abierta != null && <VisorDeFotos fotos={fotos} inicial={abierta} onCerrar={() => setAbierta(null)} />}
    </>
  )
}
