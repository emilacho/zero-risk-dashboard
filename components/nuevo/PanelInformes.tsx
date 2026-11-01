"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { InformesDelCliente } from "@/lib/informes-datos"
import { bloquesDelResumen, estadoLegible, periodoLegible, porTipo, tipoLegible, tituloDelInforme, type Informe, type TonoDeEstado } from "@/lib/informes"
import { diaYHora, plural } from "@/lib/lenguaje"

/**
 * INFORMES (sprint 6.9 · Emilio 1-nov: «en vez de cerebro poner informes»): el cuadro «Informes» del Dept. Marketing abre ENCIMA, dentro del cliente enfocado
 * en la oficina, con la misma forma de explorador que las piezas y el cerebro: ruta arriba · tipos de informe a la izquierda · tarjetas → el informe abierto.
 * SOLO LECTURA: los informes los arma la oficina (generador semanal); aquí se leen tal cual. Si no hay ninguno, se dice; no se inventa nada.
 */
const AMBAR = "#f5a524"
type Respuesta = ({ ok: true } & InformesDelCliente) | { ok: false; error: string }

const ESTILO = `
.in-entra{animation:inEntra .4s cubic-bezier(.2,.8,.2,1) both}
.in-tarjeta{transition:transform .15s ease,border-color .15s ease,background .15s ease}
.in-tarjeta:hover,.in-tarjeta:focus-visible{transform:translateY(-2px);border-color:rgba(245,165,36,.55);background:rgba(245,165,36,.06)}
.in-nodo[aria-current="true"]{background:rgba(245,165,36,.12);color:#fde68a}
@keyframes inEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.in-entra{animation:none}.in-tarjeta{transition:none}}
`
const CHIP: Record<TonoDeEstado, string> = { ambar: "border-amber-400/50 text-amber-200", verde: "border-emerald-400/40 text-emerald-200", azul: "border-sky-400/40 text-sky-200", rojo: "border-rose-400/40 text-rose-200", neutro: "border-white/15 text-zinc-300" }
const Chip = ({ children, tono = "neutro" }: { children: React.ReactNode; tono?: TonoDeEstado }) => <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${CHIP[tono]}`}>{children}</span>
const Titulito = ({ children }: { children: React.ReactNode }) => <h4 className="mb-1 text-[11px] uppercase tracking-[0.08em] text-zinc-500">{children}</h4>
const MIGA = "rounded px-1.5 py-0.5 text-[12.5px] text-zinc-300 hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"
const TARJETA = "in-tarjeta flex w-full flex-col gap-1.5 rounded-xl border border-white/10 bg-[#1c1c1c] p-3.5 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"
const B_GRIS = "rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-400 transition hover:bg-white/[0.05]"
const Sep = () => <span className="text-zinc-600" aria-hidden>›</span>
const IconoInforme = () => <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 shrink-0 text-zinc-500"><path d="M6 3h8l4 4v14H6V3Z M14 3v4h4 M9 12h6 M9 16h4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
const IconoTipo = () => <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 shrink-0"><path d="M3 2.5h7l3 3v8H3v-11Z M10 2.5v3h3 M5.5 9h5 M5.5 11.5h3" fill="none" stroke={AMBAR} strokeWidth="1.2" strokeLinejoin="round" /></svg>

function TarjetaDeInforme({ i, onAbrir }: { i: Informe; onAbrir: () => void }) {
  const e = estadoLegible(i.estado)
  const primero = bloquesDelResumen(i.resumen).find((b) => b.parrafo)
  return (
    <li>
      <button type="button" data-informe={i.id} data-tipo={i.tipo} data-estado={i.estado} onClick={onAbrir} className={TARJETA}>
        <div className="flex w-full items-start gap-2"><IconoInforme /><span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-zinc-100">{tituloDelInforme(i)}</span></div>
        {primero && <p className="line-clamp-3 text-[12px] leading-relaxed text-zinc-400">{primero.parrafo}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1"><Chip tono={e.tono}>{e.texto}</Chip>{i.pdf_url && <Chip>PDF</Chip>}</div>
        <span className="text-[11px] text-zinc-500">{i.entregado_en ? `Entregado el ${diaYHora(i.entregado_en)}` : i.creado_en ? `Armado el ${diaYHora(i.creado_en)}` : ""}</span>
      </button>
    </li>
  )
}

export function PanelInformes({ onCerrar, datosIniciales = null, clienteInicial = null, fetchImpl = fetch }: {
  onCerrar: () => void
  /** lectura ya hecha (pruebas) */
  datosIniciales?: InformesDelCliente | null
  /** el cliente en el que está enfocada la oficina (lo pasa el Dept. Marketing). El explorador NO cambia de cliente: para eso está la ventana de selección */
  clienteInicial?: string | null
  fetchImpl?: typeof fetch
}) {
  const [datos, setDatos] = useState<InformesDelCliente | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [tipo, setTipo] = useState<string | null>(null)
  const [informeId, setInformeId] = useState<string | null>(null)
  const cerrar = useRef<HTMLButtonElement>(null)

  const leer = useCallback(async (id: string | null) => {
    setCargando(true); setError(null)
    try {
      const r = await fetchImpl(`/api/informes${id ? `?cliente=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver los informes." : (j && !j.ok && j.error) || `No pude leer los informes (${r.status}).`)
      setDatos(j)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [fetchImpl])
  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => { if (!datosIniciales) void leer(clienteInicial) }, [leer, datosIniciales, clienteInicial])
  // Esc cierra lo más cercano (informe → tipo → el panel), en captura para que la oficina no lo reciba
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation(); e.preventDefault()
      if (informeId) setInformeId(null); else if (tipo) setTipo(null); else onCerrar()
    }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, informeId, tipo])

  const grupos = useMemo(() => (datos ? porTipo(datos.informes) : []), [datos])
  const grupo = tipo ? grupos.find((g) => g.tipo === tipo) ?? null : null
  const informe = informeId ? datos?.informes.find((i) => i.id === informeId) ?? null : null
  const nombre = datos?.cliente?.nombre ?? "Cliente"
  const esperan = datos ? datos.informes.filter((i) => i.estado === "awaiting_review").length : 0
  const resumen = datos ? (datos.informes.length ? `${plural(datos.informes.length, "informe", "informes")}${esperan ? ` · ${esperan} esperan tu revisión` : ""}` : "todavía sin informes") : ""
  const irA = (t: string | null) => { setTipo(t); setInformeId(null) }
  const visibles = grupo ? grupo.informes : datos?.informes ?? []

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="informes-titulo" data-seccion="informes" className="relative flex h-full max-h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="informes-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Informes</h2>
          <p className="hidden text-[12px] text-zinc-500 md:block">Lo que la oficina le reporta a {nombre}{resumen ? ` · ${resumen}` : ""}</p>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar los informes" className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        <nav aria-label="Dónde estás" data-ruta className="flex flex-wrap items-center gap-1 border-b border-white/10 px-4 py-2 sm:px-6">
          <button type="button" data-miga="cliente" onClick={() => irA(null)} aria-current={!tipo && !informe ? "page" : undefined} className={`${MIGA} ${!tipo && !informe ? "text-white" : ""}`}>{nombre}</button>
          {grupo && <><Sep /><button type="button" data-miga="tipo" onClick={() => setInformeId(null)} aria-current={!informe ? "page" : undefined} className={`${MIGA} ${!informe ? "text-white" : ""}`}>{grupo.nombre}</button></>}
          {informe && <><Sep /><span data-miga="informe" className="truncate px-1.5 text-[12.5px] text-white">{tituloDelInforme(informe)}</span></>}
        </nav>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[250px] shrink-0 overflow-y-auto border-r border-white/10 p-3 md:block" aria-label="Tipos de informe">
            <button type="button" data-nodo="cliente" onClick={() => irA(null)} aria-current={!tipo} className="in-nodo flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-zinc-100 hover:bg-white/[0.05]"><IconoTipo /><span className="truncate">{nombre}</span></button>
            <ul className="mt-1 space-y-0.5 pl-4">
              {grupos.map((g) => (
                <li key={g.tipo}>
                  <button type="button" data-nodo-tipo={g.tipo} onClick={() => irA(g.tipo)} aria-current={tipo === g.tipo} className="in-nodo flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-zinc-300 hover:bg-white/[0.05]">
                    <IconoTipo /><span className="min-w-0 flex-1 truncate">{g.nombre}</span>
                    <span className={`shrink-0 rounded-full px-1.5 text-[10.5px] ${g.esperan ? "bg-amber-400/20 text-amber-200" : "bg-white/[0.06] text-zinc-400"}`}>{g.informes.length}</span>
                  </button>
                </li>
              ))}
              {datos && !grupos.length && <li className="px-2 py-1.5 text-[12px] text-zinc-500">Sin informes todavía</li>}
            </ul>
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {error && <p role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">{error}</p>}
            {cargando && !datos && <p className="text-[13px] text-zinc-400">Leyendo…</p>}
            {datos && !datos.cliente && <p className="text-[13px] text-zinc-400">No hay un cliente elegido.</p>}

            {/* sin informes: se dice tal cual */}
            {datos?.cliente && !datos.informes.length && (
              <div data-vista="vacio" className="in-entra max-w-[640px] space-y-3">
                <h3 className="text-[15px] font-medium text-zinc-100">Todavía no hay informes de {nombre}</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">Los informes los arma la oficina (semanal, mensual o trimestral) con lo que pasó en la campaña: indicadores, puntos altos, lo que frena y en qué se enfoca la semana siguiente. Apenas exista el primero aparece aquí, y si espera tu revisión lo verás marcado.</p>
              </div>
            )}

            {/* la lista: todos o los de un tipo */}
            {datos?.cliente && datos.informes.length > 0 && !informe && (
              <div data-vista="informes" data-tipo-abierto={grupo?.tipo ?? "todos"} className="in-entra space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-[15px] font-medium text-zinc-100">{grupo ? `Informes · ${grupo.nombre}` : "Todos los informes"}</h3>
                  <span className="text-[12px] text-zinc-500">{plural(visibles.length, "informe", "informes")}</span>
                </div>
                {grupo ? (
                  <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{visibles.map((i) => <TarjetaDeInforme key={i.id} i={i} onAbrir={() => setInformeId(i.id)} />)}</ul>
                ) : (
                  grupos.map((g) => (
                    <div key={g.tipo} data-grupo-tipo={g.tipo}>
                      <Titulito>{g.nombre} · {plural(g.informes.length, "informe", "informes")}</Titulito>
                      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{g.informes.map((i) => <TarjetaDeInforme key={i.id} i={i} onAbrir={() => { setTipo(g.tipo); setInformeId(i.id) }} />)}</ul>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* el informe abierto */}
            {datos?.cliente && informe && (
              <article data-vista="informe" data-informe-abierto={informe.id} className="in-entra space-y-4">
                <div>
                  <h3 data-titulo-informe className="text-[16px] font-medium leading-snug text-zinc-50">{tituloDelInforme(informe)}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Chip>{tipoLegible(informe.tipo)}</Chip>
                    <Chip tono={estadoLegible(informe.estado).tono}>{estadoLegible(informe.estado).texto}</Chip>
                    <Chip>{periodoLegible(informe.desde, informe.hasta)}</Chip>
                  </div>
                </div>
                {bloquesDelResumen(informe.resumen).map((b) => (
                  <div key={b.clave} data-bloque={b.clave}>
                    <Titulito>{b.titulo}</Titulito>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[12.5px] leading-relaxed text-zinc-200">
                      {b.parrafo && <p className="whitespace-pre-wrap">{b.parrafo}</p>}
                      {b.vinetas && <ul className="list-disc space-y-0.5 pl-4">{b.vinetas.map((v, i) => <li key={i}>{v}</li>)}</ul>}
                      {b.pares && <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">{b.pares.map((p) => <div key={p.clave} className="flex justify-between gap-3 border-b border-white/5 py-0.5"><dt className="text-zinc-400">{p.clave}</dt><dd className="text-right text-zinc-100">{p.valor}</dd></div>)}</dl>}
                    </div>
                  </div>
                ))}
                {!bloquesDelResumen(informe.resumen).length && <p className="text-[13px] text-zinc-400">Este informe no trae resumen.</p>}
                <div data-bloque="entrega">
                  <Titulito>Entrega</Titulito>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[12.5px] leading-relaxed text-zinc-200">
                    <p>{informe.entregado_en ? `Entregado el ${diaYHora(informe.entregado_en)}${informe.entregado_a.length ? ` a ${informe.entregado_a.join(", ")}` : ""}` : "Todavía no se entregó."}</p>
                    {informe.pdf_url && <a href={informe.pdf_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[12px] text-sky-300 underline-offset-2 hover:underline">Abrir el PDF</a>}
                    {informe.creado_en && <p className="mt-1 text-[11.5px] text-zinc-500">Armado el {diaYHora(informe.creado_en)}</p>}
                  </div>
                </div>
                <div><button type="button" onClick={() => setInformeId(null)} className={B_GRIS}>← Volver a {grupo ? grupo.nombre.toLowerCase() : "los informes"}</button></div>
              </article>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
