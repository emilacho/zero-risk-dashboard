"use client"

import { useState } from "react"
import { limpiarTexto } from "@/lib/manual-limpio"
import type { SeccionLeida, ValorDeSeccion } from "@/lib/manual-secciones"
import { CUERPO, TITULO_1, TITULO_2, TITULO_3 } from "@/components/nuevo/manual/niveles"
import { RenglonEditable } from "@/components/nuevo/manual/RenglonEditable"
import { conRenglonCambiado, renglonEditado } from "@/lib/renglones-del-manual"

type Parte = SeccionLeida["partes"][number]

function Valor({ v, onRetirar, onEditar, editados }: { v: ValorDeSeccion; /** retirar el elemento i de una lista (solo listas simples) */ onRetirar?: (i: number) => void; /** editar el elemento i (CC2 · 03-nov): cada renglón lleva Editar y Retirar */ onEditar?: (i: number, nuevo: string) => void; /** qué renglones ya tienen una edición en espera */ editados?: boolean[] }) {
  if (v.tipo === "texto") return <p className={`whitespace-pre-line ${CUERPO}`}>{limpiarTexto(v.texto)}</p>
  if (v.tipo === "lista") return (
    <ul className="space-y-2">
      {v.items.map((x, i) => (
        <li key={i} data-elemento={i} className="flex flex-wrap items-start gap-3">
          {onRetirar && onEditar ? <RenglonEditable texto={limpiarTexto(x)} editado={!!editados?.[i]} onEditar={(nuevo) => onEditar(i, nuevo)} onRetirar={() => onRetirar(i)} /> : <span className={`min-w-0 flex-1 ${CUERPO}`}><span aria-hidden className="mr-2 text-zinc-500">•</span>{limpiarTexto(x)}</span>}
          {onRetirar && !onEditar && <button type="button" data-accion="retirar" aria-label={`Retirar «${limpiarTexto(x).slice(0, 60)}»`} onClick={() => onRetirar(i)} className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[12px] text-zinc-400 transition hover:border-rose-400/60 hover:text-rose-200">Retirar</button>}
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
export function SeccionesNuevas({ secciones, pedirCambios, acciones, editor, extra, pendiente, editando = null, onRetirar, onEditarRenglon, especial, confirmarInicial = null }: {
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
  /** retirar un elemento: la lista que queda, una por línea (vacía = se retira la parte entera · contrato CC1 #864) */
  onRetirar?: (p: Parte, lineas: string[]) => void
  /** editar UN renglón (CC2 · 03-nov): llega la lista completa con ese renglón cambiado y cuál fue (1, 2, 3…) */
  onEditarRenglon?: (p: Parte, lineas: string[], renglon: number) => void
  /** pruebas: abrir con la confirmación de retirar de esta parte a la vista */
  confirmarInicial?: string | null
}) {
  const [confirmando, setConfirmando] = useState<string | null>(confirmarInicial)
  if (!secciones.length) return null
  // lo que se ve de una parte: su cambio en espera (como lista) o lo guardado
  const valorDe = (p: Parte): ValorDeSeccion | null => {
    const t = pendiente?.(p)
    if (t === undefined) return p.valor
    if (!t.trim()) return null // retirada, sin guardar todavía
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
                const editarRenglon = retirar && onEditarRenglon ? (k: number, nuevo: string) => onEditarRenglon(p, conRenglonCambiado(lineas, k, nuevo), k + 1) : undefined
                // un renglón está «editado» si ya no es uno de los guardados
                const guardadas = p.para_editar.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
                const editados = lineas.map((l) => renglonEditado(l, guardadas))
                return (
                  <div key={p.clave} id={`campo-${p.clave}`} data-campo={p.clave} className="scroll-mt-2 border-t border-white/[0.07] pt-4 first:border-t-0 first:pt-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h4 className={TITULO_2}>{s.partes.length === 1 ? s.titulo : p.etiqueta}</h4>
                      {/* un texto (la historia) se retira entero, con confirmación */}
                      {onRetirar && v?.tipo === "texto" && editando !== p.clave && <button type="button" data-accion="retirar" aria-label={`Retirar ${p.etiqueta}`} onClick={() => setConfirmando(p.clave)} className="ml-auto shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[12px] text-zinc-400 transition hover:border-rose-400/60 hover:text-rose-200">Retirar</button>}
                      {acciones?.(p)}
                    </div>
                    {confirmando === p.clave && (
                      <div data-confirmar-retirar={p.clave} className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/[0.06] px-3 py-2">
                        <span className="text-[13.5px] text-zinc-100">¿Retirar «{s.partes.length === 1 ? s.titulo : p.etiqueta}» del manual? Queda vacío hasta que lo vuelvas a escribir.</span>
                        <button type="button" data-accion="confirmar-retirar" onClick={() => { setConfirmando(null); onRetirar?.(p, []) }} className="rounded-md border border-rose-400/60 bg-rose-500/15 px-3 py-1 text-[13px] text-rose-100 hover:bg-rose-500/25">Sí, retirar</button>
                        <button type="button" onClick={() => setConfirmando(null)} className="rounded-md border border-white/10 px-3 py-1 text-[13px] text-zinc-300 hover:bg-white/[0.05]">Cancelar</button>
                      </div>
                    )}
                    {editando !== p.clave && v && (especial?.(p) ?? <Valor v={v} onRetirar={retirar} onEditar={editarRenglon} editados={editados} />)}
                    {editor?.(p)}
                  </div>
                )
              })}
            </div>
            {extra?.(s)}
            {pedirCambios && <button type="button" data-accion="manual-pedir-cambios-seccion" data-seccion-pedir={s.titulo} onClick={() => pedirCambios(s.titulo, s.partes.map((p) => p.clave))} className="mt-4 text-[13px] text-amber-200 underline decoration-dotted underline-offset-4 hover:text-amber-100">Pedir cambios en esta sección</button>}
          </section>
        )
      })}
    </>
  )
}
