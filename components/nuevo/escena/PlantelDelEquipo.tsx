"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { DefsDelHolograma, HologramaBusto, HologramaFigura } from "@/components/nuevo/escena/Holograma"
import { FORMA_LEGIBLE, MINIMO_DE_TAREAS, type Rendimiento } from "@/lib/rendimiento"
import { BLOQUES_DE_DIMENSIONES, CARA, faltasDeLaFicha, textoPendiente, colorDeNota, COLOR_DEL_ROL, mediaDelEquipo, moralDe, rolDe, siglaDelEquipo, VENTANA_DE_TRABAJO_DIAS, type DatosDelPlantel, type Moral } from "@/lib/plantel"
import { EQUIPOS, nombreCanonico, type ClaveDeEquipo } from "@/lib/organigrama"
import type { MesaViva } from "@/lib/escena-avatares"

/**
 * EL PLANTEL DEL EQUIPO · «Squad Hub» (CC4 · 02-nov · copia la estructura del Squad Hub de EA SPORTS FC que dio Emilio; solo la estética es nuestra: oscuro, ámbar, holograma).
 * A · la lista del equipo: N.º · puesto · retrato · nombre · VAL (valoración, coloreada) · Rol · Forma (la flecha) · Moral (carita); al tocar una fila se despliegan sus acciones.
 * B · el detalle del empleado (valoración grande, equipo · modelo · desde cuándo, su estado, su impacto, cuatro círculos y las 10 dimensiones al desplegar).
 * C · su holograma de cuerpo entero · D · arriba a la derecha: cuántos hay por equipo y la valoración media de este.
 * Datos reales de `/api/rendimiento` y `/api/plantel`; lo que no hay dice «–» o «sin dato todavía». Informa: no bloquea ni decide nada sobre el empleado.
 */
const AMBAR = "#f5a524"
const RESUMEN_DE_EQUIPOS: ClaveDeEquipo[] = ["direccion", "estrategia", "creativo", "web", "medios", "relaciones"]

/** el puesto de un empleado en su equipo, del MAPA firmado (las áreas por las que pasa: «Gran idea», «Piezas y video»…; no hay dato de «oficio» por empleado, así que no se inventa uno) y su lugar en el orden del mapa */
export function puestoEnElEquipo(agente: string, equipo: string): { puesto: string; orden: number; todos: string[] } {
  const e = EQUIPOS.find((q) => q.clave === equipo)
  const k = nombreCanonico(agente)
  const areas = e ? e.areas.map((a, i) => ({ a, i })).filter(({ a }) => a.agentes.some((n) => nombreCanonico(n) === k)) : []
  if (!areas.length) return { puesto: "—", orden: 99, todos: [] }
  return { puesto: areas.length > 1 ? `${areas[0].a.nombre} +${areas.length - 1}` : areas[0].a.nombre, orden: areas[0].i, todos: areas.map(({ a }) => a.nombre) }
}

/** celda sin dato: gris, con barrita de avance y «faltan N»; nunca parece una nota (el reloj va en el detalle) */
export function Pendiente({ f, clave, titulo }: { f: { tiene: number; hace_falta: number; no_cuentan?: boolean }; clave: string; titulo?: string }) {
  const t = textoPendiente(f)
  return (
    <span data-faltan={clave} data-pendiente className="flex flex-col items-center gap-0.5 text-[10px] font-normal leading-none text-zinc-500" title={titulo ?? t.largo}>
      <span className="whitespace-nowrap">{t.corto}</span>
      {!f.no_cuentan && <span className="h-[3px] w-9 overflow-hidden rounded-full bg-white/10" aria-hidden><span className="block h-full rounded-full bg-zinc-500" style={{ width: `${Math.round(t.avance * 100)}%` }} /></span>}
    </span>
  )
}

export function Cara({ m, tam = 22 }: { m: Moral | null; tam?: number }) {
  if (!m) return <span className="text-zinc-500" aria-label="sin carita todavía">–</span>
  const k = CARA[m]
  return <svg viewBox="0 0 22 22" width={tam} height={tam} role="img" aria-label={k.texto} data-moral={m}><circle cx="11" cy="11" r="10" fill={k.color} /><circle cx="7.6" cy="8.6" r="1.4" fill="#111" /><circle cx="14.4" cy="8.6" r="1.4" fill="#111" /><path d={k.boca} stroke="#111" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
}

function Circulo({ k, v, n, color }: { k: string; v: string; n: number | null; color: string }) {
  const p = n == null ? 0 : Math.max(0, Math.min(100, n))
  return (
    <div className="flex items-center gap-2 text-[13px]" data-circulo={k}>
      <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden><circle cx="18" cy="18" r="15" stroke="#3f3f46" strokeWidth="4" fill="none" /><circle cx="18" cy="18" r="15" stroke={color} strokeWidth="4" fill="none" strokeDasharray={`${(p / 100) * 94.2} 94.2`} transform="rotate(-90 18 18)" strokeLinecap="round" /></svg>
      <span className="text-zinc-300">{k}</span><span className="ml-auto whitespace-nowrap font-semibold" style={{ color }}>{v}</span>
    </div>
  )
}

const Linea = ({ k, children }: { k: string; children: React.ReactNode }) => <div className="grid grid-cols-[130px_1fr] py-1 text-[13.5px]"><span className="text-zinc-400">{k}</span><span className="min-w-0 text-zinc-100">{children}</span></div>
const Dato = ({ k, v }: { k: string; v: string }) => <div className="min-w-0"><p className="text-[11.5px] text-zinc-400">{k}</p><p className="break-words text-[14px] font-semibold leading-tight text-zinc-100">{v}</p></div>
const corto = (d: string | null) => { if (!d) return "—"; const t = new Date(d); return Number.isNaN(t.getTime()) ? "—" : t.toLocaleDateString("es-EC", { day: "numeric", month: "short", timeZone: "America/Guayaquil" }).replace(".", "") }

export interface PropsDelPlantel {
  mesa: MesaViva
  /** todas las mesas (para el resumen de arriba a la derecha) */
  mesas: MesaViva[]
  /** el empleado que se ve en el detalle al abrir (si vino de tocar su flecha) */
  agenteInicial?: string | null
  onCerrar: () => void
  onFicha: (agente: string) => void
  /** abre su trabajo de ahora, su última entrega y su corrida en Observabilidad (la tarjeta del clic en el agente) */
  onTrabajo: (agente: string) => void
  /** solo pruebas y el arnés */
  rendimientoInicial?: Record<string, Rendimiento> | null
  plantelInicial?: Record<string, DatosDelPlantel> | null
  ahora?: Date
  /** solo pruebas y el arnés: arranca con la fila elegida desplegada y las 10 dimensiones abiertas */
  abrirTodo?: boolean
}

export function PlantelDelEquipo({ mesa, mesas, agenteInicial = null, onCerrar, onFicha, onTrabajo, rendimientoInicial = null, plantelInicial = null, ahora = new Date(), abrirTodo = false }: PropsDelPlantel) {
  const [rend, setRend] = useState<Record<string, Rendimiento> | null>(rendimientoInicial)
  const [plantel, setPlantel] = useState<Record<string, DatosDelPlantel> | null>(plantelInicial)
  const [fallo, setFallo] = useState<string | null>(null)
  const miembros = useMemo(() => [...mesa.equipo].map((p) => ({ p, ...puestoEnElEquipo(p.agente, mesa.clave) })).sort((a, b) => a.orden - b.orden || a.p.nombre.localeCompare(b.p.nombre, "es")), [mesa])
  const [sel, setSel] = useState<string>(() => (agenteInicial && miembros.some((m) => nombreCanonico(m.p.agente) === nombreCanonico(agenteInicial)) ? agenteInicial : miembros[0]?.p.agente ?? ""))
  const [menu, setMenu] = useState(abrirTodo)
  const [diez, setDiez] = useState(abrirTodo)
  const cerrar = useRef<HTMLButtonElement>(null)

  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])
  useEffect(() => {
    if (rendimientoInicial && plantelInicial) return
    let vivo = true
    const leer = async (url: string) => { const r = await fetch(url, { cache: "no-store" }); const j = (await r.json()) as { ok: boolean; empleados?: never; error?: string }; if (!j.ok) throw new Error(j.error ?? "no se pudo leer"); return j.empleados }
    Promise.all([rendimientoInicial ? Promise.resolve(rendimientoInicial) : leer("/api/rendimiento"), plantelInicial ? Promise.resolve(plantelInicial) : leer("/api/plantel")])
      .then(([a, b]) => { if (vivo) { setRend(a as Record<string, Rendimiento>); setPlantel(b as Record<string, DatosDelPlantel>) } })
      .catch((e) => { if (vivo) setFallo(e instanceof Error ? e.message : "no se pudo leer") })
    return () => { vivo = false }
  }, [rendimientoInicial, plantelInicial])

  const r = (a: string) => rend?.[nombreCanonico(a)] ?? null
  const dp = (a: string) => plantel?.[nombreCanonico(a)] ?? null
  const rol = (a: string) => { const d = dp(a); return d ? rolDe({ trabajos30d: d.trabajos_30d, desde: d.desde, ahora }) : null }
  const moral = (a: string) => { const x = r(a); return x ? moralDe(x.devueltas, x.contables) : null }
  const val = (a: string) => r(a)?.puntaje ?? null
  const media = mediaDelEquipo(miembros.map((m) => val(m.p.agente)))

  const elegido = miembros.find((m) => nombreCanonico(m.p.agente) === nombreCanonico(sel)) ?? miembros[0] ?? null
  const x = elegido ? r(elegido.p.agente) : null, d = elegido ? dp(elegido.p.agente) : null
  const rolDelElegido = elegido ? rol(elegido.p.agente) : null
  const dim = (n: number) => x?.dimensiones.find((q) => q.n === n) ?? null
  const f = x?.forma ? FORMA_LEGIBLE[x.forma] : null
  const mo = elegido ? moral(elegido.p.agente) : null
  const grilla = "grid-cols-[26px_minmax(92px,150px)_36px_minmax(0,1fr)_44px_92px_44px_48px]"

  const salida = (
    <div className="nv-panel nv-av-lista fixed inset-0 z-[76] flex items-stretch justify-center bg-black/80 p-1.5 backdrop-blur-[2px] sm:p-2" data-plantel={mesa.clave} onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="plantel-titulo" className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-amber-400/40 bg-[#0f0d0b] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 pr-12">
          <h2 id="plantel-titulo" className="text-[14px] font-light uppercase tracking-[0.3em]" style={{ color: AMBAR }}>Plantel · {mesa.nombre}</h2>
          <span className="text-[12px] text-zinc-500">{fallo ? `sin lectura: ${fallo}` : !rend || !plantel ? "leyendo…" : `${miembros.length} ${miembros.length === 1 ? "empleado" : "empleados"}`}</span>
          <div className="ml-auto flex flex-wrap items-center gap-3 rounded-md border border-white/10 px-3 py-1.5 text-[13px]" data-resumen-de-equipos>
            {RESUMEN_DE_EQUIPOS.map((k) => { const m = mesas.find((q) => q.clave === k); return m ? <span key={k} data-equipo-resumen={k}><b className={k === mesa.clave ? "text-amber-200" : "text-zinc-400"}>{siglaDelEquipo(k)}</b> <span className="text-zinc-300">{m.equipo.length}</span></span> : null })}
            <span className="text-zinc-400">valoración media del equipo</span>
            <span data-media className="rounded-full border-2 px-2 py-0.5 text-[16px] font-bold" style={{ borderColor: colorDeNota(media), color: colorDeNota(media) }}>{media ?? <span data-media-pendiente className="text-[12px] font-normal text-zinc-400">sin revisiones todavía</span>}</span>
          </div>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/[0.07]"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg></button>
        </header>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.6fr)]">
          {/* A · la lista del plantel */}
          <section aria-label="El plantel" className="min-w-0 self-start rounded-md border border-white/10 bg-[#141210]/95">
            <div className={`grid ${grilla} items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-zinc-400`}>
              <span>N.º</span><span>Puesto</span><span /><span>Nombre</span><span className="text-center">VAL</span><span>Rol</span><span className="text-center">Forma</span><span className="text-center">Moral</span>
            </div>
            {miembros.length === 0 && <p className="px-3 py-4 text-[13px] text-zinc-500">Todavía no hay nadie asignado a este equipo.</p>}
            {miembros.map((m, i) => {
              const a = m.p.agente, es = elegido?.p.agente === a, x1 = r(a), ro = rol(a), mm = moral(a)
              return (
                <div key={a} data-fila={a} data-elegida={es || undefined} className={es ? "mx-1 my-1 rounded-md border border-amber-400/70 bg-amber-400/[0.06]" : ""}>
                  <button type="button" aria-expanded={es && menu} onClick={() => { if (es) setMenu((v) => !v); else { setSel(a); setMenu(true); setDiez(false) } }} className={`grid w-full ${grilla} items-center gap-2 border-b border-white/[0.06] px-3 py-1.5 text-left text-[13.5px] hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400`}>
                    <span className="tabular-nums text-zinc-400">{i + 1}</span>
                    <span className="break-words text-[12px] leading-tight text-zinc-300" title={m.todos.join(" · ")}>{m.puesto}</span>
                    <HologramaBusto semilla={a} color={AMBAR} tam={34} />
                    <span className="min-w-0 break-words leading-tight text-zinc-100" data-nombre>{m.p.nombre}</span>
                    <span data-val className="text-center text-[16px] font-bold tabular-nums" style={{ color: colorDeNota(x1?.puntaje ?? null) }}>{x1?.puntaje ?? <Pendiente clave="val" f={faltasDeLaFicha(x1).val!} titulo={faltasDeLaFicha(x1).frase ?? undefined} />}</span>
                    <span data-rol className="text-[12.5px]" style={{ color: ro ? COLOR_DEL_ROL[ro] : "#71717a" }}>{ro ?? "–"}</span>
                    <span data-forma-fila className="text-center">{x1?.forma ? <span className="text-[16px] font-bold leading-none" style={{ color: FORMA_LEGIBLE[x1.forma].color }} title={FORMA_LEGIBLE[x1.forma].texto}>{`${FORMA_LEGIBLE[x1.forma].flecha}︎`}</span> : <Pendiente clave="forma" f={faltasDeLaFicha(x1).forma!} titulo={x1?.motivo_sin_flecha ?? undefined} />}</span>
                    <span className="flex justify-center">{mm ? <Cara m={mm} /> : <Pendiente clave="moral" f={faltasDeLaFicha(x1).moral!} />}</span>
                  </button>
                  {es && menu && (
                    <div data-acciones className="grid grid-cols-1 gap-3 px-4 py-3 text-[13px] sm:grid-cols-3">
                      <div><p className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-amber-300">Mirar</p>
                        <button type="button" data-accion="ficha" onClick={() => onFicha(a)} className="block text-left text-zinc-200 underline decoration-white/20 decoration-dotted underline-offset-4 hover:text-amber-100">Ver su ficha</button>
                        <button type="button" data-accion="entrega" onClick={() => onTrabajo(a)} className="mt-1 block text-left text-zinc-200 underline decoration-white/20 decoration-dotted underline-offset-4 hover:text-amber-100">Ver su última entrega</button></div>
                      <div><p className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-amber-300">Seguir</p>
                        <button type="button" data-accion="corrida" onClick={() => onTrabajo(a)} className="block text-left text-zinc-200 underline decoration-white/20 decoration-dotted underline-offset-4 hover:text-amber-100">Ver su corrida en Observabilidad</button></div>
                      <div><p className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-amber-300">Hablar</p>
                        <span data-reservado="preguntarle" className="inline-block rounded border border-dashed border-white/15 px-2 py-0.5 text-zinc-400">Preguntarle · pronto</span></div>
                    </div>
                  )}
                </div>
              )
            })}
          </section>

          {/* B · el detalle del empleado */}
          <section aria-label="Detalle del empleado" data-detalle={elegido?.p.agente} className="min-w-0 self-start rounded-md border border-white/10 bg-[#141210]/95 p-4">
            {!elegido ? <p className="text-[13px] text-zinc-500">Sin empleados que mostrar.</p> : (
              <>
                <p className="flex items-baseline gap-2"><span data-ovr className="text-[34px] font-bold leading-none" style={{ color: colorDeNota(x?.puntaje ?? null) }}>{x?.puntaje ?? "–"}</span><span className="text-[13px] uppercase text-zinc-300">{mesa.nombre} · {elegido.puesto}</span></p>
                {faltasDeLaFicha(x).frase && <p data-por-que-sin-nota className="mt-1 text-[12.5px] text-zinc-400">{faltasDeLaFicha(x).frase}</p>}
                <p className="mt-1 break-all text-[11.5px] uppercase tracking-[0.18em] text-zinc-400">{elegido.p.agente}</p>
                <h3 className="text-[26px] font-extrabold uppercase leading-tight tracking-wide text-zinc-50">{elegido.p.nombre}</h3>
                <div className="mt-3 grid grid-cols-3 gap-3 border-b border-white/10 pb-3"><Dato k="Equipo" v={mesa.nombre} /><Dato k="Modelo" v={d?.modelo ?? "–"} /><Dato k="Trabaja desde" v={corto(d?.desde ?? null)} /></div>
                <p className="mt-3 text-[14px] font-semibold text-zinc-100">Estado del empleado</p>
                <Linea k="Ahora">{elegido.p.estado === "trabajando" ? <span className="text-amber-200">Trabajando ahora</span> : elegido.p.estado === "fallo" ? <span className="text-red-300">Falló {elegido.p.hace}</span> : elegido.p.ultima ? `Quieto · último trabajo ${elegido.p.hace}` : "Quieto · sin trabajo en la ventana leída"}</Linea>
                <Linea k="Rol">{rolDelElegido ? <span data-rol-detalle style={{ color: COLOR_DEL_ROL[rolDelElegido] }}>{rolDelElegido}{d ? <span className="text-zinc-400"> · {d.trabajos_30d} {d.trabajos_30d === 1 ? "trabajo" : "trabajos"} en {VENTANA_DE_TRABAJO_DIAS} días</span> : null}</span> : "–"}</Linea>
                <Linea k="Forma">{f ? <span><span className="font-bold" style={{ color: f.color }}>{`${f.flecha}︎`}</span> {f.texto[0].toUpperCase() + f.texto.slice(1)}{x?.puntaje != null && x.puntaje_previo != null ? <span className="text-zinc-400"> ({x.puntaje} frente a {x.puntaje_previo})</span> : null}</span> : <span className="text-zinc-400">{x?.motivo_sin_flecha ?? "sin dato todavía"}{x && x.revisadas < MINIMO_DE_TAREAS ? ` (tiene ${x.revisadas}; hacen falta ${MINIMO_DE_TAREAS})` : ""}</span>}</Linea>
                <Linea k="Disponibilidad">{d?.activo == null ? "–" : d.activo ? "Activo" : "En espera"}</Linea>
                <p className="mt-3 text-[14px] font-semibold text-zinc-100">Impacto</p>
                <Linea k="Aprobado a la 1.ª">{dim(1)?.puntaje != null ? <span><b style={{ color: colorDeNota(dim(1)!.puntaje) }}>{dim(1)!.puntaje}</b> <span className="text-zinc-400">· {dim(1)!.valor}</span></span> : <span className="italic text-zinc-500">sin dato todavía</span>}</Linea>
                <Linea k="Cumplió la tarea">{dim(2)?.puntaje != null ? <span><b style={{ color: colorDeNota(dim(2)!.puntaje) }}>{dim(2)!.puntaje}</b> <span className="text-zinc-400">· {dim(2)!.valor}</span></span> : <span className="italic text-zinc-500">sin dato todavía</span>}</Linea>
                <Linea k="Moral"><span className="flex items-center gap-2" data-moral-detalle={mo ?? "sin"}><Cara m={mo} />{mo ? <>{CARA[mo].texto} <span className="text-zinc-400">· {x!.devueltas} {x!.devueltas === 1 ? "devuelta" : "devueltas"} de {x!.contables}</span></> : <span className="text-zinc-400">pocas entregas revisadas: tiene {x?.contables ?? 0}, hacen falta 3</span>}</span></Linea>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/10 pt-3">
                  <Circulo k="Aprobado a la 1.ª" v={dim(1)?.puntaje != null ? String(dim(1)!.puntaje) : "–"} n={dim(1)?.puntaje ?? null} color={colorDeNota(dim(1)?.puntaje ?? null)} />
                  <Circulo k={`Trabajos en ${VENTANA_DE_TRABAJO_DIAS} días`} v={d ? String(d.trabajos_30d) : "–"} n={d ? Math.round((d.trabajos_30d / 20) * 100) : null} color={AMBAR} />
                  <Circulo k="Nota del equipo" v={media != null ? String(media) : "–"} n={media} color={colorDeNota(media)} />
                  <Circulo k="Costo vs su promedio" v={d?.costo_vs_promedio_pct == null ? "–" : `${d.costo_vs_promedio_pct > 0 ? "+" : ""}${d.costo_vs_promedio_pct} %`} n={d?.costo_vs_promedio_pct == null ? null : Math.max(0, Math.min(100, 50 + d.costo_vs_promedio_pct / 2))} color="#a1a1aa" />
                </div>
                <button type="button" data-diez onClick={() => setDiez((v) => !v)} aria-expanded={diez} className="mt-3 block w-full text-center text-[12.5px] text-amber-300 hover:text-amber-100">Ver las 10 dimensiones {diez ? "▴" : "▾"}</button>
                {diez && (
                  <div data-diez-dimensiones className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-3">
                    {BLOQUES_DE_DIMENSIONES.map(([t, ns]) => (
                      <div key={t}><p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-amber-300">{t}</p>
                        {ns.map((n) => { const q = x?.dimensiones.find((z) => z.n === n); const solo = q ? !q.cuenta : false
                          return <div key={n} data-dimension={n} className="flex items-baseline justify-between gap-2 py-0.5 text-[13px]"><span className="break-words text-zinc-300" title={solo ? "solo informa, no baja la nota" : q?.detalle}>{q?.nombre ?? `Dimensión ${n}`}</span>
                            <span className="font-bold tabular-nums" style={{ color: solo ? "#a1a1aa" : colorDeNota(q?.puntaje ?? null), opacity: q?.puntaje == null && !solo ? 0.45 : 1 }} title={q?.puntaje == null && !q?.valor ? "sin dato todavía" : undefined}>{solo ? (q?.valor ? "dato" : "–") : q?.puntaje ?? "–"}</span></div> })}
                      </div>
                    ))}
                    <p className="col-span-2 text-[11px] leading-snug text-zinc-500">«–» tenue = sin dato todavía (al pasar el cursor lo dice). «dato» = solo informa, no baja la nota (6 y 10).</p>
                  </div>
                )}
              </>
            )}
          </section>

          {/* C · su holograma de cuerpo entero */}
          <section aria-label="Su holograma" className="hidden min-w-0 items-end justify-center self-stretch rounded-md border border-white/10 bg-gradient-to-b from-[#1a1612] to-[#0d0b09] lg:flex">
            {elegido && <svg viewBox="-34 -128 68 136" className="h-full max-h-[640px] w-full" role="img" aria-label={`Holograma de ${elegido.p.nombre}`}><defs><DefsDelHolograma /></defs><HologramaFigura semilla={elegido.p.agente} color={AMBAR} postura="de_pie" /></svg>}
          </section>
        </div>
        <p className="border-t border-white/10 px-4 py-2 text-[11px] text-zinc-500">Informa; no bloquea ni decide nada sobre el empleado. Una celda gris con barrita («faltan 5», «2 de 5») NO es una nota: dice cuántas entregas revisadas por la jefatura le faltan para tener dato (valoración 5 · forma 10 · moral 3). Rol: por trabajos en {VENTANA_DE_TRABAJO_DIAS} días · Moral: por entregas que le devolvieron · Forma: sus últimas 10 entregas revisadas frente a las 10 anteriores.</p>
      </section>
    </div>
  )
  if (typeof document === "undefined") return salida
  return createPortal(salida, document.body)
}
