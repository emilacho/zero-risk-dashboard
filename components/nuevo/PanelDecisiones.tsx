"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { PanelPlan } from "@/components/nuevo/PanelPlan"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import {
  NOMBRE_DEL_TIPO, TIPOS_DE_DECISION, dondeSeDecide, haceCuanto, prioridadLegible, tituloLimpio,
  type Decision, type Decisiones, type TipoDeDecision,
} from "@/lib/direccion-decisiones"

/**
 * TU OFICINA · DECISIONES (6.20 · capa 2 del encargo «oficina del humano»): la MESA DEL DIRECTOR. Todo lo que espera la firma de Emilio, de cualquier
 * departamento, como una pila de tarjetas: la más urgente al frente y las siguientes asomando detrás. Se pasa de una a otra con las flechas (o los botones);
 * a la izquierda, el índice por tipo filtra la pila. Cada tarjeta dice qué es, de qué cliente, desde cuándo espera, su prioridad y lo que se sabe del costo.
 * «Decidir» abre en el mismo lugar el panel del tablero nuevo donde esa decisión ya se toma (plan · gran idea · piezas y revisiones); al cerrarlo se vuelve a
 * la mesa con la lista leída de nuevo. Lo que todavía no tiene panel nuevo lo dice, sin botón falso y sin enlazar al tablero viejo.
 * Datos: `/api/direccion/decisiones` (servidor del tablero → ruta certificada de la plataforma). Si la lista está incompleta, nunca dice «nada pendiente».
 */
const AMBAR = "#e8731a"
type Respuesta = ({ ok: true } & Decisiones) | { ok: false; error: string }

const ESTILO = `
.de-pila{perspective:1400px}
.de-tarjeta{transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .45s ease,filter .45s ease}
.de-frente{animation:deLlega .55s cubic-bezier(.2,.8,.2,1) both}
@keyframes deLlega{from{opacity:0;transform:translateY(34px) rotateX(8deg) scale(.97)}to{opacity:1;transform:none}}
.de-urge{animation:deLate 2.2s ease-in-out infinite}
@keyframes deLate{0%,100%{box-shadow:0 0 0 0 rgba(245,120,36,.55)}50%{box-shadow:0 0 0 7px rgba(245,120,36,0)}}
.de-tipo[aria-pressed="true"]{border-color:rgba(232,115,26,.7);background:rgba(232,115,26,.1);color:#fff}
@media (prefers-reduced-motion:reduce){.de-tarjeta{transition:none}.de-frente,.de-urge{animation:none}}
`

/** la marca de cada tipo: un trazo fino en ámbar (se reconoce de un vistazo en la pila) */
function MarcaDelTipo({ tipo, className = "h-5 w-5" }: { tipo: TipoDeDecision; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  const d: Record<TipoDeDecision, ReactNode> = {
    plan: <><path {...p} d="M5 26h22M8 26V14M16 26V8M24 26v-9" /><path {...p} d="M8 14l8-6 8 3" /></>,
    gran_idea: <><path {...p} d="M16 4a8 8 0 0 0-4.5 14.6c.9.7 1.5 1.7 1.5 2.9V23h6v-1.5c0-1.2.6-2.2 1.5-2.9A8 8 0 0 0 16 4Z" /><path {...p} d="M13 26h6M14 29h4" /></>,
    pieza: <><rect x="4" y="9" width="18" height="18" rx="2" {...p} /><path {...p} d="M10 5h16a2 2 0 0 1 2 2v16" /><path {...p} d="M4 22l5-5 4 4 3-3 6 6" /></>,
    revision: <><circle cx="14" cy="14" r="8" {...p} /><path {...p} d="M20 20l7 7M10.5 14l2.5 2.5 4.5-5" /></>,
    pregunta_al_dueno: <><path {...p} d="M5 7h22v14H14l-6 5v-5H5z" /><path {...p} d="M13.5 11.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M16 18.2v.3" /></>,
    pregunta_de_finanzas: <><path {...p} d="M5 7h22v14H14l-6 5v-5H5z" /><path {...p} d="M16 9.5v9M18.5 11.5c0-1-1.1-1.7-2.5-1.7s-2.5.7-2.5 1.7 1.1 1.6 2.5 1.8 2.5.8 2.5 1.9-1.1 1.8-2.5 1.8-2.5-.7-2.5-1.7" /></>,
    firma_de_finanzas: <><path {...p} d="M8 4h11l6 6v18H8V4Z" /><path {...p} d="M19 4v6h6" /><path {...p} d="M11 22c2-3 3-3 4-1s2 2 3 0 2-2 3 0" /></>,
  }
  return <svg viewBox="0 0 32 32" aria-hidden className={className}>{d[tipo]}</svg>
}

/** de qué parte de la empresa viene cada decisión (la tabla de origen, en palabras de negocio) */
const ORIGEN: Record<string, string> = {
  hitl_queue: "Bandeja de revisión", finanzas_tableros: "Oficina financiera", finanzas_preguntas: "Oficina financiera",
  cerebro_dueno_preguntas: "El cerebro del cliente", plan_aprobaciones: "Oficina de planeación",
}
const fecha = (iso: string | null) => { if (!iso) return null; const t = new Date(iso); return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" }) }
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** la tarjeta del frente: todo lo que hace falta para decidir, en palabras de negocio */
function TarjetaDelFrente({ d, alDecidir }: { d: Decision; alDecidir: (d: Decision) => void }) {
  const pr = prioridadLegible(d.prioridad), donde = dondeSeDecide(d)
  return (
    <article data-decision={d.id} data-tipo={d.tipo} className="de-tarjeta de-frente relative flex h-full flex-col overflow-hidden rounded-2xl border border-[rgba(232,115,26,.45)] bg-[linear-gradient(160deg,#211812,#151110_55%,#110e0d)] p-5 shadow-[0_24px_60px_rgba(0,0,0,.55),0_0_40px_rgba(232,115,26,.08)] sm:p-7">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(232,115,26,.4)]" style={{ color: AMBAR }}><MarcaDelTipo tipo={d.tipo} className="h-6 w-6" /></span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">{NOMBRE_DEL_TIPO[d.tipo].nombre}</p>
          <p data-cliente className="truncate text-[14px] text-zinc-200">{d.cliente ?? "Sin cliente asignado"}</p>
        </div>
        <span data-prioridad={pr.nivel} className={`ml-auto shrink-0 rounded-full border px-2.5 py-0.5 text-[11.5px] ${pr.nivel === 3 ? "de-urge border-orange-400/60 text-orange-200" : pr.nivel === 2 ? "border-amber-300/40 text-amber-200" : "border-white/15 text-zinc-400"}`}>{pr.texto}</span>
      </header>
      <h3 data-titulo title={tituloLimpio(d.titulo)} className="mt-5 line-clamp-3 text-[19px] font-light leading-snug text-white sm:text-[21px]">{tituloLimpio(d.titulo)}</h3>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-4">
        <div><dt className="text-zinc-500">Espera</dt><dd data-espera className="text-zinc-200">{haceCuanto(d.desde)}{fecha(d.desde) ? <span className="text-zinc-500"> · {fecha(d.desde)}</span> : null}</dd></div>
        <div><dt className="text-zinc-500">Vence</dt><dd data-vence className={d.vencida ? "text-orange-300" : "text-zinc-200"}>{d.vence ? `${fecha(d.vence)}${d.vencida ? " · vencida" : ""}` : "Sin fecha límite"}</dd></div>
        <div><dt className="text-zinc-500">Viene de</dt><dd data-origen className="text-zinc-200">{ORIGEN[d.fuente ?? ""] ?? "Sin dato"}</dd></div>
        <div><dt className="text-zinc-500">Costo</dt><dd data-costo className="text-zinc-200">{d.costo_usd != null ? `US$ ${d.costo_usd.toFixed(2)}` : d.costo_nota ?? "Sin dato"}</dd></div>
      </dl>
      <footer className="mt-auto pt-6">
        {donde.panel
          ? <button type="button" data-decidir={donde.panel} onClick={() => alDecidir(d)} className="rounded-lg border border-[rgba(232,115,26,.7)] bg-[rgba(232,115,26,.14)] px-4 py-2 text-[13.5px] text-white transition hover:bg-[rgba(232,115,26,.24)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">{donde.boton}</button>
          : <p data-sin-panel className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px] text-zinc-400">{donde.nota}</p>}
      </footer>
    </article>
  )
}

export function PanelDecisiones({ onCerrar, datosIniciales = null, fetchImpl = fetch }: { onCerrar: () => void; datosIniciales?: Decisiones | null; fetchImpl?: typeof fetch }) {
  const [datos, setDatos] = useState<Decisiones | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [filtro, setFiltro] = useState<TipoDeDecision | null>(null)
  const [i, setI] = useState(0)
  const [abierta, setAbierta] = useState<Decision | null>(null) // la decisión abierta en su panel
  const cerrar = useRef<HTMLButtonElement>(null)

  const leer = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetchImpl("/api/direccion/decisiones", { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver tus decisiones." : (j && !j.ok && j.error) || `No pude leer tus decisiones (${r.status}).`)
      setDatos(j)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [fetchImpl])
  useEffect(() => { if (!datosIniciales) void leer() }, [leer, datosIniciales])
  useEffect(() => { if (!abierta) cerrar.current?.focus() }, [abierta])

  const lista = useMemo(() => (datos?.decisiones ?? []).filter((d) => !filtro || d.tipo === filtro), [datos, filtro])
  const n = lista.length, actual = n ? lista[Math.min(i, n - 1)] : null
  const mover = useCallback((paso: number) => setI((k) => (n ? (Math.min(k, n - 1) + paso + n) % n : 0)), [n])

  useEffect(() => {
    if (abierta) return // el panel abierto maneja sus propias teclas
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() }
      else if (e.key === "ArrowRight") { e.preventDefault(); mover(1) }
      else if (e.key === "ArrowLeft") { e.preventDefault(); mover(-1) }
    }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, mover, abierta])

  // decidir: el panel donde esa decisión ya se toma, en el mismo lugar; al volver, la mesa se lee de nuevo
  const volver = useCallback(() => { setAbierta(null); void leer() }, [leer])
  if (abierta) {
    const donde = dondeSeDecide(abierta)
    if (donde.panel === "plan") return <PanelPlan onCerrar={volver} clienteInicial={abierta.client_id} />
    if (donde.panel === "gran_idea") return <PanelGranIdea onCerrar={volver} clienteInicial={abierta.client_id} />
    if (donde.panel === "piezas") return <PanelPiezas onCerrar={volver} clienteInicial={abierta.client_id} piezaInicial={abierta.id} />
  }

  const total = datos?.total ?? 0
  const porTipo = TIPOS_DE_DECISION.map((t) => ({ t, n: (datos?.decisiones ?? []).filter((d) => d.tipo === t).length })).filter((x) => x.n > 0)
  const resumen = !datos ? "" : total ? `${plural(total, "decisión espera", "decisiones esperan")} tu firma${datos.completo ? "" : " · la lista puede estar incompleta"}` : datos.completo ? "Nada espera tu firma ahora" : "No se pudo leer todo: la lista puede estar incompleta"
  const detras = n > 1 ? [1, 2, 3].filter((k) => k < n).map((k) => lista[(Math.min(i, n - 1) + k) % n]) : []
  const faltan = (datos?.fuentes ?? []).filter((f) => f.estado === "error" || f.estado === "sin_credencial")

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="decisiones-titulo" data-seccion="decisiones" className="relative flex h-full max-h-full w-full max-w-[1300px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="decisiones-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Decisiones</h2>
          <p data-resumen className="text-[12px] text-zinc-400">{cargando && !datos ? "Leyendo…" : resumen}</p>
          <button type="button" onClick={() => void leer()} disabled={cargando} className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">{cargando ? "Leyendo…" : "Actualizar"}</button>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar las decisiones" className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[250px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/10 p-3 md:flex" aria-label="Decisiones por tipo">
            <p className="px-2 py-1.5 text-[13px] font-medium text-zinc-100">Por tipo</p>
            <button type="button" aria-pressed={filtro === null} onClick={() => { setFiltro(null); setI(0) }} className="de-tipo flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-[12.5px] text-zinc-300 hover:bg-white/[0.05]"><span className="flex-1">Todas</span><span className="tabular-nums text-zinc-500">{total}</span></button>
            {porTipo.map(({ t, n: k }) => (
              <button key={t} type="button" data-filtro={t} aria-pressed={filtro === t} onClick={() => { setFiltro(t); setI(0) }} className="de-tipo flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-[12.5px] text-zinc-300 hover:bg-white/[0.05]">
                <span style={{ color: AMBAR }}><MarcaDelTipo tipo={t} className="h-4 w-4" /></span><span className="flex-1">{NOMBRE_DEL_TIPO[t].plural}</span><span className="tabular-nums text-zinc-500">{k}</span>
              </button>
            ))}
            {(datos?.sin_fuente.length || faltan.length) ? (
              <div data-sin-dato className="mt-auto border-t border-white/10 pt-3 text-[11.5px] leading-relaxed text-zinc-500">
                <p className="mb-1 text-zinc-400">Sin dato todavía</p>
                {faltan.map((f) => <p key={f.fuente}>· {f.fuente}: no se pudo leer</p>)}
                {datos?.sin_fuente.map((s) => <p key={s.que} title={s.motivo}>· {s.que}</p>)}
              </div>
            ) : null}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-8">
            {actual ? (
              <>
                <div className="de-pila relative mx-auto w-full max-w-[720px]" style={{ height: 460 }}>
                  {detras.slice().reverse().map((d, k) => {
                    const capa = detras.length - k // 3, 2, 1 desde el fondo: cada una asoma 22 px por encima de la anterior
                    return (
                      <div key={`${d.id}-${capa}`} aria-hidden data-detras={capa} className="de-tarjeta absolute inset-x-0 rounded-2xl border border-[rgba(232,115,26,.22)] bg-[#1d1612] px-6 pt-2"
                        style={{ top: 66 - capa * 22, bottom: 0, transform: `scale(${1 - capa * 0.04})`, transformOrigin: "top center", opacity: 1 - capa * 0.22 } as CSSProperties}>
                        <p className="truncate text-[11.5px] text-zinc-400"><span style={{ color: AMBAR }}>{NOMBRE_DEL_TIPO[d.tipo].nombre}</span> · {d.cliente ?? "Sin cliente"} · {tituloLimpio(d.titulo)}</p>
                      </div>
                    )
                  })}
                  <div className="absolute inset-x-0 bottom-0" style={{ top: 66 }} key={actual.id}><TarjetaDelFrente d={actual} alDecidir={setAbierta} /></div>
                </div>
                <nav aria-label="Pasar de una decisión a otra" className="mx-auto mt-5 flex w-full max-w-[720px] items-center gap-3">
                  <button type="button" onClick={() => mover(-1)} disabled={n < 2} className="rounded-md border border-white/15 px-3 py-1.5 text-[12.5px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40">← Anterior</button>
                  <div className="flex flex-1 items-center justify-center gap-1.5" aria-hidden>{lista.map((d, k) => <span key={d.id} className="h-1.5 rounded-full transition-all" style={{ width: k === Math.min(i, n - 1) ? 22 : 6, background: k === Math.min(i, n - 1) ? AMBAR : "rgba(255,255,255,.18)" }} />)}</div>
                  <span data-posicion className="text-[12px] tabular-nums text-zinc-500">{Math.min(i, n - 1) + 1} de {n}</span>
                  <button type="button" onClick={() => mover(1)} disabled={n < 2} className="rounded-md border border-white/15 px-3 py-1.5 text-[12.5px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40">Siguiente →</button>
                </nav>
              </>
            ) : (
              <div data-vacio className="m-auto max-w-[420px] text-center">
                {cargando ? <p className="text-[13px] text-zinc-500">Leyendo tus decisiones…</p>
                  : datos?.completo && !error ? <><p className="text-[18px] font-light text-white">Estás al día</p><p className="mt-2 text-[13px] text-zinc-500">Nada espera tu firma en este momento.</p></>
                    : <p className="text-[13px] text-zinc-400">No pude leer todas las fuentes: no puedo asegurarte que no haya nada pendiente.</p>}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
