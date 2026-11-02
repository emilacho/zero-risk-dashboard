"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { PlanDelCliente } from "@/lib/plan-datos"
import { PlanEnSecciones } from "@/components/nuevo/PlanEnSecciones"
import { BOTONES_DEL_PLAN, rotuloDelTextoMientrasSeRehace, canalDelPlanLegible, cuerpoDeAprobar, cuerpoDePedirCambios, decisionDeEquilibrioLegible, leerElCiclo, inicioSujetoAReanudar, estadoDeLaEstrategia, type AvanceDelPedido, type CicloDelPlan, type EstadoDelCiclo, type RespuestaDelCiclo, estadoDelPlanLegible, fuenteDeLaAlertaLegible, origenDeLaFechaLegible, pedirALegible, porcentaje, publicacionesPorSemana, resultadoDeJefaturaDelPlanLegible, rolDeLaRedLegible, sedeLegible, semanaDelPatron, textoDeLaMeta, tipoDeHitoLegible } from "@/lib/plan"
import { diaDelCalendario, formatoLegible, redDelTablero } from "@/lib/pizarron"
import { textoDeLaFase } from "@/components/nuevo/PanelPizarron"
import { enviarAlCiclo, type PuertaDelCiclo } from "@/lib/plan-ciclo"
import { fechaCortaEC } from "@/lib/manual"
import { estadoDeCampanaLegible, pilarLegible, plural } from "@/lib/lenguaje"

const AMBAR = "#f5a524"
type Respuesta = ({ ok: true } & PlanDelCliente) | { ok: false; error: string }

const ESTILO = `
.pl-seccion{animation:plEntra .45s cubic-bezier(.2,.8,.2,1) both}
.pl-barra{transition:width .6s cubic-bezier(.2,.8,.2,1)}
.pl-fase[aria-current="step"]{box-shadow:0 0 0 1px rgba(245,165,36,.7),0 0 18px rgba(245,165,36,.25)}
@keyframes plEntra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.nv-pl-paso-vivo{animation:nvPlPaso 1.6s ease-in-out infinite}
@keyframes nvPlPaso{0%,100%{box-shadow:0 0 0 0 rgba(245,165,36,.0)}50%{box-shadow:0 0 0 6px rgba(245,165,36,.25)}}
@media (prefers-reduced-motion:reduce){.nv-pl-paso-vivo{animation:none}.pl-seccion{animation:none}.pl-barra{transition:none}}
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

const COLOR_PASO: Record<string, string> = { hecho: "border-amber-300 bg-amber-400 text-black", en_curso: "nv-pl-paso-vivo border-amber-300 bg-amber-400/25 text-amber-100", pendiente: "border-white/20 bg-transparent text-zinc-500", fallo: "border-rose-400 bg-rose-500/80 text-white" }
/** LA BARRA DE PROGRESO del pedido de cambios (ADENDA 1 de Emilio, 01-nov): cinco pasos con su hora, el tiempo estimado y, si falla, el paso en rojo con qué hacer */
function BarraDelPedido({ avance, onOcultar }: { avance: AvanceDelPedido; /** cerrarla a propósito (se reabre con «Ver el avance») */ onOcultar?: () => void }) {
  return (
    <div data-barra-del-pedido data-fallo={avance.fallo ? "si" : "no"} className="relative mt-4 rounded-lg border border-white/10 bg-black/30 p-4" role="group" aria-label="El avance de tu pedido de cambios">
      {onOcultar && <button type="button" data-accion="ocultar-avance" onClick={onOcultar} className="absolute right-2 top-2 rounded px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200">Ocultar</button>}
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {avance.pasos.map((p, i) => (
          <li key={p.clave} data-paso={p.clave} data-estado={p.estado} className="flex items-start gap-2 sm:flex-col sm:items-center sm:text-center">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold ${COLOR_PASO[p.estado]}`}>{p.estado === "hecho" ? "✓" : p.estado === "fallo" ? "!" : i + 1}</span>
            <span className="min-w-0">
              <span className={`block text-[12.5px] ${p.estado === "pendiente" ? "text-zinc-500" : p.estado === "fallo" ? "text-rose-200" : "text-zinc-100"}`}>{p.nombre}</span>
              <span className="block text-[11px] text-zinc-500">{p.hora ? horaCortaEC(p.hora) : p.estado === "en_curso" ? "en curso" : "—"}</span>
              {p.detalle && <span className="block text-[11px] text-rose-300">{p.detalle}</span>}
            </span>
          </li>
        ))}
      </ol>
      {avance.ahora && <p data-ahora={avance.ahora.quien} className="mt-3 flex items-center gap-2 text-[13px] text-zinc-100"><span aria-hidden className="nv-pl-paso-vivo inline-block h-2 w-2 rounded-full bg-violet-400" />Ahora: {avance.ahora.texto.charAt(0).toLowerCase()}{avance.ahora.texto.slice(1)}{avance.ahora.desde ? ` · desde las ${horaCortaEC(avance.ahora.desde)}` : ""}</p>}
      <p className="mt-3 text-[12px] text-zinc-400" data-estimado>{avance.estimado}</p>
      {avance.nota && <p className="mt-1 text-[12px] text-amber-200">{avance.nota}</p>}
      {avance.fallo && <p role="alert" className="mt-2 rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-100">{avance.fallo.texto} <span className="text-rose-200/80">{avance.fallo.que_hacer}</span></p>}
    </div>
  )
}
/** la hora (Ecuador) de un instante: «15:42» */
const horaCortaEC = (iso: string): string => { try { return new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" }) } catch { return "—" } }

type EnviarAlCiclo = typeof enviarAlCiclo
const ESTADO_CICLO_COLOR: Record<EstadoDelCiclo, string> = {
  en_revision: "border-sky-400/50 bg-sky-400/10 text-sky-100",
  reescribiendo: "border-violet-400/50 bg-violet-400/10 text-violet-100",
  esperando_decision: "border-amber-400/70 bg-amber-400/15 text-amber-100",
  aprobado: "border-emerald-400/60 bg-emerald-400/10 text-emerald-100",
}
const BOTON_GRANDE = "min-h-[56px] rounded-xl px-6 py-3 text-[16px] font-semibold tracking-[0.01em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-50"

/**
 * LA DECISIÓN SOBRE EL PLAN (CC6 · 01-nov · ciclo del plan de CC1): para TODO plan, la versión vigente con su estado a la vista (en revisión · reescribiendo ·
 * esperando tu decisión · aprobado → pasa al brief) y los dos botones grandes. Sin avisos ni confirmaciones de gasto (Emilio, 01-nov 16:27Z): «Aprobar» es un
 * clic y «Pedir cambios» es escribir y enviar; el gasto se verá en el panel de gastos de la oficina y en Dinero. Si la última llamada no despertó al flujo se ofrece «Reintentar». Las versiones anteriores
 * quedan en segundo plano («corregido N veces · ver historial»).
 */
function DecisionDelPlan({ planId, statusDelDocumento, ciclo, enviar, onResultado, queCambio = null, palabraDelDueno = [], pedirEn = null, children }: { planId: string; statusDelDocumento: string | null; ciclo: CicloDelPlan; enviar: EnviarAlCiclo; onResultado: (r: RespuestaDelCiclo) => void; /** «QUÉ CAMBIÓ EN ESTA VERSIÓN» de la versión vigente */ queCambio?: string | null; /** «la palabra del dueño manda»: lo que un revisor contradijo y no entró, o lo pedido que no quedó cumplido */ palabraDelDueno?: NonNullable<PlanDelCliente["palabra_del_dueno"]>; /** pedir cambios sobre una sección del plan (lo dispara el plan en secciones; `n` cambia en cada clic) */ pedirEn?: { seccion: string; n: number } | null; /** lo que marcó el chequeo y la jefatura */ children?: React.ReactNode }) {
  const lectura = leerElCiclo(statusDelDocumento, ciclo)
  // Emilio (01-nov 16:27Z): sin avisos ni confirmaciones de gasto. Aprobar = un clic; Pedir cambios = escribir y enviar. El cuerpo sigue llevando lo que la
  // puerta exige (`confirmo_gasto:true`, `tope_usd:8`): el tope lo cuida la plataforma; el gasto se verá en el panel de gastos de la oficina y en Dinero
  const [modo, setModo] = useState<"quieto" | "escribir">("quieto")
  const [ocupado, setOcupado] = useState<null | "plan-aprobar" | "plan-cambios">(null)
  const [observaciones, setObservaciones] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [verHistorial, setVerHistorial] = useState(false)
  // la barra se ve SIEMPRE que haya avance (sale del dato, no de la memoria del navegador); solo se oculta si Emilio la cierra, y se reabre con «Ver el avance»
  const [barraOculta, setBarraOculta] = useState(false)
  const corregido = ciclo.version - 1
  // «Pedir cambios en esta sección»: abre el formulario con el nombre de la sección al comienzo, y lo trae a la vista
  useEffect(() => {
    if (!pedirEn || !lectura.puede_pedir_cambios) return
    setError(null); setModo("escribir")
    setObservaciones((o) => (o.trim() ? `${o.trimEnd()}\n\nSección «${pedirEn.seccion}»: ` : `Sección «${pedirEn.seccion}»: `))
    if (typeof document !== "undefined") requestAnimationFrame(() => document.querySelector('[data-apartado="decision"]')?.scrollIntoView({ behavior: "smooth", block: "start" }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedirEn?.n])

  async function mandar(accion: PuertaDelCiclo, cuerpo: Record<string, unknown> | { error: string }) {
    setError(null)
    if ("error" in cuerpo) { setError(String(cuerpo.error)); return }
    setOcupado(accion)
    const r = await enviar(accion, cuerpo)
    setOcupado(null)
    setModo("quieto")
    // la respuesta se dice una sola vez, arriba del panel (el aviso); aquí abajo solo quedan los errores de lo que se escribió
    if (r.ok) setObservaciones("")
    onResultado(r)
  }
  const reintentar = () => {
    if (lectura.reintentar === "plan-aprobar") { void mandar("plan-aprobar", cuerpoDeAprobar(planId, "")); return }
    void mandar("plan-cambios", cuerpoDePedirCambios(planId, ciclo.pedido?.texto ?? ""))
  }

  return (
    <section aria-label="La decisión sobre el plan" data-apartado="decision" data-ciclo={lectura.estado} className="pl-seccion mb-5 rounded-xl border border-amber-400/40 bg-amber-400/[0.05] p-4 sm:p-5" style={{ animationDelay: "40ms" }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>La decisión sobre el plan</h3>
        <span data-estado-ciclo={lectura.estado} className={`rounded-full border px-3 py-1 text-[13px] font-medium ${ESTADO_CICLO_COLOR[lectura.estado]}`}>{lectura.titulo}</span>
        {ciclo.avance && barraOculta && (
          <button type="button" data-accion="ver-avance" onClick={() => setBarraOculta(false)} className="rounded-full border border-violet-300/50 px-3 py-1 text-[12.5px] text-violet-100 hover:bg-violet-500/15">Ver el avance</button>
        )}
        {corregido > 0 && <span className="text-[12px] text-zinc-400" data-version={ciclo.version}>Corregido {plural(corregido, "vez", "veces")}</span>}
        {ciclo.historial.length > 0 && (
          <button type="button" data-accion="ver-historial" aria-expanded={verHistorial} onClick={() => setVerHistorial((v) => !v)} className="text-[12px] text-zinc-400 underline decoration-dotted underline-offset-4 hover:text-zinc-200">
            {verHistorial ? "ocultar historial" : "ver historial"}
          </button>
        )}
      </div>
      {queCambio && ciclo.version > 1 && (
        <div data-que-cambio className="mt-3 rounded-lg border border-amber-400/40 bg-black/30 p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-amber-300">Qué cambió en el plan</p>
          <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-zinc-100">{queCambio}</p>
        </div>
      )}
      <p className="mt-2 text-[14px] leading-relaxed text-zinc-100">{lectura.detalle}</p>
      {/* «la palabra del dueño manda» (Emilio, 01-nov): lo que un revisor sugirió contra tu orden no entra al plan; aquí queda a la vista, sin tocar el texto */}
      {palabraDelDueno.map((x) => (
        <div key={x.id} data-palabra-del-dueno={x.requiere_humano ? "no_cumplida" : "contradicha"} className={`mt-3 rounded-lg border p-3 ${x.requiere_humano ? "border-rose-400/50 bg-rose-500/[0.08]" : "border-amber-400/40 bg-black/30"}`}>
          <p className={`text-[11px] font-medium uppercase tracking-[0.14em] ${x.requiere_humano ? "text-rose-200" : "text-amber-300"}`}>{x.requiere_humano ? "Tu orden no quedó cumplida" : "Tu palabra manda"}</p>
          <p className="mt-1 text-[13.5px] font-medium text-zinc-100">{x.titulo.replace(/^Plan de 90 días:\s*/i, "")}</p>
          {x.detalle && <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">{x.detalle}</p>}
        </div>
      ))}
      {ciclo.avance && !barraOculta && <BarraDelPedido avance={ciclo.avance} onOcultar={() => setBarraOculta(true)} />}
      {lectura.estado === "reescribiendo" && ciclo.pedido?.texto && (
        <blockquote className="mt-2 border-l-2 border-violet-400/50 pl-3 text-[12.5px] italic text-zinc-300">Lo que pediste: {ciclo.pedido.texto}</blockquote>
      )}
      {lectura.avisos.length > 0 && (
        <ul className="mt-2 space-y-1" aria-label="Avisos del ciclo">{lectura.avisos.map((a, i) => <li key={i} data-aviso-ciclo className="rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-[12.5px] text-zinc-300">{a}</li>)}</ul>
      )}

      {children}

      {modo === "quieto" && (lectura.puede_aprobar || lectura.puede_pedir_cambios) && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {lectura.puede_aprobar && <button type="button" data-accion="plan-aprobar-asi" disabled={!!ocupado} onClick={() => void mandar("plan-aprobar", cuerpoDeAprobar(planId, ""))} className={`${BOTON_GRANDE} border border-amber-300/80 bg-amber-400/90 text-black hover:bg-amber-300`}>{ocupado === "plan-aprobar" ? "Aprobando…" : BOTONES_DEL_PLAN.aprobar}</button>}
          {lectura.puede_pedir_cambios && <button type="button" data-accion="plan-pedir-cambios" disabled={!!ocupado} onClick={() => { setError(null); setModo("escribir") }} className={`${BOTON_GRANDE} border border-white/25 bg-white/[0.06] text-zinc-50 hover:border-violet-300/70 hover:bg-violet-400/10`}>{BOTONES_DEL_PLAN.rechazar}</button>}
        </div>
      )}
      {modo === "quieto" && lectura.reintentar && (
        <div className="mt-4">
          <button type="button" data-accion="reintentar" disabled={!!ocupado} onClick={reintentar} className={`${BOTON_GRANDE} border border-amber-300/70 bg-black/40 text-amber-100 hover:bg-amber-400/15`}>
            {ocupado ? "Enviando…" : lectura.reintentar === "plan-cambios" ? "Reintentar el pedido" : "Reintentar: seguir al brief"}
          </button>
        </div>
      )}

      {modo === "escribir" && (
        <form data-editor="plan-cambios" className="mt-4 rounded-lg border border-violet-400/30 bg-black/30 p-3" onSubmit={(ev) => { ev.preventDefault(); void mandar("plan-cambios", cuerpoDePedirCambios(planId, observaciones)) }}>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">¿Qué debe cambiar? (el jefe de marketing lo lee y reescribe el plan)</span>
            <textarea value={observaciones} onChange={(ev) => setObservaciones(ev.target.value)} rows={4} maxLength={4000} aria-label="Qué debe cambiar en el plan" autoFocus
              className="w-full resize-y rounded-md border border-white/15 bg-black/40 px-3 py-2 text-[14px] leading-relaxed text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400" />
          </label>
          <p className="mt-1 text-[11px] text-zinc-500">{observaciones.trim().length}/4000</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="submit" data-accion="enviar-pedido" disabled={!!ocupado} className="rounded-md border border-violet-300/60 bg-violet-500/70 px-5 py-2 text-[13.5px] font-medium text-white hover:bg-violet-500 disabled:opacity-50">{ocupado === "plan-cambios" ? "Enviando…" : "Enviar el pedido"}</button>
            <button type="button" disabled={!!ocupado} onClick={() => setModo("quieto")} className="rounded-md border border-white/10 px-4 py-2 text-[13px] text-zinc-400 hover:bg-white/[0.05]">Cancelar</button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="mt-3 text-[13px] text-rose-300">{error}</p>}

      {verHistorial && ciclo.historial.length > 0 && (
        <ol data-historial className="mt-4 space-y-1 border-t border-white/10 pt-3 text-[12.5px] text-zinc-400" aria-label="Versiones anteriores del plan">
          {ciclo.historial.map((v) => (
            <li key={v.id} className="flex flex-wrap gap-x-2">
              <span className="text-zinc-300">Plan anterior</span>
              {v.creado_en && <span>· {fechaCortaEC(v.creado_en)}</span>}
              {v.superseded_por ? <span>· reemplazada</span> : v.status === "rejected" ? <span>· rechazada</span> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export function PanelPlan({ onCerrar, datosIniciales = null, clienteInicial = null, enviarCiclo = enviarAlCiclo }: { onCerrar: () => void; datosIniciales?: PlanDelCliente | null; /** abrir con este cliente (el harness local y las aplicaciones lo usan) */ clienteInicial?: string | null; /** cómo se envían las decisiones del ciclo (pruebas) */ enviarCiclo?: typeof enviarAlCiclo }) {
  const [datos, setDatos] = useState<PlanDelCliente | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [cliente, setCliente] = useState<string | null>(datosIniciales?.cliente?.id ?? clienteInicial)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string; tono?: "info" } | null>(null)
  const [pedirEn, setPedirEn] = useState<{ seccion: string; n: number } | null>(null) // pedir cambios sobre una sección del plan
  const cerrar = useRef<HTMLButtonElement>(null)

  useEffect(() => { cerrar.current?.focus() }, [])
  // Esc cierra el plan y NO la oficina: se atiende en captura y se detiene ahí
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])

  const leer = useCallback(async (id: string | null, silencioso = false) => {
    if (!silencioso) { setCargando(true); setError(null) }
    try {
      const r = await fetch(`/api/plan${id ? `?cliente=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver el plan." : (j && !j.ok && j.error) || `No pude leer el plan (${r.status}).`)
      setDatos(j); setCliente(j.cliente?.id ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [])
  useEffect(() => { if (!datosIniciales) void leer(clienteInicial) }, [leer, datosIniciales, clienteInicial])
  // mientras el plan se reescribe o la jefatura lo revisa, el panel se actualiza solo (sin recargar) cada 15 s
  const enMarcha = !!datos?.ciclo && (datos.ciclo.pedido !== null || (datos.ciclo.con_compuerta && !datos.ciclo.compuerta))
  useEffect(() => {
    if (!enMarcha) return
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void leer(cliente, true) }, 15_000)
    return () => window.clearInterval(t)
  }, [enMarcha, leer, cliente])

  // después de decidir: se dice qué pasó, en palabras, y se vuelve a leer cuando el estado del ciclo cambió
  const alResultado = (r: RespuestaDelCiclo) => {
    setAviso({ ok: r.ok, texto: r.texto, tono: r.tono })
    if (r.releer) void leer(cliente)
  }

  const c = datos?.campana ?? null, e = datos?.estrategia ?? null, d = datos?.documento ?? null, rev = datos?.revision ?? null
  const faseEnCurso = datos?.fase_activa.situacion === "en_curso" ? datos.fase_activa.fase?.clave : null
  const ritmo = e ? publicacionesPorSemana(e.redes) : null
  // una revisión pendiente también es «algo»: se decide aunque la campaña o el documento no existan (ficha de práctica · plan sin cadena)
  const hayAlgo = !!(c || e || d || rev)

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onCerrar() }}>
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
        {aviso && <p role="status" data-aviso={aviso.ok ? "ok" : aviso.tono === "info" ? "info" : "error"} className={`border-b px-4 py-2 text-[13px] sm:px-6 ${aviso.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : aviso.tono === "info" ? "border-white/10 bg-white/[0.04] text-zinc-300" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>{aviso.texto}</p>}

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
                  {c && (() => { const sujeto = inicioSujetoAReanudar(c.estado, datos.fase_activa, c.desde); return sujeto ? <Chip tono="ambar">{sujeto}</Chip> : c.estado === "activa" && datos.fase_activa.situacion !== "sin_fecha" ? <Chip>{textoDeLaFase({ fase_activa: datos.fase_activa, campana: { estado: c.estado, desde: c.desde } as never })}</Chip> : null })()}
                  {e && <Chip>estrategia {estadoDeLaEstrategia(e.estado)}{c?.del_plan_anterior ? " · del plan anterior" : ""}</Chip>}
                  {d && <Chip>plan escrito {d.creado_en ? fechaCortaEC(d.creado_en) : ""}</Chip>}
                  {d && <Chip tono={d.estado_del_plan === "con_pendientes" ? "ambar" : "neutro"}>{estadoDelPlanLegible(d.estado_del_plan)}{d.marcas.length ? ` · ${d.marcas.length}` : ""}</Chip>}
                  {rev && rev.status !== "pending" && rev.decision && <Chip tono={rev.status === "approved" ? "verde" : "rojo"}>{rev.decision} · {fechaCortaEC(rev.creada_en)}</Chip>}
                </div>
                {c?.estado_motivo && <p className="mt-2 text-[12.5px] text-zinc-400">{c.estado_motivo}</p>}
                {c && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-3">
                    <div><dt className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">Sedes</dt><dd className="text-zinc-200">{c.sedes.length ? c.sedes.map(sedeLegible).join(" · ") : "—"}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">Publicaciones</dt><dd className="text-zinc-200">{c.publicaciones}{c.del_plan_anterior ? " · del plan anterior" : ""}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">Producción</dt><dd className="text-zinc-200">{c.autoproducir ? "la oficina produce sola" : "cada pieza se pide"}</dd></div>
                  </dl>
                )}
              </section>

              {/* la decisión sobre el plan: para TODO plan, con el estado del ciclo a la vista y los dos botones grandes */}
              {d && datos.ciclo && (
                <DecisionDelPlan planId={d.id} statusDelDocumento={d.status} ciclo={datos.ciclo} enviar={enviarCiclo} onResultado={alResultado} queCambio={d.que_cambio} palabraDelDueno={datos.palabra_del_dueno ?? []} pedirEn={pedirEn}>
                  {d.marcas.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[12.5px] text-zinc-300">El chequeo del sistema marcó estos puntos antes de darlo por bueno:</p>
                      <ol className="mt-1.5 space-y-1.5" aria-label="Las marcas del chequeo">
                        {d.marcas.map((m, i) => <li key={`${m.codigo}-${i}`} className="flex gap-2 text-[12.5px]"><span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70" /><span className="text-zinc-200">{m.texto}</span></li>)}
                      </ol>
                    </div>
                  )}
                  {d.aviso_del_chequeo.length > 0 && (
                    <details className="mt-2 text-[12px] text-zinc-400"><summary className="cursor-pointer">Lo que dice el chequeo, punto por punto</summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">{d.aviso_del_chequeo.map((p, i) => <li key={i}>{p}</li>)}</ul></details>
                  )}
                  {d.jefatura && <p className="mt-2 text-[12px] text-zinc-400">{resultadoDeJefaturaDelPlanLegible(d.jefatura.resultado)}{d.jefatura.marcado_en ? ` · ${fechaCortaEC(d.jefatura.marcado_en)}` : ""}</p>}
                </DecisionDelPlan>
              )}

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
                <div className="min-w-0 space-y-5">
                  {/* las fases */}
                  <Seccion titulo="Las fases" nota={e && c?.del_plan_anterior ? "de la estrategia del plan anterior" : undefined} retraso={60}>
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
                  <Seccion titulo="La meta y el reparto" nota={d ? `${rotuloDelTextoMientrasSeRehace(datos.ciclo) ? `${rotuloDelTextoMientrasSeRehace(datos.ciclo)} · ` : ""}${d.titulo}${d.caracteres ? ` · ${d.caracteres.toLocaleString("es-EC")} caracteres` : ""}` : "sin documento del plan"} retraso={120}>
                    {!d && <Vacio>La oficina de planeación todavía no escribió el plan de este cliente.</Vacio>}
                    {/* el plan por secciones (Emilio, 02-nov: «que no se pierda entre párrafos gigantes») */}
                    {d && !d.plan && d.prosa && <PlanEnSecciones prosa={d.prosa} onPedirCambios={datos.ciclo && leerElCiclo(d.status, datos.ciclo).puede_pedir_cambios ? (seccion) => setPedirEn((x) => ({ seccion, n: (x?.n ?? 0) + 1 })) : undefined} />}
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
                    {c && datos.esperas.vencidas.n > 0 && (
                      <div data-vencidas className="mt-4 border-t border-white/10 pt-3">
                        <h4 className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">Vencidas · {datos.esperas.vencidas.n}</h4>
                        <ul className="mt-1.5 space-y-1.5" aria-label="Las esperas vencidas">
                          {datos.esperas.vencidas.grupos.map((g) => <li key={g.tipo} data-vencida={g.tipo} className="flex gap-2 text-[12px] text-zinc-500"><span className="shrink-0 rounded-md border border-white/10 px-1.5 tabular-nums">{g.n}</span><span>{g.etiqueta}{g.vence_primero ? <span className="block text-[11px]">venció {fechaCortaEC(g.vence_primero)}</span> : null}</span></li>)}
                        </ul>
                        <p className="mt-1.5 text-[11px] text-zinc-600">Vencieron sin resolverse: ya no esperan nada (las cierra el reloj de la cadena).</p>
                      </div>
                    )}
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
                        <div><dt className="inline text-zinc-500">Estrategia · </dt><dd className="inline">{estadoDeLaEstrategia(e.estado)}{c?.del_plan_anterior ? " · del plan anterior" : ""}{e.creada_en ? ` · ${fechaCortaEC(e.creada_en)}` : ""}</dd></div>
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
        <footer className="border-t border-white/10 px-4 py-2 text-[11.5px] text-zinc-500 sm:px-6">Aprobar deja el plan firme y arranca la campaña (brief y gran idea). Pedir cambios hace que el jefe de marketing reescriba el plan y la jefatura lo revise. Cada decisión queda registrada; el plan lo escribe la oficina de planeación.</footer>
      </section>
    </div>
  )
}
