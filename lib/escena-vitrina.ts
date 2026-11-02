/**
 * LA VITRINA · la pantalla vertical de la foto de marketing (CC4 · 02-nov, tarea 2 del encargo del pizarrón de métricas): rota las ~8 piezas con mejores resultados
 * (imagen + métrica principal). Hoy no hay resultados que leer: cada pantalla dice «métricas pronto» y se muestra la última pieza aprobada. La forma del dato con
 * resultados la fija el contrato de CC1 (no se inventa aquí): LA ÚNICA lectura de mejores piezas es `leerMejoresPiezas`.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { listarPiezas } from "@/lib/piezas-datos"
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
}

/** qué se muestra: las mejores piezas (hasta 8) si hay; si no, la última pieza aprobada con «métricas pronto»; si tampoco, la pantalla lo dice */
export function armarVitrina(mejores: PiezaDeLaVitrina[], ultima: { id: string; titulo: string } | null, lectura: LecturaDeMejoresPiezas): VitrinaDeLaEscena {
  if (mejores.length > 0) return { modo: "mejores", piezas: mejores.slice(0, MAXIMO_DE_PIEZAS_EN_LA_VITRINA), lectura: lectura.estado }
  if (ultima) return { modo: "ultima", piezas: [{ id: ultima.id, titulo: ultima.titulo, imagen: null, principal: null, texto: lectura.motivo || TEXTO_SIN_METRICAS }], lectura: lectura.estado }
  return { modo: "vacia", piezas: [], lectura: lectura.estado }
}

/** la última pieza aprobada de la bandeja (el sistema todavía no publica en redes: «publicada» no existe como estado). Solo lectura */
export async function leerLaUltimaPieza(supa: SupabaseClient, cliente: string | null): Promise<{ id: string; titulo: string } | null> {
  const filas = await listarPiezas(supa, { estado: "todas", limite: 60 })
  const f = filas.find((x) => x.estado === "aprobada" && (!cliente || x.cliente_id === cliente))
  return f ? { id: f.id, titulo: f.titulo_legible } : null
}

export async function leerLaVitrina(supa: SupabaseClient, o: { cliente: string | null }): Promise<VitrinaDeLaEscena> {
  const lectura = await leerMejoresPiezas(supa, o)
  return armarVitrina([], await leerLaUltimaPieza(supa, o.cliente), lectura)
}
