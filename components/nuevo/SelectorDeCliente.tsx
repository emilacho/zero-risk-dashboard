"use client"

import { useEffect, useRef, useState } from "react"
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown"

/**
 * 6.42 · el selector «Seleccionar cliente» de la barra superior (cambio 1 de Emilio): abre la vista financiera del cliente a un clic desde cualquier pantalla.
 * La lista se pide al abrirlo (`/api/direccion/clientes`, SOLO LECTURA); cada cliente es un enlace (Ctrl+clic = otra pestaña).
 */
type Cliente = { nombre: string; ruta: string }

export function SelectorDeCliente({ inicial = null, fetchImpl }: { inicial?: Cliente[] | null; fetchImpl?: typeof fetch }) {
  const [abierto, setAbierto] = useState(false)
  const [clientes, setClientes] = useState<Cliente[] | null>(inicial)
  const [error, setError] = useState<string | null>(null)
  const caja = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto || clientes) return
    let vivo = true
    ;(fetchImpl ?? fetch)("/api/direccion/clientes", { cache: "no-store" })
      .then(async (r) => { const j = await r.json().catch(() => null); if (!vivo) return; if (!r.ok || !j?.ok) setError(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador." : "No pude leer los clientes."); else setClientes(j.clientes) })
      .catch(() => vivo && setError("No pude leer los clientes."))
    return () => { vivo = false }
  }, [abierto, clientes, fetchImpl])
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false) }
    document.addEventListener("mousedown", fuera); document.addEventListener("keydown", tecla)
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla) }
  }, [abierto])
  return (
    <div ref={caja} data-selector-de-cliente className="relative ml-1 hidden sm:block">
      <button type="button" aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}
        className="flex items-center gap-2 whitespace-nowrap rounded-md px-2 py-1 text-[13px] text-zinc-200 hover:bg-white/[0.07] hover:text-white">
        Seleccionar cliente <CaretDown size={12} className="text-zinc-400" />
      </button>
      {abierto && (
        <div role="menu" data-lista-de-clientes className="absolute left-0 top-full z-[80] mt-1 min-w-[240px] rounded-lg border border-white/10 bg-[#161412] p-1 shadow-2xl">
          <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-[0.16em] text-zinc-500">Vista financiera del cliente</p>
          {error ? <p className="px-3 py-2 text-[13px] text-rose-300">{error}</p>
            : !clientes ? <p className="px-3 py-2 text-[13px] text-zinc-500">Leyendo…</p>
            : !clientes.length ? <p className="px-3 py-2 text-[13px] text-zinc-500">Sin clientes todavía.</p>
            : clientes.map((c) => <a key={c.ruta} role="menuitem" href={c.ruta} data-cliente-del-selector={c.nombre} className="block rounded-md px-3 py-2 text-[13.5px] text-zinc-200 hover:bg-white/[0.07] hover:text-white">{c.nombre}</a>)}
        </div>
      )}
    </div>
  )
}
