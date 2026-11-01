"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GranIdeaDelCliente } from "@/lib/gran-idea-datos"
import type { EstadoDelConcepto } from "@/lib/concepto-datos"
import { diaYHora, plural, usdFinoES } from "@/lib/lenguaje"

/**
 * GRAN IDEA (sprint 6.10 · encargo 01-nov §2 botón 5 · reemplaza al cuadro Cerebro): el concepto de la campaña que la sala creativa propone y Emilio aprueba.
 * SOLO LECTURA en esta rebanada: la decisión (aprobar / pedir cambios) va por una ruta de la plataforma que todavía no está publicada (T9); cuando exista se cablea
 * y se certifica con una corrida real antes de publicarla (regla de Emilio). Lo que se enseña sale del lector de CC#1 (`lib/concepto-datos.ts`), reutilizado tal cual.
 * Hoy (1-nov) no hay tarjetas de gran idea: el panel lo dice; no inventa una.
 */
const AMBAR = "#f5a524"
type Respuesta = ({ ok: true } & GranIdeaDelCliente) | { ok: false; error: string }

const ESTILO = `
.gi-entra{animation:giEntra .4s cubic-bezier(.2,.8,.2,1) both}
.gi-nodo[aria-current="true"]{background:rgba(245,165,36,.12);color:#fde68a}
.gi-punto{animation:giLate 2.2s ease-in-out infinite}
@keyframes giEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes giLate{0%,100%{box-shadow:0 0 0 0 rgba(245,165,36,.6)}50%{box-shadow:0 0 0 6px rgba(245,165,36,0)}}
@media (prefers-reduced-motion:reduce){.gi-entra{animation:none}.gi-punto{animation:none}}
`
type Tono = "neutro" | "ambar" | "verde" | "rojo" | "azul"
const CHIP: Record<Tono, string> = { ambar: "border-amber-400/50 text-amber-200", verde: "border-emerald-400/40 text-emerald-200", azul: "border-sky-400/40 text-sky-200", rojo: "border-rose-400/40 text-rose-200", neutro: "border-white/15 text-zinc-300" }
const Chip = ({ children, tono = "neutro" }: { children: React.ReactNode; tono?: Tono }) => <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${CHIP[tono]}`}>{children}</span>
const Titulito = ({ children }: { children: React.ReactNode }) => <h4 className="mb-1 text-[11px] uppercase tracking-[0.08em] text-zinc-500">{children}</h4>
const Caja = ({ children }: { children: React.ReactNode }) => <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[12.5px] leading-relaxed text-zinc-200">{children}</div>
const MIGA = "rounded px-1.5 py-0.5 text-[12.5px] text-zinc-300"
const Sep = () => <span className="text-zinc-600" aria-hidden>›</span>

export function estadoDeLaGranIdeaLegible(e: EstadoDelConcepto): { texto: string; tono: Tono } {
  switch (e) {
    case "pendiente": return { texto: "Espera tu decisión", tono: "ambar" }
    case "aprobada": return { texto: "Aprobada", tono: "verde" }
    case "con_cambios": return { texto: "Con cambios pedidos", tono: "azul" }
    case "rechazada": return { texto: "Rechazada", tono: "rojo" }
    default: return { texto: "Vista", tono: "neutro" }
  }
}

export function PanelGranIdea({ onCerrar, datosIniciales = null, clienteInicial = null, fetchImpl = fetch }: {
  onCerrar: () => void
  datosIniciales?: GranIdeaDelCliente | null
  clienteInicial?: string | null
  fetchImpl?: typeof fetch
}) {
  const [datos, setDatos] = useState<GranIdeaDelCliente | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const cerrar = useRef<HTMLButtonElement>(null)

  const leer = useCallback(async (id: string | null, tarjeta?: string) => {
    setCargando(true); setError(null)
    try {
      const q = new URLSearchParams(); if (id) q.set("cliente", id); if (tarjeta) q.set("tarjeta", tarjeta)
      const r = await fetchImpl(`/api/gran-idea${q.size ? `?${q}` : ""}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver la gran idea." : (j && !j.ok && j.error) || `No pude leer la gran idea (${r.status}).`)
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
  const tarjetas = datos?.tarjetas ?? []
  const d = datos?.detalle ?? null
  const pendientes = tarjetas.filter((t) => t.estado === "pendiente").length
  const resumen = datos ? (!datos.publicado && !tarjetas.length ? "la sala creativa aún no abre" : tarjetas.length ? `${plural(tarjetas.length, "propuesta", "propuestas")}${pendientes ? ` · ${pendientes} esperan tu decisión` : ""}` : "todavía sin propuesta") : ""

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="gran-idea-titulo" data-seccion="gran-idea" className="relative flex h-full max-h-full w-full max-w-[1300px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="gran-idea-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Gran idea</h2>
          <p className="hidden text-[12px] text-zinc-500 md:block">El concepto de la campaña de {nombre}{resumen ? ` · ${resumen}` : ""}</p>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar la gran idea" className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        <nav aria-label="Dónde estás" data-ruta className="flex flex-wrap items-center gap-1 border-b border-white/10 px-4 py-2 sm:px-6">
          <span data-miga="cliente" className={`${MIGA} ${!d ? "text-white" : ""}`}>{nombre}</span>
          {d && <><Sep /><span data-miga="gran-idea" className="truncate px-1.5 text-[12.5px] text-white">{d.gran_idea?.nombre ?? d.titulo}</span></>}
        </nav>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[250px] shrink-0 overflow-y-auto border-r border-white/10 p-3 md:block" aria-label="Propuestas de gran idea">
            <p className="px-2 py-1.5 text-[13px] font-medium text-zinc-100">Propuestas</p>
            <ul className="mt-1 space-y-0.5 pl-2">
              {tarjetas.map((t) => {
                const e = estadoDeLaGranIdeaLegible(t.estado)
                return (
                  <li key={t.hitl_id}>
                    <button type="button" data-nodo-tarjeta={t.hitl_id} data-estado={t.estado} onClick={() => void leer(datos?.cliente?.id ?? null, t.hitl_id)} aria-current={d?.hitl_id === t.hitl_id} className="gi-nodo flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-zinc-300 hover:bg-white/[0.05]">
                      {t.estado === "pendiente" && <span className="gi-punto h-2 w-2 shrink-0 rounded-full" style={{ background: AMBAR }} aria-hidden />}
                      <span className="min-w-0 flex-1 truncate">{t.version != null ? `v${t.version} · ` : ""}{e.texto}</span>
                    </button>
                  </li>
                )
              })}
              {datos && !tarjetas.length && <li className="px-2 py-1.5 text-[12px] text-zinc-500">{datos.publicado ? "Sin propuestas todavía" : "Llega con la cadena nueva"}</li>}
            </ul>
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {error && <p role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">{error}</p>}
            {cargando && !datos && <p className="text-[13px] text-zinc-400">Leyendo…</p>}
            {datos && !datos.cliente && <p className="text-[13px] text-zinc-400">No hay un cliente elegido.</p>}

            {datos?.cliente && !tarjetas.length && !datos.publicado && (
              <div data-vista="no-publicado" className="gi-entra max-w-[640px] space-y-3">
                <h3 className="text-[15px] font-medium text-zinc-100">La sala creativa aún no abre</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">La mesa de creativos (la que propone la gran idea de la campaña a partir del brief) forma parte de la cadena nueva que el equipo técnico está publicando. Cuando esté en producción, cada propuesta de {nombre} aparece aquí con un punto amarillo si espera tu decisión. Mientras tanto no se muestra nada inventado.</p>
              </div>
            )}
            {datos?.cliente && !tarjetas.length && datos.publicado && (
              <div data-vista="vacio" className="gi-entra max-w-[640px] space-y-3">
                <h3 className="text-[15px] font-medium text-zinc-100">{datos.campana ? "La mesa de creativos todavía no sesionó" : `${nombre} todavía no tiene campaña`}</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">{datos.campana ? "La gran idea se propone una vez por campaña, con el brief validado. Apenas la sala creativa cierre su sesión, la propuesta aparece aquí para que la apruebes o pidas cambios." : "La gran idea se propone después del plan y del brief. Cuando exista la campaña, la sala creativa sesiona y su propuesta aparece aquí."}</p>
              </div>
            )}

            {datos?.cliente && d && (
              <article data-vista="gran-idea" data-tarjeta-abierta={d.hitl_id} data-estado={d.estado} className="gi-entra max-w-[900px] space-y-4">
                <div>
                  <h3 className="text-[18px] font-medium leading-snug text-zinc-50">{d.gran_idea?.nombre ?? d.titulo}</h3>
                  {d.gran_idea?.frase && <p className="mt-1 text-[14px] italic text-amber-100/90">«{d.gran_idea.frase}»</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Chip tono={estadoDeLaGranIdeaLegible(d.estado).tono}>{estadoDeLaGranIdeaLegible(d.estado).texto}</Chip>
                    {d.version != null && <Chip>Versión {d.version}</Chip>}
                    {d.seco && <Chip>Ensayo en seco</Chip>}
                    {d.costo_usd != null && <Chip>{usdFinoES(d.costo_usd)}</Chip>}
                    {d.creada && <Chip>{diaYHora(d.creada)}</Chip>}
                    {d.vueltas_restantes != null && <Chip>{plural(d.vueltas_restantes, "vuelta de cambios", "vueltas de cambios")} restantes</Chip>}
                  </div>
                </div>
                {d.estado === "pendiente" && (
                  <div data-bloque="decision" className="rounded-lg border border-amber-400/40 bg-amber-400/[0.07] p-3 text-[12.5px] leading-relaxed text-amber-100">
                    Esta propuesta espera tu decisión. Los botones de aprobar y pedir cambios se encienden aquí cuando la plataforma publique la ruta de decisión de la cadena nueva y se haya probado con una corrida real; hasta entonces la decisión se toma en la bandeja de la plataforma.
                  </div>
                )}
                {d.sin_concepto && <p className="rounded-md border border-white/10 bg-white/[0.03] p-2.5 text-[12px] text-zinc-400">Lo que la cadena guardó de esta propuesta está incompleto: {d.sin_concepto}.</p>}
                {d.avisos.length > 0 && <div data-bloque="avisos"><Titulito>Avisos de la sala</Titulito><Caja><ul className="list-disc space-y-0.5 pl-4">{d.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></Caja></div>}
                {d.por_que_funciona && <div data-bloque="por_que_funciona"><Titulito>Por qué funciona</Titulito><Caja><p className="whitespace-pre-wrap">{d.por_que_funciona}</p></Caja></div>}
                {d.como_se_ve && <div data-bloque="como_se_ve"><Titulito>Cómo se ve</Titulito><Caja><p className="whitespace-pre-wrap">{d.como_se_ve}</p></Caja></div>}
                {d.como_suena && <div data-bloque="como_suena"><Titulito>Cómo suena</Titulito><Caja><p className="whitespace-pre-wrap">{d.como_suena}</p></Caja></div>}
                {d.capitulos.length > 0 && (
                  <div data-bloque="capitulos">
                    <Titulito>Capítulos · {plural(d.capitulos.length, "capítulo", "capítulos")}</Titulito>
                    <ul className="space-y-2">
                      {d.capitulos.map((c) => (
                        <li key={c.clave} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[12.5px] leading-relaxed text-zinc-200">
                          <p className="font-medium text-zinc-100">{c.nombre}{c.fase ? <span className="ml-2 text-[11px] font-normal text-zinc-500">fase {c.fase}</span> : null}</p>
                          {c.que_cuenta && <p className="mt-0.5 text-zinc-300">{c.que_cuenta}</p>}
                          {c.series.length > 0 && <ul className="mt-1 list-disc pl-4 text-zinc-400">{c.series.map((s) => <li key={s.id}>{s.nombre}{s.redes.length ? ` · ${s.redes.join(", ")}` : ""}</li>)}</ul>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {d.resumen.total > 0 && (
                  <div data-bloque="banco">
                    <Titulito>Banco de ideas · {plural(d.resumen.total, "idea", "ideas")}</Titulito>
                    <Caja>
                      <p>{Object.entries(d.resumen.por_red).map(([red, n]) => `${red}: ${n}`).join(" · ")}</p>
                      {d.resumen.parcial.length > 0 && <p className="mt-1 text-[11.5px] text-amber-200/80">Banco parcial: {d.resumen.parcial.map((p) => `${p.red} / ${p.capitulo} faltan ${p.faltan}`).join(" · ")}</p>}
                    </Caja>
                  </div>
                )}
                {d.caminos_descartados && <div data-bloque="caminos_descartados"><Titulito>Caminos descartados</Titulito><Caja><p className="whitespace-pre-wrap">{d.caminos_descartados}</p></Caja></div>}
                {d.devolucion_del_brief && <div data-bloque="devolucion_del_brief"><Titulito>Devolución al brief</Titulito><Caja><p className="whitespace-pre-wrap">{d.devolucion_del_brief}</p></Caja></div>}
                {(d.nota_de_emilio || d.decidido_en) && (
                  <div data-bloque="decidido">
                    <Titulito>Tu decisión</Titulito>
                    <Caja>{d.nota_de_emilio && <p className="whitespace-pre-wrap">{d.nota_de_emilio}</p>}{d.decidido_en && <p className="text-[11.5px] text-zinc-500">Decidido el {diaYHora(d.decidido_en)}</p>}</Caja>
                  </div>
                )}
              </article>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
