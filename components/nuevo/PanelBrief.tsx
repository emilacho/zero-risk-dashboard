"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { BriefDelCliente } from "@/lib/brief-datos"
import { estadoDelBriefLegible, loQueSigueDelBrief, seccionesDelBrief, type Brief, type TonoDelBrief } from "@/lib/brief"
import { PlanEnSecciones } from "@/components/nuevo/PlanEnSecciones"
import { diaYHora, plural } from "@/lib/lenguaje"
import { sinCodigos } from "@/lib/sin-codigos"
import { ConFormato } from "@/components/nuevo/TextoSinCodigos"

/**
 * BRIEF DE CAMPAÑA (sprint 6.10 · encargo 01-nov §2 botón 4): lo que la mesa del brief le entrega a los creativos, corto y con secciones fijas. SOLO LECTURA.
 * CC6 · 02-nov (boceto aprobado por Emilio): el mismo patrón del plan y el manual · el brief en secciones plegables (índice + resumen, `PlanEnSecciones` sin los datos
 * clave del plan) y una barra fija con el estado, de dónde sale (empleado real), lo que sigue y las versiones. Sin botones: Emilio lo ve, no lo firma.
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
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="brief-titulo" data-seccion="brief" className="relative flex h-full max-h-full w-full max-w-[1200px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="brief-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Brief de campaña</h2>
          {datos?.cliente?.nombre && <span data-cliente-cabecera className="ml-1 truncate font-display text-[19px] font-medium tracking-normal text-zinc-50">{datos?.cliente?.nombre}</span>}
          <p className="hidden text-[12px] text-zinc-500 md:block">Lo que la mesa del brief le entrega a los creativos de {nombre}{resumen ? ` · ${resumen}` : ""}</p>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar el brief" className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        <nav aria-label="Dónde estás" data-ruta className="flex flex-wrap items-center gap-1 border-b border-white/10 px-4 py-2 sm:px-6">
          <span data-miga="cliente" className={`${MIGA} ${!brief ? "text-white" : ""}`}>{nombre}</span>
          {brief && <><Sep /><span data-miga="brief" className="px-1.5 text-[12.5px] text-white">Brief</span></>}
        </nav>

        <div className="flex min-h-0 flex-1">

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
                <p /* estilo-ok: solo cambia el nombre del plan, la pantalla migra entera aparte */ className="text-[13px] leading-relaxed text-zinc-400">El brief se escribe después del Plan de Marketing. Cuando exista la campaña, la mesa del brief sesiona y su entrega aparece aquí.</p>
              </div>
            )}
            {datos?.cliente && datos.publicado && datos.campana && !briefs.length && (
              <div data-vista="vacio" className="br-entra max-w-[640px] space-y-3">
                <h3 className="text-[15px] font-medium text-zinc-100">La mesa del brief todavía no escribió</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">La campaña existe pero la mesa del brief no entregó ninguna versión. Apenas lo haga, aparece aquí con su estado (validado, devuelto o en la mesa).</p>
              </div>
            )}

            {datos?.cliente && brief && (
              <div data-vista="brief" data-brief-abierto={brief.id} className="br-entra grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
                <article className="min-w-0 space-y-4">
                  <div>
                    <h3 className="text-[16px] font-medium leading-snug text-zinc-50">Brief de campaña</h3>
                    <p className="mt-0.5 text-[12px] text-zinc-500">Lo que la mesa del brief le entrega a los creativos. Solo lectura: no se firma.</p>
                  </div>
                  {brief.devolucion_texto && (
                    <div data-bloque="devolucion" className="rounded-lg border border-rose-400/30 bg-rose-500/[0.06] p-2.5 text-[12.5px] leading-relaxed text-rose-100">
                      <Titulito>Devuelto por la dirección creativa</Titulito>
                      <p className="whitespace-pre-wrap"><ConFormato texto={sinCodigos(brief.devolucion_texto, { fotos: datos?.fotos ?? [], aportes: brief.aportes })} /></p>
                    </div>
                  )}
                  {brief.texto_md && seccionesDelBrief(brief.texto_md).length > 0 ? <PlanEnSecciones prosa={brief.texto_md} sinDatosClave fotosConocidas={datos?.fotos ?? []} aportes={brief.aportes} /> : <p /* estilo-ok: solo se pasan las fotos conocidas, la pantalla migra entera aparte */ className="text-[13px] text-zinc-400">Esta versión no trae texto.</p>}
                </article>
                <aside aria-label="Lo esencial del brief" data-barra-del-brief className="space-y-3 lg:sticky lg:top-0 lg:self-start">
                  <section data-barra="estado" className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5">
                    <Titulito>Estado</Titulito>
                    <div className="flex flex-wrap gap-1.5"><Chip tono={estadoDelBriefLegible(brief.estado).tono}>{estadoDelBriefLegible(brief.estado).texto}</Chip>{brief.seco && <Chip>Ensayo en seco</Chip>}</div>
                  </section>
                  <section data-barra="origen" className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5">
                    <Titulito>De dónde sale</Titulito>
                    <p className="text-[12.5px] text-zinc-200">La mesa del brief{brief.quienes_escribieron?.length ? <> · {brief.quienes_escribieron.map((q, i) => <span key={q} data-escribio={q} className="font-mono text-[11.5px] text-amber-100">{i ? " · " : ""}{q}</span>)}</> : <span className="text-zinc-500"> · sin registro de qué empleado lo escribió</span>}</p>
                    <p className="text-[11.5px] text-zinc-500">a partir del plan, el manual y lo que trajo el portero{brief.creada_en ? ` · ${diaYHora(brief.creada_en)}` : ""}</p>
                    {brief.motivo && <p /* estilo-ok: solo se quitan los códigos, la pantalla migra entera aparte */ className="mt-1 text-[11.5px] text-zinc-400">Por qué esta versión: <ConFormato texto={sinCodigos(brief.motivo, { aportes: brief.aportes })} /></p>}
                  </section>
                  <section data-barra="sigue" className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5">
                    <Titulito>Lo que sigue</Titulito>
                    <p className="text-[12.5px] leading-snug text-zinc-200">{loQueSigueDelBrief(brief.estado)}</p>
                  </section>
                  {briefs.length > 1 && (
                    <section data-barra="versiones" className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5">
                      <Titulito>Versiones · {briefs.length}</Titulito>
                      <ul className="space-y-0.5">
                        {briefs.map((b) => (
                          <li key={b.id}><button type="button" data-nodo-brief={b.id} onClick={() => setBriefId(b.id)} aria-current={brief.id === b.id} className="br-nodo flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] text-zinc-300 hover:bg-white/[0.05]">
                            <span className="min-w-0 flex-1 truncate">{b.creada_en ? diaYHora(b.creada_en) : "sin fecha"} · {estadoDelBriefLegible(b.estado).texto}</span>
                          </button></li>
                        ))}
                      </ul>
                    </section>
                  )}
                </aside>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
