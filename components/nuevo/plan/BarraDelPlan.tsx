"use client"

import { useState } from "react"
import type { BarraDelPlan as Barra } from "@/lib/plan-barra"

const AMBAR = "#f5a524"
const COLOR_DECISION: Record<string, string> = {
  en_revision: "border-sky-400/50 text-sky-100", reescribiendo: "border-violet-400/50 text-violet-100", esperando_decision: "border-amber-400/70 text-amber-100", aprobado: "border-emerald-400/60 text-emerald-100",
  en_preparacion: "border-violet-400/50 text-violet-100", sin_plan_vigente: "border-zinc-400/50 text-zinc-100",
}
function Bloque({ id, titulo, children, nota, realce = false }: { id: string; titulo: string; children: React.ReactNode; nota?: string | null; realce?: boolean }) {
  return (
    <section data-barra={id} className={`rounded-lg border bg-white/[0.02] p-3.5 ${realce ? "border-amber-400/45" : "border-white/10"}`}>
      <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: AMBAR }}>{titulo}</h3>
      {children}
      {nota && <p className="mt-1 text-[10.5px] text-zinc-500">{nota}</p>}
    </section>
  )
}
/** la meta entera; si es larga, las primeras líneas y «Ver más» (Lenovo 02-nov: no cortar la parte importante) */
const LARGO_DE_LA_META = 220
function Meta({ texto }: { texto: string }) {
  const [abierta, setAbierta] = useState(false)
  const larga = texto.length > LARGO_DE_LA_META
  return (
    <div data-meta data-abierta={abierta}>
      <p className={`text-[13.5px] leading-snug text-zinc-100 ${larga && !abierta ? "line-clamp-4" : ""}`}>{texto}</p>
      {larga && <button type="button" data-accion="ver-meta" onClick={() => setAbierta((v) => !v)} className="mt-1 text-[11.5px] text-amber-300 underline decoration-dotted underline-offset-4 hover:text-amber-200">{abierta ? "Ver menos" : "Ver más"}</button>}
    </div>
  )
}
const Falta = ({ children }: { children: React.ReactNode }) => <p className="text-[12px] italic text-zinc-500">{children}</p>
const Chip = ({ children }: { children: React.ReactNode }) => <span className="inline-flex rounded-full border border-white/15 px-2 py-0.5 text-[11.5px] text-zinc-300">{children}</span>

/**
 * LA BARRA DEL PLAN (CC6 · 02-nov · boceto aprobado por Emilio): los primeros bloques de la barra derecha del plan, con datos reales.
 * Va arriba de lo que ya estaba (lo que espera la campaña, lo que no se buscó, la ficha); la barra entera queda fija al bajar.
 */
export function BarraDelPlan({ b }: { b: Barra }) {
  const ancho = (n: number) => (b.total_dias ? Math.max(0, Math.min(100, ((n - 1) / Math.max(1, b.total_dias - 1)) * 100)) : 0)
  return (
    <div data-barra-del-plan className="space-y-3">
      <Bloque id="decision" titulo="Estado de la decisión">
        {b.decision ? <span data-decision={b.decision.estado} className={`inline-flex rounded-full border px-2.5 py-0.5 text-[12px] ${COLOR_DECISION[b.decision.estado] ?? "border-white/15 text-zinc-200"}`}>{b.decision.titulo}</span> : <Falta>Todavía no hay plan escrito.</Falta>}
      </Bloque>
      {/* plan cerrado: sin meta, fechas ni presupuesto, para que nada se tome por cifra vigente (Lenovo 06-nov) */}
      {!b.plan_cerrado && <>
      <Bloque id="meta" titulo="Meta">{b.meta ? <Meta texto={b.meta} /> : <Falta>El plan todavía no dice su meta.</Falta>}</Bloque>
      <Bloque id="fechas" titulo="Fechas" nota={b.fechas?.detalle}>{b.fechas ? <p className="text-[13px] text-zinc-100">{b.fechas.texto}</p> : <Falta>Sin fechas todavía.</Falta>}</Bloque>
      <Bloque id="presupuesto" titulo="Presupuesto" nota={b.presupuesto ? "Tomado de la sección «Presupuesto» del plan. Lo gastado está en Dinero." : null}>{b.presupuesto ? <p className="text-[13px] leading-snug text-zinc-100">{b.presupuesto}</p> : <Falta>El plan todavía no trae la cifra.</Falta>}</Bloque>
      </>}
      <Bloque id="sedes-y-canales" titulo="Sedes y canales">
        {b.sedes.length + b.canales.length === 0 ? <Falta>{b.sin_estrategia ? "Se definen con la estrategia, después de aprobar el plan." : "Sin sedes ni canales todavía."}</Falta> : <div className="flex flex-wrap gap-1.5">{b.sedes.map((s) => <Chip key={`s-${s}`}>{s}</Chip>)}{b.canales.map((c) => <Chip key={`c-${c}`}>{c}</Chip>)}</div>}
      </Bloque>
      <Bloque id="fases" titulo="Fases" nota={b.dia ? `Hoy es el día ${b.dia}${b.total_dias ? ` de ${b.total_dias}` : ""}.` : null}>
        {b.fases.length === 0 ? <Falta>{b.sin_estrategia ?? "La estrategia todavía no tiene fases."}</Falta> : (
          <>
            <div className="relative mt-1 h-6" aria-hidden>
              <div className="absolute left-0 right-0 top-2.5 h-1 rounded-full bg-white/10" />
              {b.dia && <div className="absolute left-0 top-2.5 h-1 rounded-full" style={{ width: `${ancho(b.dia)}%`, background: AMBAR }} />}
              {b.fases.map((f) => <span key={f.clave} className={`absolute top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 ${f.estado === "por_venir" ? "border-white/30 bg-[#171717]" : "border-amber-300 bg-amber-400"} ${f.estado === "en_curso" ? "nv-pl-paso-vivo" : ""}`} style={{ left: `${ancho(f.desde)}%` }} />)}
            </div>
            <ol className="mt-1.5 space-y-1">
              {b.fases.map((f) => <li key={f.clave} data-fase={f.clave} data-estado={f.estado} className={`text-[12px] leading-snug ${f.estado === "en_curso" ? "text-amber-100" : f.estado === "hecha" ? "text-zinc-500" : "text-zinc-300"}`}><span className="tabular-nums text-zinc-500">días {f.desde}–{f.hasta} · </span>{f.objetivo}</li>)}
            </ol>
          </>
        )}
      </Bloque>
      <Bloque id="te-toca" titulo="Lo que te toca" realce={b.te_toca.length > 0}>
        {b.te_toca.length ? <ul className="space-y-1">{b.te_toca.map((t) => <li key={t} className="text-[12.5px] leading-snug text-zinc-100">· {t}</li>)}</ul> : <Falta>Nada pendiente de tu lado.</Falta>}
      </Bloque>
    </div>
  )
}
