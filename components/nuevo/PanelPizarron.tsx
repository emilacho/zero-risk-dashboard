"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Pizarron } from "@/lib/pizarron-datos"
import { DIAS_DE_LA_SEMANA, ESTADOS_DEL_TABLERO, colorDelEstado, diaDelCalendario, enlaceDeLaPieza, estadoDeFilaLegible, formatoLegible, nombreDelEstado, redDelTablero, type FilaDelTablero } from "@/lib/pizarron"
import { estadoDeCampanaLegible, familiaLegible, pilarLegible, resultadoDeJefaturaDePiezaLegible } from "@/lib/lenguaje"
import { Kanban } from "@/components/nuevo/Kanban"
import { armarKanban, tarjetaDeFila } from "@/lib/kanban"

/** 6.11 (ADENDA 3): las mismas publicaciones, como calendario (semanas × días) o como Kanban (columnas genéricas) */
export type VistaDelTablero = "calendario" | "kanban"

const AMBAR = "#f5a524"
type Respuesta = ({ ok: true } & Pizarron) | { ok: false; error: string }

const ESTILO = `
.pz-casilla{transition:transform .15s ease,box-shadow .15s ease,filter .15s ease}
.pz-casilla:hover,.pz-casilla:focus-visible{transform:translateY(-1px);filter:brightness(1.15)}
.pz-casilla[data-destacada="true"]{box-shadow:0 0 0 1px rgba(245,165,36,.9),0 0 14px rgba(245,165,36,.55);animation:pzLate 2.2s ease-in-out infinite}
.pz-casilla[data-elegida="true"]{outline:1px solid #fff;outline-offset:1px}
@keyframes pzLate{0%,100%{box-shadow:0 0 0 1px rgba(245,165,36,.9),0 0 10px rgba(245,165,36,.4)}50%{box-shadow:0 0 0 1px rgba(245,165,36,1),0 0 20px rgba(245,165,36,.8)}}
@media (prefers-reduced-motion:reduce){.pz-casilla{transition:none}.pz-casilla[data-destacada="true"]{animation:none}}
`

/** el nombre de una fase con sus tildes («senal» → «Señal»); las que no conoce las escribe con mayúscula inicial */
const FASES_CON_TILDE: Record<string, string> = { senal: "Señal", señal: "Señal", conexion: "Conexión", conversion: "Conversión", optimizacion: "Optimización", activacion: "Activación", expansion: "Expansión", atraccion: "Atracción" }
export const nombreDeLaFase = (clave: unknown): string => { const k = String(clave ?? "").trim(); return k ? FASES_CON_TILDE[k.toLowerCase()] ?? k.charAt(0).toUpperCase() + k.slice(1) : "—" }

/** qué dice arriba del tablero y en la tarjeta «Plan de 90 días»: el estado REAL (campaña en pausa · plan esperando tu decisión · en reescritura…); la fase solo si la campaña corre con su plan vigente */
export function textoDeLaFase(p: Pick<Pizarron, "fase_activa" | "campana">): string {
  const c = p.campana
  const f = p.fase_activa
  if (c && (c.estado !== "activa" || c.del_plan_anterior || (c.momento_del_plan && !/aprobado|en marcha/.test(c.momento_del_plan)))) {
    const partes = [c.estado !== "activa" ? `Campaña ${estadoDeCampanaLegible(c.estado)}` : null, c.momento_del_plan].filter((x): x is string => !!x)
    if (partes[0]) partes[0] = partes[0].charAt(0).toUpperCase() + partes[0].slice(1)
    if (partes.length) return partes.join(" · ")
    if (c.del_plan_anterior) return "Sigue el plan anterior"
  }
  if (f.situacion === "sin_fecha") return "La campaña no tiene fecha de inicio"
  if (f.situacion === "sin_fases") return "La estrategia todavía no trae fases"
  if (f.situacion === "antes") return `Empieza ${f.dias_para_empezar === 1 ? "mañana" : `en ${f.dias_para_empezar} días`} (${c?.desde ? diaDelCalendario(c.desde) : "—"}) · primera fase: ${nombreDeLaFase(f.fase?.clave)}`
  if (f.situacion === "despues") return `Terminó sus 90 días · última fase: ${nombreDeLaFase(f.fase?.clave)}`
  return `Día ${f.dia} · fase ${nombreDeLaFase(f.fase?.clave)}`
}

/** las esperas vivas de la campaña, agrupadas por motivo («un dato se investiga ×16»), en el orden en que aparecen */
export function agruparEsperas(esperas: Array<{ motivo: string }>): string[] {
  const cuenta = new Map<string, number>()
  for (const e of esperas) cuenta.set(e.motivo, (cuenta.get(e.motivo) ?? 0) + 1)
  return [...cuenta.entries()].map(([m, n]) => (n > 1 ? `${m} ×${n}` : m))
}

export function PanelPizarron({ onCerrar, datosIniciales = null, onAbrirPieza, vistaInicial = "calendario" }: { onCerrar: () => void; datosIniciales?: Pizarron | null; /** 6.6: abrir la pieza encima, en el estilo nuevo; sin esto, enlaza a la ventana de siempre */ onAbrirPieza?: (id: string) => void; vistaInicial?: VistaDelTablero }) {
  const [datos, setDatos] = useState<Pizarron | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [cliente, setCliente] = useState<string | null>(datosIniciales?.cliente?.id ?? null)
  const [elegida, setElegida] = useState<string | null>(null)
  const [vista, setVista] = useState<VistaDelTablero>(vistaInicial)
  const cerrar = useRef<HTMLButtonElement>(null)

  useEffect(() => { cerrar.current?.focus() }, [])
  // Esc cierra el calendario y NO la oficina: se atiende en captura y se detiene ahí
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])

  const leer = useCallback(async (id: string | null) => {
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/pizarron${id ? `?cliente=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver el calendario." : (j && !j.ok && j.error) || `No pude leer el calendario (${r.status}).`)
      setDatos(j); setCliente(j.cliente?.id ?? null); setElegida(null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [])
  useEffect(() => { if (!datosIniciales) void leer(null) }, [leer, datosIniciales])

  const filaElegida = useMemo(() => datos?.filas.find((f) => `${f.id}|${f.fecha}` === elegida) ?? null, [datos, elegida])
  const porAprobar = datos?.totales.emilio ?? 0
  const fases = datos?.fases ?? []
  const faseActiva = datos?.fase_activa.situacion === "en_curso" ? datos.fase_activa.fase?.clave : null
  const kanban = useMemo(() => armarKanban((datos?.filas ?? []).map(tarjetaDeFila)), [datos])

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="pizarron-titulo" data-seccion="pizarron" data-vista-activa={vista} className="relative flex max-h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <span aria-hidden className={`h-2 w-2 rounded-full ${porAprobar > 0 ? "bg-amber-400 animate-pulse" : "bg-zinc-500"}`} />
          <h2 id="pizarron-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Calendario</h2>
          <p className="hidden text-[12px] text-zinc-500 md:block">La campaña del cliente, publicación por publicación · solo lectura</p>
          <div role="group" aria-label="Cómo ver la campaña" className="ml-auto flex rounded-md border border-white/10 p-0.5 text-[11px]">
            {(["calendario", "kanban"] as const).map((v) => (
              <button key={v} type="button" data-vista-tablero={v} aria-pressed={vista === v} onClick={() => setVista(v)} className={`rounded px-2.5 py-1 transition ${vista === v ? "bg-amber-400/20 text-amber-100" : "text-zinc-400 hover:text-zinc-200"}`}>{v === "calendario" ? "Calendario" : "Kanban"}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[12px] text-zinc-400">
            <span>Cliente</span>
            <select value={cliente ?? ""} onChange={(e) => void leer(e.target.value || null)} disabled={!datos || cargando} aria-label="Elegir el cliente"
              className="rounded-md border border-white/10 bg-[#111] px-2 py-1 text-[13px] text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
              {(datos?.clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.con_campana ? "" : " · sin campaña"}</option>)}
              {!datos && <option value="">Leyendo…</option>}
            </select>
          </label>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </header>

        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden">
          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
            {!datos && !error && <p className="text-[13px] text-zinc-500">Leyendo el calendario…</p>}
            {datos && !datos.campana && <p className="text-[13px] text-zinc-400">{datos.cliente ? `${datos.cliente.nombre} todavía no tiene una campaña en la cadena.` : "No hay clientes para mostrar."}</p>}
            {datos && datos.campana && (
              <>
                {/* arriba: la gran idea y la fase activa */}
                <section aria-label="La campaña" className="mb-4 rounded-lg border border-white/10 bg-black/30 p-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-[15px] font-medium text-zinc-100">Campaña de {datos.cliente?.nombre}</h3>
                    <span className="text-[12px] text-zinc-400">{estadoDeCampanaLegible(datos.campana.estado)}{datos.campana.desde ? ` · ${diaDelCalendario(datos.campana.desde)}` : ""}{datos.campana.hasta ? ` → ${diaDelCalendario(datos.campana.hasta)}` : ""}</span>
                    <span className="text-[12px] text-zinc-500">{datos.filas.length} publicaciones{datos.campana.del_plan_anterior ? " · del plan anterior" : ""}</span>
                  </div>
                  {datos.campana.del_plan_anterior && <p data-calendario-anterior className="mt-2 text-[12.5px] text-amber-200/90">Este calendario se armó con el plan anterior; el plan vigente todavía no lo reemplaza.</p>}
                  <p className="mt-2 text-[13px]"><span className="text-zinc-500">Gran idea · </span>{datos.gran_idea.texto ? <span className="text-zinc-100">{datos.gran_idea.texto}</span> : <span className="italic text-zinc-400">{datos.gran_idea.nota}</span>}</p>
                  <p className="mt-1 text-[13px]"><span className="text-zinc-500">Fase · </span><span className="text-zinc-100">{textoDeLaFase(datos)}</span>{datos.fase_activa.fase?.objetivo ? <span className="text-zinc-400"> — {datos.fase_activa.fase.objetivo}</span> : null}</p>
                  {fases.length > 0 && (
                    <ol className="mt-3 flex flex-wrap gap-2" aria-label="Las fases de la estrategia">
                      {fases.map((f) => (
                        <li key={f.clave} className={`rounded-md border px-2.5 py-1.5 text-[12px] ${faseActiva === f.clave ? "border-amber-400/70 bg-amber-400/10 text-amber-100" : "border-white/10 bg-white/[0.03] text-zinc-400"}`} aria-current={faseActiva === f.clave ? "step" : undefined}>
                          <span className="font-medium">{f.clave}</span> <span className="opacity-70">· días {f.dia_desde}–{f.dia_hasta}</span>
                          <span className="block max-w-[26rem] truncate text-[11.5px] opacity-80" title={f.objetivo}>{f.objetivo}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {datos.esperas.length > 0 && <p className="mt-3 text-[12px] text-amber-200/80">La campaña espera: {agruparEsperas(datos.esperas).join(" · ")}</p>}
                </section>

                {/* leyenda */}
                <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-zinc-400" aria-label="Colores del calendario">
                  {ESTADOS_DEL_TABLERO.filter((e) => (datos.totales[e.clave] ?? 0) > 0 || ["idea", "mesa", "jefatura", "emilio", "aprobada", "vencida"].includes(e.clave)).map((e) => (
                    <li key={e.clave} className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: e.color }} />{e.nombre}<span className="text-zinc-600">{datos.totales[e.clave] ?? 0}</span></li>
                  ))}
                </ul>

                {/* la cuadrícula: semanas × días */}
                {vista === "kanban" ? <Kanban columnas={kanban} elegida={elegida} onElegir={(id) => setElegida(id === elegida ? null : id)} etiqueta="Las publicaciones de la campaña por columna" /> : datos.semanas.length === 0 ? <p className="text-[13px] text-zinc-500">El calendario de esta campaña todavía no tiene publicaciones.</p> : (
                  <div role="grid" aria-label="Publicaciones del calendario por semana" className="overflow-x-auto">
                    <div role="row" className="grid min-w-[760px] grid-cols-[5.5rem_repeat(7,minmax(0,1fr))] gap-1 px-0.5 pb-1 text-[11px] uppercase tracking-wider text-zinc-500">
                      <span role="columnheader">Semana</span>{DIAS_DE_LA_SEMANA.map((d) => <span key={d} role="columnheader">{d}</span>)}
                    </div>
                    {datos.semanas.map((s, i) => (
                      <div role="row" key={s.desde} className="grid min-w-[760px] grid-cols-[5.5rem_repeat(7,minmax(0,1fr))] gap-1 border-t border-white/[0.06] py-1.5">
                        <div role="rowheader" className="pr-2 text-[11.5px] leading-tight text-zinc-400"><span className="block text-zinc-200">S{i + 1}</span>{diaDelCalendario(s.desde)} – {diaDelCalendario(s.hasta)}</div>
                        {s.dias.map((d) => (
                          <div role="gridcell" key={d.fecha} className={`min-h-[2.4rem] rounded-sm px-0.5 ${d.fecha === datos.hoy ? "bg-white/[0.05] ring-1 ring-white/10" : ""}`} aria-label={diaDelCalendario(d.fecha)}>
                            <div className="flex flex-wrap gap-1">
                              {d.publicaciones.map((p) => {
                                const red = redDelTablero(p.red); const clave = `${p.id}|${p.fecha}`
                                return (
                                  <button key={clave} type="button" className="pz-casilla flex h-7 min-w-[2.6rem] items-center justify-center gap-0.5 rounded-sm px-1 text-[10px] font-semibold text-black/80"
                                    style={{ background: colorDelEstado(p.tablero) }} data-estado={p.tablero} data-destacada={p.tablero === "emilio"} data-elegida={clave === elegida}
                                    title={`${red.nombre} · ${formatoLegible(p.formato)} · ${nombreDelEstado(p.tablero)} · ${p.tema}`} aria-label={`${red.nombre}, ${formatoLegible(p.formato)}, ${nombreDelEstado(p.tablero)}: ${p.tema}`} aria-pressed={clave === elegida}
                                    onClick={() => setElegida(clave === elegida ? null : clave)}>
                                    <span>{red.sigla}</span><span className="font-normal opacity-80">{formatoLegible(p.formato).slice(0, 4).toLowerCase()}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* la pieza elegida */}
          <aside className="flex min-h-0 flex-col border-t border-white/10 lg:border-l lg:border-t-0" aria-label="La publicación elegida">
            {!filaElegida ? <p className="px-4 py-4 text-[13px] text-zinc-500">Haz clic en una casilla o en una tarjeta para ver la publicación y, si ya hay pieza, abrirla para aprobarla o pedir cambios.</p> : <DetalleDeLaFila f={filaElegida} onAbrirPieza={onAbrirPieza} />}
          </aside>
        </div>
      </section>
    </div>
  )
}

const BOTON_ABRIR = "block w-full rounded-md border border-amber-400/60 bg-amber-400/10 px-3 py-2 text-center text-[13px] font-medium text-amber-100 transition-colors hover:bg-amber-400/20 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"

function DetalleDeLaFila({ f, onAbrirPieza }: { f: FilaDelTablero; onAbrirPieza?: (id: string) => void }) {
  const red = redDelTablero(f.red)
  const [conLamina, setConLamina] = useState(true)
  useEffect(() => { setConLamina(true) }, [f.pieza?.id])
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-[13px]">
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{diaDelCalendario(f.fecha)}{f.hora ? ` · ${f.hora}` : ""}</p>
      <h3 className="mt-1 text-[15px] font-medium text-zinc-100">{formatoLegible(f.formato)} en {red.nombre}</h3>
      <p className="mt-2 flex items-center gap-2"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorDelEstado(f.tablero) }} /><span className="font-medium text-zinc-100">{nombreDelEstado(f.tablero)}</span></p>
      <p className="mt-0.5 text-zinc-400">{f.motivo}</p>
      <dl className="mt-3 space-y-1.5 text-zinc-300">
        <div><dt className="inline text-zinc-500">Tema · </dt><dd className="inline">{f.tema || "—"}</dd></div>
        {f.pilar && pilarLegible(f.pilar) ? <div><dt className="inline text-zinc-500">Pilar · </dt><dd className="inline">{pilarLegible(f.pilar)}</dd></div> : f.pilar ? <div><dt className="inline text-zinc-500">Pilar · </dt><dd className="inline">{f.pilar}</dd></div> : null}
        {f.sede && <div><dt className="inline text-zinc-500">Sede · </dt><dd className="inline">{f.sede}</dd></div>}
        <div><dt className="inline text-zinc-500">En el calendario · </dt><dd className="inline">{estadoDeFilaLegible(f.estado_fila)}{f.tanda != null ? ` · tanda ${f.tanda}` : ""}{f.pieza_fija ? " · pieza fija" : ""}</dd></div>
        {f.encargo && <div><dt className="inline text-zinc-500">Oficina · </dt><dd className="inline">{familiaLegible(f.encargo.familia)} · {f.encargo.estado.startsWith("cerrado") ? "entregada" : f.encargo.estado === "fallido" ? "falló" : f.encargo.estado === "aprobada" ? "aprobada" : "en proceso"}</dd></div>}
        {f.jefatura && <div><dt className="inline text-zinc-500">Jefatura · </dt><dd className="inline">{f.jefatura.estado === "cerrada" ? resultadoDeJefaturaDePiezaLegible(f.jefatura.resultado) : "revisando"}</dd></div>}
      </dl>
      {f.pendientes.length > 0 && <div className="mt-3"><p className="text-zinc-500">Pendientes</p><ul className="mt-1 list-disc space-y-0.5 pl-4 text-zinc-300">{f.pendientes.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
      {f.avisos.length > 0 && <div className="mt-3"><p className="text-zinc-500">Avisos</p><ul className="mt-1 list-disc space-y-0.5 pl-4 text-zinc-400">{f.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
      {f.pieza ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3">
          {conLamina && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/piezas/${f.pieza.id}/lamina/1`} alt="" className="mb-3 w-full rounded-md" onError={() => setConLamina(false)} />
          )}
          {onAbrirPieza
            ? <button type="button" onClick={() => onAbrirPieza(f.pieza!.id)} data-accion="abrir-pieza" aria-haspopup="dialog" className={BOTON_ABRIR}>{f.tablero === "emilio" ? "Abrir la pieza para aprobarla o pedir cambios" : "Abrir la pieza"}</button>
            : <a href={enlaceDeLaPieza(f.pieza.id)} data-accion="abrir-pieza" className={BOTON_ABRIR}>{f.tablero === "emilio" ? "Abrir la pieza para aprobarla o pedir cambios" : "Abrir la pieza"}</a>}
          <p className="mt-2 text-[11.5px] text-zinc-500">{onAbrirPieza ? "Se abre encima, en esta misma oficina; aquí el calendario solo mira." : "Se abre en su ventana; aquí el calendario solo mira."}</p>
        </div>
      ) : (
        <p className="mt-4 text-[12.5px] text-zinc-500">Todavía no hay pieza para esta publicación.</p>
      )}
    </div>
  )
}
