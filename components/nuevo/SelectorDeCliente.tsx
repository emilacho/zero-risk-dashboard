"use client"

import { elegirTodosLosClientes, guardarClienteDeTrabajo } from "@/lib/cliente-de-trabajo"
import { estadoDeCampanaLegible } from "@/lib/lenguaje"
import { useClienteDeTrabajo } from "@/components/nuevo/ClienteComoTexto"
import { useEffect, useRef, useState } from "react"
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown"

/**
 * 06-nov · SELECTOR ÚNICO DE CLIENTE (boceto 2, aprobado tal cual por Emilio: «esa es su función correcta: elegir el cliente»).
 * Es el ÚNICO lugar donde se elige el cliente: todos los paneles lo usan y lo muestran como texto. Elegir NO recarga ni cambia de pantalla: los paneles
 * abiertos se pasan solos al cliente nuevo. «Todos los clientes» solo vale para Dinero y Observabilidad.
 * La lista se pide al abrirlo (`/api/direccion/clientes`, SOLO LECTURA). Antes (6.42) cada cliente era un enlace a su vista financiera; eso sigue en Dinero.
 */
export type ClienteDeLaLista = { nombre: string; ruta: string; id: string | null; con_campana?: boolean; estado_campana?: string | null }

/**
 * lo que dice el selector junto al nombre: SIEMPRE el estado de la última campaña real (09-nov · CC6 🟡 + Lenovo: con una campaña viva no decía nada
 * y Náufrago, en `necesita_humano`, salía sin estado). `necesita_humano` → «detenida». Sin campañas leídas, nada (nunca un estado inventado).
 */
export function estadoJuntoAlNombre(c: ClienteDeLaLista): string {
  if (typeof c.con_campana !== "boolean") return ""
  if (!c.estado_campana) return "sin campaña"
  return `campaña ${c.estado_campana === "necesita_humano" ? "detenida" : estadoDeCampanaLegible(c.estado_campana)}`
}

/** al elegir un cliente: se guarda como cliente de trabajo (sin «Todos») y se avisa a los paneles */
export function elegirCliente(c: ClienteDeLaLista): void {
  guardarClienteDeTrabajo({ id: c.id, nombre: c.nombre, todos: false })
}

export function SelectorDeCliente({ inicial = null, fetchImpl, abiertoInicial = false, elegidoInicial }: { inicial?: ClienteDeLaLista[] | null; fetchImpl?: typeof fetch; /** para pruebas e imágenes */ abiertoInicial?: boolean; elegidoInicial?: { id: string | null; nombre: string | null; todos?: boolean } | null }) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  const [clientes, setClientes] = useState<ClienteDeLaLista[] | null>(inicial)
  const [error, setError] = useState<string | null>(null)
  const guardado = useClienteDeTrabajo()
  const elegido = guardado ?? elegidoInicial ?? null
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
    // Esc cierra solo la lista: no se cuela a la escena (antes sacaba de Dept. Marketing · informe del mapa, punto 7)
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); setAbierto(false) }
    document.addEventListener("mousedown", fuera); window.addEventListener("keydown", tecla, true)
    return () => { document.removeEventListener("mousedown", fuera); window.removeEventListener("keydown", tecla, true) }
  }, [abierto])
  const titulo = elegido?.todos ? "Todos los clientes" : elegido?.nombre ?? "Elige un cliente"
  const elegir = (c: ClienteDeLaLista) => { elegirCliente(c); setAbierto(false) }
  return (
    <div ref={caja} data-selector-de-cliente className="relative ml-1 hidden sm:block">
      <button type="button" aria-haspopup="menu" aria-expanded={abierto} aria-label={`Cliente de trabajo: ${titulo}. Cambiar`} onClick={() => setAbierto((a) => !a)}
        className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md border border-white/15 px-3 py-1 text-[13px] text-zinc-200 hover:bg-white/[0.07] hover:text-white">
        <span className="text-[10.5px] uppercase tracking-[0.2em] text-zinc-500">Cliente</span>
        <span data-cliente-elegido className="font-medium text-zinc-50">{titulo}</span>
        <CaretDown size={12} className="text-zinc-400" />
      </button>
      {abierto && (
        <div role="menu" data-lista-de-clientes className="absolute left-0 top-full z-[80] mt-1 min-w-[300px] rounded-lg border border-white/10 bg-[#161412] p-1 shadow-2xl">
          <p className="px-3 pb-1 pt-2 text-[10.5px] uppercase tracking-[0.2em] text-amber-300/90">Cliente de trabajo</p>
          {error ? <p role="alert" className="px-3 py-2 text-[13px] text-rose-300">{error}</p>
            : !clientes ? <p className="px-3 py-2 text-[13px] text-zinc-500">Leyendo…</p>
            : !clientes.length ? <p className="px-3 py-2 text-[13px] text-zinc-500">Sin clientes todavía.</p>
            : clientes.map((c) => {
              const marcado = !elegido?.todos && (c.id ? elegido?.id === c.id : elegido?.nombre === c.nombre)
              const estado = estadoJuntoAlNombre(c)
              return (
                <button key={c.id ?? c.nombre} type="button" role="menuitemradio" aria-checked={marcado} data-cliente-del-selector={c.nombre} onClick={() => elegir(c)}
                  className={`flex w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left text-[13.5px] hover:bg-white/[0.07] hover:text-white ${marcado ? "bg-white/[0.05] text-white" : "text-zinc-200"}`}>
                  <span>{c.nombre}</span>
                  <span className="flex items-center gap-2">
                    {estado && <span data-estado-del-cliente className="text-[11.5px] text-zinc-500">{estado}</span>}
                    {marcado && <span aria-hidden className="text-amber-300">✓</span>}
                  </span>
                </button>
              )
            })}
          <div className="my-1 border-t border-white/10" />
          <button type="button" role="menuitemradio" aria-checked={elegido?.todos === true} data-todos-los-clientes onClick={() => { elegirTodosLosClientes(); setAbierto(false) }}
            className={`flex w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left text-[13px] hover:bg-white/[0.07] hover:text-white ${elegido?.todos ? "bg-white/[0.05] text-white" : "text-zinc-400"}`}>
            <span>Todos los clientes <span className="text-zinc-500">(Dinero, Observabilidad)</span></span>
            {elegido?.todos && <span aria-hidden className="text-amber-300">✓</span>}
          </button>
        </div>
      )}
    </div>
  )
}
