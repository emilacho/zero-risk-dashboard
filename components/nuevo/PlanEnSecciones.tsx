"use client"

import { useMemo, useState } from "react"
import { bloquesDelMarkdown, datosClave, seccionesDelPlan, trozosDelTexto, type Bloque } from "@/lib/plan-documento"

/**
 * EL PLAN EN SECCIONES (CC6 · 02-nov · Emilio: «que esté bien segmentado para que el lector no se pierda entre párrafos gigantes»).
 * Lectura al estilo GitBook: arriba los datos clave en tarjetas; a la izquierda el índice; cada sección plegable con su resumen corto y, al abrirla,
 * el texto completo con las tablas como tablas y las cifras y fechas destacadas. Desde cada sección se puede pedir cambios sobre esa parte.
 * Solo lectura del documento: no cambia nada por sí mismo.
 */
function Texto({ texto }: { texto: string }) {
  return (
    <>
      {trozosDelTexto(texto).map((x, i) => (
        <span key={i} className={`${x.negrita ? "font-semibold text-zinc-50" : ""} ${x.cifra ? "rounded bg-amber-400/[0.12] px-0.5 text-amber-100" : ""}`}>{x.t}</span>
      ))}
    </>
  )
}
function Bloques({ bloques }: { bloques: Bloque[] }) {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-zinc-200">
      {bloques.map((b, i) => {
        if (b.tipo === "titulo") return <h5 key={i} className={`${b.nivel === 3 ? "pt-2 text-[13.5px]" : "text-[13px]"} font-semibold text-amber-100`}><Texto texto={b.texto} /></h5>
        if (b.tipo === "parrafo") return <p key={i}><Texto texto={b.texto} /></p>
        if (b.tipo === "cita") return <blockquote key={i} className="border-l-2 border-amber-400/40 pl-3 text-zinc-300"><Texto texto={b.texto} /></blockquote>
        if (b.tipo === "lista") {
          const Lista = b.ordenada ? "ol" : "ul"
          return <Lista key={i} className={`${b.ordenada ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>{b.items.map((x, k) => <li key={k}><Texto texto={x} /></li>)}</Lista>
        }
        return (
          <div key={i} className="overflow-x-auto rounded-md border border-white/10" data-tabla>
            <table className="w-full min-w-[28rem] border-collapse text-left text-[12.5px]">
              {b.cabecera.some((c) => c.trim()) && <thead className="bg-white/[0.04] text-zinc-300"><tr>{b.cabecera.map((c, k) => <th key={k} className="border-b border-white/10 px-2.5 py-1.5 font-medium"><Texto texto={c} /></th>)}</tr></thead>}
              <tbody>{b.filas.map((f, k) => <tr key={k} className="border-b border-white/[0.05] last:border-0">{f.map((c, j) => <td key={j} className="px-2.5 py-1.5 align-top"><Texto texto={c} /></td>)}</tr>)}</tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

export function PlanEnSecciones({ prosa, onPedirCambios, abiertasIniciales = [] }: {
  prosa: string
  /** pedir cambios sobre una sección (solo si el plan admite pedir cambios ahora) */
  onPedirCambios?: (seccion: string) => void
  /** solo pruebas y el arnés: abrir estas secciones de entrada */
  abiertasIniciales?: string[]
}) {
  const doc = useMemo(() => seccionesDelPlan(prosa), [prosa])
  const datos = useMemo(() => datosClave(doc), [doc])
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set(abiertasIniciales))
  const alternar = (id: string) => setAbiertas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const ir = (id: string) => {
    setAbiertas((s) => new Set(s).add(id))
    if (typeof document !== "undefined") requestAnimationFrame(() => document.getElementById(`plan-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }
  if (!doc.secciones.length) return <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-200">{prosa}</p>

  return (
    <div data-plan-en-secciones className="space-y-4">
      {/* los datos clave: copiados del documento; lo que no está, se dice */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Los datos clave del plan">
        {datos.map((x) => (
          <div key={x.clave} data-dato={x.clave} className={`rounded-lg border border-white/10 bg-white/[0.03] p-3 ${x.clave === "meta" ? "sm:col-span-2 xl:col-span-2" : ""}`}>
            <p className="text-[10.5px] uppercase tracking-[0.12em] text-zinc-500">{x.etiqueta}</p>
            {x.valor ? <p className="mt-1 text-[13px] leading-snug text-zinc-100"><Texto texto={x.valor} /></p> : <p className="mt-1 text-[12.5px] italic text-zinc-500">No está dicho en el plan</p>}
            {x.seccion && <button type="button" onClick={() => ir(x.seccion!)} className="mt-1 text-[11px] text-amber-300/80 underline decoration-dotted underline-offset-4 hover:text-amber-200">ver la sección</button>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[13rem_1fr]">
        {/* el índice: en pantalla ancha, fijo a la izquierda; en angosta, una fila que se desliza */}
        <nav aria-label="Índice del plan" className="md:sticky md:top-0 md:self-start">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10.5px] uppercase tracking-[0.12em] text-zinc-500">Índice · {doc.secciones.length} secciones</p>
          </div>
          <ol className="flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible">
            {doc.secciones.map((s, i) => (
              <li key={s.id} className="shrink-0 md:shrink">
                <button type="button" data-ir={s.id} onClick={() => ir(s.id)} className={`w-full whitespace-nowrap rounded-md px-2 py-1 text-left text-[12px] transition md:whitespace-normal ${abiertas.has(s.id) ? "bg-amber-400/10 text-amber-100" : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"}`}>
                  <span className="mr-1.5 text-zinc-600">{i + 1}.</span>{s.titulo}
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 hidden gap-2 md:flex">
            <button type="button" data-accion="abrir-todo" onClick={() => setAbiertas(new Set(doc.secciones.map((s) => s.id)))} className="text-[11px] text-zinc-500 underline decoration-dotted underline-offset-4 hover:text-zinc-200">abrir todo</button>
            <button type="button" data-accion="cerrar-todo" onClick={() => setAbiertas(new Set())} className="text-[11px] text-zinc-500 underline decoration-dotted underline-offset-4 hover:text-zinc-200">cerrar todo</button>
          </div>
        </nav>

        {/* las secciones: cerradas muestran su resumen; abiertas, el texto completo */}
        <div className="min-w-0 space-y-2">
          {doc.secciones.map((s, i) => {
            const abierta = abiertas.has(s.id)
            return (
              <section key={s.id} id={`plan-${s.id}`} data-seccion={s.id} data-abierta={abierta} className={`scroll-mt-2 rounded-lg border ${abierta ? "border-amber-400/30 bg-white/[0.03]" : "border-white/10 bg-white/[0.015]"}`}>
                <button type="button" aria-expanded={abierta} onClick={() => alternar(s.id)} className="flex w-full items-start gap-3 px-3.5 py-3 text-left">
                  <span className="mt-0.5 text-[11px] text-zinc-600">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-zinc-100">{s.titulo}</span>
                    {!abierta && s.resumen.length > 0 && (
                      <span className="mt-1 block space-y-0.5 text-[12.5px] leading-snug text-zinc-400">{s.resumen.map((r, k) => <span key={k} className="block"><Texto texto={r} /></span>)}</span>
                    )}
                  </span>
                  <span aria-hidden className={`mt-1 text-zinc-500 transition ${abierta ? "rotate-90" : ""}`}>›</span>
                </button>
                {abierta && (
                  <div className="border-t border-white/[0.06] px-3.5 pb-3.5 pt-3">
                    <Bloques bloques={bloquesDelMarkdown(s.cuerpo)} />
                    {onPedirCambios && (
                      <button type="button" data-pedir-en={s.id} onClick={() => onPedirCambios(s.titulo)} className="mt-3 rounded-md border border-violet-300/40 px-2.5 py-1 text-[12px] text-violet-100 hover:bg-violet-500/15">Pedir cambios en esta sección</button>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
