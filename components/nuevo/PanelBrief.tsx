"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { BriefDelCliente } from "@/lib/brief-datos"
import { estadoDelBriefLegible, seccionesDelBrief, type Brief, type TonoDelBrief } from "@/lib/brief"
import { diaYHora, plural, usdFinoES } from "@/lib/lenguaje"

/**
 * BRIEF DE CAMPAÑA (sprint 6.10 · encargo 01-nov §2 botón 4): lo que la mesa del brief le entrega a los creativos, corto y con secciones fijas. SOLO LECTURA.
 * Hoy (1-nov) la tabla del brief no está en producción (llega con T9): el panel lo dice tal cual y no inventa un brief. Versiones a la izquierda · el brief abierto al centro.
 */
const AMBAR = "#f5a524"
type Respuesta = ({ ok: true } & BriefDelCliente) | { ok: false; error: string }

const ESTILO = `
.br-entra{animation:brEntra .4s cubic-bezier(.2,.8,.2,1) both}
.br-nodo[aria-current="true"]{background:rgba(245,165,36,.12);color:#fde68a}
@keyframes brEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.br-entra{animation:none}}
`
const CHIP: Record<TonoDelBrief, string> = { ambar: "border-amber-400/50 text-amber-200", verde: "border-emerald-400/40 text-emerald-200", azul: "border-sky-400/40 text-sky-200", rojo: "border-rose-400/40 text-rose-200", neutro: "border-white/15 text-zinc-300" }
const Chip = ({ children, tono = "neutro" }: { children: React.ReactNode; tono?: TonoDelBrief }) => <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${CHIP[tono]}`}>{children}</span>
const Titulito = ({ children }: { children: React.ReactNode }) => <h4 className="mb-1 text-[11px] uppercase tracking-[0.08em] text-zinc-500">{children}</h4>
const MIGA = "rounded px-1.5 py-0.5 text-[12.5px] text-zinc-300 hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"
const Sep = () => <span className="text-zinc-600" aria-hidden>›</span>

export function PanelBrief({ onCerrar, datosIniciales = null, clienteInicial = null, fetchImpl = fetch }: {
  onCerrar: () => void
  datosIniciales?: BriefDelCliente | null
  clienteInicial?: string | null
  fetchImpl?: typeof fetch
}) {
  const [datos, setDatos] = useState<BriefDelCliente | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [briefId, setBriefId] = useState<string | null>(null)
  const cerrar = useRef<HTMLButtonElement>(null)

  const leer = useCallback(async (id: string | null) => {
    setCargando(true); setError(null)
    try {
      const r = await fetchImpl(`/api/brief${id ? `?cliente=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver el brief." : (j && !j.ok && j.error) || `No pude leer el brief (${r.status}).`)
      setDatos(j)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [fetchImpl])
  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => { if (!datosIniciales) void leer(clienteInicial) }, [leer, datosIniciales, clienteInicial])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); onCerrar() }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])

  const nombre = datos?.cliente?.nombre ?? "Cliente"
  const briefs = datos?.briefs ?? []
  const brief: Brief | null = briefs.length ? (briefId ? briefs.find((b) => b.id === briefId) ?? briefs[0] : briefs[0]) : null
  const resumen = datos ? (!datos.publicado ? "la cadena todavía no lo publica" : briefs.length ? plural(briefs.length, "versión", "versiones") : "todavía sin brief") : ""

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="brief-titulo" data-seccion="brief" className="relative flex h-full max-h-full w-full max-w-[1200px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="brief-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Brief de campaña</h2>
          <p className="hidden text-[12px] text-zinc-500 md:block">Lo que la mesa del brief le entrega a los creativos de {nombre}{resumen ? ` · ${resumen}` : ""}</p>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar el brief" className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        <nav aria-label="Dónde estás" data-ruta className="flex flex-wrap items-center gap-1 border-b border-white/10 px-4 py-2 sm:px-6">
          <span data-miga="cliente" className={`${MIGA} ${!brief ? "text-white" : ""}`}>{nombre}</span>
          {brief && <><Sep /><span data-miga="brief" className="px-1.5 text-[12.5px] text-white">Brief v{brief.version}</span></>}
        </nav>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[230px] shrink-0 overflow-y-auto border-r border-white/10 p-3 md:block" aria-label="Versiones del brief">
            <p className="px-2 py-1.5 text-[13px] font-medium text-zinc-100">Versiones</p>
            <ul className="mt-1 space-y-0.5 pl-2">
              {briefs.map((b) => {
                const e = estadoDelBriefLegible(b.estado)
                return (
                  <li key={b.id}>
                    <button type="button" data-nodo-brief={b.id} onClick={() => setBriefId(b.id)} aria-current={brief?.id === b.id} className="br-nodo flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-zinc-300 hover:bg-white/[0.05]">
                      <span className="min-w-0 flex-1 truncate">v{b.version} · {e.texto}</span>
                    </button>
                  </li>
                )
              })}
              {datos && !briefs.length && <li className="px-2 py-1.5 text-[12px] text-zinc-500">{datos.publicado ? "Sin versiones todavía" : "Llega con la cadena nueva"}</li>}
            </ul>
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {error && <p role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">{error}</p>}
            {cargando && !datos && <p className="text-[13px] text-zinc-400">Leyendo…</p>}
            {datos && !datos.cliente && <p className="text-[13px] text-zinc-400">No hay un cliente elegido.</p>}

            {datos?.cliente && !datos.publicado && (
              <div data-vista="no-publicado" className="br-entra max-w-[640px] space-y-3">
                <h3 className="text-[15px] font-medium text-zinc-100">La cadena todavía no publica el brief</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">La mesa del brief (la que escribe insight, un solo mensaje, objetivo, tono y obligatorios a partir del plan, el manual y lo que trajo el portero) forma parte de la cadena nueva que el equipo técnico está publicando. Cuando esté en producción, cada versión del brief de {nombre} aparece aquí sola; no se muestra nada inventado mientras tanto.</p>
              </div>
            )}
            {datos?.cliente && datos.publicado && !datos.campana && (
              <div data-vista="sin-campana" className="br-entra max-w-[640px] space-y-3">
                <h3 className="text-[15px] font-medium text-zinc-100">{nombre} todavía no tiene campaña</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">El brief se escribe después del plan de 90 días. Cuando exista la campaña, la mesa del brief sesiona y su entrega aparece aquí.</p>
              </div>
            )}
            {datos?.cliente && datos.publicado && datos.campana && !briefs.length && (
              <div data-vista="vacio" className="br-entra max-w-[640px] space-y-3">
                <h3 className="text-[15px] font-medium text-zinc-100">La mesa del brief todavía no escribió</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">La campaña existe pero la mesa del brief no entregó ninguna versión. Apenas lo haga, aparece aquí con su estado (validado, devuelto o en la mesa).</p>
              </div>
            )}

            {datos?.cliente && brief && (
              <article data-vista="brief" data-brief-abierto={brief.id} className="br-entra max-w-[860px] space-y-4">
                <div>
                  <h3 className="text-[16px] font-medium leading-snug text-zinc-50">Brief de campaña · versión {brief.version}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Chip tono={estadoDelBriefLegible(brief.estado).tono}>{estadoDelBriefLegible(brief.estado).texto}</Chip>
                    {brief.seco && <Chip>Ensayo en seco</Chip>}
                    {brief.costo_usd != null && <Chip>{usdFinoES(brief.costo_usd)}</Chip>}
                    {brief.creada_en && <Chip>{diaYHora(brief.creada_en)}</Chip>}
                  </div>
                </div>
                {brief.devolucion_texto && (
                  <div data-bloque="devolucion" className="rounded-lg border border-rose-400/30 bg-rose-500/[0.06] p-2.5 text-[12.5px] leading-relaxed text-rose-100">
                    <Titulito>Devuelto por la dirección creativa</Titulito>
                    <p className="whitespace-pre-wrap">{brief.devolucion_texto}</p>
                  </div>
                )}
                {seccionesDelBrief(brief.texto_md).map((s, i) => (
                  <div key={i} data-bloque={s.titulo}>
                    <Titulito>{s.titulo}</Titulito>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[12.5px] leading-relaxed text-zinc-200"><p className="whitespace-pre-wrap">{s.cuerpo}</p></div>
                  </div>
                ))}
                {!seccionesDelBrief(brief.texto_md).length && <p className="text-[13px] text-zinc-400">Esta versión no trae texto.</p>}
                {brief.motivo && <p className="text-[11.5px] text-zinc-500">Motivo de la versión: {brief.motivo}</p>}
              </article>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
