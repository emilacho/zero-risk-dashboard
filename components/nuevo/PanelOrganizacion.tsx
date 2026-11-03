"use client"
/**
 * ORGANIZACIÓN · el organigrama vivo de toda la empresa (sprint 6.28-B · «dale» de Emilio 2-nov a ChartHop como referencia; la fachada es nuestra).
 * Como ChartHop: árbol de arriba hacia abajo (dueño → gerente general → departamentos → equipos), tarjetas de persona con estado, departamentos que se abren y cierran
 * con su conteo, equipos apilados, puestos por cubrir en línea punteada, buscador, filtros por estado, zoom con la rueda, arrastrar para moverse y ficha lateral.
 * SOLO LECTURA. Nada de dinero aquí: eso vive en la pantalla Dinero.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as PE, type WheelEvent as WE } from "react"
import { HORA_24 } from "@/lib/formato"
import { aSuCargo, coincide, NOMBRE_DEL_ESTADO, inicialesDe as iniciales, resumenQueSuma, type Departamento, type EquipoDeOrg, type EstadoDePersona, type Organizacion, type Persona } from "@/lib/direccion-organizacion"

const AMBAR = "#e8731a"
const COLOR_DEL_ESTADO: Record<EstadoDePersona, string> = { trabajando: "#ffb020", activo: "#7fc99a", por_activar: "#8a8580", apagado: "#5a5653" }
type Filtro = "todos" | EstadoDePersona

/* medidas del lienzo (px a escala 1) */
const TW = 236, TH = 62, DH = 92, GW = 252, GAP_G = 18, GAP_D = 44, FILA = 50, CAB = 52, PIE = 10, Y0 = 24
const Y1 = Y0 + TH + 46, Y2 = Y1 + TH + 54, Y3 = Y2 + DH + 50

const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-EC", { day: "numeric", month: "short", ...HORA_24 }) : "—")

interface Caja { x: number; y: number; w: number; h: number }
interface Plano { ancho: number; alto: number; dueno: Caja; gerente: Caja; deptos: Array<{ d: Departamento; caja: Caja; abierto: boolean; grupos: Array<{ e: EquipoDeOrg; caja: Caja }> }> }

function planear(org: Organizacion, abiertos: Set<string>): Plano {
  const cols = org.departamentos.map((d) => {
    const abierto = abiertos.has(d.clave) && d.equipos.length > 0
    const n = abierto ? d.equipos.length : 0
    return { d, abierto, ancho: Math.max(TW, n * GW + Math.max(0, n - 1) * GAP_G) }
  })
  let x = 0, alto = Y2 + DH
  const deptos = cols.map((c) => {
    const caja = { x: x + (c.ancho - TW) / 2, y: Y2, w: TW, h: DH }
    let gx = x + (c.ancho - (c.abierto ? c.d.equipos.length * GW + (c.d.equipos.length - 1) * GAP_G : 0)) / 2
    const grupos = c.abierto ? c.d.equipos.map((e) => {
      const h = CAB + (e.miembros.length + e.por_cubrir.length) * FILA + PIE
      const g = { e, caja: { x: gx, y: Y3, w: GW, h } }
      gx += GW + GAP_G; alto = Math.max(alto, Y3 + h)
      return g
    }) : []
    x += c.ancho + GAP_D
    return { d: c.d, caja, abierto: c.abierto, grupos }
  })
  const ancho = Math.max(TW, x - GAP_D)
  const centro = deptos.length ? (deptos[0].caja.x + deptos.at(-1)!.caja.x + TW) / 2 : ancho / 2
  return { ancho, alto: alto + 40, dueno: { x: centro - TW / 2, y: Y0, w: TW, h: TH }, gerente: { x: centro - TW / 2, y: Y1, w: TW, h: TH }, deptos }
}

/** codo de arriba hacia abajo: baja, cruza y vuelve a bajar */
const codo = (x1: number, y1: number, x2: number, y2: number) => { const m = y1 + (y2 - y1) / 2; return `M${x1},${y1} V${m} H${x2} V${y2}` }

function Avatar({ p, color, tam = 34 }: { p: { nombre: string; estado: EstadoDePersona }; color: string; tam?: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide text-white" style={{ width: tam, height: tam, background: `linear-gradient(145deg, ${color}55, ${color}22)`, boxShadow: `inset 0 0 0 1px ${color}88` }}>
      {iniciales(p.nombre)}
      <span data-punto={p.estado} className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#1a1714] ${p.estado === "trabajando" ? "or-late" : ""}`} style={{ background: p.estado === "por_activar" ? "transparent" : COLOR_DEL_ESTADO[p.estado], boxShadow: p.estado === "por_activar" ? `inset 0 0 0 1.5px ${COLOR_DEL_ESTADO.por_activar}` : undefined }} />
    </span>
  )
}

export function PanelOrganizacion({ onCerrar, datosIniciales = null, fetchImpl = fetch }: { onCerrar: () => void; datosIniciales?: Organizacion | null; fetchImpl?: typeof fetch }) {
  const [org, setOrg] = useState<Organizacion | null>(datosIniciales)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set()) // como ChartHop: abre con los departamentos cerrados y su conteo; al abrir uno, la vista va hacia él
  const [elegido, setElegido] = useState<string | null>(null)
  const [busca, setBusca] = useState("")
  const [filtro, setFiltro] = useState<Filtro>("todos")
  const [vista, setVista] = useState({ x: 0, y: 0, s: 1 })
  const lienzo = useRef<HTMLDivElement | null>(null)
  const cerrar = useRef<HTMLButtonElement | null>(null)
  const arrastre = useRef<{ x: number; y: number; vx: number; vy: number; movio: boolean } | null>(null)
  const encuadrado = useRef(false)
  const centrarEn = useRef<string | null>(null)

  const leer = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetchImpl("/api/direccion/organizacion", { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as ({ ok?: boolean; error?: string } & Organizacion) | null
      if (!r.ok || !j?.ok) throw new Error(j?.error === "sin_permiso" || j?.error === "sin_sesion" ? "Esta pantalla es solo para el administrador." : `No se pudo leer la organización${j?.error ? ` · ${j.error}` : ""}`)
      setOrg(j)
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo leer la organización") } finally { setCargando(false) }
  }, [fetchImpl])
  useEffect(() => { void leer() }, [leer])
  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); if (elegido) setElegido(null); else onCerrar() }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, elegido])

  /* búsqueda: abre los departamentos donde hay coincidencias */
  const visibles = useMemo(() => {
    if (!org) return null
    const s = new Set<string>()
    for (const p of Object.values(org.personas)) if (coincide(p, busca, org) && (filtro === "todos" || p.estado === filtro)) s.add(p.id)
    return s
  }, [org, busca, filtro])
  const filtrando = !!busca.trim() || filtro !== "todos"
  useEffect(() => {
    if (!org || !busca.trim() || !visibles) return
    const conCoincidencias = org.departamentos.filter((d) => d.equipos.some((e) => e.miembros.some((id) => visibles.has(id)))).map((d) => d.clave)
    if (conCoincidencias.length) setAbiertos((a) => new Set([...a, ...conCoincidencias]))
  }, [busca, org, visibles])

  const plano = useMemo(() => (org ? planear(org, abiertos) : null), [org, abiertos])

  /* encuadre: legible (nunca menos de 0,7) y centrado arriba, como abre ChartHop */
  const ajustar = useCallback(() => {
    const el = lienzo.current; if (!el || !plano) return
    const s = Math.min(1, Math.max(0.7, (el.clientWidth - 48) / plano.ancho))
    setVista({ s, x: (el.clientWidth - plano.ancho * s) / 2, y: 8 })
  }, [plano])
  useLayoutEffect(() => { if (plano && !encuadrado.current) { encuadrado.current = true; ajustar() } }, [plano, ajustar])
  /* al abrir un departamento, la vista se corre para mostrar sus equipos */
  useLayoutEffect(() => {
    const k = centrarEn.current; const el = lienzo.current; if (!k || !plano || !el) return
    centrarEn.current = null
    const d = plano.deptos.find((x) => x.d.clave === k); if (!d || !d.grupos.length) return
    const izq = d.grupos[0].caja.x, der = d.grupos.at(-1)!.caja.x + GW
    // que entren todos sus equipos si se puede sin bajar de 0,6 (legible); el departamento queda arriba
    setVista((v) => { const sc = Math.min(v.s, Math.max(0.6, (el.clientWidth - 40) / (der - izq))); return { s: sc, x: el.clientWidth / 2 - ((izq + der) / 2) * sc, y: 24 - Y2 * sc } })
  }, [plano])

  const zoom = useCallback((f: number, cx?: number, cy?: number) => {
    const el = lienzo.current; if (!el) return
    const px = cx ?? el.clientWidth / 2, py = cy ?? el.clientHeight / 2
    setVista((v) => { const s = Math.min(1.8, Math.max(0.3, v.s * f)); return { s, x: px - ((px - v.x) * s) / v.s, y: py - ((py - v.y) * s) / v.s } })
  }, [])
  const rueda = (e: WE<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top) }
  const baja = (e: PE<HTMLDivElement>) => { if (e.button !== 0) return; arrastre.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y, movio: false } }
  const mueve = (e: PE<HTMLDivElement>) => {
    const a = arrastre.current; if (!a) return
    const dx = e.clientX - a.x, dy = e.clientY - a.y
    if (!a.movio && Math.hypot(dx, dy) < 4) return
    if (!a.movio) { a.movio = true; e.currentTarget.setPointerCapture(e.pointerId) }
    setVista((v) => ({ ...v, x: a.vx + dx, y: a.vy + dy }))
  }
  const suelta = () => { setTimeout(() => { arrastre.current = null }, 0) }
  const clic = (fn: () => void) => () => { if (arrastre.current?.movio) return; fn() }

  /* llevar a una persona al centro (búsqueda con Enter y «Reporta a» en la ficha) */
  const enfocar = useCallback((id: string) => {
    if (!org || !plano) return
    const p = org.personas[id]; if (!p) return
    if (!abiertos.has(p.departamento) && org.departamentos.some((d) => d.clave === p.departamento && d.jefe !== id)) { setAbiertos((a) => new Set([...a, p.departamento])); setElegido(id); return }
    setElegido(id)
    const el = lienzo.current; const caja = cajaDe(id); if (!el || !caja) return
    setVista((v) => ({ ...v, x: el.clientWidth / 2 - (caja.x + caja.w / 2) * v.s - 180, y: el.clientHeight / 2 - (caja.y + caja.h / 2) * v.s }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, plano, abiertos])
  function cajaDe(id: string): Caja | null {
    if (!plano || !org) return null
    if (id === org.gerente) return plano.gerente
    for (const d of plano.deptos) {
      if (d.d.jefe === id) return d.caja
      for (const g of d.grupos) { const i = g.e.miembros.indexOf(id); if (i >= 0) return { x: g.caja.x, y: g.caja.y + CAB + i * FILA, w: GW, h: FILA } }
    }
    return null
  }

  const tenue = (id: string | null) => filtrando && visibles && (!id || !visibles.has(id))
  const p = elegido && org ? org.personas[elegido] : null
  const conteo = (f: Filtro) => (org ? (f === "todos" ? Object.keys(org.personas).length : Object.values(org.personas).filter((x) => x.estado === f).length) : 0)

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{".or-late{animation:orLate 1.6s ease-in-out infinite}@keyframes orLate{50%{box-shadow:0 0 0 4px rgba(255,176,32,.25)}}.or-lienzo{cursor:grab}.or-lienzo:active{cursor:grabbing}@media (prefers-reduced-motion:reduce){.or-late{animation:none}}"}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="organizacion-titulo" data-seccion="organizacion" className="relative flex h-full max-h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161412] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="organizacion-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Organización</h2>
          {org && <p data-resumen className="text-[12px] text-zinc-400">{resumenQueSuma(org.resumen)}</p>}
          <button type="button" onClick={() => void leer()} disabled={cargando} className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">{cargando ? "Leyendo…" : "Actualizar"}</button>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar la organización" className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-2.5 sm:px-6">
          <input data-buscar value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && org && visibles) { const id = [...visibles][0]; if (id) enfocar(id) } }}
            placeholder="Buscar por nombre, puesto o equipo" aria-label="Buscar en la organización"
            className="w-[min(280px,100%)] rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-amber-500/50" />
          <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
            {(["todos", "trabajando", "activo", "por_activar", ...(conteo("apagado") > 0 ? ["apagado"] : [])] as Filtro[]).map((f) => (
              <button key={f} type="button" data-filtro={f} aria-pressed={filtro === f} onClick={() => setFiltro(f)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${filtro === f ? "border-amber-500/60 bg-amber-500/10 text-zinc-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>
                {f !== "todos" && <span className="h-2 w-2 rounded-full" style={{ background: f === "por_activar" ? "transparent" : COLOR_DEL_ESTADO[f], boxShadow: f === "por_activar" ? `inset 0 0 0 1.5px ${COLOR_DEL_ESTADO.por_activar}` : undefined }} />}
                {f === "todos" ? "Todos" : NOMBRE_DEL_ESTADO[f]} <span className="tabular-nums text-zinc-500">{conteo(f)}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => org && setAbiertos(new Set(org.departamentos.map((d) => d.clave)))} className="rounded-md border border-white/10 px-2 py-1 text-[12px] text-zinc-400 hover:text-zinc-200">Abrir todo</button>
            <button type="button" onClick={() => setAbiertos(new Set())} className="rounded-md border border-white/10 px-2 py-1 text-[12px] text-zinc-400 hover:text-zinc-200">Cerrar todo</button>
            <span className="mx-1 h-4 w-px bg-white/10" />
            <button type="button" aria-label="Alejar" onClick={() => zoom(1 / 1.2)} className="h-7 w-7 rounded-md border border-white/10 text-zinc-300 hover:bg-white/[0.06]">−</button>
            <span data-zoom className="w-11 text-center text-[11.5px] tabular-nums text-zinc-500">{Math.round(vista.s * 100)} %</span>
            <button type="button" aria-label="Acercar" onClick={() => zoom(1.2)} className="h-7 w-7 rounded-md border border-white/10 text-zinc-300 hover:bg-white/[0.06]">+</button>
            <button type="button" onClick={ajustar} className="rounded-md border border-white/10 px-2 py-1 text-[12px] text-zinc-400 hover:text-zinc-200">Ajustar</button>
          </div>
        </div>

        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}

        <div className="relative min-h-0 flex-1">
          <div ref={lienzo} data-lienzo className="or-lienzo absolute inset-0 touch-none select-none overflow-hidden" onWheel={rueda} onPointerDown={baja} onPointerMove={mueve} onPointerUp={suelta} onPointerCancel={suelta}
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)", backgroundSize: `${22 * vista.s}px ${22 * vista.s}px`, backgroundPosition: `${vista.x}px ${vista.y}px` }}>
            {!org && cargando && <p className="p-6 text-[13px] text-zinc-500">Leyendo…</p>}
            {org && plano && (
              <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.s})`, width: plano.ancho, height: plano.alto }}>
                <svg className="pointer-events-none absolute left-0 top-0" width={plano.ancho} height={plano.alto} aria-hidden="true">
                  <g fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={1.2}>
                    <path d={codo(plano.dueno.x + TW / 2, plano.dueno.y + TH, plano.gerente.x + TW / 2, plano.gerente.y)} />
                    {plano.deptos.map(({ d, caja, grupos }) => (
                      <g key={d.clave}>
                        <path d={codo(plano.gerente.x + TW / 2, plano.gerente.y + TH, caja.x + TW / 2, caja.y)} />
                        {grupos.map((g) => <path key={g.e.clave} d={codo(caja.x + TW / 2, caja.y + DH, g.caja.x + GW / 2, g.caja.y)} stroke={`${g.e.color}55`} />)}
                      </g>
                    ))}
                  </g>
                </svg>

                {/* dueño y gerente */}
                <div data-persona="dueno" className="absolute flex items-center gap-3 rounded-lg border px-3" style={{ left: plano.dueno.x, top: plano.dueno.y, width: TW, height: TH, borderColor: `${AMBAR}66`, background: "linear-gradient(180deg,#221c17,#1a1714)", opacity: tenue(null) ? 0.3 : 1 }}>
                  <Avatar p={{ nombre: org.dueno.nombre, estado: "activo" }} color={AMBAR} />
                  <span className="min-w-0"><span className="block truncate text-[13px] font-medium text-zinc-100">{org.dueno.nombre}</span><span className="block truncate text-[11.5px] text-zinc-400">{org.dueno.puesto}</span></span>
                </div>
                {org.gerente && org.personas[org.gerente] && <TarjetaGrande p={org.personas[org.gerente]} caja={plano.gerente} color={AMBAR} elegida={elegido === org.gerente} tenue={!!tenue(org.gerente)} alElegir={clic(() => setElegido(org.gerente))} />}

                {plano.deptos.map(({ d, caja, abierto, grupos }) => {
                  const jefe = d.jefe ? org.personas[d.jefe] : null
                  const coincidencias = visibles ? d.equipos.reduce((n, e) => n + e.miembros.filter((id) => visibles.has(id)).length, 0) + (d.jefe && visibles.has(d.jefe) ? 1 : 0) : 0
                  return (
                    <div key={d.clave}>
                      <div data-depto={d.clave} data-abierto={abierto ? "" : undefined} className="absolute overflow-hidden rounded-lg border transition-opacity" style={{ left: caja.x, top: caja.y, width: TW, height: DH, borderColor: `${d.color}66`, background: "#1a1714", opacity: filtrando && coincidencias === 0 ? 0.3 : 1 }}>
                        <button type="button" onClick={clic(() => setAbiertos((a) => { const n = new Set(a); if (n.has(d.clave)) n.delete(d.clave); else { n.add(d.clave); centrarEn.current = d.clave } return n }))} disabled={!d.equipos.length}
                          aria-expanded={abierto} aria-label={`${abierto ? "Cerrar" : "Abrir"} ${d.nombre}`}
                          className="flex h-[30px] w-full items-center gap-2 px-3 text-left" style={{ background: `linear-gradient(90deg, ${d.color}33, transparent)` }}>
                          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: d.color }}>{d.nombre}</span>
                          {d.estado === "planeado" && <span className="rounded-full border border-white/15 px-1.5 text-[10px] text-zinc-400">planeado</span>}
                          <span data-total className="ml-auto inline-flex items-center gap-1 text-[11px] tabular-nums text-zinc-400">{d.total}{d.equipos.length > 0 && <span aria-hidden="true" className="text-zinc-500">{abierto ? "▴" : "▾"}</span>}</span>
                        </button>
                        {jefe ? (
                          <button type="button" data-persona={jefe.id} data-estado={jefe.estado} onClick={clic(() => setElegido(jefe.id))} className={`flex h-[62px] w-full items-center gap-3 px-3 text-left hover:bg-white/[0.03] ${elegido === jefe.id ? "bg-white/[0.05]" : ""}`} style={{ opacity: tenue(jefe.id) ? 0.35 : 1 }}>
                            <Avatar p={jefe} color={d.color} />
                            <span className="min-w-0"><span className="block truncate text-[13px] text-zinc-100">{jefe.nombre}</span><span className="block truncate text-[11.5px] text-zinc-400">Jefe de {d.nombre.toLowerCase()}</span></span>
                          </button>
                        ) : <p className="px-3 py-3 text-[12px] text-zinc-500">{d.total ? "Sin jefe asignado" : "Sin empleados todavía"}</p>}
                      </div>
                      {grupos.map(({ e, caja: g }) => (
                        <div key={e.clave} data-equipo={e.clave} data-etapa={e.etapa} className="absolute overflow-hidden rounded-lg border bg-[#1a1714]" style={{ left: g.x, top: g.y, width: GW, height: g.h, borderColor: "rgba(255,255,255,.09)", boxShadow: `inset 0 2px 0 ${e.color}` }}>
                          <div className="flex h-[52px] flex-col justify-center px-3" title={e.bloqueo ?? e.descripcion}>
                            <span className="flex items-center gap-2"><span className="truncate text-[12.5px] font-medium text-zinc-100">{e.nombre}</span><span className="ml-auto text-[11px] tabular-nums text-zinc-500">{e.miembros.length}</span></span>
                            <span className="truncate text-[11px]" style={{ color: e.etapa === "activo" ? "#9c948b" : "#8a8580" }}>{e.etapa === "activo" ? (d.clave === "marketing" ? "Activo" : d.nombre) : `Por activar${e.bloqueo ? ` · ${e.bloqueo}` : ""}`}</span>
                          </div>
                          {e.miembros.map((id) => <Fila key={id} p={org.personas[id]} color={e.color} elegida={elegido === id} tenue={!!tenue(id)} alElegir={clic(() => setElegido(id))} />)}
                          {e.por_cubrir.map((n) => (
                            <div key={n} data-por-cubrir className="mx-2 mb-1 flex h-[46px] items-center gap-2.5 rounded-md border border-dashed border-white/15 px-2" style={{ opacity: filtrando ? 0.3 : 1 }}>
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-white/20 text-[13px] text-zinc-500">+</span>
                              <span className="min-w-0"><span className="block truncate text-[12px] text-zinc-400">{n}</span><span className="block text-[10.5px] text-zinc-500">Puesto por cubrir</span></span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {p && org && <Ficha p={p} org={org} alCerrar={() => setElegido(null)} alIr={enfocar} />}
        </div>

        {org && (
          <footer className="border-t border-white/[0.06] px-4 py-2 text-[11.5px] text-zinc-500 sm:px-6">
            Rueda para acercar · arrastra para moverte · clic en un departamento para abrirlo o cerrarlo · clic en una persona para ver su ficha
          </footer>
        )}
      </section>
    </div>
  )
}

function TarjetaGrande({ p, caja, color, elegida, tenue, alElegir }: { p: Persona; caja: Caja; color: string; elegida: boolean; tenue: boolean; alElegir: () => void }) {
  return (
    <button type="button" data-persona={p.id} data-estado={p.estado} onClick={alElegir} className={`absolute flex items-center gap-3 rounded-lg border px-3 text-left transition-colors hover:bg-white/[0.03] ${elegida ? "bg-white/[0.05]" : ""}`}
      style={{ left: caja.x, top: caja.y, width: caja.w, height: caja.h, borderColor: elegida ? `${color}aa` : `${color}55`, background: elegida ? undefined : "#1a1714", opacity: tenue ? 0.3 : 1 }}>
      <Avatar p={p} color={color} />
      <span className="min-w-0"><span className="block truncate text-[13px] text-zinc-100">{p.nombre}</span><span className="block truncate text-[11.5px] text-zinc-400">{p.puesto}</span></span>
    </button>
  )
}

function Fila({ p, color, elegida, tenue, alElegir }: { p: Persona; color: string; elegida: boolean; tenue: boolean; alElegir: () => void }) {
  return (
    <button type="button" data-persona={p.id} data-estado={p.estado} onClick={alElegir}
      className={`mx-2 mb-1 flex h-[46px] w-[calc(100%-1rem)] items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-white/[0.04] ${elegida ? "bg-white/[0.06]" : ""}`}
      style={{ opacity: tenue ? 0.3 : 1, boxShadow: elegida ? `inset 0 0 0 1px ${color}88` : undefined }}>
      <Avatar p={p} color={color} tam={28} />
      <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] text-zinc-100">{p.nombre}</span><span className="block truncate text-[10.5px] text-zinc-500">{p.estado === "trabajando" ? (p.tarea ? `Trabajando · ${p.tarea}` : "Trabajando ahora") : p.especialidad ?? p.puesto}</span></span>
    </button>
  )
}

function Ficha({ p, org, alCerrar, alIr }: { p: Persona; org: Organizacion; alCerrar: () => void; alIr: (id: string) => void }) {
  const d = org.departamentos.find((x) => x.clave === p.departamento)
  const e = d?.equipos.find((x) => x.clave === p.equipo)
  const color = e?.color ?? d?.color ?? AMBAR
  const jefe = p.reporta_a ? org.personas[p.reporta_a] : null
  const cargo = aSuCargo(org, p.id)
  return (
    <aside data-ficha={p.id} aria-label={`Ficha de ${p.nombre}`} className="absolute bottom-3 right-3 top-3 flex w-[min(360px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1b1815]/95 shadow-2xl">
      <div className="relative px-5 pb-4 pt-5" style={{ background: `linear-gradient(180deg, ${color}26, transparent)` }}>
        <button type="button" onClick={alCerrar} aria-label="Cerrar la ficha" className="absolute right-3 top-3 h-7 w-7 rounded-md text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100">×</button>
        <Avatar p={p} color={color} tam={52} />
        <h3 className="mt-3 text-[16px] font-medium text-zinc-50">{p.nombre}</h3>
        <p className="text-[12.5px] text-zinc-400">{p.puesto}{d ? ` · ${d.nombre}` : ""}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-[12px]" style={{ color: COLOR_DEL_ESTADO[p.estado] }}><span className="h-2 w-2 rounded-full" style={{ background: COLOR_DEL_ESTADO[p.estado] }} />{NOMBRE_DEL_ESTADO[p.estado]}{p.estado === "trabajando" && p.tarea ? ` · ${p.tarea}` : ""}</p>
      </div>
      <dl className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 pb-5 text-[12.5px] [scrollbar-width:thin]">
        {e && <Dato t="Equipo">{e.nombre}{p.equipo_segun === "mapa" && <span className="block text-[11px] text-zinc-500">según el mapa firmado (sin tarjeta en el directorio)</span>}</Dato>}
        <Dato t="Reporta a">{jefe ? <button type="button" onClick={() => alIr(jefe.id)} className="text-left text-zinc-100 underline decoration-white/20 underline-offset-2 hover:decoration-amber-500">{jefe.nombre}</button> : p.id === org.gerente ? org.dueno.nombre : "—"}</Dato>
        {cargo.length > 0 && <Dato t={`A su cargo · ${cargo.length}`}><span className="flex flex-wrap gap-1">{cargo.map((id) => <button key={id} type="button" onClick={() => alIr(id)} className="rounded-full border border-white/10 px-2 py-0.5 text-[11.5px] text-zinc-300 hover:border-amber-500/50">{org.personas[id].nombre}</button>)}</span></Dato>}
        {p.especialidad && <Dato t="Especialidad">{p.especialidad}</Dato>}
        {p.sabe_hacer.length > 0 && <Dato t="Sabe hacer"><span className="flex flex-wrap gap-1">{p.sabe_hacer.map((s) => <span key={s} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11.5px] text-zinc-300">{s}</span>)}</span></Dato>}
        <Dato t="Trabajos en las últimas 24 h">{p.trabajos_24h}</Dato>
        <Dato t="Última actividad">{hora(p.ultima)}</Dato>
        {!p.instalado && <Dato t="Nota">Tiene tarjeta en el directorio pero no está instalado como empleado</Dato>}
      </dl>
    </aside>
  )
}

const Dato = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <div><dt className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{t}</dt><dd className="mt-0.5 text-zinc-200">{children}</dd></div>
)
