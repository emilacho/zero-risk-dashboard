"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { BajaParaFirmar, EditorDeCifra, type VerCambio } from "@/components/nuevo/EditorDeCifra"
import { PanelPlan } from "@/components/nuevo/PanelPlan"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import {
  NOMBRE_DEL_TIPO, TIPOS_DE_DECISION, TOPE_MOTIVO, TOPE_RESPUESTA, accionesDe, costoDeLaDecision, dondeSeDecide, faltaQueLeer, textoDeCifra, gruposDeDecisiones, haceCuanto, nombreDeOficina, prioridadLegible, tituloDeDecision,
  type AccionDeDecision, type Decision, type Decisiones, type TipoDeDecision,
} from "@/lib/direccion-decisiones"
import type { PasoDelRegistro, ResultadoDeContestar } from "@/lib/decisiones-contestar"
import { HORA_24 } from "@/lib/formato"

/**
 * TU OFICINA · DECISIONES (6.20 · capa 2 del encargo «oficina del humano»): la MESA DEL DIRECTOR. Todo lo que espera la firma de Emilio, de cualquier
 * departamento, como una pila de tarjetas: la más urgente al frente y las siguientes asomando detrás. Se pasa de una a otra con las flechas (o los botones);
 * a la izquierda, el índice por tipo filtra la pila. Cada tarjeta dice qué es, de qué cliente, desde cuándo espera, su prioridad y lo que se sabe del costo.
 * «Decidir» abre en el mismo lugar el panel del tablero nuevo donde esa decisión ya se toma (plan · gran idea · piezas y revisiones); al cerrarlo se vuelve a
 * la mesa con la lista leída de nuevo. Lo que todavía no tiene panel nuevo lo dice, sin botón falso y sin enlazar al tablero viejo.
 * 04-nov · CONTESTAR EN EL LUGAR (boceto aprobado por Emilio 18:08Z): las preguntas se responden o descartan en la misma tarjeta y las firmas se firman ahí;
 * cada tarjeta muestra solo las acciones que su oficina permite, quién pregunta y qué se destraba. Al contestar, la fila de origen cambia y la decisión sale
 * de todas partes a la vez; queda su registro (qué preguntó la oficina, qué hiciste, qué hizo el sistema). Si no salió, la tarjeta se queda con el motivo.
 * Primero lo que tiene un trabajo detenido; después, lo más antiguo.
 * Datos: `/api/direccion/decisiones` (servidor del tablero → ruta certificada de la plataforma). Si la lista está incompleta, nunca dice «nada pendiente».
 */
const AMBAR = "#e8731a"
type Respuesta = ({ ok: true } & Decisiones) | { ok: false; error: string }

const ESTILO = `
.de-pila{perspective:1400px}
.de-tarjeta{transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .45s ease,filter .45s ease}
.de-frente{animation:deLlega .55s cubic-bezier(.2,.8,.2,1) both}
@keyframes deLlega{from{opacity:0;transform:translateY(34px) rotateX(8deg) scale(.97)}to{opacity:1;transform:none}}
.de-urge{animation:none}
@keyframes deLate{0%,100%{box-shadow:0 0 0 0 rgba(245,120,36,.55)}50%{box-shadow:0 0 0 7px rgba(245,120,36,0)}}
.de-punto{display:inline-block;width:7px;height:7px;border-radius:50%;background:#e8731a;flex-shrink:0;box-shadow:0 0 6px 1px rgba(232,115,26,.45)} /* luz quieta: los puntos naranjas ya no laten (regla de CC6) */
.de-aviso{animation:deLlega .4s ease both}
.de-tipo[aria-pressed="true"]{border-color:rgba(232,115,26,.7);background:rgba(232,115,26,.1);color:#fff}
@media (prefers-reduced-motion:reduce){.de-tarjeta{transition:none}.de-frente,.de-urge,.de-aviso{animation:none}}
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
/** 6.52 · «Zero Risk Seguridad Industrial» → «Zero Risk SI» (nombres largos en un rótulo corto) */
export const clienteCorto = (c: string): string => { const w = c.trim().split(/\s+/); return w.length > 3 ? `${w.slice(0, 2).join(" ")} ${w.slice(2).map((x) => x[0]?.toLocaleUpperCase("es") ?? "").join("")}` : c }
/** el grupo que se mira: lo que espera tu firma, lo que se atiende fuera, o lo de un cliente en pausa */
type Grupo = "firma" | "detienen" | "fuera" | `pausa:${string}`

/** 04-nov · lo que pasó con una decisión que contestaste (el registro de su detalle) */
export interface Contestada { d: Decision; resultado: ResultadoDeContestar; accion: AccionDeDecision; en: string }
const iniciales = (o: string) => o.replace(/(de|la|del|el)/gi, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toLocaleUpperCase("es")).join("") || "OF"
const hora = (iso: string | null) => { if (!iso) return null; const t = new Date(iso); return Number.isNaN(t.getTime()) ? null : t.toLocaleTimeString("es-EC", { ...HORA_24 }) }
const COLOR_PASO: Record<PasoDelRegistro["estado"], string> = { pregunto: "#e9d6b6", respondiste: "#e9d6b6", firmaste: "#e9d6b6", descartaste: "#a1a1aa", guardado: "#8fbf9a", retomado: "#8fbf9a", espera: "#71717a", fallo: "#ff5a36" }

/** el registro de una decisión: qué preguntó la oficina, qué hiciste tú y qué hizo el sistema después */
function Registro({ c, onCerrar }: { c: Contestada; onCerrar: () => void }) {
  return (
    <aside data-registro aria-label="Registro de la decisión" className="absolute inset-y-0 right-0 z-10 flex w-full max-w-[430px] flex-col overflow-y-auto border-l border-white/10 bg-[#141414] p-6 shadow-[-20px_0_50px_rgba(0,0,0,.5)]">
      <div className="flex items-center"><p className="font-display text-[13px] uppercase tracking-[0.2em] text-zinc-400">Registro</p>
        <button type="button" onClick={onCerrar} className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06]">Cerrar</button></div>
      <p className="mt-2 text-[16px] font-light leading-snug text-white">{tituloDeDecision(c.d)}</p>
      <ol className="relative mt-5 border-l border-white/10 pl-5">
        {c.resultado.registro.map((p, k) => (
          <li key={k} data-paso={p.estado} className="relative mb-4">
            <span aria-hidden className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full" style={{ background: COLOR_PASO[p.estado] }} />
            <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">{[hora(p.cuando), p.quien === "tu" ? "tú" : p.quien === "oficina" ? "la oficina" : "el sistema"].filter(Boolean).join(" · ")}</p>
            <p className={`mt-0.5 text-[13.2px] leading-snug ${p.estado === "fallo" ? "text-rose-200" : "text-zinc-200"}`}>{p.texto}</p>
            {p.cita && <q className="mt-1.5 block border-l-2 border-[rgba(233,214,182,.35)] px-2.5 text-[13px] text-zinc-300 [quotes:none]">{p.cita}</q>}
          </li>
        ))}
      </ol>
      {c.resultado.sale
        ? <><p className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">Dónde ya no aparece</p>
          <p data-donde className="mt-1.5 rounded-lg border border-white/10 px-3 py-2.5 text-[12.5px] leading-relaxed text-zinc-400">{c.d.tipo === "pregunta_al_dueno" ? <><b className="font-normal text-zinc-200">Tu oficina</b> · <b className="font-normal text-zinc-200">la oficina que preguntó</b> · <b className="font-normal text-zinc-200">la antena</b> · el contador de arriba</> : <><b className="font-normal text-zinc-200">Tu oficina</b> · el contador de arriba</>}<br />Todos leen el mismo registro: al contestar aquí, sale de todos a la vez.</p></>
        : c.resultado.motivo ? <p data-motivo-registro className="rounded-lg border border-rose-400/30 bg-rose-500/[0.06] px-3 py-2.5 text-[12.5px] leading-relaxed text-rose-100">{c.resultado.motivo}</p> : null}
    </aside>
  )
}

const BOTON = "rounded-[10px] border px-5 py-2.5 text-[14px] transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400 disabled:opacity-50"
const PRINCIPAL = `${BOTON} border-[rgba(232,115,26,.75)] bg-[rgba(232,115,26,.2)] font-medium text-white hover:bg-[rgba(232,115,26,.3)]`
const SECUNDARIO = `${BOTON} border-white/15 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]`
const DISCRETO = `${BOTON} border-transparent px-2 text-zinc-400 hover:text-zinc-200`

/** la tarjeta del frente: todo lo que hace falta para decidir, en palabras de negocio; lo que se contesta aquí, se contesta en la misma tarjeta */
export function TarjetaDelFrente({ d, alDecidir, enPausa, detiene, contestar, verCambio, previa }: {
  d: Decision; alDecidir: (d: Decision) => void; enPausa: string | null; detiene: boolean
  contestar: (d: Decision, accion: AccionDeDecision, texto: { respuesta?: string; motivo?: string; cambio?: { clave: string; firmado: number } }) => Promise<ResultadoDeContestar | null>
  verCambio: (d: Decision, clave: string, firmado: number) => ReturnType<VerCambio>
  /** lo que pasó la última vez que se contestó esta decisión (si no salió, se muestra el motivo) */
  previa: Contestada | null
}) {
  const pr = prioridadLegible(d.prioridad), donde = dondeSeDecide(d), acciones = accionesDe(d)
  const [respuesta, setRespuesta] = useState(previa?.accion === "responder" ? (previa.resultado.registro.find((p) => p.cita)?.cita ?? "") : "")
  const [descartando, setDescartando] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [enviando, setEnviando] = useState<AccionDeDecision | null>(null)
  const [cambiando, setCambiando] = useState<string | null>(null) // la cifra que Emilio está cambiando: una a la vez, porque la meta y el presupuesto están atados
  const cifraEnCambio = d.cifras?.find((c) => c.clave === cambiando && c.editable) ?? null
  const fallo = previa && !previa.resultado.sale ? previa.resultado.motivo ?? previa.resultado.texto : null
  const destraba = d.destraba ?? (d.tipo === "pregunta_al_dueno" && detiene ? `El plan de 90 días${d.cliente ? ` de ${d.cliente}` : ""} sigue en cuanto contestes sus preguntas.` : null)
  const quien = d.pregunta_de ? nombreDeOficina(d.pregunta_de.oficina) : d.tipo === "firma_de_finanzas" ? "Oficina financiera" : null
  const hacer = async (a: AccionDeDecision, t: { respuesta?: string; motivo?: string; cambio?: { clave: string; firmado: number } }) => { setEnviando(a); try { return await contestar(d, a, t) } finally { setEnviando(null) } }
  const contestable = acciones.length > 0
  const falta = faltaQueLeer(d)
  // lo que no salió se lee sin bajar: con varias cifras, el pie fijo lo tapaba (CC6 · #283)
  const porQue = useRef<HTMLParagraphElement>(null)
  const pie = useRef<HTMLElement>(null) // Firmar no va fijo: se llega a él pasando por las cifras y por lo que sigue abierto (CC6 · #283)
  useEffect(() => { if (fallo) porQue.current?.scrollIntoView({ block: "center", behavior: "smooth" }) }, [fallo, previa?.en, cifraEnCambio])
  return (
    <article data-decision={d.id} data-tipo={d.tipo} data-fallo={fallo ? "si" : undefined} className={`de-tarjeta de-frente relative flex h-full flex-col overflow-y-auto [&>*]:shrink-0 rounded-2xl border bg-[linear-gradient(160deg,#211812,#151110_55%,#110e0d)] p-5 shadow-[0_24px_60px_rgba(0,0,0,.55),0_0_40px_rgba(232,115,26,.08)] sm:p-7 ${fallo ? "border-[rgba(255,90,54,.55)]" : "border-[rgba(232,115,26,.45)]"}`}>
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(232,115,26,.4)]" style={{ color: AMBAR }}><MarcaDelTipo tipo={d.tipo} className="h-6 w-6" /></span>
        <div className="min-w-0">
          <p className="truncate text-[11px] uppercase tracking-[0.1em] text-zinc-400 sm:tracking-[0.22em]">{NOMBRE_DEL_TIPO[d.tipo].nombre}</p>
          <p data-cliente className="truncate text-[14px] text-zinc-200">{d.cliente ?? "Sin cliente asignado"}</p>
        </div>
        {falta ? <span data-chip="falta" className="ml-auto shrink-0 rounded-full border border-white/15 px-2.5 py-0.5 text-[11.5px] text-zinc-300">Falta información</span>
          : fallo ? <span data-chip="volvio" className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-full border border-[rgba(255,90,54,.55)] px-2.5 py-0.5 text-[11.5px] text-rose-200"><span className="h-[7px] w-[7px] rounded-full bg-[#ff5a36]" />No salió</span>
          : detiene ? <span data-chip="detiene" className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-full border border-[rgba(232,115,26,.55)] px-2.5 py-0.5 text-[11.5px] text-orange-200"><span className="de-punto" />Detiene el plan</span>
            : <span data-prioridad={pr.nivel} className={`ml-auto shrink-0 rounded-full border px-2.5 py-0.5 text-[11.5px] ${pr.nivel === 3 ? "de-urge border-orange-400/60 text-orange-200" : pr.nivel === 2 ? "border-amber-300/40 text-amber-200" : "border-white/15 text-zinc-400"}`}>{contestable && pr.nivel === 0 ? (d.tipo === "firma_de_finanzas" ? "Espera tu firma" : "Espera tu respuesta") : pr.texto}</span>}
      </header>
      {quien && <p data-quien className="mt-4 flex items-center gap-2.5 text-[13px] text-zinc-400"><span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#2a2622] font-display text-[11px] text-[#e9d6b6]">{iniciales(quien)}</span><span>{d.tipo === "firma_de_finanzas" ? "Propone la" : "Pregunta la"} <b className="font-medium text-zinc-200">{quien}</b></span></p>}
      <h3 data-titulo title={tituloDeDecision(d)} className={`${quien ? "mt-2" : "mt-5"} line-clamp-3 text-[19px] font-light leading-snug text-white sm:text-[21px]`}>{tituloDeDecision(d)}</h3>
      {enPausa && <p data-en-pausa className="mt-2 text-[12.5px] text-zinc-400">{enPausa} está en pausa por tu decisión: esto no cuenta en «esperan por ti».</p>}
      {fallo && !cifraEnCambio && <p ref={porQue} data-por-que-volvio role="status" className="mt-4 rounded-[10px] border border-[rgba(255,90,54,.35)] bg-[rgba(255,90,54,.06)] px-3.5 py-2.5 text-[13.5px] leading-snug text-rose-100"><span className="mb-0.5 block text-[11px] uppercase tracking-[0.1em] text-rose-300">Por qué sigue aquí</span>{fallo}</p>}
      {cifraEnCambio ? <EditorDeCifra cifra={cifraEnCambio} todas={d.cifras ?? []} alEditar={d.al_editar ?? null} criticos={d.criticos ?? []} ver={(firmado) => verCambio(d, cifraEnCambio.clave, firmado)} firmar={(firmado) => hacer("editar", { cambio: { clave: cifraEnCambio.clave, firmado } })} volver={() => setCambiando(null)} /> : d.cifras?.length ? (
        <div data-cifras className="mt-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.1em] text-zinc-500">Lo que propuso la oficina</p>
          <dl className="grid gap-2.5 sm:grid-cols-2">
            {d.cifras.map((c) => <div key={c.clave} data-cifra={c.clave} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"><dt className="text-[12.5px] text-zinc-400">{c.nombre}</dt><dd className="mt-1 text-[22px] font-light leading-tight text-white">{textoDeCifra(c)}</dd>{c.nota && <dd className="mt-1 text-[12.5px] leading-snug text-zinc-400">{c.nota}</dd>}{c.editable && acciones.includes("editar") && <dd className="mt-1.5"><button type="button" data-cambiar={c.clave} disabled={!!enviando} onClick={() => setCambiando(c.clave)} className="text-[13px] text-[#e9d6b6] underline underline-offset-2 hover:text-white">Cambiar esta cifra</button></dd>}</div>)}
          </dl>
        </div>
      ) : null}
      {!cifraEnCambio && (d.para_que || destraba) && (
        <dl data-contexto className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {d.para_que && <div className="rounded-[10px] border border-white/10 bg-white/[0.02] px-3 py-2.5"><dt className="mb-1 text-[11px] uppercase tracking-[0.1em] text-zinc-500">Para qué lo necesita</dt><dd className="text-[13.5px] leading-snug text-zinc-200">{d.para_que}</dd></div>}
          {destraba && <div className="rounded-[10px] border border-white/10 bg-white/[0.02] px-3 py-2.5"><dt className="mb-1 text-[11px] uppercase tracking-[0.1em] text-zinc-500">Qué se destraba</dt><dd data-destraba className="text-[13.5px] leading-snug text-[#e9d6b6]">{destraba}</dd></div>}
        </dl>
      )}
      {!cifraEnCambio && d.criticos?.length ? (
        <div data-criticos className="mt-3 rounded-[10px] border border-[rgba(232,115,26,.3)] bg-[rgba(232,115,26,.05)] px-3.5 py-2.5"><p className="mb-1 text-[11px] uppercase tracking-[0.1em] text-orange-200/80">Sigue abierto</p><ul className="space-y-1 text-[13.5px] leading-snug text-zinc-200">{d.criticos.map((c) => <li key={c}>{c}</li>)}</ul></div>
      ) : null}
      {falta && <p data-falta-informacion role="status" className="mt-4 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3.5 text-[14.5px] leading-snug text-zinc-200"><span className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-zinc-400">Todavía no hay nada que firmar</span>Falta información: la <b className="font-medium text-white">Oficina financiera</b> debe mandar las cifras que propone.</p>}
      {!contestable && !falta && (
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-4">
          <div><dt className="text-zinc-500">Espera</dt><dd data-espera className="text-zinc-200">{haceCuanto(d.desde)}{fecha(d.desde) ? <span className="text-zinc-500"> · {fecha(d.desde)}</span> : null}</dd></div>
          <div><dt className="text-zinc-500">Vence</dt><dd data-vence className={d.vencida ? "text-orange-300" : "text-zinc-200"}>{d.vence ? `${fecha(d.vence)}${d.vencida ? " · vencida" : ""}` : "Sin fecha límite"}</dd></div>
          <div><dt className="text-zinc-500">Viene de</dt><dd data-origen className="text-zinc-200">{ORIGEN[d.fuente ?? ""] ?? "Sin dato"}</dd></div>
          <div><dt className="text-zinc-500">Costó producirlo</dt><dd data-costo className={d.costo_usd == null ? "text-zinc-500" : "text-zinc-200"} title={d.costo_nota ?? undefined}>{costoDeLaDecision(d)}</dd></div>
        </dl>
      )}
      {acciones.includes("responder") && (
        <label className="mt-4 block">
          <span className="sr-only">Tu respuesta</span>
          <textarea data-respuesta value={respuesta} onChange={(e) => setRespuesta(e.target.value)} maxLength={TOPE_RESPUESTA} rows={3} placeholder="Escribe tu respuesta…" disabled={!!enviando}
            className="block w-full resize-y rounded-xl border border-white/15 bg-[#121010] px-4 py-3 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:border-[rgba(232,115,26,.6)] focus:outline-none" />
        </label>
      )}
      {descartando && (
        <div data-descartar className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input data-motivo value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={TOPE_MOTIVO} placeholder="Por qué (opcional)" className="min-w-0 flex-1 rounded-[10px] border border-white/15 bg-[#121010] px-3 py-2 text-[14px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none" />
          <div className="flex gap-2"><button type="button" data-confirmar-descartar disabled={!!enviando} onClick={() => void hacer("descartar", { motivo })} className={SECUNDARIO}>{enviando === "descartar" ? "Descartando…" : "Descartar"}</button><button type="button" onClick={() => setDescartando(false)} className={DISCRETO}>Volver</button></div>
        </div>
      )}
      {!cifraEnCambio && acciones.includes("aceptar") && <BajaParaFirmar hasta={pie} />}
      {!cifraEnCambio && <footer ref={pie} data-pie className="mt-auto flex flex-wrap items-center gap-2.5 pt-5">
        {acciones.includes("responder") && <button type="button" data-enviar disabled={!!enviando || !respuesta.trim()} onClick={() => void hacer("responder", { respuesta })} className={`${PRINCIPAL} w-full sm:w-auto`}>{enviando === "responder" ? "Enviando…" : fallo ? "Enviar de nuevo" : "Enviar respuesta"}</button>}
        {acciones.includes("aceptar") && <button type="button" data-firmar disabled={!!enviando} onClick={() => void hacer("aceptar", {})} className={`${PRINCIPAL} w-full sm:w-auto`}>{enviando === "aceptar" ? "Firmando…" : fallo ? "Firmar de nuevo" : "Firmar"}</button>}
        {acciones.includes("descartar") && !descartando && <button type="button" data-descartar-abrir disabled={!!enviando} onClick={() => setDescartando(true)} className={DISCRETO}>Descartar</button>}
        {falta && <span data-espera className="ml-auto text-[12px] text-zinc-500">Espera {haceCuanto(d.desde)}</span>}
        {!contestable && !falta && (donde.panel
          ? <button type="button" data-decidir={donde.panel} onClick={() => alDecidir(d)} className="rounded-lg border border-[rgba(232,115,26,.7)] bg-[rgba(232,115,26,.14)] px-4 py-2 text-[13.5px] text-white transition hover:bg-[rgba(232,115,26,.24)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">{donde.boton}</button>
          : <p data-sin-panel className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px] text-zinc-400">{donde.nota}</p>)}
        {contestable && <span data-espera className="ml-auto hidden text-[12px] text-zinc-500 sm:inline">Espera {haceCuanto(d.desde)}</span>}
      </footer>}
    </article>
  )
}

export function PanelDecisiones({ onCerrar, datosIniciales = null, fetchImpl = fetch }: { onCerrar: () => void; datosIniciales?: Decisiones | null; fetchImpl?: typeof fetch }) {
  const [datos, setDatos] = useState<Decisiones | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [filtro, setFiltro] = useState<TipoDeDecision | null>(null)
  const [grupo, setGrupo] = useState<Grupo>("firma")
  const [i, setI] = useState(0)
  const [abierta, setAbierta] = useState<Decision | null>(null) // la decisión abierta en su panel
  const [contestadas, setContestadas] = useState<Contestada[]>([]) // lo que contestaste en esta visita (con su registro)
  const [registro, setRegistro] = useState<Contestada | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
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

  // 6.52 · UN SOLO NÚMERO: «esperan tu firma» (lo mismo en la oficina, la cabecera, «Todas» y el carrusel); lo de fuera y lo de clientes en pausa, aparte
  const g = useMemo(() => gruposDeDecisiones(datos ?? { decisiones: [] }), [datos])
  const delGrupo = useMemo(() => (grupo === "firma" ? g.firma : grupo === "detienen" ? g.detienen : grupo === "fuera" ? g.fuera : g.pausa.find((p) => `pausa:${p.cliente}` === grupo)?.decisiones ?? []), [g, grupo])
  const lista = useMemo(() => delGrupo.filter((d) => !filtro || d.tipo === filtro), [delGrupo, filtro])
  const enPausa = grupo.startsWith("pausa:") ? clienteCorto(grupo.slice(6)) : null
  const n = lista.length, actual = n ? lista[Math.min(i, n - 1)] : null
  const mover = useCallback((paso: number) => setI((k) => (n ? (Math.min(k, n - 1) + paso + n) % n : 0)), [n])

  useEffect(() => {
    if (abierta) return // el panel abierto maneja sus propias teclas
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() }
      else if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return // en una caja de texto, las flechas mueven el cursor: no cambian de tarjeta
      else if (e.key === "ArrowRight") { e.preventDefault(); mover(1) }
      else if (e.key === "ArrowLeft") { e.preventDefault(); mover(-1) }
    }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, mover, abierta])

  // 04-nov · contestar en el lugar: el servidor del tablero lo manda a la puerta de la plataforma de esa fuente y confirma que salió
  const contestar = useCallback(async (d: Decision, accion: AccionDeDecision, t: { respuesta?: string; motivo?: string; cambio?: { clave: string; firmado: number } }): Promise<ResultadoDeContestar | null> => {
    let resultado: ResultadoDeContestar
    try {
      const r = await fetchImpl("/api/direccion/decisiones/contestar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: d.id, accion, ...t }) })
      const j = (await r.json().catch(() => ({}))) as Partial<ResultadoDeContestar> & { error?: string; detalle?: string }
      if (r.status === 409 && j.error === "ya_no_esta") resultado = { ok: true, sale: true, texto: "Ya estaba resuelta en otro lugar.", registro: [{ cuando: new Date().toISOString(), quien: "sistema", estado: "guardado", texto: String(j.detalle ?? "Ya no estaba pendiente") }] }
      else if (Array.isArray(j.registro)) resultado = j as ResultadoDeContestar
      else resultado = { ok: false, sale: false, texto: "No salió.", motivo: r.status === 401 ? "Tu sesión venció: entra de nuevo." : String(j.detalle ?? j.error ?? `No se pudo (${r.status}).`), registro: [] }
    } catch (e) { resultado = { ok: false, sale: false, texto: "No salió.", motivo: `No se pudo contactar al tablero: ${e instanceof Error ? e.message : String(e)}`, registro: [] } }
    const c: Contestada = { d, resultado, accion, en: new Date().toISOString() }
    setContestadas((xs) => [c, ...xs.filter((x) => x.d.id !== d.id)])
    if (resultado.sale) {
      setAviso(accion === "editar" ? "Firmado con tu cambio. Salió de Tu oficina." : accion === "aceptar" ? "Firmado. Salió de Tu oficina." : accion === "descartar" ? "Descartada. Salió de Tu oficina, de la oficina que preguntó y de la antena." : "Contestada. Salió de Tu oficina, de la oficina que preguntó y de la antena.")
      setDatos((x) => (x ? { ...x, decisiones: x.decisiones.filter((y) => y.id !== d.id) } : x)) // ya salió de su fuente: se quita sin esperar la lectura
      setRegistro(c)
      void leer()
    } else setAviso(null)
    return resultado
  }, [fetchImpl, leer])
  // 05-nov · ver cómo quedaría una cifra cambiada: no firma, no mueve la lista y no queda como «contestada»
  const verCambio = useCallback(async (d: Decision, clave: string, firmado: number): Promise<ResultadoDeContestar> => {
    try {
      const r = await fetchImpl("/api/direccion/decisiones/contestar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: d.id, accion: "recalcular", cambio: { clave, firmado } }) })
      const j = (await r.json().catch(() => ({}))) as Partial<ResultadoDeContestar> & { detalle?: string }
      return Array.isArray(j.registro) ? (j as ResultadoDeContestar) : { ok: false, sale: false, texto: "No salió.", motivo: r.status === 401 ? "Tu sesión venció: entra de nuevo." : String(j.detalle ?? `No se pudo calcular (${r.status}).`), registro: [] }
    } catch (e) { return { ok: false, sale: false, texto: "No salió.", motivo: `No se pudo contactar al tablero: ${e instanceof Error ? e.message : String(e)}`, registro: [] } }
  }, [fetchImpl])
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 6000); return () => clearTimeout(t) }, [aviso])

  // decidir: el panel donde esa decisión ya se toma, en el mismo lugar; al volver, la mesa se lee de nuevo
  const volver = useCallback(() => { setAbierta(null); void leer() }, [leer])
  if (abierta) {
    const donde = dondeSeDecide(abierta)
    if (donde.panel === "plan") return <PanelPlan onCerrar={volver} clienteInicial={abierta.client_id} />
    if (donde.panel === "gran_idea") return <PanelGranIdea onCerrar={volver} clienteInicial={abierta.client_id} />
    if (donde.panel === "piezas") return <PanelPiezas onCerrar={volver} clienteInicial={abierta.client_id} piezaInicial={abierta.id} />
  }

  const total = g.firma.length, fuera = g.fuera.length, detienen = g.detienen.length
  const porTipo = TIPOS_DE_DECISION.map((t) => ({ t, n: g.firma.filter((d) => d.tipo === t).length })).filter((x) => x.n > 0) // suman lo mismo que «Todas»
  const aparte = [fuera ? `${plural(fuera, "se atiende", "se atienden")} fuera de este tablero` : null, ...g.pausa.map((p) => `${p.decisiones.length} en pausa (${clienteCorto(p.cliente)})`)].filter(Boolean).map((x) => ` · ${x}`).join("")
  const resumen = !datos ? "" : `${total ? `${plural(total, "espera", "esperan")} por ti` : "Nada espera por ti ahora"}${detienen ? ` · ${plural(detienen, "tiene un trabajo detenido", "tienen un trabajo detenido")}` : ""}${aparte}${datos.completo ? "" : " · la lista puede estar incompleta"}`
  const elegir = (x: Grupo) => { setGrupo(x); setFiltro(null); setI(0) }
  const grupos: Array<{ k: Grupo; nombre: string; n: number; nota?: string | null }> = [
    { k: "firma", nombre: "Esperan por ti", n: total },
    ...(fuera ? [{ k: "fuera" as Grupo, nombre: "Se atienden fuera", n: fuera, nota: "todavía no se firman desde este tablero" }] : []),
    ...g.pausa.map((p) => ({ k: `pausa:${p.cliente}` as Grupo, nombre: `En pausa · ${clienteCorto(p.cliente)}`, n: p.decisiones.length, nota: p.motivo })),
  ]
  const detras = n > 1 ? [1, 2, 3].filter((k) => k < n).map((k) => lista[(Math.min(i, n - 1) + k) % n]) : []
  const faltan = (datos?.fuentes ?? []).filter((f) => f.estado === "error" || f.estado === "sin_credencial")

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="decisiones-titulo" data-seccion="decisiones" className="relative flex h-full max-h-full w-full max-w-[1300px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="decisiones-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Decisiones</h2>
          <p data-resumen className="order-last w-full text-[12px] text-zinc-400 sm:order-none sm:w-auto">{cargando && !datos ? "Leyendo…" : resumen}</p>
          <button type="button" onClick={() => void leer()} disabled={cargando} className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">{cargando ? "Leyendo…" : "Actualizar"}</button>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar las decisiones" className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[250px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/10 p-3 md:flex" aria-label="Decisiones por tipo">
            <p className="px-2 py-1.5 text-[13px] font-medium text-zinc-100">Esperan por ti</p>
            {detienen > 0 && <button type="button" data-detienen aria-pressed={grupo === "detienen"} onClick={() => elegir("detienen")} className="de-tipo flex items-center gap-2 rounded-md border border-[rgba(232,115,26,.28)] bg-[rgba(232,115,26,.06)] px-2 py-1.5 text-left text-[12.5px] text-zinc-200 hover:bg-white/[0.05]"><span className="de-punto mx-1" aria-hidden /><span className="flex-1">Detienen un trabajo</span><span className="tabular-nums text-zinc-500">{detienen}</span></button>}
            <button type="button" data-todas aria-pressed={grupo === "firma" && filtro === null} onClick={() => elegir("firma")} className="de-tipo flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-[12.5px] text-zinc-300 hover:bg-white/[0.05]"><span className="flex-1">Todas</span><span className="tabular-nums text-zinc-500">{total}</span></button>
            {porTipo.map(({ t, n: k }) => (
              <button key={t} type="button" data-filtro={t} aria-pressed={grupo === "firma" && filtro === t} onClick={() => { setGrupo("firma"); setFiltro(t); setI(0) }} className="de-tipo flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 pl-4 text-left text-[12.5px] text-zinc-300 hover:bg-white/[0.05]">
                <span style={{ color: AMBAR }}><MarcaDelTipo tipo={t} className="h-4 w-4" /></span><span className="flex-1">{NOMBRE_DEL_TIPO[t].plural}</span><span className="tabular-nums text-zinc-500">{k}</span>
              </button>
            ))}
            {grupos.slice(1).map((x) => (
              <button key={x.k} type="button" data-grupo-aparte={x.k} aria-pressed={grupo === x.k} aria-expanded={grupo === x.k} onClick={() => elegir(grupo === x.k ? "firma" : x.k)}
                className="de-tipo mt-2 flex flex-col gap-0.5 rounded-md border border-white/10 px-2 py-1.5 text-left text-[12.5px] text-zinc-300 hover:bg-white/[0.05]">
                <span className="flex w-full items-center gap-2"><span aria-hidden className="text-zinc-500">{grupo === x.k ? "▾" : "▸"}</span><span className="flex-1">{x.nombre}</span><span className="tabular-nums text-zinc-500">{x.n}</span></span>
                {x.nota && <span className="pl-5 text-[11px] leading-snug text-zinc-500">{x.nota}</span>}
              </button>
            ))}
            {contestadas.length > 0 && (
              <div data-lo-que-contestaste className="mt-auto border-t border-white/10 px-2 pt-3 text-[12px] leading-relaxed text-zinc-400">
                <p className="font-medium text-zinc-200">Lo que contestaste ahora</p>
                <p>{plural(contestadas.filter((c) => c.resultado.sale).length, "salió", "salieron")} · {plural(contestadas.filter((c) => !c.resultado.sale).length, "sigue aquí", "siguen aquí")}</p>
                {contestadas.slice(0, 5).map((c) => <button key={c.d.id} type="button" onClick={() => setRegistro(c)} className="mt-1 block w-full truncate text-left text-[#e9d6b6] hover:underline">{c.resultado.sale ? "✓" : "!"} {tituloDeDecision(c.d)}</button>)}
              </div>
            )}
            {(datos?.sin_fuente.length || faltan.length) ? (
              <div data-sin-dato className={`${contestadas.length ? "mt-3" : "mt-auto"} border-t border-white/10 pt-3 text-[11.5px] leading-relaxed text-zinc-500`}>
                <p className="mb-1 text-zinc-400">Sin dato todavía</p>
                {faltan.map((f) => <p key={f.fuente}>· {f.fuente}: no se pudo leer</p>)}
                {datos?.sin_fuente.map((s) => <p key={s.que} title={s.motivo}>· {s.que}</p>)}
              </div>
            ) : null}
          </aside>

          <div className={`relative flex min-w-0 flex-1 flex-col overflow-y-auto p-4 sm:p-8 ${registro ? "lg:pr-[460px]" : ""}`}>
            {aviso && <p data-aviso role="status" className="de-aviso mx-auto mb-3 flex max-w-full items-center gap-2.5 rounded-full border border-[rgba(143,191,154,.4)] bg-[#141a15] px-4 py-2 text-[13px] text-zinc-200"><span aria-hidden className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[rgba(143,191,154,.2)] text-[11px] text-[#8fbf9a]">✓</span>{aviso}</p>}
            {registro && <Registro c={registro} onCerrar={() => setRegistro(null)} />}
            {grupos.length > 1 && (
              <div data-grupos-celular className="-mt-1 mb-3 flex flex-wrap gap-1.5 md:hidden">
                {grupos.map((x) => <button key={x.k} type="button" aria-pressed={grupo === x.k} onClick={() => elegir(x.k)} className="de-tipo rounded-full border border-white/15 px-3 py-1.5 text-[12.5px] text-zinc-300">{x.nombre} <span className="tabular-nums text-zinc-500">{x.n}</span></button>)}
              </div>
            )}
            {actual ? (
              <>
                <div className="de-pila relative mx-auto w-full max-w-[720px]" style={{ height: accionesDe(actual).includes("responder") || actual.cifras?.length ? 620 : 460 }}>
                  {detras.slice().reverse().map((d, k) => {
                    const capa = detras.length - k // 3, 2, 1 desde el fondo: cada una asoma 22 px por encima de la anterior
                    return (
                      <div key={`${d.id}-${capa}`} aria-hidden data-detras={capa} className="de-tarjeta absolute inset-x-0 rounded-2xl border border-[rgba(232,115,26,.22)] bg-[#1d1612] px-6 pt-2"
                        style={{ top: 66 - capa * 22, bottom: 0, transform: `scale(${1 - capa * 0.04})`, transformOrigin: "top center", opacity: 1 - capa * 0.22 } as CSSProperties}>
                        <p className="truncate text-[11.5px] text-zinc-400"><span style={{ color: AMBAR }}>{NOMBRE_DEL_TIPO[d.tipo].nombre}</span> · {d.cliente ?? "Sin cliente"} · {tituloDeDecision(d)}</p>
                      </div>
                    )
                  })}
                  <div className="absolute inset-x-0 bottom-0" style={{ top: 66 }} key={actual.id}><TarjetaDelFrente d={actual} alDecidir={setAbierta} enPausa={enPausa} detiene={g.detienen.some((x) => x.id === actual.id)} contestar={contestar} verCambio={verCambio} previa={contestadas.find((c) => c.d.id === actual.id) ?? null} /></div>
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
                  : datos?.completo && !error ? <><p className="text-[18px] font-light text-white">Estás al día</p><p className="mt-2 text-[13px] text-zinc-500">Nada espera por ti en este momento.{grupos.length > 1 ? " Lo que se atiende fuera o está en pausa sigue en su grupo, aparte." : ""}</p></>
                    : <p className="text-[13px] text-zinc-400">No pude leer todas las fuentes: no puedo asegurarte que no haya nada pendiente.</p>}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
