"use client"

import { faltantesDeLasSecciones } from "@/lib/manual-secciones"
import { TarjetaDeRevisionDelEditor } from "@/components/nuevo/manual/RevisionDelEditor"
import { guardarClienteDeTrabajo } from "@/lib/cliente-de-trabajo"
import { useCallback, useEffect, useRef, useState } from "react"
import { PalabrasDelManual } from "@/components/nuevo/PalabrasDelManual"
import { PedirCambiosAlManual, type PedidoEnSeccion } from "@/components/nuevo/manual/PedirCambiosAlManual"
import { borrarBorrador, borradorVacio, guardarBorrador, haceCuanto, leerBorrador, pasoDelGuardado, queHacerAlAbrir, salirTrasGuardar, TEXTO_DEL_OTRO_EQUIPO, TEXTO_NO_SE_GUARDO, textoDelAvisoDeSalir, unoALaVez, type BorradorDelDueno } from "@/lib/borrador-del-dueno"
import { cuantosCambios, enviarTusCambios, quitarDeTusCambios, renglonesDeTusCambios, type ComoCambio, type TusCambios } from "@/lib/pedido-del-manual"
import { BarraDelManual } from "@/components/nuevo/manual/BarraDelManual"
import { JerarquiaTipografica } from "@/components/nuevo/manual/JerarquiaTipografica"
import { puedeMoverNiveles } from "@/lib/jerarquia-tipografica"
import { SeccionesNuevas } from "@/components/nuevo/manual/SeccionesNuevas"
import { RenglonEditable } from "@/components/nuevo/manual/RenglonEditable"
import { conRenglonCambiado, detalleDelRenglon, renglonEditado, retirarRenglon } from "@/lib/renglones-del-manual"
import { ESTILO_DEL_PEDIDO } from "@/components/nuevo/pedido/PiezasDelPedido"
import { CICLO_DEL_MANUAL_CERRADO } from "@/lib/manual-ciclo"
import { origenDelCampo } from "@/lib/manual-campo"
import { CUERPO, TITULO_1, TITULO_2, TITULO_3 } from "@/components/nuevo/manual/niveles"
import { campoLimpio, elementoLimpio, juntarLista, partirLista, soloLaFrase } from "@/lib/manual-limpio"
import type { ManualDelCliente } from "@/lib/manual-datos"
import { CAMPOS_DEL_LECTOR, type CampoLeido } from "@/lib/manual-lector"
import { EDITABLES_DESDE_EL_TABLERO, TOPE_DEL_TEXTO_DEL_MANUAL, esEditableDesdeElTablero, etiquetaDelHueco, fechaCortaEC, separarPropuesta } from "@/lib/manual"

const AMBAR = "#f5a524"
type Respuesta = ({ ok: true } & ManualDelCliente) | { ok: false; error: string }

const ESTILO = `
.mn-seccion{animation:mnEntra .45s cubic-bezier(.2,.8,.2,1) both}
.mn-color{transition:transform .18s ease,box-shadow .18s ease}
.mn-color:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(0,0,0,.45)}
@keyframes mnEntra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.mn-seccion{animation:none}.mn-color{transition:none}}
` + ESTILO_DEL_PEDIDO

/** los apartados del manual, en el orden en que se leen: qué es la marca · cómo habla · a quién le habla */
export const APARTADOS_DEL_MANUAL: ReadonlyArray<{ titulo: string; claves: string[] }> = [
  { titulo: "Lo que la marca es", claves: ["proposito", "mision", "vision", "valores", "eslogan", "posicionamiento", "personalidad"] },
  { titulo: "Cómo habla", claves: ["voz", "mensajes_clave", "propuestas_de_valor", "nunca"] },
  { titulo: "A quién le habla", claves: ["publico"] },
]
const esLista = (clave: string) => CAMPOS_DEL_LECTOR.find((c) => c.clave === clave)?.lista === true

/** un valor de lista guardado como «a · b · c» vuelve a ser lista para leerse como viñetas */
export function viñetasDelCampo(c: Pick<CampoLeido, "clave" | "valor">): string[] | null {
  if (!c.valor || !esLista(c.clave)) return null
  const partes = partirLista(c.valor).map((x) => elementoLimpio(c.clave, x)).filter(Boolean)
  return partes.length > 1 ? partes : null
}


/** el cuadro de edición de un campo (03-nov · manual limpio): lo que se ve, una caja para escribir y «Listo». No guarda solo: el cambio queda en espera
 *  y se guarda con «Guardar cambios», abajo del manual, junto con los demás. */
function Editor({ clave, valor, onListo, onCancelar }: { clave: string; valor: string; onListo: (texto: string) => void; onCancelar: () => void }) {
  const def = EDITABLES_DESDE_EL_TABLERO.find((e) => e.clave === clave)
  const [texto, setTexto] = useState(valor)
  const [error, setError] = useState<string | null>(null)
  const caja = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { caja.current?.focus() }, [])
  function listo() {
    const t = def?.lista ? texto.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).join("\n") : texto.trim()
    if (!t) { setError("Escribe algo, o usa «Retirar»."); return }
    if (t.length > TOPE_DEL_TEXTO_DEL_MANUAL) { setError("Es demasiado largo."); return }
    onListo(t)
  }
  return (
    <form data-editor={clave} className="mt-2 rounded-lg border border-amber-400/30 bg-black/30 p-3" onSubmit={(e) => { e.preventDefault(); listo() }}>
      <textarea ref={caja} value={texto} onChange={(e) => setTexto(e.target.value)} rows={def?.lista ? 6 : 4} maxLength={TOPE_DEL_TEXTO_DEL_MANUAL} aria-label={`Editar ${def?.etiqueta ?? clave}`}
        className="w-full resize-y rounded-md border border-white/15 bg-black/40 px-3 py-2 text-[15px] leading-relaxed text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400" />
      {def?.lista && <p className="mt-1 text-[12px] text-zinc-500">Uno por línea.</p>}
      {error && <p role="alert" className="mt-2 text-[13px] text-rose-300">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button type="submit" data-accion="listo-campo" className="rounded-lg border border-amber-400/70 bg-amber-400/15 px-4 py-2 text-[14px] text-amber-50 transition hover:bg-amber-400/25">Listo</button>
        <button type="button" onClick={onCancelar} className="rounded-lg border border-white/10 px-4 py-2 text-[14px] text-zinc-300 hover:bg-white/[0.05]">Cancelar</button>
      </div>
    </form>
  )
}

type ResultadoDeGuardado = { ok: true; texto: string; detalle: Record<string, unknown> } | { ok: false; texto: string; /** el código de la plataforma (p. ej. `plan_en_curso`), para decirlo en palabras */ codigo?: string; detalleCrudo?: string; /** pedido de cambios: lo directo YA quedó guardado aunque lo demás fallara (CC1 #869) */ directo?: boolean }

/** una llamada a `POST /api/acciones/<nombre>` dicha con franqueza: hecho (con lo que dijo la plataforma), no disponible, o por qué falló */
export async function llamarAccion(nombre: string, cuerpo: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<ResultadoDeGuardado> {
  try {
    const r = await fetchImpl(`/api/acciones/${encodeURIComponent(nombre)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) })
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
    if (r.ok && j.ok) return { ok: true, texto: "Guardado", detalle: (j.resultado ?? {}) as Record<string, unknown> }
    const texto = r.status === 501 ? "Todavía no está disponible: la plataforma aún no tiene esta acción. No se cambió nada." : r.status === 401 ? "Tu sesión venció: entra de nuevo." : r.status === 409 ? `Otra decisión se adelantó: recarga. ${String(j.detalle ?? "")}` : `No se pudo: ${String(j.detalle ?? j.error ?? r.status)}`
    const pl = (j.plataforma && typeof j.plataforma === "object" ? j.plataforma : {}) as Record<string, unknown>
    const codigo = typeof pl.error === "string" ? pl.error : typeof j.plataforma_error === "string" ? j.plataforma_error : typeof j.error === "string" ? j.error : undefined
    return { ok: false, texto, ...(codigo ? { codigo } : {}), ...(j.detalle != null ? { detalleCrudo: String(j.detalle) } : {}), ...(j.directo ? { directo: true } : {}) }
  } catch (e) { return { ok: false, texto: `No se pudo: ${e instanceof Error ? e.message : String(e)}` } }
}

/** lo que se le dice a Emilio después de guardar: versión nueva y si el cerebro ya lo tiene */
export function resumenDelGuardado(d: Record<string, unknown>): string {
  // sin números de versión a la vista (Lenovo, 02-nov): se dice que quedó guardado
  const c = (d.cerebro && typeof d.cerebro === "object" ? d.cerebro : {}) as { indice?: unknown; enviados?: unknown; pendientes?: unknown }
  const pend = Array.isArray(c.pendientes) ? c.pendientes.length : 0
  const env = Array.isArray(c.enviados) ? c.enviados.length : 0
  const cerebro = pend ? `el cerebro recibió ${env} y quedan ${pend} pendientes` : env ? "el cerebro ya lo tiene: el siguiente empleado lo lee así" : c.indice === "sin_cambios" ? "sin cambios" : "el cerebro lo recibe en breve"
  return `Guardado · ${cerebro}`
}

/** «Retirar» de un elemento: botón chico y claro, al lado de lo que retira */
function BotonRetirar({ que, onClick }: { que: string; onClick: () => void }) {
  return <button type="button" data-accion="retirar" aria-label={`Retirar «${que.slice(0, 60)}»`} onClick={onClick}
    className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[12px] text-zinc-400 transition hover:border-rose-400/60 hover:text-rose-200">Retirar</button>
}
const BotonEditar = ({ etiqueta, onClick, clave }: { etiqueta: string; onClick: () => void; clave: string }) => (
  <button type="button" data-accion="editar-campo" data-campo-editar={clave} onClick={onClick} aria-label={`Editar ${etiqueta}`}
    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-[12.5px] text-zinc-300 transition hover:border-amber-400/60 hover:text-amber-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden><path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>Editar
  </button>
)
const SinGuardar = () => <span data-sin-guardar className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11.5px] text-amber-200">pendiente</span>
/* 03-nov 19:53Z (Emilio, con captura): el botón «Observación» se quitó: «Editar» basta. Para pedir una reescritura está la caja de texto libre de arriba.
   Las observaciones ya guardadas en un borrador siguen visibles (NotaDelCampo) con su ✕ en «Tus cambios»; solo deja de haber botón para crear nuevas. */
/** la observación de un campo: el cuadro para escribirla, o la nota pendiente con su texto */
function NotaDelCampo({ clave, etiqueta, nota, abierta, onListo, onCerrar }: { clave: string; etiqueta: string; nota?: string; abierta: boolean; onListo: (t: string) => void; onCerrar: () => void }) {
  const [texto, setTexto] = useState(nota ?? "")
  if (abierta) return (
    <form data-nota-editor={clave} className="mt-2 rounded-lg border border-amber-400/30 bg-black/30 p-3" onSubmit={(e) => { e.preventDefault(); onListo(texto.trim()) }}>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={100_000} autoFocus aria-label={`Observación sobre ${etiqueta}`} placeholder={`¿Qué debe cambiar en «${etiqueta}»?`}
        className="w-full resize-y rounded-md border border-white/15 bg-black/40 px-3 py-2 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400" />
      <div className="mt-2 flex items-center gap-2">
        <button type="submit" data-accion="listo-observacion" className="min-h-11 rounded-lg border border-amber-400/70 bg-amber-400/15 px-4 py-2 text-[14px] text-amber-50 transition hover:bg-amber-400/25">Listo</button>
        <button type="button" onClick={onCerrar} className="min-h-11 rounded-lg border border-white/10 px-4 py-2 text-[14px] text-zinc-300 hover:bg-white/[0.05]">Cancelar</button>
      </div>
    </form>
  )
  return nota ? <p data-nota={clave} className="mt-2 rounded-md border-l-2 border-amber-400/60 bg-amber-400/[0.05] px-3 py-2 text-[13.5px] text-amber-50"><span className="text-amber-200">Tu observación: </span>{nota}</p> : null
}

/** los elementos de un campo-lista: como están guardados (para retirar) y como se ven (limpios) */
export function elementosDelCampo(clave: string, valor: string | null): Array<{ crudo: string; limpio: string }> | null {
  if (!valor || !esLista(clave)) return null
  return partirLista(valor).map((crudo) => ({ crudo, limpio: elementoLimpio(clave, crudo) })).filter((e) => e.limpio)
}

/** UN CAMPO DEL MANUAL, LIMPIO (03-nov): su título (nivel 2), el contenido sin evidencia ni «por qué», y nada más que Editar y Retirar.
 *  Vacío: el título y «Editar», sin texto (las 6 secciones y los campos editables siguen a la vista para poder escribirlos · auditoría 02-nov). */
function Campo({ c, opciones = [], pendiente, editando, onEditar, onCambio, nota, observando = false, onObservar = null, onNota }: { /** la observación pendiente de este campo */ nota?: string; observando?: boolean; /** null = no se pueden mandar observaciones (la plataforma no tiene el pedido, o hay una reescritura en curso) */ onObservar?: ((clave: string | null) => void) | null; onNota?: (clave: string, t: string) => void; c: CampoLeido; /** opciones de eslogan cuando el eslogan aún no está decidido */ opciones?: string[]; /** el cambio en espera de este campo, si hay */ pendiente?: string; editando: boolean; onEditar: (clave: string | null) => void; onCambio: (clave: string, valor: string, como?: ComoCambio, detalle?: string) => void }) {
  const [confirmar, setConfirmar] = useState(false)
  const base = pendiente ?? separarPropuesta(c.valor).valor
  const elementos = elementosDelCampo(c.clave, base)
  const texto = base && !elementos ? campoLimpio(c.clave, base) : null
  const editable = esEditableDesdeElTablero(c.clave)
  // las opciones dependen de lo GUARDADO, no de lo pendiente: elegir una no las esconde (Emilio 16:40Z: «ya no puedo seguir eligiendo»)
  const guardado = separarPropuesta(c.valor).valor
  const opcionesLeidas = guardado ? [] : opciones.map((o) => soloLaFrase(separarPropuesta(o).valor ?? "")).filter(Boolean)
  // vacío: solo su título y «Editar» (sin «sin dato»: el documento no muestra rótulos); si no se puede escribir desde aquí, no se pinta
  if (!base && !editando && !opcionesLeidas.length && !editable) return null
  const paraEditar = elementos ? elementos.map((e) => e.limpio).join("\n") : texto ?? ""
  // los renglones tal como están GUARDADOS: uno que ya no está ahí es un renglón editado en espera (CC2 · 03-nov)
  const guardadosCrudos = (elementosDelCampo(c.clave, guardado) ?? []).map((x) => x.crudo)
  // RETIRAR EL CAMPO ENTERO (03-nov · contrato CC1 #864): un texto, o una lista de un solo elemento; siempre con confirmación (se va todo el campo)
  // solo lo GUARDADO se retira entero: lo recién elegido o escrito se deshace con su ✕ en «Tus cambios»
  const retirarEntero = editable && !!guardado && !editando && !elementos
  return (
    <div id={`campo-${c.clave}`} data-campo={c.clave} data-editable={editable} className="scroll-mt-2 border-t border-white/[0.07] pt-4 first:border-t-0 first:pt-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className={TITULO_2}>{c.etiqueta}</h4>
        {pendiente !== undefined && <SinGuardar />}
        {!editando && editable && <span className="ml-auto flex gap-1.5">{retirarEntero && <BotonRetirar que={c.etiqueta} onClick={() => setConfirmar(true)} />}{editable && <BotonEditar clave={c.clave} etiqueta={c.etiqueta} onClick={() => onEditar(c.clave)} />}</span>}
      </div>
      {confirmar && (
        <div data-confirmar-retirar={c.clave} className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/[0.06] px-3 py-2">
          <span className="text-[13.5px] text-zinc-100">¿Retirar «{c.etiqueta}» del manual? Queda vacío hasta que lo vuelvas a escribir.</span>
          <button type="button" data-accion="confirmar-retirar" onClick={() => { setConfirmar(false); onCambio(c.clave, "", "retirar") }} className="rounded-md border border-rose-400/60 bg-rose-500/15 px-3 py-1 text-[13px] text-rose-100 hover:bg-rose-500/25">Sí, retirar</button>
          <button type="button" onClick={() => setConfirmar(false)} className="rounded-md border border-white/10 px-3 py-1 text-[13px] text-zinc-300 hover:bg-white/[0.05]">Cancelar</button>
        </div>
      )}
      {editando && <Editor clave={c.clave} valor={paraEditar} onCancelar={() => onEditar(null)} onListo={(t) => onCambio(c.clave, t, "editar")} />}
      {!editando && elementos && (
        <ul className="space-y-2">
          {elementos.map((e, i) => (
            <li key={`${i}-${e.limpio.slice(0, 20)}`} data-elemento={i} className="flex flex-wrap items-start gap-3">
              {editable
                ? <RenglonEditable texto={e.limpio} editado={renglonEditado(e.crudo, guardadosCrudos)}
                    onEditar={(nuevo) => onCambio(c.clave, juntarLista(conRenglonCambiado(elementos.map((x) => x.crudo), i, nuevo)), "editar", detalleDelRenglon(i))}
                    onRetirar={() => { const r = retirarRenglon(elementos.map((x) => x.crudo), i); if (r.tipo === "quitar") onCambio(c.clave, juntarLista(r.quedan), "retirar"); else setConfirmar(true) }} />
                : <span className={`min-w-0 flex-1 ${CUERPO}`}><span aria-hidden className="mr-2 text-zinc-500">•</span>{e.limpio}</span>}
            </li>
          ))}
        </ul>
      )}
      {!editando && texto && <p className={`whitespace-pre-line ${CUERPO}`}>{texto}</p>}
      {onNota && onObservar !== undefined && <NotaDelCampo key={`${c.clave}-${observando}`} clave={c.clave} etiqueta={c.etiqueta} nota={nota} abierta={observando} onListo={(t) => { onNota(c.clave, t); onObservar?.(null) }} onCerrar={() => onObservar?.(null)} />}
      {opcionesLeidas.length > 0 && (
        <div className="mt-1" data-opciones={c.clave}>
          <h5 className={TITULO_3}>Opciones de eslogan</h5>
          <ul className="mt-2 space-y-2">{opcionesLeidas.map((o, i) => (
            <li key={i} data-opcion={i} className="flex items-start gap-3">
              <span className={`min-w-0 flex-1 ${CUERPO}`}>«{o}»</span>
              {editable && (pendiente === o
                ? <span data-elegida className="shrink-0 rounded-md border border-emerald-400/70 bg-emerald-400/15 px-2.5 py-1 text-[12.5px] font-medium text-emerald-100">✓ Elegida</span>
                : <button type="button" data-accion="elegir-opcion" aria-label={`Elegir «${o.slice(0, 60)}» como eslogan`} onClick={() => onCambio(c.clave, o, "elegir")}
                className="shrink-0 rounded-md border border-emerald-400/40 px-2.5 py-1 text-[12.5px] text-emerald-200 transition hover:bg-emerald-400/10">✓ Elegir</button>)}
            </li>
          ))}</ul>
        </div>
      )}
    </div>
  )
}

/** el nombre de un campo como lo ve Emilio (apartados de siempre y secciones nuevas) */
function etiquetaDeLaClave(k: string, d: ManualDelCliente | null): string {
  const c = d?.manual?.lector.campos.find((x) => x.clave === k)
  if (c) return c.etiqueta
  for (const sn of d?.manual?.secciones_nuevas ?? []) { const p = sn.partes.find((x) => x.clave === k); if (p) return p.etiqueta }
  return CAMPOS_DEL_LECTOR.find((x) => x.clave === k)?.etiqueta ?? k
}
/** el orden de los campos en el documento, para la lista de «Tus cambios» */
const ordenDelManual = (d: ManualDelCliente | null): string[] => [...APARTADOS_DEL_MANUAL.flatMap((a) => a.claves), ...(d?.manual?.secciones_nuevas ?? []).flatMap((sn) => sn.partes.map((p) => p.clave))]

/** el aviso después de aprobar el manual (03-nov · firma de Emilio 14:46Z: aprobar es el disparador del plan · contrato CC1 #868: `plan` y `aviso`) */
export function avisoDeAprobado(d: Record<string, unknown>): { ok: boolean; texto: string; reintentar: boolean } {
  const plan = (d.plan && typeof d.plan === "object" ? d.plan : {}) as Record<string, unknown>
  if ((typeof d.aviso === "string" && d.aviso.trim()) || plan.pedido === false) // texto propio: el `aviso` de la plataforma ya trae la frase entera («…Vuelve a aprobar para reintentar.») y no se repite
    return { ok: false, texto: "El manual quedó aprobado, pero el plan no se pudo pedir. Toca «Reintentar pedir el plan».", reintentar: true }
  if (plan.repetido) return { ok: true, texto: "✓ Manual aprobado · el plan de esta versión ya estaba pedido", reintentar: false }
  if (d.sin_cambios && !plan.pedido) return { ok: true, texto: "Ya estaba aprobado por ti.", reintentar: false }
  return { ok: true, texto: "✓ Manual aprobado · el plan arranca con este manual", reintentar: false }
}
/** por qué no se pudo aprobar, en palabras (contrato CC1 #868: 409 `regeneracion_en_curso` · 409 `plan_en_curso` · 502 `no_se_pudo_leer`, todos con su detalle) */
export function motivoDeNoAprobar(r: { texto: string; codigo?: string; detalleCrudo?: string }): string {
  const det = r.detalleCrudo?.trim() ? ` (${r.detalleCrudo.trim()})` : ""
  if (r.codigo === "regeneracion_en_curso") return `Todavía no se puede aprobar: el manual se está reescribiendo. Espera a que termine${det}.`
  if (r.codigo === "plan_en_curso") return `Ya hay un plan en marcha para este cliente; no se pide otro${det}.`
  if (r.codigo === "borrador_pendiente") return `Todavía no se puede aprobar: hay cambios sin pedir guardados como borrador. Pídelos o descártalos primero${det}.`
  if (r.codigo === "no_se_pudo_leer") return `No se pudo leer el manual para aprobarlo. Prueba de nuevo en un momento${det}.`
  return r.texto
}

/** el borrador de «Tus cambios» en la plataforma (inyectable en pruebas) */
export interface ApiDelBorrador {
  leer: typeof leerBorrador
  guardar: typeof guardarBorrador
  borrar: typeof borrarBorrador
}
const BORRADOR_REAL: ApiDelBorrador = { leer: leerBorrador, guardar: guardarBorrador, borrar: borrarBorrador }
/** cuánto espera para guardar después del último toque (un guardado por ráfaga, no uno por tecla) */
export const PAUSA_DEL_BORRADOR_MS = 1200

export function PanelManual({ borrador: apiBorrador = BORRADOR_REAL, borradorInicial = null, borradorViejoInicial = null, salirInicial = false, noSePudoGuardarInicial = false, onCerrar, datosIniciales = null, clienteInicial = null, accion = llamarAccion, cambiosIniciales = {}, notasIniciales = {}, libreInicial = "", confirmarAprobarInicial = false, reintentarPlanInicial = false }: { borrador?: ApiDelBorrador; /** pruebas: el borrador ya guardado / el de una versión anterior / el aviso de salir a la vista */ borradorInicial?: { revision: number | null; actualizado_en: string | null } | null; borradorViejoInicial?: BorradorDelDueno | null; salirInicial?: boolean; noSePudoGuardarInicial?: boolean; /** pruebas: observaciones y texto libre pendientes */ notasIniciales?: Record<string, string>; libreInicial?: string; /** pruebas: aprobado pero sin plan pedido */ reintentarPlanInicial?: boolean; onCerrar: () => void; datosIniciales?: ManualDelCliente | null; /** pruebas: abrir con cambios en espera (Editar/Retirar sin guardar) */ cambiosIniciales?: Record<string, string>; /** pruebas: abrir con la confirmación de aprobar a la vista */ confirmarAprobarInicial?: boolean; /** abrir con este cliente (el harness local lo usa) */ clienteInicial?: string | null; /** cómo se envían las acciones (pruebas) */ accion?: typeof llamarAccion }) {
  const [datos, setDatos] = useState<ManualDelCliente | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [cliente, setCliente] = useState<string | null>(datosIniciales?.cliente?.id ?? clienteInicial)
  const [editando, setEditando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [validando, setValidando] = useState<"quieto" | "confirmar" | "enviando">(confirmarAprobarInicial ? "confirmar" : "quieto")
  // «Pedir cambios en esta sección» (como en el plan): el apartado lo dispara y el cuadro del pedido, en la portada, lo abre
  const [pedirEn, setPedirEn] = useState<PedidoEnSeccion | null>(null)
  // 03-nov · TUS CAMBIOS (corrección de Lenovo 16:40Z): elegir, retirar, editar, observaciones por campo y el texto libre quedan pendientes
  // y salen juntos con «Pedir los cambios», abajo del manual (`lib/pedido-del-manual.ts`)
  const [cambios, setCambios] = useState<Record<string, string>>(cambiosIniciales)
  const [como, setComo] = useState<Record<string, ComoCambio>>({})
  const [detalles, setDetalles] = useState<Record<string, string>>({})
  const [notas, setNotas] = useState<Record<string, string>>(notasIniciales)
  const [libre, setLibre] = useState(libreInicial)
  const [observando, setObservando] = useState<string | null>(null)
  // aprobado pero el plan no se pudo pedir: el botón sigue a la vista para reintentar (aprobar otra vez reintenta, sin otra versión · CC1 #868)
  const [reintentarPlan, setReintentarPlan] = useState(reintentarPlanInicial)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  // EL BORRADOR (corrección de Lenovo 18:13Z): «Tus cambios» se guarda solo en la plataforma y vuelve al abrir el manual en cualquier equipo
  const [guardadoDelBorrador, ponerGuardadoEnPantalla] = useState<{ revision: number | null; actualizado_en: string | null } | null>(borradorInicial)
  /** la revisión vigente, al instante (no espera al siguiente render): el guardado que sigue sale con ELLA (04-nov: dos guardados con la misma revisión chocaban) */
  const revisionVigente = useRef<number | null>(borradorInicial?.revision ?? null)
  const setGuardadoDelBorrador = (g: { revision: number | null; actualizado_en: string | null } | null) => { revisionVigente.current = g?.revision ?? null; ponerGuardadoEnPantalla(g) }
  /** choque REAL con otro equipo: lo escrito aquí ganó; lo del otro equipo queda para recuperarlo si Emilio quiere */
  const [delOtroEquipo, setDelOtroEquipo] = useState<BorradorDelDueno | null>(null)
  const [borradorViejo, setBorradorViejo] = useState<BorradorDelDueno | null>(borradorViejoInicial)
  const [salir, setSalir] = useState<null | (() => void)>(salirInicial ? () => () => {} : null)
  /** el último guardado del borrador falló: el aviso al salir lo dice (no promete) */
  const [noSePudoGuardar, setNoSePudoGuardar] = useState(noSePudoGuardarInicial)
  const [ahora, setAhora] = useState(() => new Date())
  /** a qué «cliente|versión» pertenece lo que hay en pantalla: solo se guarda cuando ya se leyó el borrador de ESE manual (nunca se pisa el de otro) */
  const borradorDe = useRef<string | null>(null)
  const ultimoGuardado = useRef<string>("")
  const cerrar = useRef<HTMLButtonElement>(null)

  useEffect(() => { cerrar.current?.focus() }, [])
  // Esc cierra el manual y NO la oficina: se atiende en captura y se detiene ahí
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); salirConAviso.current(onCerrar) } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])

  const leer = useCallback(async (id: string | null) => {
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/manual${id ? `?cliente=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver el manual." : (j && !j.ok && j.error) || `No pude leer el manual (${r.status}).`)
      setDatos(j); setCliente(j.cliente?.id ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [])
  useEffect(() => { if (!datosIniciales) void leer(clienteInicial) }, [leer, datosIniciales, clienteInicial])

  // después de guardar: se dice qué pasó y se vuelve a leer (la versión nueva es la que verá el siguiente empleado)
  const guardado = (r: ResultadoDeGuardado) => { setEditando(null); setAviso(r.ok ? { ok: true, texto: resumenDelGuardado(r.detalle) } : { ok: false, texto: r.texto }); if (r.ok) void leer(cliente) }
  // `detalle` (CC2 · 03-nov): "editaste el renglón 2"; si el campo ya tenía otro cambio en espera, se dice el genérico («lo cambiaste»)
  const cambiar = (clave: string, valor: string, forma: ComoCambio = "editar", detalle?: string) => { setDetalles((d) => { const n = { ...d }; if (detalle && cambios[clave] === undefined) n[clave] = detalle; else delete n[clave]; return n }); setCambios((c) => ({ ...c, [clave]: valor })); setComo((x) => ({ ...x, [clave]: forma })); setEditando(null); setGuardadoOk(false); setAviso(null) }
  const anotar = (clave: string, t: string) => { setNotas((n) => { const o = { ...n }; if (t.trim()) o[clave] = t.trim(); else delete o[clave]; return o }); setGuardadoOk(false); setAviso(null) }
  const tus: TusCambios = { campos: cambios, como, notas, libre, detalle: detalles }
  const nCambios = cuantosCambios(tus)
  const ponerTus = (t: TusCambios) => { setCambios(t.campos); setComo(t.como); setDetalles(t.detalle ?? {}); setNotas(t.notas); setLibre(t.libre) }
  const descartarTodo = () => { ponerTus({ campos: {}, como: {}, notas: {}, libre: "" }); setEditando(null); setObservando(null) }

  // ── EL BORRADOR EN LA PLATAFORMA (contrato CC1 #872) ──
  const manualId = datos?.manual?.id ?? null
  const llaveDelBorrador = cliente && manualId ? `${cliente}|${manualId}` : null
  const fotoDeTus = JSON.stringify(tus)
  // 1 · al abrir (o al cambiar de cliente o de versión): se lee el borrador; si es de ESTA versión vuelve a «Tus cambios»; si es de otra, se pregunta
  useEffect(() => {
    if (!llaveDelBorrador || borradorDe.current === llaveDelBorrador || !cliente || !manualId) return
    let vivo = true
    void apiBorrador.leer(cliente, "manual").then((r) => {
      if (!vivo) return
      const b = r.borrador, q = queHacerAlAbrir(b, manualId)
      // la revisión se guarda SIEMPRE que haya fila, aunque venga vacía (CC1 04-nov: con fila vacía el primer guardado salía con 0 y chocaba)
      if (b) setGuardadoDelBorrador({ revision: b.revision, actualizado_en: b.actualizado_en })
      if (q.tipo === "recuperar") { ponerTus(q.acciones); ultimoGuardado.current = JSON.stringify(q.acciones) }
      else if (q.tipo === "preguntar") setBorradorViejo(q.borrador)
      // si la lectura falló, NO se marca como leído: no se guarda encima de un borrador que no se pudo ver
      if (r.ok) borradorDe.current = llaveDelBorrador
    })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llaveDelBorrador])
  // 2 · cada cambio se guarda solo, a los pocos segundos (vacío = se borra). Un borrador viejo sin decidir no se toca mientras no haya nada nuevo
  /** true = lo que hay en pantalla quedó guardado (o no había nada que guardar) */
  async function guardarElBorradorYa(): Promise<boolean> {
    if (!cliente || !manualId) return true
    const paso = pasoDelGuardado({ leido: borradorDe.current === llaveDelBorrador, igualAlUltimo: fotoDeTus === ultimoGuardado.current, vacio: borradorVacio(tus), hayViejoSinDecidir: !!borradorViejo, hayGuardado: !!guardadoDelBorrador })
    if (paso === "nada") return borradorDe.current === llaveDelBorrador || borradorVacio(tus)
    ultimoGuardado.current = fotoDeTus
    // vaciar se hace guardando VACÍO con la revisión (la plataforma lo borra): si otro equipo marcó algo entretanto, da 409 y se muestra (reserva 2 de CC3)
    const lo = paso === "borrar" ? { campos: {}, como: {}, notas: {}, libre: "" } : tus
    let g = await apiBorrador.guardar(cliente, "manual", manualId, lo, revisionVigente.current ?? 0)
    if (g.otroEquipo && !g.borrador) {
      // la fila ya no existe (la plataforma cierra el borrador con el pedido · CC1 #876): no hay nada que pisar
      revisionVigente.current = 0
      if (paso === "borrar") { setGuardadoDelBorrador(null); setNoSePudoGuardar(false); return true }
      g = await apiBorrador.guardar(cliente, "manual", manualId, lo, 0)
    }
    if (g.otroEquipo && g.borrador) {
      // choque REAL (otro equipo guardó entretanto): lo que se escribe AQUÍ no se pisa. Se guarda encima con la revisión vigente y lo del otro equipo
      // queda para recuperarlo con un toque (Lenovo 04-nov: «gana lo último que escribió esta pestaña y el aviso ofrece recuperar lo otro»)
      const otro = g.borrador
      revisionVigente.current = otro.revision
      if (paso === "borrar") {
        // reserva 2 de CC3 (#240): vaciar NUNCA borra a ciegas lo que otro equipo acaba de marcar; aquí no se escribía nada, así que se muestra lo suyo
        ponerTus(otro.acciones); ultimoGuardado.current = JSON.stringify(otro.acciones)
        setGuardadoDelBorrador({ revision: otro.revision, actualizado_en: otro.actualizado_en })
        setAviso({ ok: true, texto: "En otro equipo se marcaron cambios en este borrador: te los muestro." }); setNoSePudoGuardar(false); return true
      }
      g = await apiBorrador.guardar(cliente, "manual", manualId, lo, otro.revision ?? 0)
      if (!borradorVacio(otro.acciones) && JSON.stringify(otro.acciones) !== JSON.stringify(lo)) setDelOtroEquipo(otro)
    }
    if (g.ok) {
      setGuardadoDelBorrador(g.borrador ? { revision: g.borrador.revision, actualizado_en: g.borrador.actualizado_en } : null)
      if (g.borrador) setBorradorViejo(null)
      setNoSePudoGuardar(false); return true
    }
    if (g.borrador && g.otroEquipo) revisionVigente.current = g.borrador.revision // segundo choque seguido: se reintenta en el próximo cambio, sin pisar nada
    ultimoGuardado.current = "" // no se guardó: se reintenta en el próximo cambio o al salir, y el aviso de salir lo dice
    setNoSePudoGuardar(true); return false
  }
  const guardarAhora = useRef(guardarElBorradorYa); guardarAhora.current = guardarElBorradorYa
  // un guardado a la vez: el siguiente espera al que está en vuelo y sale con lo último (y su revisión)
  const guardarYa = useRef<() => Promise<boolean>>(unoALaVez(() => guardarAhora.current()))
  useEffect(() => {
    if (!llaveDelBorrador) return
    const t = setTimeout(() => { void guardarYa.current() }, PAUSA_DEL_BORRADOR_MS)
    return () => clearTimeout(t)
  }, [fotoDeTus, llaveDelBorrador])
  // el aviso de salir solo aparece al intentar salir: si Emilio sigue escribiendo, se quita (04-nov: quedaba fijo arriba)
  const fotoAlPedirSalir = useRef<string | null>(null)
  useEffect(() => {
    if (!salir) { fotoAlPedirSalir.current = null; return }
    if (fotoAlPedirSalir.current == null) { fotoAlPedirSalir.current = fotoDeTus; return }
    if (fotoAlPedirSalir.current !== fotoDeTus) setSalir(null)
  }, [fotoDeTus, salir])
  // «hace N min» se actualiza solo
  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 30_000); return () => clearInterval(t) }, [])
  // 3 · salir con cambios: aviso propio (cerrar, Esc, fuera del panel, cambiar de cliente) y el nativo del navegador al recargar
  // clic fuera: solo si el clic EMPIEZA y TERMINA fuera (arrastrar para seleccionar texto y soltar afuera no pide salir · 04-nov)
  const abajoAfuera = useRef(false)
  const salirConAviso = useRef<(seguir: () => void) => void>(() => {})
  salirConAviso.current = (seguir) => { if (nCambios > 0) setSalir(() => seguir); else seguir() }
  useEffect(() => {
    if (nCambios === 0) return
    const antes = (e: BeforeUnloadEvent) => { void guardarYa.current(); e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", antes)
    return () => window.removeEventListener("beforeunload", antes)
  }, [nCambios])
  /**
   * tras un pedido que salió entero, el borrador de esta versión se borra (vaciar con la revisión vigente, de a uno con el guardado automático).
   * Si quedó algo sin mandar, NO se guarda desde aquí: la plataforma ya lo deja sobre la versión vigente (CC1 #876) y guardarlo aquí lo ataría a la vieja.
   */
  async function dejarElBorradorEnLoQueQueda(quedan: TusCambios) {
    if (!cliente || !manualId || borradorDe.current !== llaveDelBorrador || !borradorVacio(quedan)) return
    await guardarYa.current().catch(() => false) // primero termina el guardado automático en vuelo: así este sale con la revisión que dejó
    const g = await apiBorrador.guardar(cliente, "manual", manualId, quedan, revisionVigente.current ?? 0)
    // 409 sin borrador = la plataforma ya lo cerró con el pedido (#876): no queda nada que borrar
    if (g.ok || (g.otroEquipo && !g.borrador)) { revisionVigente.current = 0; setGuardadoDelBorrador(null); ultimoGuardado.current = JSON.stringify(quedan) }
  }
  async function guardarCambios() {
    if (!cliente || !nCambios) return
    setGuardando(true); setAviso(null)
    const ciclo = datos?.manual?.ciclo ?? CICLO_DEL_MANUAL_CERRADO
    const r = await enviarTusCambios(accion, cliente, tus, { puedeReescribir: ciclo.disponible && !ciclo.abierto, etiqueta: (k) => etiquetaDeLaClave(k, datos) })
    setGuardando(false)
    ponerTus(r.quedan)
    // 04-nov (CC1 · borrador de Náufrago): lo pedido crea otra versión del manual; si no se limpia AHORA, el borrador queda atado a la versión vieja y al
    // volver a leer sale «Tienes un borrador de la versión anterior» con cosas ya mandadas. Se guarda lo que queda (vacío = la plataforma lo borra) ANTES de leer.
    if (r.ok) await dejarElBorradorEnLoQueQueda(r.quedan)
    if (r.ok) { setGuardadoOk(true); if (r.reescribe) setAviso({ ok: true, texto: r.texto }); void leer(cliente) }
    else { setAviso({ ok: false, texto: r.texto }); if (r.quedan.campos !== cambios) void leer(cliente) }
  }
  // «Reintentar» un pedido que no llegó o no terminó: solo lo escrito, sin lo directo (eso ya quedó) y sin tocar lo pendiente de ahora
  async function reintentar(texto: string) {
    if (!cliente) return
    setGuardando(true); setAviso(null)
    const r = await enviarTusCambios(accion, cliente, { campos: {}, como: {}, notas: {}, libre: texto }, { puedeReescribir: true })
    setGuardando(false)
    setAviso({ ok: r.ok, texto: r.texto }); void leer(cliente)
  }
  async function validar() {
    if (!cliente) return
    setValidando("enviando"); setAviso(null)
    const r = await accion("manual-validar", { client_id: cliente })
    setValidando("quieto")
    if (r.ok) { const a = avisoDeAprobado(r.detalle); setAviso({ ok: a.ok, texto: a.texto }); setReintentarPlan(a.reintentar); void leer(cliente) } else setAviso({ ok: false, texto: motivoDeNoAprobar(r) })
  }

  const m = datos?.manual ?? null
  const campos = new Map((m?.lector.campos ?? []).map((c) => [c.clave, c]))
  // auditoría 02-nov: las secciones nuevas vacías también faltan (Historia y origen, Tono según el canal, Reglas de escritura, Dirección de fotografía, Uso del logo, Jerarquía tipográfica)
  const faltanSecciones = m ? faltantesDeLasSecciones(m.secciones_nuevas ?? []) : []
  const huecos = m ? [...m.lector.huecos, ...faltanSecciones.map((f) => f.clave)] : []
  const faltan = m ? [...m.lector.huecos.map(etiquetaDelHueco), ...faltanSecciones.map((f) => f.etiqueta)] : []
  const ciclo = m?.ciclo ?? CICLO_DEL_MANUAL_CERRADO
  const esDelDueno = (c: CampoLeido) => !!c.valor && (origenDelCampo(c) === "dueno" || origenDelCampo(c) === "aceptado")
  // auditoría 02-nov (punto 3): cada revisión del editor va en la PRIMERA sección que contiene una de sus claves (apartados de siempre y secciones nuevas)
  const revisiones = m?.revisiones_del_editor ?? []
  const seccionesConClaves: string[][] = [...APARTADOS_DEL_MANUAL.map((a) => a.claves), ...(m?.secciones_nuevas ?? []).map((sn) => sn.partes.map((p) => p.clave))]
  // la sección del PRIMER campo de la revisión que esté en el manual (el principal de quien la escribió), no la primera que nombre cualquiera
  const dondeVa = (claves: string[]) => { for (const k of claves) { const i = seccionesConClaves.findIndex((sc) => sc.includes(k)); if (i >= 0) return i } return -1 }
  const revisionesDe = (claves: string[]) => revisiones.filter((r) => { const k = dondeVa(r.claves); return k >= 0 && seccionesConClaves[k].join() === claves.join() })
  const revisionesSueltas = revisiones.filter((r) => dondeVa(r.claves) < 0)
  const irAEscribir = (k: string) => { if (esEditableDesdeElTablero(k)) setEditando(k); setTimeout(() => document.getElementById(`campo-${k}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 30) }
  const revisionHecha = (texto: string) => { setAviso({ ok: true, texto }); void leer(cliente) }
  const validadosDe = (claves: string[]) => claves.map((k) => campos.get(k)).filter((c): c is CampoLeido => !!c && esDelDueno(c)).map((c) => c.etiqueta)
  const puedePedirEnSeccion = ciclo.disponible && !ciclo.abierto && !!cliente
  // las observaciones las lee el equipo del manual: solo con el pedido disponible y sin otra reescritura en curso
  const puedeObservar = puedePedirEnSeccion
  const renglones = renglonesDeTusCambios(tus, (k) => etiquetaDeLaClave(k, datos), ordenDelManual(datos))
  const pedirEnSeccion = (titulo: string, claves: string[]) => setPedirEn((p) => ({ titulo, campos: claves, validados: validadosDe(claves), n: (p?.n ?? 0) + 1 }))
  const BotonDeSeccion = ({ titulo, claves }: { titulo: string; claves: string[] }) => puedePedirEnSeccion ? (
    <button type="button" data-accion="manual-pedir-cambios-seccion" data-seccion-pedir={titulo} onClick={() => pedirEnSeccion(titulo, claves)}
      className="mt-3 text-[12px] text-amber-200 underline decoration-dotted underline-offset-4 hover:text-amber-100">Pedir cambios en esta sección</button>
  ) : null

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { abajoAfuera.current = e.target === e.currentTarget }} onMouseUp={(e) => { if (abajoAfuera.current && e.target === e.currentTarget) salirConAviso.current(onCerrar); abajoAfuera.current = false }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="manual-titulo" data-seccion="manual" className="relative flex max-h-full w-full max-w-[1280px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="manual-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Manual de marca</h2>
          {datos?.cliente?.nombre && <span data-cliente-cabecera className="ml-1 truncate font-display text-[19px] font-medium tracking-normal text-zinc-50">{datos?.cliente?.nombre}</span>}
          <p className="hidden text-[12px] text-zinc-500 md:block">Lo que la marca es, cómo habla y cómo se ve · se edita aquí</p>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-zinc-400">
            <span>Cliente</span>
            <select value={cliente ?? ""} onChange={(e) => { const id = e.target.value || null; salirConAviso.current(() => { borradorDe.current = null; ultimoGuardado.current = ""; descartarTodo(); setBorradorViejo(null); setGuardadoDelBorrador(null); setGuardadoOk(false); if (id) guardarClienteDeTrabajo({ id, nombre: datos?.clientes.find((c) => c.id === id)?.nombre ?? null }); void leer(id) })}} disabled={!datos || cargando} aria-label="Elegir el cliente"
              className="rounded-md border border-white/10 bg-[#111] px-2 py-1 text-[13px] text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
              {(datos?.clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.con_manual ? "" : " · sin manual"}</option>)}
              {!datos && <option value="">Leyendo…</option>}
            </select>
          </label>
          <button ref={cerrar} type="button" onClick={() => salirConAviso.current(onCerrar)} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </header>

        {salir && (
          <div role="alertdialog" aria-labelledby="salir-titulo" data-aviso-salir className="flex flex-wrap items-center gap-3 border-b border-amber-400/40 bg-amber-500/10 px-4 py-3 sm:px-6">
            <p id="salir-titulo" data-no-se-pudo-guardar={noSePudoGuardar} className={`text-[14px] ${noSePudoGuardar ? "text-rose-100" : "text-amber-50"}`}>{textoDelAvisoDeSalir(nCambios, noSePudoGuardar)}</p>
            <button type="button" data-accion="seguir-aqui" onClick={() => setSalir(null)} className="min-h-11 rounded-lg border border-amber-400/70 bg-amber-400/15 px-4 py-2 text-[14px] font-medium text-amber-50 hover:bg-amber-400/25">Seguir aquí</button>
            <button type="button" data-accion="salir-igual" onClick={() => { const seguir = salir; if (noSePudoGuardar) { setSalir(null); seguir(); return } void salirTrasGuardar(() => guardarYa.current(), () => { setSalir(null); seguir() }) }} className="min-h-11 rounded-lg border border-white/10 px-4 py-2 text-[14px] text-zinc-300 hover:bg-white/[0.05]">{noSePudoGuardar ? "Salir sin guardar" : "Salir"}</button>
          </div>
        )}
        {borradorViejo && (
          <div data-borrador-viejo className="flex flex-wrap items-center gap-3 border-b border-amber-400/40 bg-amber-500/[0.07] px-4 py-3 sm:px-6">
            <p className="text-[14px] text-amber-50">Tienes un borrador de cambios que era de la versión anterior del manual{guardadoDelBorrador?.actualizado_en ? ` (${haceCuanto(guardadoDelBorrador.actualizado_en, ahora).replace("borrador guardado · ", "")})` : ""}.</p>
            <button type="button" data-accion="seguir-con-el-borrador" onClick={() => { const b = borradorViejo; setBorradorViejo(null); ponerTus(b.acciones) }} className="min-h-11 rounded-lg border border-amber-400/70 bg-amber-400/15 px-4 py-2 text-[14px] font-medium text-amber-50 hover:bg-amber-400/25">Seguir con él</button>
            <button type="button" data-accion="descartar-borrador-viejo" onClick={() => { setBorradorViejo(null); setGuardadoDelBorrador(null); if (cliente) void apiBorrador.borrar(cliente, "manual") }} className="min-h-11 rounded-lg border border-white/10 px-4 py-2 text-[14px] text-zinc-300 hover:bg-white/[0.05]">Descartar</button>
          </div>
        )}
        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}
        {delOtroEquipo && (
          <div data-del-otro-equipo className="flex flex-wrap items-center gap-3 border-b border-amber-400/40 bg-amber-500/[0.07] px-4 py-3 sm:px-6">
            <p className="text-[14px] text-amber-50">{TEXTO_DEL_OTRO_EQUIPO}</p>
            <button type="button" data-accion="recuperar-del-otro-equipo" onClick={() => { const b = delOtroEquipo; setDelOtroEquipo(null); ponerTus(b.acciones) }} className="min-h-11 rounded-lg border border-amber-400/70 bg-amber-400/15 px-4 py-2 text-[14px] font-medium text-amber-50 hover:bg-amber-400/25">Ver lo del otro equipo</button>
            <button type="button" data-accion="quedarme-con-lo-mio" onClick={() => setDelOtroEquipo(null)} className="min-h-11 rounded-lg border border-white/10 px-4 py-2 text-[14px] text-zinc-300 hover:bg-white/[0.06]">Seguir con lo mío</button>
          </div>
        )}
        {aviso && <p role="status" data-aviso={aviso.ok ? "ok" : "error"} className={`border-b px-4 py-2 text-[13px] sm:px-6 ${aviso.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>{aviso.texto}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {!datos && !error && <p className="text-[13px] text-zinc-500">Leyendo el manual…</p>}
          {datos && !m && <p className="text-[13px] text-zinc-400">{datos.cliente ? `${datos.cliente.nombre} todavía no tiene manual de marca.` : "No hay clientes para mostrar."}</p>}
          {datos && m && (
            <>
              {/* la portada: quién es, qué versión, quién lo validó, qué falta */}
              <section aria-label="La portada del manual" className="mn-seccion mb-5 rounded-lg border border-white/10 bg-black/30 p-4 sm:p-5">
                <h3 className="font-display text-[24px] font-semibold leading-tight tracking-tight text-zinc-50">{datos.cliente?.nombre}</h3>
                {/* 03-nov 08:20Z · Emilio: la caja «Lo que falta» y los rótulos de estado no van arriba del documento; lo que falta, en una línea del panel lateral */}
                <nav aria-label="Apartados del manual" className="mt-3 flex flex-wrap gap-1.5">
                  {APARTADOS_DEL_MANUAL.map((ap) => <button key={ap.titulo} type="button" data-ir-apartado={ap.titulo} onClick={() => document.getElementById(`apartado-${ap.titulo}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11.5px] text-zinc-400 hover:border-amber-400/50 hover:text-amber-100">{ap.titulo}</button>)}
                  {(m.secciones_nuevas ?? []).map((sn) => <button key={sn.id} type="button" data-ir-apartado={sn.titulo} onClick={() => document.getElementById(`apartado-${sn.titulo}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11.5px] text-zinc-400 hover:border-amber-400/50 hover:text-amber-100">{sn.titulo}</button>)}
                  <button type="button" data-ir-apartado="Palabras" onClick={() => document.getElementById("apartado-Palabras")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11.5px] text-zinc-400 hover:border-amber-400/50 hover:text-amber-100">Palabras</button>
                </nav>
                {(m.lector.validadoPor !== "dueno" || reintentarPlan || !!m.plan_sin_pedir) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {validando !== "confirmar" ? (
                      // 03-nov (firma de Emilio 14:46Z): este botón es el DISPARADOR de la cadena; con cambios sin guardar o una reescritura en curso no se puede aprobar
                      <>
                        <button type="button" data-accion="validar-manual" onClick={() => setValidando("confirmar")} disabled={validando === "enviando" || nCambios > 0 || !!borradorViejo || ciclo.abierto != null}
                          className="min-h-11 rounded-lg border border-emerald-400/60 bg-emerald-400/10 px-4 py-2 text-[14px] font-medium text-emerald-100 transition hover:bg-emerald-400/20 disabled:border-white/10 disabled:bg-transparent disabled:text-zinc-500">{validando === "enviando" ? "Aprobando…" : (reintentarPlan || !!m.plan_sin_pedir) && m.lector.validadoPor === "dueno" ? "Reintentar pedir el plan" : "✓ Aprobar el manual y seguir con el plan"}</button>
                        {nCambios > 0 && <span data-aprobar-espera className="text-[13px] text-amber-200">Pide tus cambios antes de aprobar.</span>}
                        {nCambios === 0 && !!borradorViejo && <span data-aprobar-espera className="text-[13px] text-amber-200">Decide qué hacer con el borrador de la versión anterior.</span>}
                        {nCambios === 0 && ciclo.abierto != null && <span data-aprobar-espera className="text-[13px] text-amber-200">Espera a que termine la reescritura del manual.</span>}
                      </>
                    ) : (
                      <>
                        <span className="text-[13.5px] text-zinc-200">Al aprobar, el manual{datos?.cliente?.nombre ? <> de <b data-validar-para className="text-amber-200">{datos.cliente.nombre}</b></> : null} queda como tuyo y <b>arranca el plan de campaña</b> con él. Lo que retiraste o editaste ya cuenta. Después, los cambios al manual van por «Pedir cambios».</span>
                        <button type="button" data-accion="confirmar-validar" onClick={() => void validar()} className="min-h-11 rounded-lg border border-emerald-400/70 bg-emerald-400/15 px-4 py-2 text-[14px] font-medium text-emerald-50 hover:bg-emerald-400/25">{datos?.cliente?.nombre ? `Sí, aprobar y seguir con el plan de ${datos.cliente.nombre}` : "Sí, aprobar y seguir con el plan"}</button>
                        <button type="button" onClick={() => setValidando("quieto")} className="min-h-11 rounded-lg border border-white/10 px-4 py-2 text-[14px] text-zinc-300 hover:bg-white/[0.05]">Cancelar</button>
                      </>
                    )}
                  </div>
                )}
                {/* pedir cambios al manual entero (como el plan); la puerta es `manual-cambios`: data-tablero-accion="manual-cambios" */}
                <PedirCambiosAlManual clienteNombre={datos?.cliente?.nombre ?? null} ciclo={ciclo} validadosDelManual={validadosDe(APARTADOS_DEL_MANUAL.flatMap((a) => a.claves))} pedirEn={pedirEn}
                  libre={libre} onLibre={(t) => { setLibre(t); setGuardadoOk(false) }} onReintentar={(t) => void reintentar(t)} reintentando={guardando} />
                <p className="mt-2 text-[11.5px] text-zinc-500">{m.actualizado_en ? `Última actualización ${fechaCortaEC(m.actualizado_en)}` : ""}{m.creado_en ? ` · creado ${fechaCortaEC(m.creado_en)}` : ""}</p>
              </section>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
                <div className="min-w-0 space-y-5">
                  {revisionesSueltas.length > 0 && (
                    <section data-revisiones-sueltas aria-label="Revisiones del editor" className="rounded-lg border border-amber-400/30 bg-white/[0.02] p-4">
                      <h3 className="text-[12px] font-medium uppercase tracking-[0.18em] text-amber-200">Revisiones del editor</h3>
                      {revisionesSueltas.map((r) => <TarjetaDeRevisionDelEditor key={r.id} r={r} accion={accion} onHecho={revisionHecha} />)}
                    </section>
                  )}
                  {APARTADOS_DEL_MANUAL.map((ap, i) => {
                    // un campo opcional vacío el lector no lo muestra; si se puede editar desde aquí, se muestra vacío con su botón (si no, no habría cómo escribirlo)
                    const vacio = (k: string): CampoLeido | null => { const d = CAMPOS_DEL_LECTOR.find((x) => x.clave === k); return d && esEditableDesdeElTablero(k) ? { clave: k, etiqueta: d.etiqueta, valor: null, estado: "hueco", nota: null, explicacion: null, origen: null } : null }
                    const lista = ap.claves.map((k) => campos.get(k) ?? vacio(k)).filter((c): c is CampoLeido => !!c)
                    if (!lista.length) return null
                    return (
                      <section key={ap.titulo} id={`apartado-${ap.titulo}`} aria-label={ap.titulo} className="mn-seccion scroll-mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6" style={{ animationDelay: `${60 + i * 60}ms` }}>
                        <h3 className={`mb-4 ${TITULO_1}`}>{ap.titulo}</h3>
                        <div className="space-y-4">{lista.map((c) => <Campo key={c.clave} c={c} opciones={c.clave === "eslogan" ? m.opciones_eslogan : []} pendiente={cambios[c.clave]} editando={editando === c.clave} onEditar={setEditando} onCambio={cambiar}
                          nota={notas[c.clave]} observando={observando === c.clave} onObservar={puedeObservar ? setObservando : null} onNota={anotar} />)}</div>
                        <BotonDeSeccion titulo={ap.titulo} claves={ap.claves} />
                        {revisionesDe(ap.claves).map((r) => <TarjetaDeRevisionDelEditor key={r.id} r={r} accion={accion} onHecho={revisionHecha} />)}
                      </section>
                    )
                  })}

                  {/* las secciones nuevas del manual (ADENDA 1): aparecen solas cuando el manual las trae */}
                  <SeccionesNuevas secciones={m.secciones_nuevas ?? []} extra={(sn) => revisionesDe(sn.partes.map((p) => p.clave)).map((r) => <TarjetaDeRevisionDelEditor key={r.id} r={r} accion={accion} onHecho={revisionHecha} />)} pedirCambios={puedePedirEnSeccion ? pedirEnSeccion : null}
                    pendiente={(p) => cambios[p.clave]} editando={editando}
                    acciones={(p) => (<>{cambios[p.clave] !== undefined && <SinGuardar />}{editando !== p.clave && <span className="ml-auto flex gap-1.5">{esEditableDesdeElTablero(p.clave) && <BotonEditar clave={p.clave} etiqueta={p.etiqueta} onClick={() => setEditando(p.clave)} />}</span>}</>)}
                    onRetirar={(p, lineas) => cambiar(p.clave, juntarLista(lineas), "retirar")}
                    onEditarRenglon={(p, lineas, renglon) => cambiar(p.clave, juntarLista(lineas), "editar", detalleDelRenglon(renglon - 1))}
                    especial={(p) => p.clave === "jerarquia_tipografica" && puedeMoverNiveles(cambios[p.clave] ?? p.para_editar) ? <JerarquiaTipografica texto={cambios[p.clave] ?? p.para_editar} onCambiar={(t) => cambiar(p.clave, t)} /> : null}
                    editor={(p) => editando === p.clave ? <Editor clave={p.clave} valor={cambios[p.clave] ?? p.para_editar} onCancelar={() => setEditando(null)} onListo={(t) => cambiar(p.clave, t)} /> : (observando === p.clave || notas[p.clave]) ? <NotaDelCampo key={`${p.clave}-${observando === p.clave}`} clave={p.clave} etiqueta={p.etiqueta} nota={notas[p.clave]} abierta={observando === p.clave} onListo={(t) => { anotar(p.clave, t); setObservando(null) }} onCerrar={() => setObservando(null)} /> : null} />

                  {(m.palabras_prohibidas.length > 0 || (m.palabras ?? []).length > 0 || m.terminos_propios.length > 0 || m.politica_competidores || !!cliente) && (
                    <section id="apartado-Palabras" aria-label="Palabras" className="mn-seccion scroll-mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6" style={{ animationDelay: "240ms" }}>
                      <h3 className={`mb-4 ${TITULO_1}`}>Palabras</h3>
                      {m.terminos_propios.length > 0 && (
                        <div className="mb-3"><h4 className={`mb-2 ${TITULO_2}`}>Términos propios</h4>
                          <ul className="flex flex-wrap gap-1.5">{m.terminos_propios.map((t) => <li key={t} className="rounded-md border border-emerald-400/25 bg-emerald-400/[0.06] px-2 py-0.5 text-[12px] text-emerald-100">{t}</li>)}</ul></div>
                      )}
                      {/* CC6 · tablero del dueño: cada palabra con su intención y lo que el dueño decide sobre ella (antes: la lista plana de «prohibidas») */}
                      <PalabrasDelManual palabras={m.palabras ?? m.palabras_prohibidas.map((t) => ({ texto: t, intencion: "estilo" as const, porque: null, cita: null, origen: null, fecha: null, por: null }))} cliente={cliente} accion={accion} onGuardado={guardado} />
                      {m.politica_competidores && <p className="text-[12.5px] text-zinc-300"><span className="text-zinc-500">Competencia · </span>{m.politica_competidores}</p>}
                      <BotonDeSeccion titulo="Palabras" claves={[]} />
                    </section>
                  )}
                </div>

                {/* la identidad visual: colores y letras con su procedencia */}
                {/* la barra lateral (boceto aprobado por Emilio, 02-nov): fija al bajar, lo esencial del manual con datos reales */}
                <BarraDelManual m={m} nombre={datos.cliente?.nombre ?? null} campos={campos} delDueno={esDelDueno} faltan={faltan} huecos={huecos} irA={irAEscribir} />
              </div>
            </>
          )}
        </div>
        {datos && m && (
          <footer data-guardar-cambios className="border-t border-white/10 bg-[#141414] px-4 py-3 sm:px-6">
            {renglones.length > 0 && (
              <div data-tus-cambios className="mb-2">
                <p className="text-[12px] uppercase tracking-[0.08em] text-zinc-500">Tus cambios · {renglones.length}</p>
                <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto pr-14 sm:pr-0">{renglones.map((x) => (
                  <li key={x.id} data-renglon={x.id} className="flex items-center gap-2 text-[13.5px] text-zinc-200">
                    <span className="min-w-0 flex-1 truncate">{x.texto}</span>
                    <button type="button" data-accion="quitar-cambio" aria-label={`Quitar: ${x.texto}`} disabled={guardando} onClick={() => { ponerTus(quitarDeTusCambios(tus, x.id)); setGuardadoOk(false) }}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-rose-200">✕</button>
                  </li>
                ))}</ul>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" data-accion="guardar-cambios" data-tablero-accion="manual-campos" disabled={!nCambios || guardando || !cliente} onClick={() => void guardarCambios()}
                className="min-h-11 rounded-lg border border-amber-400/70 bg-amber-400/15 px-5 py-2.5 text-[15px] font-medium text-amber-50 transition hover:bg-amber-400/25 disabled:border-amber-400/25 disabled:bg-amber-400/[0.04] disabled:text-amber-200/40">
                {guardando ? "Enviando…" : "Pedir los cambios"}
              </button>
              {nCambios > 0 && !guardando && <button type="button" data-accion="descartar-cambios" onClick={descartarTodo} className="min-h-11 text-[13px] text-zinc-400 underline decoration-dotted underline-offset-4 hover:text-zinc-200">Descartar todo</button>}
              {guardadoOk && !nCambios && <span role="status" data-cambios-guardados className="text-[15px] font-medium text-emerald-300">✓ Cambios pedidos</span>}
              {/* 04-nov (Lenovo · reserva de CC3 a #260): si el guardado del borrador falla mientras Emilio escribe, se ve EN EL MOMENTO, con «Reintentar» */}
              {nCambios > 0 && noSePudoGuardar && (
                <span role="alert" data-borrador-no-guardado className="ml-auto flex items-center gap-2 text-[12.5px] text-rose-200">
                  {TEXTO_NO_SE_GUARDO}
                  <button type="button" data-accion="reintentar-borrador" onClick={() => { ultimoGuardado.current = ""; void guardarYa.current() }} className="min-h-11 rounded-md border border-rose-400/50 px-3 text-[12.5px] text-rose-100 hover:bg-rose-500/15">Reintentar</button>
                </span>
              )}
              {nCambios > 0 && !noSePudoGuardar && guardadoDelBorrador && <span data-borrador-guardado className="ml-auto text-[12px] text-zinc-500">{haceCuanto(guardadoDelBorrador.actualizado_en, ahora)}</span>}
            </div>
          </footer>
        )}
      </section>
    </div>
  )
}
