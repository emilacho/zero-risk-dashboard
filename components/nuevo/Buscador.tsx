"use client"

/**
 * EL BUSCADOR DE LA BARRA SUPERIOR (CC6 · 03-nov · sprint dashboard): antes era solo la forma; ahora busca de verdad en paneles, clientes, empleados y piezas.
 * «/» lo abre desde cualquier parte (salvo que estés escribiendo en otro campo). Las listas se leen al abrirlo por primera vez (las mismas lecturas de siempre,
 * solo lectura) y quedan en memoria. Elegir: un panel lo abre encima de la escena · un cliente abre su vista · un empleado abre Organización · una pieza abre Piezas en ella.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { MagnifyingGlass } from "@phosphor-icons/react"
import { esAtajoDelBuscador, resultadosDeBusqueda, type FuentesDelBuscador, type ResultadoDeBusqueda } from "@/lib/buscador"
import { abrirPanel } from "@/components/nuevo/BotonesDelMarco"

type Lectura = "sin_leer" | "leyendo" | "listo" | "error"

async function leerFuentes(fetchImpl: typeof fetch): Promise<FuentesDelBuscador> {
  const json = async (url: string) => { try { const r = await fetchImpl(url, { cache: "no-store" }); return r.ok ? ((await r.json()) as Record<string, unknown>) : null } catch { return null } }
  const [c, o, b] = await Promise.all([json("/api/direccion/clientes"), json("/api/direccion/organizacion"), json("/api/bandeja?estado=todas")])
  const personas = (o?.personas && typeof o.personas === "object" ? Object.values(o.personas as Record<string, Record<string, unknown>>) : [])
  return {
    clientes: Array.isArray(c?.clientes) ? (c!.clientes as Array<{ nombre: string; ruta: string }>) : [],
    empleados: personas.map((p) => ({ id: String(p.id), nombre: String(p.nombre ?? ""), puesto: String(p.puesto ?? ""), departamento: String(p.departamento ?? "") })).filter((p) => p.nombre),
    piezas: Array.isArray(b?.piezas) ? (b!.piezas as Array<Record<string, unknown>>).map((p) => ({ id: String(p.id), titulo: String(p.titulo_legible ?? ""), cliente: p.cliente ? String(p.cliente) : null })).filter((p) => p.titulo) : [],
  }
}

export function Buscador({ fetchImpl = fetch, abiertoInicial = false, consultaInicial = "", fuentesIniciales = null }: { fetchImpl?: typeof fetch; /** pruebas */ abiertoInicial?: boolean; consultaInicial?: string; fuentesIniciales?: FuentesDelBuscador | null }) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  const [q, setQ] = useState(consultaInicial)
  const [fuentes, setFuentes] = useState<FuentesDelBuscador | null>(fuentesIniciales)
  const [lectura, setLectura] = useState<Lectura>(fuentesIniciales ? "listo" : "sin_leer")
  const [marcado, setMarcado] = useState(0)
  const caja = useRef<HTMLInputElement>(null)

  const abrir = useCallback(() => { setAbierto(true); requestAnimationFrame(() => caja.current?.focus()) }, [])
  const cerrar = useCallback(() => { setAbierto(false); setQ(""); setMarcado(0) }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (esAtajoDelBuscador(e, document.activeElement as HTMLElement | null)) { e.preventDefault(); abrir() } }
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [abrir])
  useEffect(() => {
    if (!abierto || lectura !== "sin_leer") return
    setLectura("leyendo")
    void leerFuentes(fetchImpl).then((f) => { setFuentes(f); setLectura("listo") }).catch(() => setLectura("error"))
  }, [abierto, lectura, fetchImpl])

  const resultados = resultadosDeBusqueda(q, fuentes ?? { clientes: [], empleados: [], piezas: [] })
  function elegir(r: ResultadoDeBusqueda) {
    cerrar()
    if (r.tipo === "panel") abrirPanel(r.panel)
    else if (r.tipo === "cliente") window.location.assign(r.ruta)
    else if (r.tipo === "empleado") abrirPanel("organizacion")
    else abrirPanel("piezas", { pieza: r.id.replace(/^pieza-/, "") })
  }

  return (
    <div className="relative mx-auto hidden w-[min(34vw,420px)] md:block" data-buscador>
      {!abierto ? (
        <button type="button" data-accion="abrir-buscador" onClick={abrir} aria-label="Buscar (tecla /)"
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-left text-[13px] text-zinc-400 transition hover:border-white/25 hover:text-zinc-200">
          <MagnifyingGlass size={15} /> <span className="flex-1">Buscar</span>
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1.5 text-[11px] text-zinc-300">/</kbd>
        </button>
      ) : (
        <div role="combobox" aria-expanded={resultados.length > 0} aria-haspopup="listbox" aria-owns="nv-buscador-lista">
          <div className="flex h-9 items-center gap-2 rounded-lg border border-[#e8731a]/60 bg-[#141414] px-3 text-[13px] text-zinc-100">
            <MagnifyingGlass size={15} className="text-zinc-400" />
            <input ref={caja} value={q} onChange={(e) => { setQ(e.target.value); setMarcado(0) }} aria-label="Buscar clientes, empleados, paneles y piezas" placeholder="Clientes, empleados, paneles, piezas…"
              onBlur={() => setTimeout(cerrar, 150)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrar() }
                else if (e.key === "ArrowDown") { e.preventDefault(); setMarcado((m) => Math.min(m + 1, Math.max(0, resultados.length - 1))) }
                else if (e.key === "ArrowUp") { e.preventDefault(); setMarcado((m) => Math.max(0, m - 1)) }
                else if (e.key === "Enter" && resultados[marcado]) { e.preventDefault(); elegir(resultados[marcado]) }
              }}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-500" />
          </div>
          {q.trim() && (
            <ul id="nv-buscador-lista" role="listbox" data-resultados className="absolute inset-x-0 top-11 z-[80] max-h-[60vh] overflow-y-auto rounded-lg border border-white/10 bg-[#141414] p-1 shadow-2xl">
              {lectura === "leyendo" && !resultados.length && <li className="px-3 py-2 text-[13px] text-zinc-500">Buscando…</li>}
              {lectura !== "leyendo" && !resultados.length && <li className="px-3 py-2 text-[13px] text-zinc-500">Nada con «{q.trim()}».</li>}
              {resultados.map((r, i) => (
                <li key={r.id} role="option" aria-selected={i === marcado} data-resultado={r.tipo}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(r)} onMouseEnter={() => setMarcado(i)}
                    className={`flex w-full items-baseline gap-3 rounded-md px-3 py-2 text-left ${i === marcado ? "bg-white/[0.07]" : ""}`}>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-zinc-100">{r.titulo}</span>
                    <span className="shrink-0 text-[12px] text-zinc-500">{r.detalle}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
