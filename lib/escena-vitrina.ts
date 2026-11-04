/**
 * LA VITRINA · la pantalla vertical de la foto de marketing (CC4 · 02-nov, tarea 2 del encargo del pizarrón de métricas): rota las ~8 piezas con mejores resultados
 * (imagen + métrica principal). Hoy no hay resultados que leer: cada pantalla dice «métricas pronto» y se muestra la última pieza aprobada. La forma del dato con
 * resultados la fija el contrato de CC1 (no se inventa aquí): LA ÚNICA lectura de mejores piezas es `leerMejoresPiezas`.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { listarPiezas } from "@/lib/piezas-datos"
import { esPiezaAprobada } from "@/lib/piezas"
import { TEXTO_SIN_METRICAS } from "@/lib/escena-metricas"

export const MAXIMO_DE_PIEZAS_EN_LA_VITRINA = 8
/** cuánto dura cada pieza en la pantalla */
export const ROTACION_DE_LA_VITRINA_MS = 4000
/** las 4 esquinas de la cara de la pantalla vertical sobre la foto `marketing-2560` (medidas sobre la foto: arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda) */
export const PANTALLA_VERTICAL = [{ x: 1692, y: 518 }, { x: 1733, y: 539 }, { x: 1732, y: 648 }, { x: 1691, y: 625 }]

export type LecturaDeMejoresPiezas = { estado: "sin_datos"; motivo: string }

/** LA ÚNICA FUNCIÓN DE LECTURA DE «MEJORES PIEZAS». Hoy no hay tabla de resultados conectada: devuelve «sin datos». Cuando llegue el contrato de CC1 se conecta aquí y en ningún otro lado. */
export async function leerMejoresPiezas(_supa: SupabaseClient | null, _o: { cliente: string | null }): Promise<LecturaDeMejoresPiezas> {
  return { estado: "sin_datos", motivo: TEXTO_SIN_METRICAS }
}

export interface PiezaDeLaVitrina {
  id: string
  titulo: string
  /** la imagen de la pieza: hoy no se lee (la oficina la guarda firmada); null = sin imagen */
  imagen: string | null
  /** la métrica principal: hoy nunca hay (null) */
  principal: string | null
  texto: string
}
export interface VitrinaDeLaEscena {
  /** `ultima` = no hay resultados: se muestra la última pieza aprobada; `vacia` = ni eso */
  modo: "mejores" | "ultima" | "vacia"
  piezas: PiezaDeLaVitrina[]
  lectura: LecturaDeMejoresPiezas["estado"]
  /** el cliente elegido en la escena (para decir «Náufrago aún sin piezas aprobadas») */
  cliente?: string | null
  /** las piezas aprobadas de OTROS clientes: la Vitrina filtra por el cliente elegido y lo dice (Lenovo 22:06Z) */
  otros_clientes?: { cuantos: number; piezas: Array<{ id: string; titulo: string; cliente: string | null }> }
}

/** el texto de la Vitrina sin piezas del cliente: si hay aprobadas de otros clientes, se dice cuántas (y la Vitrina ofrece verlas) */
export function textoDeLaVitrinaVacia(v: Pick<VitrinaDeLaEscena, "cliente" | "otros_clientes"> | undefined): string {
  const n = v?.otros_clientes?.cuantos ?? 0
  if (n > 0) return `${v?.cliente ?? "Este cliente"} aún sin piezas aprobadas · ${n} de ${n === 1 ? "otro cliente" : "otros clientes"}`
  return v?.cliente ? `${v.cliente} aún sin piezas aprobadas. Aparecerán aquí cuando se aprueben.` : "Todavía no hay piezas aprobadas. Aparecerán aquí cuando se aprueben."
}

/** qué se muestra: las mejores piezas (hasta 8) si hay; si no, la última pieza aprobada con «métricas pronto»; si tampoco, la pantalla lo dice */
export function armarVitrina(mejores: PiezaDeLaVitrina[], ultima: { id: string; titulo: string } | null, lectura: LecturaDeMejoresPiezas): VitrinaDeLaEscena {
  if (mejores.length > 0) return { modo: "mejores", piezas: mejores.slice(0, MAXIMO_DE_PIEZAS_EN_LA_VITRINA), lectura: lectura.estado }
  if (ultima) return { modo: "ultima", piezas: [{ id: ultima.id, titulo: ultima.titulo, imagen: null, principal: null, texto: lectura.motivo || TEXTO_SIN_METRICAS }], lectura: lectura.estado }
  return { modo: "vacia", piezas: [], lectura: lectura.estado }
}

/** las piezas aprobadas de la bandeja (la misma definición que Dinero: `esPiezaAprobada`), separadas en las del cliente y las de otros. Solo lectura */
export async function leerLasAprobadas(supa: SupabaseClient, cliente: string | null): Promise<{ ultima: { id: string; titulo: string } | null; otras: Array<{ id: string; titulo: string; cliente: string | null }> }> {
  const filas = (await listarPiezas(supa, { estado: "aprobada", limite: 500 })).filter((x) => esPiezaAprobada(x.status))
  const propias = filas.filter((x) => !cliente || x.cliente_id === cliente)
  const otras = cliente ? filas.filter((x) => x.cliente_id !== cliente) : []
  return { ultima: propias[0] ? { id: propias[0].id, titulo: propias[0].titulo_legible } : null, otras: otras.map((x) => ({ id: x.id, titulo: x.titulo_legible, cliente: x.cliente })) }
}

/** la última pieza aprobada del cliente (el sistema todavía no publica en redes: «publicada» no existe como estado). Solo lectura */
export async function leerLaUltimaPieza(supa: SupabaseClient, cliente: string | null): Promise<{ id: string; titulo: string } | null> {
  return (await leerLasAprobadas(supa, cliente)).ultima
}

export async function leerLaVitrina(supa: SupabaseClient, o: { cliente: string | null; nombre?: string | null }): Promise<VitrinaDeLaEscena> {
  const lectura = await leerMejoresPiezas(supa, o)
  const { ultima, otras } = await leerLasAprobadas(supa, o.cliente)
  return { ...armarVitrina([], ultima, lectura), cliente: o.nombre ?? null, otros_clientes: { cuantos: otras.length, piezas: otras.slice(0, MAXIMO_DE_PIEZAS_EN_LA_VITRINA) } }
}
