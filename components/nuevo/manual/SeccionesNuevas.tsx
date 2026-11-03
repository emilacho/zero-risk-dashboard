"use client"

import { limpiarTexto } from "@/lib/manual-limpio"
import type { SeccionLeida, ValorDeSeccion } from "@/lib/manual-secciones"
import { CUERPO, TITULO_1, TITULO_2, TITULO_3 } from "@/components/nuevo/manual/niveles"

type Parte = SeccionLeida["partes"][number]

function Valor({ v, onRetirar }: { v: ValorDeSeccion; /** retirar el elemento i de una lista (solo listas simples) */ onRetirar?: (i: number) => void }) {
  if (v.tipo === "texto") return <p className={`whitespace-pre-line ${CUERPO}`}>{limpiarTexto(v.texto)}</p>
  if (v.tipo === "lista") return (
    <ul className="space-y-2">
      {v.items.map((x, i) => (
        <li key={i} data-elemento={i} className="flex items-start gap-3">
          <span className={`min-w-0 flex-1 ${CUERPO}`}><span aria-hidden className="mr-2 text-zinc-500">•</span>{limpiarTexto(x)}</span>
          {onRetirar && v.items.length > 1 && <button type="button" data-accion="retirar" aria-label={`Retirar «${limpiarTexto(x).slice(0, 60)}»`} onClick={() => onRetirar(i)} className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[12px] text-zinc-400 transition hover:border-rose-400/60 hover:text-rose-200">Retirar</button>}
        </li>
      ))}
    </ul>
  )
  if (v.tipo === "filas") return (
    <ul className="space-y-3">
      {v.filas.map((f, i) => (
        <li key={i}>
          {f.titulo && <p className={TITULO_3}>{limpiarTexto(f.titulo)}</p>}
          {f.texto && <p className={CUERPO}>{limpiarTexto(f.texto)}</p>}
          {f.extra.length > 0 && <ul className="mt-1 space-y-0.5">{f.extra.map((x, j) => <li key={j} className={`italic ${CUERPO}`}>«{limpiarTexto(x)}»</li>)}</ul>}
        </li>
      ))}
    </ul>
  )
  return <div className="space-y-3">{v.apartados.map((a, i) => <div key={i}><p className={`mb-1 ${TITULO_3}`}>{a.etiqueta}</p><Valor v={a.valor} /></div>)}</div>
}

/**
 * LAS SECCIONES NUEVAS DEL MANUAL (CC6 · 02-nov · ADENDA 1 firmada por Emilio) · 03-nov, manual limpio: solo el contenido. Sin rótulo de origen, sin notas
 * y sin «sin dato»: una parte vacía muestra solo su título y «Editar» (las 6 secciones siguen siempre a la vista · auditoría 02-nov).
 * Cada parte tiene Editar y, si es una lista, Retirar por elemento; los cambios quedan en espera hasta «Guardar cambios» (lo pone el panel).
 */
export function SeccionesNuevas({ secciones, pedirCambios, acciones, editor, extra, pendiente, editando = null, onRetirar, especial }: {
  /** una parte con su propia pantalla (la jerarquía tipográfica con niveles): si devuelve algo, va en lugar de su valor de siempre */
  especial?: (p: Parte) => React.ReactNode
  secciones: SeccionLeida[]
  /** lo que va al pie de una sección (las revisiones del editor que le pertenecen · auditoría 02-nov) */
  extra?: (s: SeccionLeida) => React.ReactNode
  pedirCambios?: ((titulo: string, claves: string[]) => void) | null
  /** los botones de cada parte (Editar): los pone el panel */
  acciones?: (p: Parte) => React.ReactNode
  /** el cuadro de edición abierto de una parte, si lo hay */
  editor?: (p: Parte) => React.ReactNode
  /** el cambio en espera de una parte (el texto, uno por línea), si lo hay */
  pendiente?: (p: Parte) => string | undefined
  /** la clave que se está editando */
  editando?: string | null
  /** retirar un elemento: la lista que queda, una por línea */
  onRetirar?: (p: Parte, lineas: string[]) => void
}) {
  if (!secciones.length) return null
  // lo que se ve de una parte: su cambio en espera (como lista) o lo guardado
  const valorDe = (p: Parte): ValorDeSeccion | null => {
    const t = pendiente?.(p)
    if (t === undefined) return p.valor
    const lineas = t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
    return lineas.length > 1 || p.valor?.tipo === "lista" ? { tipo: "lista", items: lineas } : { tipo: "texto", texto: t }
  }
  return (
    <>
      {secciones.map((s, i) => {
        return (
          <section key={s.id} id={`apartado-${s.titulo}`} data-seccion-nueva={s.id} aria-label={s.titulo} className="mn-seccion scroll-mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6" style={{ animationDelay: `${240 + i * 60}ms` }}>
            <h3 className={`mb-4 ${TITULO_1}`}>{s.titulo}</h3>
            <div className="space-y-4">
              {s.partes.map((p) => {
                const v = valorDe(p)
                const lineas = (pendiente?.(p) ?? p.para_editar).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
                // retirar por elemento: solo si cada elemento de la lista es una línea de lo que se guarda (si no, se usa Editar)
                const retirar = v?.tipo === "lista" && v.items.length === lineas.length && onRetirar ? (k: number) => onRetirar(p, lineas.filter((_, j) => j !== k)) : undefined
                return (
                  <div key={p.clave} id={`campo-${p.clave}`} data-campo={p.clave} className="scroll-mt-2 border-t border-white/[0.07] pt-4 first:border-t-0 first:pt-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h4 className={TITULO_2}>{s.partes.length === 1 ? s.titulo : p.etiqueta}</h4>
                      {acciones?.(p)}
                    </div>
                    {editando !== p.clave && v && (especial?.(p) ?? <Valor v={v} onRetirar={retirar} />)}
                    {editor?.(p)}
                  </div>
                )
              })}
            </div>
            {extra?.(s)}
            {pedirCambios && <button type="button" data-accion="manual-pedir-cambios-seccion" data-seccion-pedir={s.titulo} onClick={() => pedirCambios(s.titulo, s.partes.map((p) => p.clave))} className="mt-4 text-[13px] text-violet-200 underline decoration-dotted underline-offset-4 hover:text-violet-100">Pedir cambios en esta sección</button>}
          </section>
        )
      })}
    </>
  )
}
