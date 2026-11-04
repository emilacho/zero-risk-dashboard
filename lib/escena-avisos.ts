/**
 * LOS AVISOS DE FIRMA EN EL PIZARRÓN (CC6 · 04-nov · encargo de Lenovo, Emilio 11:29Z): el PRIMER recuadro del pizarrón (arriba a la izquierda) queda para
 * lo que espera la firma de Emilio. Pieza general: hoy solo el manual; mañana el plan o las piezas usan la misma forma.
 * Manual listo = la versión VIGENTE del manual del cliente elegido no está aprobada por el dueño y no hay una reescritura en curso
 * (`esperas_del_dueno` está vacía hoy: la señal real es la aprobación del manual vigente, la misma regla de «manual primero»).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { manualAprobadoPorCliente } from "@/lib/manual-primero"
import { esPedidoAbierto } from "@/lib/manual-ciclo"

export interface AvisoDeFirma {
  /** qué espera la firma (hoy solo «manual») */
  clave: "manual"
  /** lo que dice el recuadro */
  texto: string
  /** qué abre al tocarlo: la aplicación del Centro de campaña */
  abre: "manual"
}

export const TEXTO_MANUAL_LISTO = "Manual listo · revísalo"

/** ¿el manual espera la firma? Sin saber (null) no se avisa: no se titila por un error */
export function avisoDelManual(o: { aprobado: boolean | null; reescribiendo: boolean }): AvisoDeFirma | null {
  return o.aprobado === false && !o.reescribiendo ? { clave: "manual", texto: TEXTO_MANUAL_LISTO, abre: "manual" } : null
}

/** solo lectura: la aprobación del manual vigente y el último pedido de cambios del manual del cliente */
export async function leerAvisosDeFirma(supa: SupabaseClient, cliente: string | null): Promise<AvisoDeFirma[]> {
  if (!cliente) return []
  const aprobado = (await manualAprobadoPorCliente(supa, [cliente])).get(cliente) ?? null
  if (aprobado !== false) return []
  const pc = await supa.from("plan_cambios").select("estado").eq("documento", "manual").eq("client_id", cliente).order("creado_en", { ascending: false }).limit(1).maybeSingle()
  if (pc.error) return [] // sin saber si se reescribe, no se avisa
  const aviso = avisoDelManual({ aprobado, reescribiendo: !!pc.data && esPedidoAbierto(String((pc.data as { estado?: unknown }).estado ?? "")) })
  return aviso ? [aviso] : []
}
