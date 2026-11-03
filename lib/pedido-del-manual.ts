/**
 * UN SOLO PEDIDO DE CAMBIOS AL MANUAL (CC6 · 03-nov · corrección de Lenovo 16:40Z, Emilio en pantalla real).
 * Emilio hace todo en el mismo manual y en el orden que quiera: elegir un eslogan, retirar, editar, dejar una observación en cualquier
 * campo y escribir un texto libre para todo el manual. Cada cosa queda PENDIENTE en «Tus cambios» (quitar una = un toque) y al final
 * UN botón «Pedir los cambios» lo manda junto. Elegir no dispara nada solo.
 *
 * Envío (opción A, sin tocar la plataforma, mientras CC1 decide si la ruta acepta todo en un pedido):
 *   1. lo directo (elegir · retirar · editar) por `manual-campos`, como siempre: sin modelo y sin gasto;
 *   2. solo si hay observaciones o texto libre, `manual-cambios` con un texto armado: «Campo «X»: …» por observación y luego el texto libre.
 * Si falla el 2, lo directo ya quedó guardado y las observaciones siguen pendientes para reintentar. Todo pasa por `enviarTusCambios`.
 */
import { cuerpoDePedirCambiosAlManual, palabrasDelPedidoDelManual } from "@/lib/manual-ciclo"

export type ComoCambio = "elegir" | "retirar" | "editar"
export interface TusCambios {
  /** lo que se escribe directo en el campo («» = retirar el campo entero) */
  campos: Record<string, string>
  /** cómo nació cada cambio directo, para decirlo en la lista */
  como: Record<string, ComoCambio>
  /** una observación de texto por campo (la lee el equipo del manual) */
  notas: Record<string, string>
  /** el texto libre para todo el manual */
  libre: string
}
export const SIN_CAMBIOS: TusCambios = { campos: {}, como: {}, notas: {}, libre: "" }

export interface RenglonDeTusCambios {
  /** para quitarlo: `campo:<clave>` · `nota:<clave>` · `libre` */
  id: string
  texto: string
}

const corto = (v: string, n = 70) => { const t = v.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t }

/** la lista corta de «Tus cambios», en el orden del manual (y el texto libre al final) */
export function renglonesDeTusCambios(c: TusCambios, etiqueta: (clave: string) => string, orden: string[] = []): RenglonDeTusCambios[] {
  const pos = (k: string) => { const i = orden.indexOf(k); return i < 0 ? orden.length : i }
  const porOrden = (a: string, b: string) => pos(a) - pos(b)
  const out: RenglonDeTusCambios[] = []
  for (const k of Object.keys(c.campos).sort(porOrden)) {
    const v = c.campos[k], e = etiqueta(k), como = c.como[k] ?? (v.trim() ? "editar" : "retirar")
    const texto = !v.trim() ? `Retirar «${e}»`
      : como === "elegir" ? `${e}: elegiste «${corto(v)}»`
      : como === "retirar" ? `${e}: retiraste un elemento`
      : `${e}: lo cambiaste`
    out.push({ id: `campo:${k}`, texto })
  }
  for (const k of Object.keys(c.notas).sort(porOrden)) out.push({ id: `nota:${k}`, texto: `${etiqueta(k)}: «${corto(c.notas[k])}»` })
  if (c.libre.trim()) out.push({ id: "libre", texto: `Para todo el manual: «${corto(c.libre)}»` })
  return out
}

/** quitar un renglón (un toque) */
export function quitarDeTusCambios(c: TusCambios, id: string): TusCambios {
  if (id === "libre") return { ...c, libre: "" }
  const [tipo, clave] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)]
  if (tipo === "campo") { const campos = { ...c.campos }, como = { ...c.como }; delete campos[clave]; delete como[clave]; return { ...c, campos, como } }
  if (tipo === "nota") { const notas = { ...c.notas }; delete notas[clave]; return { ...c, notas } }
  return c
}

export const cuantosCambios = (c: TusCambios): number => Object.keys(c.campos).length + Object.keys(c.notas).length + (c.libre.trim() ? 1 : 0)
export const hayObservaciones = (c: TusCambios): boolean => Object.keys(c.notas).length > 0 || !!c.libre.trim()

/** el texto que lee el equipo del manual: una línea por observación de campo y, después, el texto libre */
export function textoDeLasObservaciones(c: TusCambios, etiqueta: (clave: string) => string, orden: string[] = []): string {
  const pos = (k: string) => { const i = orden.indexOf(k); return i < 0 ? orden.length : i }
  const lineas = Object.keys(c.notas).sort((a, b) => pos(a) - pos(b)).map((k) => `Campo «${etiqueta(k)}»: ${c.notas[k].trim()}`)
  if (c.libre.trim()) lineas.push(c.libre.trim())
  return lineas.join("\n\n")
}

type Resultado = { ok: true; texto: string; detalle: Record<string, unknown> } | { ok: false; texto: string; codigo?: string; detalleCrudo?: string }
export type Accion = (nombre: string, cuerpo: Record<string, unknown>) => Promise<Resultado>

export interface ResultadoDelPedido {
  ok: boolean
  texto: string
  /** lo que sigue pendiente (vacío si salió todo) */
  quedan: TusCambios
  /** si se mandó al equipo del manual (reescritura) */
  reescribe: boolean
}

/**
 * «Pedir los cambios»: lo directo primero (sin gasto) y, si hay observaciones, el pedido al equipo del manual.
 * `puedeReescribir` = la plataforma tiene el pedido de cambios y no hay otro en curso; si no, las observaciones no se mandan y se dice.
 */
export async function enviarTusCambios(accion: Accion, cliente: string | null, c: TusCambios, o: { etiqueta: (clave: string) => string; orden?: string[]; puedeReescribir: boolean }): Promise<ResultadoDelPedido> {
  if (!cliente) return { ok: false, texto: "Falta el cliente.", quedan: c, reescribe: false }
  if (!cuantosCambios(c)) return { ok: false, texto: "No hay cambios para pedir.", quedan: c, reescribe: false }
  const obs = hayObservaciones(c)
  if (obs && !o.puedeReescribir) return { ok: false, texto: "Ahora no se pueden mandar observaciones: el manual se está reescribiendo. Espera a que termine.", quedan: c, reescribe: false }
  // las observaciones se validan ANTES de guardar lo directo: si el texto no sirve, no se manda nada
  const texto = obs ? textoDeLasObservaciones(c, o.etiqueta, o.orden) : ""
  const cuerpoObs = obs ? cuerpoDePedirCambiosAlManual(cliente, texto) : null
  if (cuerpoObs && "error" in cuerpoObs) return { ok: false, texto: String(cuerpoObs.error), quedan: c, reescribe: false }

  let quedan = c
  const nDirectos = Object.keys(c.campos).length
  if (nDirectos) {
    const retirar = Object.entries(c.campos).filter(([, v]) => !v.trim()).map(([k]) => k)
    const r = await accion("manual-campos", { client_id: cliente, campos: c.campos, ...(retirar.length ? { retirar } : {}) })
    if (!r.ok) return { ok: false, texto: r.texto, quedan: c, reescribe: false }
    quedan = { ...c, campos: {}, como: {} }
  }
  if (!cuerpoObs) return { ok: true, texto: "✓ Cambios guardados", quedan: SIN_CAMBIOS, reescribe: false }

  const p0 = palabrasDelPedidoDelManual(await accion("manual-cambios", cuerpoObs as Record<string, unknown>))
  // aquí no hay botón «Reintentar»: las observaciones siguen pendientes y se vuelven a pedir con el mismo botón
  const p = { ...p0, texto: p0.texto.replace("Usa «Reintentar».", "Toca «Pedir los cambios» otra vez.") }
  if (!p.ok) return { ok: false, texto: nDirectos ? `Lo que elegiste, retiraste o editaste quedó guardado. Las observaciones no se pudieron mandar: ${p.texto}` : p.texto, quedan, reescribe: false }
  return { ok: true, texto: p.texto, quedan: SIN_CAMBIOS, reescribe: true }
}
