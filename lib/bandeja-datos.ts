/**
 * LA BANDEJA · lectura (servidor, SOLO LECTURA · sprint 6.6): lo que el panel nuevo de Piezas pide de una vez. Reusa la lectura de siempre (`lib/piezas-datos.ts`:
 * las piezas, las otras revisiones, la cuenta de por aprobar) y suma la lista de clientes para filtrar. Un error de la base lanza; nunca se lee como «bandeja vacía».
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { clientesParaElegir } from "@/lib/clientes-datos"
import { contarPiezasPorAprobar, listarPiezas, type FilaDeLaLista } from "@/lib/piezas-datos"
import type { FiltroDeLaBandeja } from "@/lib/bandeja"

export interface Bandeja {
  estado: FiltroDeLaBandeja
  por_aprobar: number
  piezas: FilaDeLaLista[]
  /** lo que no es pieza (plan con pendientes · lista de competidores · revisión del editor) */
  otras: FilaDeLaLista[]
  clientes: Array<{ id: string; nombre: string }>
  leido_en: string
}

export async function leerBandeja(supa: SupabaseClient, o: { estado?: FiltroDeLaBandeja; ahora?: Date } = {}): Promise<Bandeja> {
  const estado = o.estado ?? "pendiente"
  const [piezas, otras, por_aprobar, clientes] = await Promise.all([
    listarPiezas(supa, { estado, tipo: "piezas" }),
    listarPiezas(supa, { estado, tipo: "otras" }),
    contarPiezasPorAprobar(supa),
    clientesParaElegir(supa),
  ])
  return { estado, por_aprobar, piezas, otras, clientes, leido_en: (o.ahora ?? new Date()).toISOString() }
}
