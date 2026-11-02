/**
 * PEDIR CAMBIOS AL MANUAL · lógica pura (CC6 · 02-nov · encargo de Lenovo pedido por Emilio: el manual funciona IGUAL que el plan).
 * Contrato de CC1 (PLAN-CC1-pedir-cambios-al-manual-puerta-y-datos): la misma tabla `plan_cambios` con `documento='manual'`, la puerta
 * `POST /api/tablero/manual-cambios` `{ client_id, texto, seccion?, campos?, confirmo_gasto, tope_usd }` y los mismos estados del pedido.
 * El avance usa la MISMA cuenta que el plan (`avanceDelPedido` con documento «manual»). «Qué cambió» se calcula aquí, campo por campo,
 * comparando las dos versiones completas (también lo cambiado FUERA de la sección pedida · CC3). Sin modelo.
 */
import type { AvanceDelPedido } from "@/lib/plan"
import type { CampoLeido } from "@/lib/manual-lector"

/** el tope por pedido (provisional, CC1 02-nov): lo cuida la plataforma; el panel lo manda por código, sin aviso de gasto (Emilio, 01-nov) */
export const TOPE_PEDIR_CAMBIOS_AL_MANUAL_USD = 5

export interface PedidoDelManual {
  id: string
  estado: string
  texto: string
  seccion: string | null
  creado_en: string | null
  actualizado_en: string | null
  despertado: boolean | null
  despertar_detalle: string | null
  manual_id: string | null
  manual_nuevo_id: string | null
}
export interface CicloDelManual {
  /** la tabla de pedidos ya sabe de manuales (migración de CC1 aplicada): sin esto no se ofrece «Pedir cambios» (la puerta daría 404) */
  disponible: boolean
  /** el pedido abierto (pendiente o en reescritura): bloquea un segundo pedido */
  abierto: PedidoDelManual | null
  /** el último pedido, con su avance, mientras tenga sentido mostrarlo */
  avance: AvanceDelPedido | null
  /** lo que cambió entre la versión sobre la que se pidió y la que quedó vigente (si la vigente salió de un pedido) */
  que_cambio: string[]
}
export const CICLO_DEL_MANUAL_CERRADO: CicloDelManual = { disponible: false, abierto: null, avance: null, que_cambio: [] }

export const esPedidoAbierto = (estado: string) => estado === "pendiente" || estado === "en_reescritura"

/** el cuerpo que valida el servidor del tablero (`manual-cambios`): las observaciones, y la sección con sus campos si se pidió sobre una */
export function cuerpoDePedirCambiosAlManual(cliente: string | null, observaciones: string, seccion: { titulo: string; campos: string[] } | null = null): Record<string, unknown> | { error: string } {
  if (!cliente) return { error: "Falta el cliente." }
  const t = observaciones.trim()
  if (t.length < 5) return { error: "Cuenta qué debe cambiar (al menos 5 letras)." }
  if (t.length > 4000) return { error: "Máximo 4.000 caracteres." }
  return { client_id: cliente, texto: t, ...(seccion ? { seccion: seccion.titulo, campos: seccion.campos } : {}), confirmo_gasto: true, tope_usd: TOPE_PEDIR_CAMBIOS_AL_MANUAL_USD }
}

const nombres = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`)
/**
 * La línea de los campos que el dueño validó (regla que recomienda CC1, pendiente de Lenovo · decisión 1): en una sección se liberan sus campos y, si el
 * equipo los cambia, pierden la validación; en una observación general no se tocan, salvo que se nombren. Sin bloqueo: solo se dice.
 */
export function avisoDeLoValidado(validados: string[], enSeccion: boolean): string | null {
  if (!validados.length) return null
  return enSeccion
    ? `Validaste ${nombres(validados)}: si el equipo ${validados.length > 1 ? "cambia esos campos" : "cambia ese campo"}, se pierde tu validación.`
    : `No se toca lo que validaste (${nombres(validados)}), salvo que lo nombres.`
}

const corto = (v: string, n = 90) => (v.length > n ? `${v.slice(0, n - 1).trimEnd()}…` : v)
/** «Qué cambió» campo por campo entre dos versiones completas del manual: lo nuevo, lo quitado y lo reescrito (con el antes y el ahora, cortos) */
export function queCambioEnElManual(antes: CampoLeido[], ahora: CampoLeido[]): string[] {
  const a = new Map(antes.map((c) => [c.clave, c]))
  const lineas: string[] = []
  const vistos = new Set<string>()
  for (const c of ahora) {
    vistos.add(c.clave)
    const viejo = (a.get(c.clave)?.valor ?? "").trim(), nuevo = (c.valor ?? "").trim()
    if (viejo === nuevo) continue
    if (!viejo) lineas.push(`${c.etiqueta}: se escribió «${corto(nuevo)}»`)
    else if (!nuevo) lineas.push(`${c.etiqueta}: se quitó (decía «${corto(viejo, 60)}»)`)
    else lineas.push(`${c.etiqueta}: «${corto(viejo, 60)}» → «${corto(nuevo)}»`)
  }
  for (const c of antes) if (!vistos.has(c.clave) && (c.valor ?? "").trim()) lineas.push(`${c.etiqueta}: se quitó (decía «${corto(String(c.valor), 60)}»)`)
  return lineas
}

/** el rótulo arriba del manual mientras el equipo lo reescribe: solo con el pedido abierto, sin fallo y sin pasarse de la hora y media (CC3: se apaga si falla o vence) */
export function rotuloMientrasSeReescribe(ciclo: Pick<CicloDelManual, "abierto" | "avance">): string | null {
  if (!ciclo.abierto || !ciclo.avance || ciclo.avance.fallo || ciclo.avance.listo) return null
  if (ciclo.avance.minutos != null && ciclo.avance.minutos > 90) return null
  return "El equipo está reescribiendo el manual con tus observaciones. Mientras tanto ves la versión vigente."
}

/** lo que se le dice a Emilio después de enviar el pedido (el detalle es lo que respondió la plataforma) */
export function palabrasDelPedidoDelManual(r: { ok: true; detalle: Record<string, unknown> } | { ok: false; texto: string }): { ok: boolean; texto: string } {
  if (!r.ok) {
    if (/reescritura_en_curso/.test(r.texto)) return { ok: false, texto: "Ya hay un pedido de cambios en curso: espera la versión nueva." }
    if (/sin_manual/.test(r.texto)) return { ok: false, texto: "Este cliente todavía no tiene manual: no hay sobre qué pedir cambios." }
    return { ok: false, texto: r.texto }
  }
  if (r.detalle.despertado === false) return { ok: false, texto: "Tu pedido quedó guardado, pero no se pudo avisar al equipo del manual. Usa «Reintentar»." }
  return { ok: true, texto: "Pedido enviado: el equipo del manual reescribe el manual con tus observaciones." }
}
