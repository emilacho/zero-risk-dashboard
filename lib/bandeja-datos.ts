/**
 * LA BANDEJA · lectura (servidor, SOLO LECTURA · sprint 6.6): lo que el panel nuevo de Piezas pide de una vez. Reusa la lectura de siempre (`lib/piezas-datos.ts`:
 * las piezas, las otras revisiones, la cuenta de por aprobar) y suma la lista de clientes para filtrar. Un error de la base lanza; nunca se lee como «bandeja vacía».
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { clientesParaElegir } from "@/lib/clientes-datos"
import { contarPiezasPorAprobar, listarEnCurso, listarPiezas, type FilaDeLaLista, type PiezaEnCurso } from "@/lib/piezas-datos"
import type { FiltroDeLaBandeja } from "@/lib/bandeja"
import { loDeLaCampana } from "@/lib/campana-datos"

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
  /** 19-nov · la campaña con la que se filtró (null = todas, como siempre) */
  campana?: string | null
  leido_en: string
}

export async function leerBandeja(supa: SupabaseClient, o: { estado?: FiltroDeLaBandeja; ahora?: Date; /** 19-nov · varias campañas: la campaña elegida en el Centro (sus piezas, su archivo y lo que está en curso) */ campana?: string | null } = {}): Promise<Bandeja> {
  const estado = o.estado ?? "pendiente"
  // 19-nov · con campaña: solo sus encargos · una campaña que no existe deja la bandeja de piezas vacía (nunca la de otra campaña)
  const lo = o.campana ? await loDeLaCampana(supa, o.campana) : null
  const encargos = o.campana ? lo?.encargos ?? [] : undefined
  const [piezas, otras, archivo, por_aprobar, clientes, enCurso] = await Promise.all([
    listarPiezas(supa, { estado, tipo: "piezas", encargos }),
    listarPiezas(supa, { estado, tipo: "otras" }),
    listarPiezas(supa, { estado: "todas", tipo: "piezas", archivo: "solo", limite: 300, encargos }),
    contarPiezasPorAprobar(supa),
    clientesParaElegir(supa),
    // 19-nov (Piezas parte B · A): también en «Por aprobar», pero ahí solo las que esperan tu decisión (sus propuestas están en «Propuestas»)
    listarEnCurso(supa),
  ])
  // los encargos de un cliente de práctica o dado de baja no salen (la lista de clientes ya los deja fuera)
  const deLaLista = new Set(clientes.map((c) => c.id))
  // unión de #361 (CC4 · con «Por aprobar» solo lo que espera tu decisión) y #359 (CC1 · solo los encargos de la campaña elegida)
  const deLaCampana = encargos ? new Set(encargos) : null
  const en_curso = enCurso.filter((e) => e.cliente_id != null && deLaLista.has(e.cliente_id) && (estado === "todas" || e.espera_al_dueno === true) && (!deLaCampana || deLaCampana.has(e.encargo_id)))
  return { estado, por_aprobar, piezas, otras, archivo, clientes, en_curso, ...(o.campana ? { campana: o.campana } : {}), leido_en: (o.ahora ?? new Date()).toISOString() }
}
