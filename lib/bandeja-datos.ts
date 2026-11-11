/**
 * LA BANDEJA · lectura (servidor, SOLO LECTURA · sprint 6.6): lo que el panel nuevo de Piezas pide de una vez. Reusa la lectura de siempre (`lib/piezas-datos.ts`:
 * las piezas, las otras revisiones, la cuenta de por aprobar) y suma la lista de clientes para filtrar. Un error de la base lanza; nunca se lee como «bandeja vacía».
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { clientesParaElegir } from "@/lib/clientes-datos"
import { contarPiezasPorAprobar, listarEnCurso, listarPiezas, type FilaDeLaLista, type PiezaEnCurso } from "@/lib/piezas-datos"
import type { FiltroDeLaBandeja } from "@/lib/bandeja"

export interface Bandeja {
  estado: FiltroDeLaBandeja
  por_aprobar: number
  piezas: FilaDeLaLista[]
  /** lo que no es pieza (plan con pendientes · lista de competidores · revisión del editor) */
  otras: FilaDeLaLista[]
  /** CC6 · 03-nov: lo archivado de una campaña anterior (todas, decididas o no): la carpeta plegada del final */
  archivo?: FilaDeLaLista[]
  clientes: Array<{ id: string; nombre: string }>
  /** 11-nov · Piezas v2 (arreglo 7): con «Todas», lo que la oficina todavía está haciendo o la jefatura revisa (aún no está en la bandeja). Solo de los clientes de la lista */
  en_curso?: PiezaEnCurso[]
  leido_en: string
}

export async function leerBandeja(supa: SupabaseClient, o: { estado?: FiltroDeLaBandeja; ahora?: Date } = {}): Promise<Bandeja> {
  const estado = o.estado ?? "pendiente"
  const [piezas, otras, archivo, por_aprobar, clientes, enCurso] = await Promise.all([
    listarPiezas(supa, { estado, tipo: "piezas" }),
    listarPiezas(supa, { estado, tipo: "otras" }),
    listarPiezas(supa, { estado: "todas", tipo: "piezas", archivo: "solo", limite: 300 }),
    contarPiezasPorAprobar(supa),
    clientesParaElegir(supa),
    estado === "todas" ? listarEnCurso(supa) : Promise.resolve([] as PiezaEnCurso[]),
  ])
  // los encargos de un cliente de práctica o dado de baja no salen (la lista de clientes ya los deja fuera)
  const deLaLista = new Set(clientes.map((c) => c.id))
  const en_curso = enCurso.filter((e) => e.cliente_id != null && deLaLista.has(e.cliente_id))
  return { estado, por_aprobar, piezas, otras, archivo, clientes, ...(estado === "todas" ? { en_curso } : {}), leido_en: (o.ahora ?? new Date()).toISOString() }
}
