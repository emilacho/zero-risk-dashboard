"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GranIdeaDelCliente } from "@/lib/gran-idea-datos"
import type { EstadoDelConcepto } from "@/lib/concepto-datos"
import { diaYHora, plural, usdFinoES } from "@/lib/lenguaje"
import { NOTA_MINIMA, type ApuntaA } from "@/lib/concepto-decision"
import { avisoTrasDecidirGranIdea, cuerpoDeDecisionDeGranIdea, errorTrasDecidirGranIdea, rutaDeDecisionDeGranIdea, type AccionDeGranIdea, type RespuestaDeDecisionDeGranIdea } from "@/lib/gran-idea"

/**
 * GRAN IDEA (sprint 6.10 · encargo 01-nov §2 botón 5 · reemplaza al cuadro Cerebro): el concepto de la campaña que la sala creativa propone y Emilio aprueba.
 * 6.11 (ADENDA 7.2): la DECISIÓN ya existe en el tablero (CC#1 · PR #77: `POST /api/piezas/{id}/gran-idea` → `lib/concepto-decision.ts` → la plataforma decide) y se
 * reutiliza TAL CUAL: dos botones grandes (Aprobar · Pedir cambios con nota y a qué apunta), `estado_visto` para que una pantalla vieja reciba 409, y la plataforma aplica
 * el efecto; el tablero no escribe nada en la base. Lo que se enseña sale del lector de CC#1 (`lib/concepto-datos.ts`). Sin tarjeta (hoy, 1-nov) el panel lo dice; no inventa una.
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
const BOTON = "rounded-xl border px-5 py-3 text-[14px] font-medium transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
const B_VERDE = `${BOTON} border-emerald-500/70 bg-emerald-700/60 text-emerald-50 hover:bg-emerald-700/80`
const B_AMBAR = `${BOTON} border-amber-400/70 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25`
const B_GRIS = "rounded-xl border border-white/15 px-4 py-2.5 text-[13px] text-zinc-300 hover:bg-white/[0.06]"
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
  // 6.11 · la decisión
  const [dialogo, setDialogo] = useState(false)
  const [nota, setNota] = useState("")
  const [apunta, setApunta] = useState<ApuntaA>("concepto")
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)

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
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); if (dialogo) setDialogo(false); else onCerrar() }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, dialogo])

  const nombre = datos?.cliente?.nombre ?? "Cliente"
  const tarjetas = datos?.tarjetas ?? []
  const d = datos?.detalle ?? null
  const pendientes = tarjetas.filter((t) => t.estado === "pendiente").length
  const resumen = datos ? (!datos.publicado && !tarjetas.length ? "la sala creativa aún no abre" : tarjetas.length ? `${plural(tarjetas.length, "propuesta", "propuestas")}${pendientes ? ` · ${pendientes} esperan tu decisión` : ""}` : "todavía sin propuesta") : ""
  const pendiente = !!d && d.estado === "pendiente" && d.status === "pending"

  /** la decisión va a la ruta de CC#1 (`POST /api/piezas/{id}/gran-idea`); la plataforma la aplica. Con 409 (la tarjeta cambió) se recarga */
  const decidir = async (accion: AccionDeGranIdea) => {
    if (!d) return
    const c = cuerpoDeDecisionDeGranIdea({ accion, nota, apunta_a: apunta, estado_visto: d.status })
    if ("error" in c) { setMensaje({ ok: false, texto: c.error }); return }
    setEnviando(true); setMensaje(null)
    try {
      const r = await fetchImpl(rutaDeDecisionDeGranIdea(d.hitl_id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c.cuerpo) })
      const j = (await r.json().catch(() => ({}))) as RespuestaDeDecisionDeGranIdea
      if (r.ok && j.ok) { setMensaje({ ok: true, texto: avisoTrasDecidirGranIdea(accion, j) }); setDialogo(false); setNota(""); await leer(datos?.cliente?.id ?? null, d.hitl_id) }
      else { setMensaje({ ok: false, texto: errorTrasDecidirGranIdea(r.status, j) }); if (r.status === 409) await leer(datos?.cliente?.id ?? null, d.hitl_id) }
    } catch { setMensaje({ ok: false, texto: "No se pudo contactar al servidor." }) } finally { setEnviando(false) }
  }

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
        {mensaje && !dialogo && <p role="status" data-aviso={mensaje.ok ? "ok" : "error"} className={`border-b px-4 py-2 text-[13px] sm:px-6 ${mensaje.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>{mensaje.texto}</p>}

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
                {pendiente && (
                  <div data-bloque="decision" className="rounded-xl border border-amber-400/40 bg-amber-400/[0.07] p-4">
                    <p className="text-[13px] leading-relaxed text-amber-100">Esta propuesta espera tu decisión. Apruebas la gran idea y el brief de la campaña; con eso la cadena arma el calendario de la primera tanda. Si pides cambios, dices a qué apuntan: al concepto (otra ronda de la mesa) o al brief (brief nuevo y concepto sobre él).</p>
                    {d.sin_concepto && <p className="mt-1 text-[12px] text-rose-200">No se puede decidir hasta que la cadena complete la tarjeta: {d.sin_concepto}.</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button type="button" data-accion="aprobar-gran-idea" disabled={enviando || !!d.sin_concepto} onClick={() => void decidir("aprobar")} className={B_VERDE}>{enviando && !dialogo ? "Enviando…" : "Aprobar la gran idea"}</button>
                      <button type="button" data-accion="pedir-cambios-gran-idea" disabled={enviando || !!d.sin_concepto} onClick={() => { setDialogo(true); setMensaje(null) }} className={B_AMBAR}>Pedir cambios…</button>
                      {d.vueltas_restantes != null && <span className="text-[11.5px] text-zinc-400">{d.vueltas_restantes === 0 ? "No quedan vueltas de cambios: la siguiente va a revisión humana" : plural(d.vueltas_restantes, "vuelta de cambios disponible", "vueltas de cambios disponibles")}</span>}
                    </div>
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

        {dialogo && d && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="gi-dialogo-titulo" data-dialogo="cambios" onMouseDown={(e) => { if (e.target === e.currentTarget) setDialogo(false) }}>
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#171717] p-5 shadow-2xl">
              <h3 id="gi-dialogo-titulo" className="text-[16px] font-medium text-zinc-50">Pedir cambios a la gran idea</h3>
              <p className="mt-1 text-[12px] text-zinc-400">{d.vueltas_restantes != null ? `Quedan ${plural(d.vueltas_restantes, "vuelta", "vueltas")} de cambios en esta campaña. ` : ""}Di a qué apuntan los cambios.</p>
              <div className="mt-3 space-y-1.5 text-[13px] text-zinc-200">
                <label className="flex items-start gap-2"><input type="radio" name="gi-apunta" value="concepto" checked={apunta === "concepto"} onChange={() => setApunta("concepto")} /><span><b>Al concepto</b> · la mesa de creativos hace otra ronda con tu nota (el brief se queda).</span></label>
                <label className="flex items-start gap-2"><input type="radio" name="gi-apunta" value="brief" checked={apunta === "brief"} onChange={() => setApunta("brief")} /><span><b>Al brief</b> · se escribe un brief nuevo y, sobre él, otra gran idea (es el camino largo).</span></label>
              </div>
              <textarea autoFocus value={nota} onChange={(e) => setNota(e.target.value)} rows={5} maxLength={2000} placeholder="¿Qué quieres distinto?" aria-label="Qué quieres distinto" className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-[13px] text-zinc-100 outline-none focus:border-amber-400/70" />
              <p className="mt-1 text-[11px] text-zinc-500">Mínimo {NOTA_MINIMA} letras</p>
              {mensaje && !mensaje.ok && <p role="alert" className="mt-2 text-[13px] text-rose-300">{mensaje.texto}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setDialogo(false)} className={B_GRIS}>Cancelar</button>
                <button type="button" data-accion="confirmar-cambios-gran-idea" disabled={enviando || nota.trim().length < NOTA_MINIMA} onClick={() => void decidir("cambios")} className={B_AMBAR}>{enviando ? "Enviando…" : "Confirmar y pedir cambios"}</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
