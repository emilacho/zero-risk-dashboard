"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { PlanDelCliente } from "@/lib/plan-datos"
import { BOTONES_DEL_PLAN, canalDelPlanLegible, cuerpoDeResolucion, decisionDeEquilibrioLegible, estadoDelPlanLegible, fuenteDeLaAlertaLegible, origenDeLaFechaLegible, pedirALegible, porcentaje, publicacionesPorSemana, resultadoDeJefaturaDelPlanLegible, rolDeLaRedLegible, sedeLegible, semanaDelPatron, textoDeLaMeta, tipoDeHitoLegible } from "@/lib/plan"
import { diaDelCalendario, formatoLegible, redDelTablero } from "@/lib/pizarron"
import { textoDeLaFase } from "@/components/nuevo/PanelPizarron"
import { llamarAccion } from "@/components/nuevo/PanelManual"
import { fechaCortaEC } from "@/lib/manual"
import { estadoDeCampanaLegible, pilarLegible, plural, usdES } from "@/lib/lenguaje"

const AMBAR = "#f5a524"
type Respuesta = ({ ok: true } & PlanDelCliente) | { ok: false; error: string }
type Resultado = Awaited<ReturnType<typeof llamarAccion>>

const ESTILO = `
.pl-seccion{animation:plEntra .45s cubic-bezier(.2,.8,.2,1) both}
.pl-barra{transition:width .6s cubic-bezier(.2,.8,.2,1)}
.pl-fase[aria-current="step"]{box-shadow:0 0 0 1px rgba(245,165,36,.7),0 0 18px rgba(245,165,36,.25)}
@keyframes plEntra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pl-seccion{animation:none}.pl-barra{transition:none}}
`

function Chip({ children, tono = "neutro" }: { children: React.ReactNode; tono?: "neutro" | "ambar" | "verde" | "rojo" }) {
  const clase = tono === "ambar" ? "border-amber-400/50 text-amber-200" : tono === "verde" ? "border-emerald-400/40 text-emerald-200" : tono === "rojo" ? "border-rose-400/40 text-rose-200" : "border-white/15 text-zinc-300"
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${clase}`}>{children}</span>
}
function Seccion({ titulo, nota, retraso = 0, children, etiqueta }: { titulo: string; nota?: string; retraso?: number; children: React.ReactNode; etiqueta?: string }) {
  return (
    <section aria-label={etiqueta ?? titulo} data-apartado={etiqueta ?? titulo} className="pl-seccion rounded-lg border border-white/10 bg-white/[0.02] p-4" style={{ animationDelay: `${retraso}ms` }}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>{titulo}</h3>
        {nota && <span className="text-[11px] text-zinc-500">{nota}</span>}
      </div>
      {children}
    </section>
  )
}
const Vacio = ({ children }: { children: React.ReactNode }) => <p className="text-[12.5px] italic text-zinc-500">{children}</p>
const Titulito = ({ children }: { children: React.ReactNode }) => <h4 className="mb-1.5 text-[11px] uppercase tracking-[0.08em] text-zinc-500">{children}</h4>

/** una barra de reparto (pilares, canales con peso): el ancho es el porcentaje; la cifra siempre se lee */
function Barra({ nombre, pct, detalle }: { nombre: string; pct: number; detalle?: string }) {
  return (
    <li className="text-[13px]">
      <div className="flex items-baseline justify-between gap-3"><span className="text-zinc-200">{nombre}</span><span className="shrink-0 tabular-nums text-zinc-400">{porcentaje(pct)}</span></div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"><div className="pl-barra h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct <= 1 ? pct * 100 : pct))}%`, background: AMBAR }} /></div>
      {detalle && <p className="mt-0.5 text-[11.5px] text-zinc-500">{detalle}</p>}
    </li>
  )
}

interface Enviar { accion: (nombre: string, cuerpo: Record<string, unknown>) => Promise<Resultado> }

/** la decisión sobre un plan con puntos por resolver: aprobarlo así (con confirmación) o pedir cambios (con el porqué). Va por la acción del tablero `revision-resolver`. */
function Decision({ revisionId, enviar, onDecidido }: { revisionId: string; enviar: Enviar; onDecidido: (r: Resultado, decision: "aprobar" | "rechazar") => void }) {
  const [modo, setModo] = useState<"quieto" | "aprobar" | "rechazar" | "enviando">("quieto")
  const [porque, setPorque] = useState("")
  const [error, setError] = useState<string | null>(null)
  async function decidir(decision: "aprobar" | "rechazar") {
    setError(null)
    const cuerpo = cuerpoDeResolucion(revisionId, decision, porque)
    if ("error" in cuerpo) { setError(cuerpo.error); return }
    setModo("enviando")
    const r = await enviar.accion("revision-resolver", cuerpo)
    setModo("quieto")
    if (!r.ok) setError(r.texto)
    onDecidido(r, decision)
  }
  return (
    <div className="mt-3" data-decision={modo}>
      {modo === "quieto" && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" data-accion="plan-aprobar-asi" onClick={() => setModo("aprobar")} className="rounded-md border border-amber-400/70 bg-amber-400/15 px-3 py-1.5 text-[12px] text-amber-100 transition hover:bg-amber-400/25">{BOTONES_DEL_PLAN.aprobar}</button>
          <button type="button" data-accion="plan-pedir-cambios" onClick={() => setModo("rechazar")} className="rounded-md border border-white/15 px-3 py-1.5 text-[12px] text-zinc-200 transition hover:border-rose-400/60 hover:text-rose-100">{BOTONES_DEL_PLAN.rechazar}</button>
          <span className="text-[11.5px] text-zinc-500">Se registra en la bandeja del sistema; el plan en sí no cambia por esto.</span>
        </div>
      )}
      {modo === "aprobar" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-zinc-300">Aprobarlo así significa que lo das por bueno con esos puntos abiertos: la cadena sigue con este plan.</span>
          <button type="button" data-accion="confirmar-aprobar-plan" onClick={() => void decidir("aprobar")} className="rounded-md border border-amber-400/70 bg-amber-400/15 px-3 py-1.5 text-[12px] text-amber-100 hover:bg-amber-400/25">Sí, aprobar así</button>
          <button type="button" onClick={() => setModo("quieto")} className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-400 hover:bg-white/[0.05]">Cancelar</button>
        </div>
      )}
      {(modo === "rechazar" || modo === "enviando") && (
        <form data-editor="plan-cambios" className="rounded-md border border-rose-400/30 bg-black/30 p-3" onSubmit={(e) => { e.preventDefault(); void decidir("rechazar") }}>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">¿Qué debe cambiar? (la oficina de planeación lo lee)</span>
            <textarea value={porque} onChange={(e) => setPorque(e.target.value)} rows={3} maxLength={1000} aria-label="Qué debe cambiar en el plan" autoFocus
              className="w-full resize-y rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-[13px] leading-relaxed text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400" />
          </label>
          <p className="mt-1 text-[11px] text-zinc-500">{porque.trim().length}/1000</p>
          <div className="mt-2 flex items-center gap-2">
            <button type="submit" disabled={modo === "enviando"} data-accion="confirmar-pedir-cambios" className="rounded-md border border-rose-400/60 bg-rose-400/10 px-3 py-1.5 text-[12px] text-rose-100 transition hover:bg-rose-400/20 disabled:opacity-50">{modo === "enviando" ? "Enviando…" : "Enviar el pedido de cambios"}</button>
            <button type="button" onClick={() => setModo("quieto")} disabled={modo === "enviando"} className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-400 hover:bg-white/[0.05]">Cancelar</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-[12px] text-rose-300">{error}</p>}
    </div>
  )
}

export function PanelPlan({ onCerrar, datosIniciales = null, clienteInicial = null, accion = llamarAccion }: { onCerrar: () => void; datosIniciales?: PlanDelCliente | null; /** abrir con este cliente (el harness local y las aplicaciones lo usan) */ clienteInicial?: string | null; /** cómo se envían las acciones (pruebas) */ accion?: typeof llamarAccion }) {
  const [datos, setDatos] = useState<PlanDelCliente | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [cliente, setCliente] = useState<string | null>(datosIniciales?.cliente?.id ?? clienteInicial)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const cerrar = useRef<HTMLButtonElement>(null)

  useEffect(() => { cerrar.current?.focus() }, [])
  // Esc cierra el plan y NO la oficina: se atiende en captura y se detiene ahí
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])

  const leer = useCallback(async (id: string | null) => {
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/plan${id ? `?cliente=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver el plan." : (j && !j.ok && j.error) || `No pude leer el plan (${r.status}).`)
      setDatos(j); setCliente(j.cliente?.id ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [])
  useEffect(() => { if (!datosIniciales) void leer(clienteInicial) }, [leer, datosIniciales, clienteInicial])

  // después de decidir: se dice qué pasó y se vuelve a leer (la bandeja ya no muestra la revisión como pendiente)
  const decidido = (r: Resultado, decision: "aprobar" | "rechazar") => {
    if (!r.ok) return
    const res = typeof r.detalle.resultado === "string" ? r.detalle.resultado : decision === "aprobar" ? "aprobado así" : "cambios pedidos"
    setAviso({ ok: true, texto: `Decisión registrada: plan ${res} · la oficina de planeación la ve en la bandeja` })
    void leer(cliente)
  }

  const c = datos?.campana ?? null, e = datos?.estrategia ?? null, d = datos?.documento ?? null, rev = datos?.revision ?? null
  const faseEnCurso = datos?.fase_activa.situacion === "en_curso" ? datos.fase_activa.fase?.clave : null
  const ritmo = e ? publicacionesPorSemana(e.redes) : null
  // una revisión pendiente también es «algo»: se decide aunque la campaña o el documento no existan (ficha de práctica · plan sin cadena)
  const hayAlgo = !!(c || e || d || rev)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="plan-titulo" data-seccion="plan" className="relative flex max-h-full w-full max-w-[1280px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="plan-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Plan de 90 días</h2>
          <p className="hidden text-[12px] text-zinc-500 md:block">La meta, las fases, las redes y lo que la campaña espera · se decide aquí</p>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-zinc-400">
            <span>Cliente</span>
            <select value={cliente ?? ""} onChange={(ev) => void leer(ev.target.value || null)} disabled={!datos || cargando} aria-label="Elegir el cliente"
              className="rounded-md border border-white/10 bg-[#111] px-2 py-1 text-[13px] text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
              {(datos?.clientes ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.con_campana ? "" : " · sin campaña"}</option>)}
              {!datos && <option value="">Leyendo…</option>}
            </select>
          </label>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </header>

        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}
        {aviso && <p role="status" data-aviso={aviso.ok ? "ok" : "error"} className={`border-b px-4 py-2 text-[13px] sm:px-6 ${aviso.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>{aviso.texto}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {!datos && !error && <p className="text-[13px] text-zinc-500">Leyendo el plan…</p>}
          {datos && !hayAlgo && <p className="text-[13px] text-zinc-400">{datos.cliente ? `${datos.cliente.nombre} todavía no tiene plan de 90 días ni campaña en la cadena.` : "No hay clientes para mostrar."}</p>}
          {datos && hayAlgo && (
            <>
              {/* la portada: en qué está la campaña, qué versión del plan y de la estrategia, qué falta decidir */}
              <section aria-label="La portada del plan" className="pl-seccion mb-5 rounded-lg border border-white/10 bg-black/30 p-4 sm:p-5">
                <h3 className="font-display text-[24px] font-semibold leading-tight tracking-tight text-zinc-50">{datos.cliente?.nombre}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {c && <Chip tono={c.estado === "activa" ? "verde" : c.estado === "pausada" || c.estado === "necesita_humano" ? "ambar" : "neutro"}>campaña {estadoDeCampanaLegible(c.estado)}</Chip>}
                  {c && (c.desde || c.hasta) && <Chip>{c.desde ? diaDelCalendario(c.desde) : "—"} → {c.hasta ? diaDelCalendario(c.hasta) : "—"}</Chip>}
                  {datos.fase_activa.situacion !== "sin_fecha" && c && <Chip>{textoDeLaFase({ fase_activa: datos.fase_activa, campana: { desde: c.desde } as never })}</Chip>}
                  {e && <Chip>estrategia v{e.version ?? "?"} · {e.estado}</Chip>}
                  {d && <Chip>plan escrito {d.creado_en ? fechaCortaEC(d.creado_en) : ""}</Chip>}
                  {d && <Chip tono={d.estado_del_plan === "con_pendientes" ? "ambar" : "neutro"}>{estadoDelPlanLegible(d.estado_del_plan)}{d.marcas.length ? ` · ${d.marcas.length}` : ""}</Chip>}
                  {rev && rev.status !== "pending" && rev.decision && <Chip tono={rev.status === "approved" ? "verde" : "rojo"}>{rev.decision} · {fechaCortaEC(rev.creada_en)}</Chip>}
                </div>
                {c?.estado_motivo && <p className="mt-2 text-[12.5px] text-zinc-400">{c.estado_motivo}</p>}
                {c && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-4">
                    <div><dt className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">Sedes</dt><dd className="text-zinc-200">{c.sedes.length ? c.sedes.map(sedeLegible).join(" · ") : "—"}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">Publicaciones</dt><dd className="text-zinc-200">{c.publicaciones}{c.version_calendario != null ? ` · calendario v${c.version_calendario}` : ""}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">Tope de planeación</dt><dd className="text-zinc-200" title="Lo máximo que gasta la planeación de esta campaña; no es pauta ni presupuesto del cliente">{usdES(c.tope_planeacion_usd)}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">Producción</dt><dd className="text-zinc-200">{c.autoproducir ? "la oficina produce sola" : "cada pieza se pide"}</dd></div>
                  </dl>
                )}
              </section>

              {/* lo que espera tu decisión */}
              {rev && rev.status === "pending" && (
                <section aria-label="Tu decisión sobre el plan" data-apartado="decision" className="pl-seccion mb-5 rounded-lg border border-amber-400/40 bg-amber-400/[0.06] p-4" style={{ animationDelay: "40ms" }}>
                  <h3 className="text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>Espera tu decisión</h3>
                  <p className="mt-1 text-[13px] text-zinc-100">El plan quedó con puntos por resolver: el chequeo del sistema los marcó antes de darlo por bueno.</p>
                  {d && d.marcas.length > 0 && (
                    <ol className="mt-2 space-y-1.5" aria-label="Las marcas del chequeo">
                      {d.marcas.map((m, i) => <li key={`${m.codigo}-${i}`} className="flex gap-2 text-[12.5px]"><span className="shrink-0 rounded border border-white/15 px-1.5 font-mono text-[10.5px] text-zinc-400">{m.codigo || "·"}</span><span className="text-zinc-200">{m.texto}</span></li>)}
                    </ol>
                  )}
                  {d && d.aviso_del_chequeo.length > 0 && (
                    <details className="mt-2 text-[12px] text-zinc-400"><summary className="cursor-pointer">Lo que dice el chequeo, punto por punto</summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">{d.aviso_del_chequeo.map((p, i) => <li key={i}>{p}</li>)}</ul></details>
                  )}
                  {d?.jefatura && <p className="mt-2 text-[12px] text-zinc-400">{resultadoDeJefaturaDelPlanLegible(d.jefatura.resultado)}{d.jefatura.marcado_en ? ` · ${fechaCortaEC(d.jefatura.marcado_en)}` : ""}</p>}
                  <Decision revisionId={rev.id} enviar={{ accion }} onDecidido={decidido} />
                </section>
              )}

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
                <div className="min-w-0 space-y-5">
                  {/* las fases */}
                  <Seccion titulo="Las fases" nota={e ? `estrategia v${e.version ?? "?"}` : undefined} retraso={60}>
                    {!e || e.fases.length === 0 ? <Vacio>La estrategia todavía no trae fases.</Vacio> : (
                      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Las fases de la estrategia">
                        {e.fases.map((f) => (
                          <li key={f.clave} className={`pl-fase rounded-md border p-3 ${faseEnCurso === f.clave ? "border-amber-400/70 bg-amber-400/10" : "border-white/10 bg-white/[0.02]"}`} aria-current={faseEnCurso === f.clave ? "step" : undefined} data-fase={f.clave}>
                            <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">Días {f.dia_desde}–{f.dia_hasta}</p>
                            <p className="mt-1 text-[13px] text-zinc-100">{f.objetivo}</p>
                            {f.cita_plan && <p className="mt-1 text-[11.5px] italic text-zinc-500">«{f.cita_plan}»</p>}
                          </li>
                        ))}
                      </ol>
                    )}
                  </Seccion>

                  {/* la meta y el reparto, del documento del plan */}
                  <Seccion titulo="La meta y el reparto" nota={d ? `${d.titulo}${d.caracteres ? ` · ${d.caracteres.toLocaleString("es-EC")} caracteres` : ""}` : "sin documento del plan"} retraso={120}>
                    {!d && <Vacio>La oficina de planeación todavía no escribió el plan de este cliente.</Vacio>}
                    {d && !d.plan && d.prosa && <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-200">{d.prosa}</p>}
                    {d && !d.plan && !d.prosa && <Vacio>El documento del plan está vacío.</Vacio>}
                    {d?.plan && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-4">
                          <div className="col-span-2"><Titulito>Meta</Titulito><p className="text-[15px] font-medium text-zinc-50">{textoDeLaMeta(d.plan) ?? "Sin meta declarada"}</p></div>
                          <div><Titulito>Zonas</Titulito><p className="text-zinc-200">{d.plan.zonas.length ? d.plan.zonas.map(sedeLegible).join(" · ") : "—"}</p></div>
                          <div><Titulito>Horario</Titulito><p className="text-zinc-200">{d.plan.horario ?? "—"}{d.plan.dias_activos_por_semana != null ? ` · ${d.plan.dias_activos_por_semana} días/semana` : ""}</p></div>
                        </div>
                        {d.plan.canales.length > 0 && (
                          <div><Titulito>Canales y su peso</Titulito>
                            <ul className="space-y-2">{d.plan.canales.map((x) => <Barra key={x.canal} nombre={`${canalDelPlanLegible(x.canal)}${x.activo ? "" : " · apagado"}`} pct={x.peso ?? 0} detalle={x.condicion ?? undefined} />)}</ul></div>
                        )}
                        {(d.plan.produccion_fraccion != null || d.plan.marca_fraccion != null) && (
                          <p className="text-[12.5px] text-zinc-300"><span className="text-zinc-500">Del esfuerzo · </span>{d.plan.produccion_fraccion != null ? `${porcentaje(d.plan.produccion_fraccion)} a producción` : ""}{d.plan.produccion_fraccion != null && d.plan.marca_fraccion != null ? " · " : ""}{d.plan.marca_fraccion != null ? `${porcentaje(d.plan.marca_fraccion)} a marca` : ""}</p>
                        )}
                        {d.plan.equilibrio && (
                          <div className="rounded-md border border-white/10 bg-black/30 p-3"><Titulito>Decisión de equilibrio · {decisionDeEquilibrioLegible(d.plan.equilibrio.decision)}</Titulito>
                            {d.plan.equilibrio.motivo && <p className="text-[12.5px] leading-relaxed text-zinc-300">{d.plan.equilibrio.motivo}</p>}</div>
                        )}
                        {d.plan.no_se.length > 0 && (
                          <div><Titulito>Lo que el plan declara que no sabe ({d.plan.no_se.length})</Titulito>
                            <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-amber-100/90">{d.plan.no_se.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                        )}
                        {d.plan.otras_claves.length > 0 && <p className="text-[11px] text-zinc-600">El documento trae además: {d.plan.otras_claves.join(" · ")} (sin lectura todavía).</p>}
                      </div>
                    )}
                  </Seccion>

                  {/* las redes y su ritmo */}
                  <Seccion titulo="Redes y ritmo" nota={ritmo ? `${plural(ritmo.total, "publicación", "publicaciones")} por semana · ${ritmo.feed} feed · ${ritmo.historias} historias · ${plural(ritmo.anuncios, "anuncio", "anuncios")}` : undefined} retraso={180}>
                    {!e || e.redes.length === 0 ? <Vacio>La estrategia todavía no reparte las redes.</Vacio> : (
                      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Las redes de la estrategia">
                        {e.redes.map((r) => {
                          const red = redDelTablero(r.red); const fuera = r.rol === "no"
                          return (
                            <li key={r.red} data-red={r.red} data-rol={r.rol} className={`rounded-md border p-3 ${fuera ? "border-white/[0.06] opacity-60" : "border-white/10 bg-white/[0.02]"}`}>
                              <div className="flex flex-wrap items-baseline gap-2"><span className="text-[13px] font-medium text-zinc-100">{red.nombre}</span><Chip tono={r.rol === "principal" ? "ambar" : "neutro"}>{rolDeLaRedLegible(r.rol)}</Chip></div>
                              {!fuera && <p className="mt-1 text-[12px] text-zinc-300">{[r.feed_semana ? `${r.feed_semana} al feed` : null, r.historias_semana ? `${r.historias_semana} historias` : null, r.anuncios_semana ? `${r.anuncios_semana} anuncios` : null].filter(Boolean).join(" · ") || "sin frecuencia"} por semana{r.formatos.length ? ` · ${r.formatos.map(formatoLegible).join(", ")}` : ""}</p>}
                              {r.motivo && <p className="mt-1 text-[11.5px] text-zinc-500">{r.motivo}</p>}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    {e && e.excluidos.length > 0 && <p className="mt-2 text-[12px] text-zinc-400">Fuera del plan: {e.excluidos.map((x) => `${redDelTablero(x.red).nombre}${x.cita_plan ? ` («${x.cita_plan}»)` : ""}`).join(" · ")}</p>}
                  </Seccion>

                  {/* los pilares */}
                  <Seccion titulo="Pilares de contenido" retraso={240}>
                    {!e || e.pilares.length === 0 ? <Vacio>Sin pilares en la estrategia.</Vacio> : <ul className="space-y-2" aria-label="Los pilares">{e.pilares.map((p) => <Barra key={p.clave} nombre={p.nombre} pct={p.pct} detalle={pilarLegible(p.clave) || undefined} />)}</ul>}
                  </Seccion>

                  {/* el patrón semanal */}
                  <Seccion titulo="La semana tipo" nota={e?.patron_semanal.length ? `${e.patron_semanal.length} publicaciones fijas por semana` : undefined} retraso={300}>
                    {!e || e.patron_semanal.length === 0 ? <Vacio>La estrategia todavía no fija una semana tipo.</Vacio> : (
                      <div role="grid" aria-label="La semana tipo" className="overflow-x-auto">
                        <div role="row" className="grid min-w-[640px] grid-cols-7 gap-1">
                          {semanaDelPatron(e.patron_semanal).map((dia) => (
                            <div role="gridcell" key={dia.dia} className="min-h-[4rem] rounded-sm border border-white/[0.06] p-1.5" aria-label={dia.nombre}>
                              <p className="text-[11px] uppercase tracking-wider text-zinc-500">{dia.nombre}</p>
                              <ul className="mt-1 space-y-1">{dia.slots.map((s) => <li key={s.slot} className="rounded-sm bg-white/[0.04] px-1.5 py-1 text-[11px] leading-tight" title={`${redDelTablero(s.red).nombre} · ${formatoLegible(s.formato)} · ${pilarLegible(s.pilar) || s.pilar}${s.sede ? ` · ${sedeLegible(s.sede)}` : ""}${s.requiere_abierto ? " · pide local abierto" : ""}`}><span className="text-zinc-200">{s.hora} {redDelTablero(s.red).sigla}</span><span className="block text-zinc-400">{formatoLegible(s.formato)}{s.requiere_abierto ? " ·" : ""}</span></li>)}</ul>
                            </div>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[11px] text-zinc-500">El punto «·» marca una publicación que pide el local abierto. Las fechas reales están en el calendario.</p>
                      </div>
                    )}
                  </Seccion>

                  {/* lo que falta, lo que alerta, lo que depende */}
                  <Seccion titulo="Lo que la estrategia deja dicho" retraso={360}>
                    {!e ? <Vacio>Sin estrategia todavía.</Vacio> : (
                      <div className="space-y-4 text-[12.5px]">
                        <div><Titulito>Datos que faltan ({e.pendientes.length})</Titulito>
                          {e.pendientes.length === 0 ? <Vacio>No falta ningún dato declarado.</Vacio> : <ul className="space-y-1.5">{e.pendientes.map((p) => <li key={p.clave} className="text-zinc-200">{p.que_falta}<span className="text-zinc-500"> · {pedirALegible(p.pedir_a)}{p.desbloquea.length ? ` · desbloquea: ${p.desbloquea.join(", ")}` : ""}</span></li>)}</ul>}</div>
                        <div><Titulito>Alertas ({e.alertas.length})</Titulito>
                          {e.alertas.length === 0 ? <Vacio>Sin alertas.</Vacio> : <ul className="space-y-1.5">{e.alertas.map((a, i) => <li key={i} className="text-amber-100/90">{a.texto}{fuenteDeLaAlertaLegible(a.ref) ? <span className="text-zinc-500"> · {fuenteDeLaAlertaLegible(a.ref)}</span> : null}</li>)}</ul>}</div>
                        <div><Titulito>Dependencias ({e.dependencias.length})</Titulito>
                          {e.dependencias.length === 0 ? <Vacio>Sin dependencias.</Vacio> : <ul className="space-y-1.5">{e.dependencias.map((x, i) => <li key={i} className="text-zinc-200">{x.regla || `${x.antes} → ${x.despues}`}{x.regla ? <span className="text-zinc-500"> · primero {x.antes}, después {x.despues}</span> : null}</li>)}</ul>}</div>
                        <div><Titulito>Fechas que importan ({e.fechas_que_importan.length})</Titulito>
                          {e.fechas_que_importan.length === 0 ? <Vacio>Sin fechas especiales declaradas.</Vacio> : <ul className="space-y-1.5">{e.fechas_que_importan.map((f, i) => <li key={i} className="text-zinc-200">{f.tipo}{f.ambito ? ` · ${f.ambito}` : ""}<span className="text-zinc-500"> · {origenDeLaFechaLegible(f.origen)}{f.motivo ? ` · ${f.motivo}` : ""}</span></li>)}</ul>}</div>
                        <div><Titulito>Hitos ({e.hitos.length})</Titulito>
                          {e.hitos.length === 0 ? <Vacio>Esta estrategia no fija hitos.</Vacio> : <ul className="space-y-1">{e.hitos.map((h) => <li key={h.clave} className="text-zinc-200">Día {h.dia} · {tipoDeHitoLegible(h.tipo)}{h.cita_plan ? <span className="text-zinc-500"> · «{h.cita_plan}»</span> : null}</li>)}</ul>}</div>
                        {e.piezas_fijas.length > 0 && <div><Titulito>Piezas fijas ({e.piezas_fijas.length})</Titulito><ul className="space-y-1">{e.piezas_fijas.map((p) => <li key={p.clave} className="text-zinc-200">Semana {p.semana} · {p.tema}<span className="text-zinc-500"> · {p.slot}</span></li>)}</ul></div>}
                      </div>
                    )}
                  </Seccion>
                </div>

                {/* al costado: lo que espera la campaña y lo que el sistema no buscó */}
                <aside aria-label="Lo que espera la campaña" className="pl-seccion space-y-5 lg:sticky lg:top-0 lg:self-start" style={{ animationDelay: "120ms" }}>
                  <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4" data-apartado="esperas">
                    <h3 className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>Lo que espera la campaña</h3>
                    {!c ? <Vacio>Sin campaña, nada espera.</Vacio> : datos.esperas.vivas === 0 ? <Vacio>Nada en espera ahora.</Vacio> : (
                      <ul className="space-y-2" aria-label="Las esperas vivas">
                        {datos.esperas.grupos.map((g) => (
                          <li key={g.tipo} data-espera={g.tipo} className="flex gap-2 text-[12.5px]"><span className="shrink-0 rounded-md border border-white/15 px-1.5 tabular-nums text-zinc-300">{g.n}</span><span className="text-zinc-300">{g.etiqueta}{g.vence_primero ? <span className="block text-[11px] text-zinc-500">la primera vence {fechaCortaEC(g.vence_primero)}</span> : null}</span></li>
                        ))}
                      </ul>
                    )}
                    {c && datos.esperas.vivas > 0 && <p className="mt-3 text-[11px] text-zinc-500">{datos.esperas.vivas} esperas vivas en total · cada una tiene reloj.</p>}
                  </section>
                  {d && d.no_se_busco.length > 0 && (
                    <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                      <h3 className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>Lo que no se buscó, y por qué</h3>
                      <ul className="space-y-1.5 text-[12px] text-zinc-400">{d.no_se_busco.map((x, i) => <li key={i}>{x}</li>)}</ul>
                      <p className="mt-2 text-[11px] text-zinc-600">Lo declara el sistema, no la oficina de planeación.</p>
                    </section>
                  )}
                  {e && (
                    <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                      <h3 className="mb-2 text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>Ficha</h3>
                      <dl className="space-y-1 text-[12px] text-zinc-400">
                        <div><dt className="inline text-zinc-500">Estrategia · </dt><dd className="inline">v{e.version ?? "?"} · {e.estado}{e.creada_en ? ` · ${fechaCortaEC(e.creada_en)}` : ""}{e.costo_usd != null ? ` · costó ${usdES(e.costo_usd)}` : ""}</dd></div>
                        {c?.creada_en && <div><dt className="inline text-zinc-500">Campaña creada · </dt><dd className="inline">{fechaCortaEC(c.creada_en)}</dd></div>}
                        {c?.actualizada_en && <div><dt className="inline text-zinc-500">Último cambio · </dt><dd className="inline">{fechaCortaEC(c.actualizada_en)}</dd></div>}
                      </dl>
                    </section>
                  )}
                </aside>
              </div>
            </>
          )}
        </div>
        <footer className="border-t border-white/10 px-4 py-2 text-[11.5px] text-zinc-500 sm:px-6">Aprobar o pedir cambios se registra en la bandeja del sistema (la misma de siempre) y la oficina de planeación lo lee. El plan lo escribe esa oficina; editar sus partes desde aquí se habilita cuando la plataforma lo acepte (próximo paso).</footer>
      </section>
    </div>
  )
}
