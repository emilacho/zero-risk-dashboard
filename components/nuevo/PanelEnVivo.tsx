"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { haceCuanto } from "@/lib/oficinas"
import { CENTRO, LIENZO, OFICINAS_EN_VIVO, entreLasRecientes, filasNuevas, recorridoDelPulso, ubicarEmpleados, type ClaveDeOficina, type FilaEnVivo } from "@/lib/en-vivo"

/** aire a los lados del lienzo: las etiquetas de los empleados de las oficinas de los extremos no se cortan */
const MARGEN = 70
const CADA_MS = 5_000
const GUARDAR = 30
const VIDA_DEL_PULSO_MS = 4_200
const SEPARACION_MS = 650
const MAXIMO_DE_PULSOS_POR_TANDA = 6
const AMBAR = "#ffa53a"
const AMBAR_SUAVE = "rgba(255,165,58,0.26)"

interface Pulso { clave: string; recorrido: string; oficina: ClaveDeOficina | null; empleado: string }
interface Respuesta { ok: boolean; filas: FilaEnVivo[]; hoy: number; cursor: string | null }

const LUZ = { trabajando: "bg-amber-400 animate-pulse", listo: "bg-zinc-400", fallo: "bg-rose-500" } as const

/** el rombo isométrico de una oficina: losa fina, trazo ámbar */
function Losa({ x, y, ancho, activa, grande }: { x: number; y: number; ancho: number; activa: boolean; grande?: boolean }) {
  const a = ancho, b = ancho * 0.5, g = grande ? 9 : 7
  return (
    <g style={{ filter: activa ? "drop-shadow(0 0 9px rgba(255,150,40,.75))" : undefined, transition: "filter .4s ease" }}>
      <polygon points={`${x - a},${y} ${x},${y + b} ${x},${y + b + g} ${x - a},${y + g}`} fill="#1a1a1a" stroke={AMBAR_SUAVE} strokeWidth="0.8" />
      <polygon points={`${x + a},${y} ${x},${y + b} ${x},${y + b + g} ${x + a},${y + g}`} fill="#161616" stroke={AMBAR_SUAVE} strokeWidth="0.8" />
      <polygon points={`${x},${y - b} ${x + a},${y} ${x},${y + b} ${x - a},${y}`} fill={activa ? "#2a2018" : "#222"} stroke={activa ? AMBAR : "rgba(255,165,58,.55)"} strokeWidth="1" style={{ transition: "fill .4s ease, stroke .4s ease" }} />
    </g>
  )
}

const centroDe = (clave: ClaveDeOficina) => OFICINAS_EN_VIVO.find((o) => o.clave === clave) ?? CENTRO

export function PanelEnVivo({ onCerrar }: { onCerrar: () => void }) {
  const [filas, setFilas] = useState<FilaEnVivo[]>([])
  const [hoy, setHoy] = useState(0)
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState(false)
  const [pulsos, setPulsos] = useState<Pulso[]>([])
  const [quieto, setQuieto] = useState(false)
  const cursor = useRef<string | null>(null)
  const vistos = useRef(new Set<string>())
  const filasRef = useRef<FilaEnVivo[]>([])
  const [ahora, setAhora] = useState(() => Date.now())
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([])
  const cerrar = useRef<HTMLButtonElement>(null)
  const nodos = useMemo(() => ubicarEmpleados(filas), [filas])

  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 15_000); return () => clearInterval(t) }, [])
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)")
    setQuieto(m.matches)
    const f = () => setQuieto(m.matches)
    m.addEventListener("change", f)
    return () => m.removeEventListener("change", f)
  }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar() }
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [onCerrar])

  useEffect(() => {
    let vivo = true
    const lanzar = (nuevas: FilaEnVivo[], posiciones: ReturnType<typeof ubicarEmpleados>) => {
      nuevas.slice(-MAXIMO_DE_PULSOS_POR_TANDA).forEach((f, i) => {
        const t = setTimeout(() => {
          if (!vivo || !f.oficina) return
          const lugar = posiciones.find((n) => n.empleado === f.empleado) ?? null
          const p: Pulso = { clave: `${f.id}`, recorrido: recorridoDelPulso(f.oficina, lugar), oficina: f.oficina, empleado: f.empleado }
          setPulsos((prev) => [...prev.filter((x) => x.clave !== p.clave), p])
          const quitar = setTimeout(() => { if (vivo) setPulsos((prev) => prev.filter((x) => x.clave !== p.clave)) }, VIDA_DEL_PULSO_MS)
          temporizadores.current.push(quitar)
        }, i * SEPARACION_MS)
        temporizadores.current.push(t)
      })
    }
    let primera = true
    const leer = async () => {
      if (document.hidden || !navigator.onLine) return
      try {
        const r = await fetch(`/api/en-vivo?limite=${primera ? 16 : 12}${cursor.current ? `&desde=${encodeURIComponent(cursor.current)}` : ""}`, { cache: "no-store" })
        if (!r.ok) throw new Error(String(r.status))
        const j = (await r.json()) as Respuesta
        if (!vivo || !j.ok) return
        setError(false); setHoy(j.hoy); setCargado(true)
        if (j.cursor) cursor.current = j.cursor
        const nuevas = filasNuevas(vistos.current, j.filas)
        nuevas.forEach((f) => vistos.current.add(f.id))
        if (!nuevas.length) { primera = false; return }
        const ya = new Set(j.filas.map((x) => x.id))
        const juntas = [...j.filas, ...filasRef.current.filter((x) => !ya.has(x.id))].sort((a, b) => (a.cuando < b.cuando ? 1 : -1)).slice(0, GUARDAR)
        filasRef.current = juntas
        setFilas(juntas)
        // los pulsos se calculan con la posición que tendrán tras este cambio (fuera del actualizador: en desarrollo React lo corre dos veces)
        lanzar(primera ? entreLasRecientes(nuevas, Date.now()) : nuevas, ubicarEmpleados(juntas))
        primera = false
      } catch { if (vivo) { setError(true); primera = false } }
    }
    void leer()
    const t = setInterval(leer, CADA_MS)
    const alVolver = () => { if (!document.hidden) void leer() }
    document.addEventListener("visibilitychange", alVolver)
    const pendientes = temporizadores.current
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", alVolver); pendientes.forEach(clearTimeout) }
  }, [])

  const activas = new Set(pulsos.map((p) => p.oficina).filter(Boolean))
  const activos = new Set(pulsos.map((p) => p.empleado))
  const lista = filas.slice(0, 9)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-8" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="envivo-titulo" data-seccion="en-vivo" className="relative flex max-h-full w-full max-w-[1280px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <span aria-hidden className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <h2 id="envivo-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>En vivo</h2>
          <p className="ml-2 hidden text-[12px] text-zinc-500 sm:block">Lo que pasa ahora en las oficinas</p>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_21rem] lg:overflow-hidden">
          <div className="relative min-h-[18rem] p-2 sm:p-4">
            <svg viewBox={`${-MARGEN} 0 ${LIENZO.w + MARGEN * 2} ${LIENZO.h}`} className="h-full w-full" role="img" aria-label="Las oficinas y los empleados que están trabajando; un punto ámbar viaja hacia quien trabaja" xmlns="http://www.w3.org/2000/svg">
              {/* trazos del centro a cada oficina */}
              {OFICINAS_EN_VIVO.map((o) => <line key={`t-${o.clave}`} x1={CENTRO.x} y1={CENTRO.y} x2={o.x} y2={o.y} stroke={activas.has(o.clave) ? AMBAR : AMBAR_SUAVE} strokeWidth="0.9" strokeDasharray="3 5" style={{ transition: "stroke .4s ease" }} />)}
              {/* trazos de cada oficina a sus empleados */}
              {nodos.map((n) => {
                const o = OFICINAS_EN_VIVO.find((x) => x.clave === n.oficina)!
                return <line key={`e-${n.empleado}`} x1={o.x} y1={o.y} x2={n.x} y2={n.y} stroke={activos.has(n.empleado) ? AMBAR : AMBAR_SUAVE} strokeWidth="0.7" style={{ transition: "stroke .4s ease" }} />
              })}
              <Losa x={CENTRO.x} y={CENTRO.y - 8} ancho={40} activa={pulsos.length > 0} grande />
              <text x={CENTRO.x} y={CENTRO.y + 44} textAnchor="middle" fontSize="11" letterSpacing="2.6" fill="#a1a1aa">ZERO RISK</text>
              {OFICINAS_EN_VIVO.map((o) => (
                <g key={o.clave}>
                  <Losa x={o.x} y={o.y - 8} ancho={30} activa={activas.has(o.clave)} />
                  <text x={o.x} y={o.y + 32} textAnchor="middle" fontSize="11.5" fill={activas.has(o.clave) ? "#f4f4f5" : "#a1a1aa"} style={{ transition: "fill .4s ease" }}>{o.nombre}</text>
                </g>
              ))}
              {nodos.map((n) => {
                const on = activos.has(n.empleado)
                return (
                  <g key={n.empleado} style={{ filter: on ? "drop-shadow(0 0 6px rgba(255,150,40,.9))" : undefined, transition: "filter .4s ease" }}>
                    <title>{n.agente}</title>
                    <circle cx={n.x} cy={n.y} r={on ? 5.5 : 4.2} fill="#141414" stroke={on ? AMBAR : "rgba(255,165,58,.6)"} strokeWidth="1" style={{ transition: "r .3s ease, stroke .4s ease" }} />
                    {on && <text x={n.x + (n.x < centroDe(n.oficina).x ? -9 : 9)} y={n.y + 3.5} textAnchor={n.x < centroDe(n.oficina).x ? "end" : "start"} fontSize="10" fill="#e4e4e7">{n.agente}</text>}
                  </g>
                )
              })}
              {/* los pulsos: un punto ámbar viaja del centro a la oficina y de ahí al empleado que trabaja */}
              {!quieto && pulsos.map((p) => (
                <circle key={p.clave} r="3.4" fill="#ffd08a" style={{ filter: "drop-shadow(0 0 7px rgba(255,160,50,1))" }}>
                  <animateMotion dur="1.7s" path={p.recorrido} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.45 0 0.35 1" />
                  <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.86;1" dur="1.9s" fill="freeze" />
                </circle>
              ))}
            </svg>
            {cargado && filas.length === 0 && <p className="absolute inset-x-0 top-1/2 text-center text-[13px] text-zinc-500">Todavía no hay trabajo para mostrar.</p>}
          </div>

          <aside className="flex min-h-0 flex-col border-t border-white/10 lg:border-l lg:border-t-0" aria-label="Lo que está pasando ahora">
            <h3 className="px-4 pb-2 pt-3 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Ahora</h3>
            <ul className="min-h-0 flex-1 divide-y divide-white/[0.06] overflow-y-auto px-2 pb-2">
              {!cargado && <li className="px-2 py-3 text-[13px] text-zinc-500">Leyendo…</li>}
              {lista.map((f) => (
                <li key={f.id} className="px-2 py-2.5">
                  <p className="flex items-center gap-2 text-[13px] font-medium text-zinc-100"><span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${LUZ[f.estado]}`} /><span className="truncate">{f.agente}</span>
                    {f.oficina_nombre && <span className="ml-auto shrink-0 text-[11px] font-normal text-zinc-500">{f.oficina_nombre}</span>}</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-zinc-300">{f.que_hace}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">{f.cliente ? `${f.cliente} · ` : ""}{haceCuanto(f.cuando, new Date(ahora))}</p>
                </li>
              ))}
            </ul>
            <p className="border-t border-white/10 px-4 py-2 text-[11px] text-zinc-500">{hoy} tareas en las últimas 24 horas{error ? " · sin conexión, reintentando" : ""}</p>
          </aside>
        </div>
      </section>
    </div>
  )
}
