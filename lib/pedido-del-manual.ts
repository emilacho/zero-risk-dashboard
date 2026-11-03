/**
 * UN SOLO PEDIDO DE CAMBIOS AL MANUAL (CC6 · 03-nov · corrección de Lenovo 16:40Z, Emilio en pantalla real).
 * Emilio hace todo en el mismo manual y en el orden que quiera: elegir un eslogan, retirar, editar, dejar una observación en cualquier
 * campo y escribir un texto libre para todo el manual. Cada cosa queda PENDIENTE en «Tus cambios» (quitar una = un toque) y al final
 * UN botón «Pedir los cambios» lo manda junto. Elegir no dispara nada solo.
 *
 * Envío (opción B de Lenovo, contrato CC1 #869): UNA llamada a `manual-cambios` con lo directo (`campos` · `retirar[]`), las observaciones
 * por campo (`observaciones_por_campo[]`) y el texto libre (`texto`). La plataforma aplica lo directo primero (sin gasto) y reescribe sobre esa
 * versión solo si hay observaciones o texto. Si la reescritura falla después de aplicar lo directo, lo directo queda y se dice; las observaciones
 * siguen pendientes y el reintento manda SOLO esas (reenviar lo directo crearía otra versión con lo mismo). Todo pasa por `enviarTusCambios`.
 */
import { palabrasDelPedidoDelManual, TOPE_PEDIR_CAMBIOS_AL_MANUAL_USD } from "@/lib/manual-ciclo"

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
  /** CC2 · 03-nov: qué renglón se editó («editaste el renglón 2»); solo cuando fue UNA edición de renglón en ese campo */
  detalle?: Record<string, string>
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
      : c.detalle?.[k] ? `${e}: ${c.detalle[k]}`
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
  if (tipo === "campo") { const campos = { ...c.campos }, como = { ...c.como }, detalle = { ...(c.detalle ?? {}) }; delete campos[clave]; delete como[clave]; delete detalle[clave]; return { ...c, campos, como, detalle } }
  if (tipo === "nota") { const notas = { ...c.notas }; delete notas[clave]; return { ...c, notas } }
  return c
}

export const cuantosCambios = (c: TusCambios): number => Object.keys(c.campos).length + Object.keys(c.notas).length + (c.libre.trim() ? 1 : 0)
export const hayObservaciones = (c: TusCambios): boolean => Object.keys(c.notas).length > 0 || !!c.libre.trim()

type Resultado = { ok: true; texto: string; detalle: Record<string, unknown> } | { ok: false; texto: string; codigo?: string; detalleCrudo?: string; directo?: boolean }
export type Accion = (nombre: string, cuerpo: Record<string, unknown>) => Promise<Resultado>

export interface ResultadoDelPedido {
  ok: boolean
  texto: string
  /** lo que sigue pendiente (vacío si salió todo) */
  quedan: TusCambios
  /** si se mandó al equipo del manual (reescritura) */
  reescribe: boolean
}

/** el tope de lo que el dueño escribe en un pedido (texto libre + observaciones): el de la plataforma (CC1 #869 · Lenovo 16:57Z) */
export const TOPE_DE_LO_ESCRITO = 100_000

/** el cuerpo del pedido único (contrato CC1 #869); el gasto se confirma solo si hay algo que reescribir */
export function cuerpoDelPedidoUnico(cliente: string, c: TusCambios): Record<string, unknown> {
  // un campo va en UN solo lugar (CC3 🔴 17:15Z: #869 rechaza «viene dos veces»): con valor, en `campos`; retirado, solo en `retirar`
  const conValor = Object.fromEntries(Object.entries(c.campos).filter(([, v]) => v.trim()))
  const directos = Object.keys(conValor).length > 0
  const retirar = Object.entries(c.campos).filter(([, v]) => !v.trim()).map(([k]) => k)
  const observaciones = Object.entries(c.notas).filter(([, t]) => t.trim()).map(([campo, t]) => ({ campo, texto: t.trim() }))
  const reescribe = hayObservaciones(c)
  return {
    client_id: cliente,
    ...(directos ? { campos: conValor } : {}),
    ...(retirar.length ? { retirar } : {}),
    ...(observaciones.length ? { observaciones_por_campo: observaciones } : {}),
    ...(c.libre.trim() ? { texto: c.libre.trim() } : {}),
    ...(reescribe ? { confirmo_gasto: true, tope_usd: TOPE_PEDIR_CAMBIOS_AL_MANUAL_USD } : {}),
  }
}

const SOLO_OBSERVACIONES = (c: TusCambios): TusCambios => ({ ...c, campos: {}, como: {} })
const DIRECTO_QUEDO = "Lo que elegiste, retiraste o editaste quedó guardado; falta pedir las observaciones"

/**
 * «Pedir los cambios»: UNA llamada con todo (opción B). Lee las tres salidas del contrato de CC1:
 *   · 200 con `despertado: false` → lo directo quedó; las observaciones siguen pendientes (si no se mira, el panel diría «listo»);
 *   · error con `directo` → igual: lo directo quedó, solo las observaciones siguen pendientes;
 *   · error sin `directo` → nada se guardó: todo sigue pendiente.
 * `puedeReescribir` = la plataforma tiene el pedido de cambios y no hay otro en curso; si no, las observaciones no se mandan y se dice.
 */
export async function enviarTusCambios(accion: Accion, cliente: string | null, c: TusCambios, o: { puedeReescribir: boolean; etiqueta?: (clave: string) => string }): Promise<ResultadoDelPedido> {
  if (!cliente) return { ok: false, texto: "Falta el cliente.", quedan: c, reescribe: false }
  if (!cuantosCambios(c)) return { ok: false, texto: "No hay cambios para pedir.", quedan: c, reescribe: false }
  const obs = hayObservaciones(c)
  if (obs && !o.puedeReescribir) return { ok: false, texto: "Ahora no se pueden mandar observaciones: el manual se está reescribiendo. Espera a que termine.", quedan: c, reescribe: false }
  // lo que la plataforma rechazaría se dice aquí, sin llamar (no queda nada a medias)
  const escrito = c.libre.trim().length + Object.values(c.notas).reduce((n, t) => n + t.trim().length, 0)
  if (escrito > TOPE_DE_LO_ESCRITO) return { ok: false, texto: `Lo que escribiste pasa de ${TOPE_DE_LO_ESCRITO.toLocaleString("es-EC")} caracteres.`, quedan: c, reescribe: false }
  if (obs && !Object.keys(c.notas).length && c.libre.trim().length < 5) return { ok: false, texto: "Cuenta qué debe cambiar (al menos 5 letras).", quedan: c, reescribe: false }

  // #869 rechaza retirar un campo y dejarle una observación en el mismo pedido («deja una de las dos»): se dice antes, sin llamar
  const choca = Object.keys(c.notas).find((k) => c.campos[k] !== undefined && !c.campos[k].trim())
  if (choca) return { ok: false, texto: `«${o.etiqueta ? o.etiqueta(choca) : choca}» está para retirar y tiene una observación: quita una de las dos en «Tus cambios».`, quedan: c, reescribe: false }
  const directos = Object.keys(c.campos).length > 0
  const r = await accion("manual-cambios", cuerpoDelPedidoUnico(cliente, c))
  if (!r.ok) {
    const p = palabrasDelPedidoDelManual(r)
    if (r.directo && directos) return { ok: false, texto: `${DIRECTO_QUEDO}: ${p.texto}`, quedan: SOLO_OBSERVACIONES(c), reescribe: false }
    return { ok: false, texto: p.texto, quedan: c, reescribe: false }
  }
  if (!obs) return { ok: true, texto: "✓ Cambios guardados", quedan: SIN_CAMBIOS, reescribe: false }
  if (r.detalle.despertado === false) {
    const motivo = "el equipo del manual no recibió el aviso. Toca «Pedir los cambios» otra vez."
    return { ok: false, texto: directos ? `${DIRECTO_QUEDO}: ${motivo}` : `Tu pedido quedó guardado, pero ${motivo}`, quedan: SOLO_OBSERVACIONES(c), reescribe: false }
  }
  return { ok: true, texto: "Pedido enviado: el equipo del manual reescribe el manual con tus observaciones.", quedan: SIN_CAMBIOS, reescribe: true }
}
