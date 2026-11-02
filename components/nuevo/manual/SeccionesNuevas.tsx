"use client"

import { ORIGEN_DE_SECCION, type SeccionLeida, type ValorDeSeccion } from "@/lib/manual-secciones"

const AMBAR = "#f5a524"
const TONO = { ambar: "border-amber-400/50 text-amber-200", verde: "border-emerald-400/40 text-emerald-200", neutro: "border-white/15 text-zinc-300" } as const

function Valor({ v }: { v: ValorDeSeccion }) {
  if (v.tipo === "texto") return <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-200">{v.texto}</p>
  if (v.tipo === "lista") return <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-zinc-200">{v.items.map((x, i) => <li key={i}>{x}</li>)}</ul>
  if (v.tipo === "filas") return (
    <ul className="space-y-2">
      {v.filas.map((f, i) => (
        <li key={i} className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
          {f.titulo && <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-zinc-400">{f.titulo}</p>}
          {f.texto && <p className="text-[13px] leading-relaxed text-zinc-200">{f.texto}</p>}
          {f.extra.length > 0 && <ul className="mt-1 space-y-0.5">{f.extra.map((x, j) => <li key={j} className="text-[12.5px] italic text-zinc-300">«{x}»</li>)}</ul>}
        </li>
      ))}
    </ul>
  )
  return <div className="space-y-2">{v.apartados.map((a, i) => <div key={i}><p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">{a.etiqueta}</p><Valor v={a.valor} /></div>)}</div>
}

/**
 * LAS SECCIONES NUEVAS DEL MANUAL (CC6 · 02-nov · ADENDA 1 firmada por Emilio): mismo patrón que las demás (tarjeta por parte, su origen, «Pedir cambios en esta
 * sección»). Lo que propuso el sistema se rotula «propuesta del sistema · por validar» (distinto de «falta»). Solo se pintan las que tienen dato.
 * Validar y Editar aparecen cuando la plataforma acepte estas claves en sus puertas (contrato con CC1); hasta entonces, se piden cambios por la sección.
 */
export function SeccionesNuevas({ secciones, pedirCambios }: { secciones: SeccionLeida[]; pedirCambios?: ((titulo: string, claves: string[]) => void) | null }) {
  if (!secciones.length) return null
  return (
    <>
      {secciones.map((s, i) => (
        <section key={s.id} id={`apartado-${s.titulo}`} data-seccion-nueva={s.id} aria-label={s.titulo} className="mn-seccion scroll-mt-2 rounded-lg border border-white/10 bg-white/[0.02] p-4" style={{ animationDelay: `${240 + i * 60}ms` }}>
          <h3 className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>{s.titulo}</h3>
          <div className="space-y-2">
            {s.partes.map((p) => {
              const o = ORIGEN_DE_SECCION[p.origen]
              return (
                <div key={p.clave} data-campo={p.clave} data-origen={p.origen} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <h4 className="mr-1 text-[12px] font-medium uppercase tracking-[0.08em] text-zinc-300">{p.etiqueta}</h4>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${TONO[o.tono]}`}>{o.texto}</span>
                  </div>
                  <Valor v={p.valor} />
                </div>
              )
            })}
          </div>
          {pedirCambios && <button type="button" data-accion="manual-pedir-cambios-seccion" data-seccion-pedir={s.titulo} onClick={() => pedirCambios(s.titulo, s.partes.map((p) => p.clave))} className="mt-3 text-[12px] text-violet-200 underline decoration-dotted underline-offset-4 hover:text-violet-100">Pedir cambios en esta sección</button>}
        </section>
      ))}
    </>
  )
}
