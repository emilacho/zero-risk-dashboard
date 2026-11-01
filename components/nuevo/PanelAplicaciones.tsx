"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import type { Pizarron } from "@/lib/pizarron-datos"
import { APLICACIONES, type ClaveDeAplicacion } from "@/lib/aplicaciones-marketing"
import { PanelPizarron, textoDeLaFase } from "@/components/nuevo/PanelPizarron"
import { PanelManual } from "@/components/nuevo/PanelManual"
import { PanelPlan } from "@/components/nuevo/PanelPlan"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { PanelInformes } from "@/components/nuevo/PanelInformes"
import { PanelBrief } from "@/components/nuevo/PanelBrief"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { PanelEquipo } from "@/components/nuevo/PanelEquipo"
import type { Centro } from "@/lib/centro-datos"

const AMBAR = "#e8731a"
type Respuesta = ({ ok: true } & Pizarron) | { ok: false; error: string }
type RespuestaCentro = ({ ok: true } & Centro) | { ok: false; error: string }

const ESTILO = `
.ap-cuadro{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease;animation:apEntra .5s cubic-bezier(.2,.8,.2,1) both}
.ap-cuadro:hover{transform:translateY(-3px) scale(1.02);border-color:rgba(232,115,26,.75);background:rgba(232,115,26,.08);box-shadow:0 0 0 1px rgba(232,115,26,.35),0 10px 30px rgba(0,0,0,.45),0 0 26px rgba(232,115,26,.22)}
.ap-cuadro:hover .ap-icono{filter:drop-shadow(0 0 8px rgba(232,115,26,.8))}
.ap-cuadro[data-aviso="true"] .ap-punto{animation:apLate 2.2s ease-in-out infinite}
@keyframes apEntra{from{opacity:0;transform:translateY(10px) scale(.9)}to{opacity:1;transform:none}}
@keyframes apLate{0%,100%{box-shadow:0 0 0 0 rgba(245,165,36,.6)}50%{box-shadow:0 0 0 6px rgba(245,165,36,0)}}
@media (prefers-reduced-motion:reduce){.ap-cuadro{transition:none;animation:none}.ap-cuadro[data-aviso="true"] .ap-punto{animation:none}}
`

/** el icono de cada cuadro: trazos finos en ámbar, como los rótulos de la escena */
function Icono({ clave }: { clave: ClaveDeAplicacion }) {
  const p = { fill: "none", stroke: AMBAR, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (clave) {
    case "manual": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-9 w-9"><path {...p} d="M6 7.5A2.5 2.5 0 0 1 8.5 5H16v21H8.5A2.5 2.5 0 0 0 6 28.5V7.5ZM26 7.5A2.5 2.5 0 0 0 23.5 5H16v21h7.5a2.5 2.5 0 0 1 2.5 2.5V7.5Z" /><path {...p} d="M9.5 10.5h3.5M9.5 14h3.5M19 10.5h3.5M19 14h3.5" /></svg>
    case "plan": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-9 w-9"><path {...p} d="M5 26h22M8 26V14M16 26V8M24 26v-9" /><path {...p} d="M8 14l8-6 8 3" /><circle cx="8" cy="14" r="1.6" {...p} /><circle cx="16" cy="8" r="1.6" {...p} /><circle cx="24" cy="11" r="1.6" {...p} /></svg>
    case "calendario": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-9 w-9"><rect x="5" y="7" width="22" height="20" rx="2.5" {...p} /><path {...p} d="M5 12.5h22M11 4.5v5M21 4.5v5" /><path {...p} d="M9.5 17h3v3h-3zM14.5 17h3v3h-3zM19.5 17h3v3h-3zM9.5 22h3v3h-3zM14.5 22h3v3h-3z" /></svg>
    case "piezas": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-9 w-9"><rect x="4" y="9" width="18" height="18" rx="2" {...p} /><path {...p} d="M10 5h16a2 2 0 0 1 2 2v16" /><path {...p} d="M4 22l5-5 4 4 3-3 6 6" /><circle cx="16" cy="14" r="1.8" {...p} /></svg>
    case "brief": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-9 w-9"><path {...p} d="M7 6h18v22H7z" /><path {...p} d="M11 12h10M11 16h10M11 20h6" /><path {...p} d="M12 3v5M20 3v5" /></svg>
    case "gran_idea": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-9 w-9"><path {...p} d="M16 4a8 8 0 0 0-4.5 14.6c.9.7 1.5 1.7 1.5 2.9V23h6v-1.5c0-1.2.6-2.2 1.5-2.9A8 8 0 0 0 16 4Z" /><path {...p} d="M13 26h6M14 29h4" /><path {...p} d="M16 10v4M14 12h4" /></svg>
    case "equipo": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-9 w-9"><circle cx="16" cy="10" r="3.5" {...p} /><circle cx="7.5" cy="13" r="2.8" {...p} /><circle cx="24.5" cy="13" r="2.8" {...p} /><path {...p} d="M10 25c0-4 2.7-6.5 6-6.5s6 2.5 6 6.5" /><path {...p} d="M3 24c0-3 2-5 4.5-5 .9 0 1.7.2 2.4.6M29 24c0-3-2-5-4.5-5-.9 0-1.7.2-2.4.6" /></svg>
    case "informes": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-9 w-9"><path {...p} d="M8 4h11l6 6v18H8V4Z" /><path {...p} d="M19 4v6h6" /><path {...p} d="M12 22v-4M16 22v-7M20 22v-5" /><path {...p} d="M12 13h3" /></svg>
    case "gasto": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-9 w-9"><circle cx="16" cy="16" r="11" {...p} /><path {...p} d="M16 9.5v13M19.5 12.5c0-1.5-1.5-2.5-3.5-2.5s-3.5 1-3.5 2.5 1.5 2.3 3.5 2.6 3.5 1.2 3.5 2.7-1.5 2.7-3.5 2.7-3.5-1-3.5-2.5" /></svg>
  }
}

/** la segunda línea de cada cuadro: un dato de la lectura cuando lo hay, si no la descripción fija */
export function detalleDelCuadro(clave: ClaveDeAplicacion, datos: Pizarron | null, centro: Centro | null = null): { texto: string; aviso: boolean } {
  const fijo = APLICACIONES.find((a) => a.clave === clave)!.descripcion
  // 6.10: la segunda línea de informes · brief · gran idea · equipo la trae una lectura aparte (`/api/centro`), con lo real o con lo que falta
  if (centro) {
    if (clave === "informes") return { texto: centro.informes.texto, aviso: centro.informes.aviso }
    if (clave === "brief") return { texto: centro.brief.texto, aviso: centro.brief.aviso }
    if (clave === "gran_idea") return { texto: centro.gran_idea.texto, aviso: centro.gran_idea.aviso }
    if (clave === "equipo") return { texto: centro.equipo.texto, aviso: centro.equipo.aviso }
  }
  if (!datos) return { texto: fijo, aviso: false }
  if (clave === "plan") return { texto: datos.campana ? textoDeLaFase(datos) : "Sin campaña todavía", aviso: false }
  if (clave === "calendario") return { texto: datos.campana ? (datos.filas.length ? `${datos.filas.length} publicaciones${datos.campana.del_plan_anterior ? " · del plan anterior" : ""}` : "La campaña todavía no tiene publicaciones") : "Sin campaña todavía", aviso: false }
  if (clave === "piezas") { const n = datos.totales.emilio ?? 0; return { texto: n ? `${n} ${n === 1 ? "pieza espera" : "piezas esperan"} tu aprobación` : "Nada por aprobar ahora", aviso: n > 0 } }
  return { texto: fijo, aviso: false }
}

const CLASE_DEL_CUADRO = "ap-cuadro relative flex aspect-[1/0.92] flex-col items-start justify-end rounded-2xl border border-white/10 bg-[#171717]/90 p-4 text-left shadow-xl focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400 sm:aspect-[1/0.85]"

export function PanelAplicaciones({ onCerrar, datosIniciales = null }: { onCerrar: () => void; datosIniciales?: Pizarron | null }) {
  const [datos, setDatos] = useState<Pizarron | null>(datosIniciales)
  const [centro, setCentro] = useState<Centro | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [cliente, setCliente] = useState<string | null>(datosIniciales?.cliente?.id ?? null)
  const [vista, setVista] = useState<"inicio" | ClaveDeAplicacion>("inicio")
  // una pieza abierta desde el calendario: al cerrarla se vuelve al calendario, no a los cuadros
  const [piezaAbierta, setPiezaAbierta] = useState<{ id: string; desde: "calendario" | "inicio" } | null>(null)
  const primero = useRef<HTMLAnchorElement>(null)

  useEffect(() => { if (vista === "inicio") primero.current?.focus() }, [vista])
  // Esc cierra las aplicaciones y NO la oficina (captura + stop); cuando el calendario está encima, su propio Esc lo cierra y volvemos aquí
  useEffect(() => {
    if (vista !== "inicio") return
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, vista])

  const leer = useCallback(async (id: string | null) => {
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/pizarron${id ? `?cliente=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver las aplicaciones." : (j && !j.ok && j.error) || `No pude leer los datos del cliente (${r.status}).`)
      setDatos(j); setCliente(j.cliente?.id ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [])
  useEffect(() => { if (!datosIniciales) void leer(null) }, [leer, datosIniciales])
  // la segunda línea de los cuadros nuevos (6.10): una lectura liviana aparte, por cliente; si falla, los cuadros quedan con su descripción fija
  const idDelCentro = datos?.cliente?.id ?? null
  useEffect(() => {
    if (!datos) return
    let vivo = true
    setCentro(null)
    fetch(`/api/centro${idDelCentro ? `?cliente=${encodeURIComponent(idDelCentro)}` : ""}`, { cache: "no-store" })
      .then(async (r) => { const j = (await r.json().catch(() => null)) as RespuestaCentro | null; if (vivo && r.ok && j && j.ok) setCentro(j) })
      .catch(() => {})
    return () => { vivo = false }
  }, [datos, idDelCentro])

  const volverAlInicio = useCallback(() => setVista("inicio"), [])
  const abrirPieza = useCallback((id: string) => { setPiezaAbierta({ id, desde: "calendario" }); setVista("piezas") }, [])
  const cerrarPiezas = useCallback(() => { setVista(piezaAbierta?.desde === "calendario" ? "calendario" : "inicio"); setPiezaAbierta(null) }, [piezaAbierta])
  if (vista === "calendario") return <PanelPizarron onCerrar={volverAlInicio} datosIniciales={datos} onAbrirPieza={abrirPieza} />
  if (vista === "manual") return <PanelManual onCerrar={volverAlInicio} clienteInicial={cliente} />
  if (vista === "plan") return <PanelPlan onCerrar={volverAlInicio} clienteInicial={cliente} />
  if (vista === "piezas") return <PanelPiezas onCerrar={cerrarPiezas} clienteInicial={cliente} piezaInicial={piezaAbierta?.id ?? null} />
  if (vista === "informes") return <PanelInformes onCerrar={volverAlInicio} clienteInicial={cliente} />
  if (vista === "brief") return <PanelBrief onCerrar={volverAlInicio} clienteInicial={cliente} />
  if (vista === "gran_idea") return <PanelGranIdea onCerrar={volverAlInicio} clienteInicial={cliente} />
  if (vista === "equipo") return <PanelEquipo onCerrar={volverAlInicio} clienteInicial={cliente} />

  const idCliente = datos?.cliente?.id ?? null
  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[3px] sm:p-8" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="aplicaciones-titulo" data-seccion="aplicaciones" className="relative w-full max-w-[780px] text-zinc-200">
        <header className="mb-5 flex flex-wrap items-center gap-3 px-1">
          <h2 id="aplicaciones-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.3em]" style={{ color: AMBAR }}>Centro de campaña</h2>
          <p className="hidden text-[12px] text-zinc-400 md:block">Dept. Marketing · los 9 pasos de la campaña, en el orden de la cadena</p>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-zinc-400">
            <span>Cliente</span>
            <select value={cliente ?? ""} onChange={(e) => void leer(e.target.value || null)} disabled={!datos || cargando} aria-label="Elegir el cliente"
              className="rounded-md border border-white/15 bg-black/60 px-2 py-1 text-[13px] text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
              {(datos?.clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.con_campana ? "" : " · sin campaña"}</option>)}
              {!datos && <option value="">Leyendo…</option>}
            </select>
          </label>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </header>

        {error && <p role="alert" className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200">{error}</p>}

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" aria-label="Los 9 pasos del Centro de campaña">
          {APLICACIONES.map((a, i) => {
            const d = detalleDelCuadro(a.clave, datos, centro)
            const href = a.enlace(idCliente)
            const retraso = { animationDelay: `${i * 45}ms` }
            const dentro = (
              <>
                <span className="ap-punto absolute right-3 top-3 h-2 w-2 rounded-full" style={{ background: d.aviso ? "#f5a524" : "transparent" }} aria-hidden />
                <span data-paso={a.paso} className="absolute left-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 text-[10.5px] font-medium text-zinc-400" aria-label={`Paso ${a.paso}`}>{a.paso}</span>
                <Icono clave={a.clave} />
                <span className="mt-3 block text-[14px] font-medium text-zinc-100">{a.nombre}</span>
                <span className="mt-1 block min-h-[2.4em] text-[11.5px] leading-snug text-zinc-400">{cargando && !datos ? "Leyendo…" : d.texto}</span>
              </>
            )
            return (
              <li key={a.clave} className="contents">
                {href
                  ? <a ref={i === 0 ? (primero as RefObject<HTMLAnchorElement>) : undefined} href={href} data-aplicacion={a.clave} data-aviso={d.aviso} className={CLASE_DEL_CUADRO} style={retraso}>{dentro}</a>
                  : <button type="button" data-aplicacion={a.clave} data-aviso={d.aviso} onClick={() => setVista(a.clave)} aria-haspopup="dialog" className={CLASE_DEL_CUADRO} style={retraso}>{dentro}</button>}
              </li>
            )
          })}
        </ul>
        <p className="mt-4 px-1 text-[11.5px] text-zinc-500">Esc o clic fuera para volver a la oficina</p>
      </section>
    </div>
  )
}
