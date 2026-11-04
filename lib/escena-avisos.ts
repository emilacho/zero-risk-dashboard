/**
 * LOS AVISOS DE FIRMA EN EL PIZARRÓN (CC6 · 04-nov · encargo de Lenovo, Emilio 11:29Z y 14:05Z): los primeros recuadros del pizarrón, arriba a la izquierda
 * y en este orden fijo, son para lo que espera la firma de Emilio: MANUAL · PLAN · PIEZAS. Cada uno titila (sin texto fijo; nombre en aria-label y al pasar
 * el cursor) SOLO cuando hay algo de eso esperando, y al tocarlo abre su panel. Pieza general: lo que se sume después usa la misma forma.
 * - Manual: la versión VIGENTE del manual del cliente no está aprobada por el dueño y no hay una reescritura en curso (regla de «manual primero»;
 *   `esperas_del_dueno` está vacía hoy).
 * - Plan: una revisión pendiente de la bandeja con `documento = 'plan'` del cliente, y el manual ya aprobado (mientras el manual no, el plan no espera la firma).
 * - Piezas: una pieza de la oficina creativa pendiente en la bandeja del cliente (no archivada).
 * Solo lectura; una lectura que falla no titila (no se avisa por un error).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { esperaLaFirma, manualAprobadoPorCliente } from "@/lib/manual-primero"
import { esPedidoAbierto } from "@/lib/manual-ciclo"
import { TIPO_PIEZA } from "@/lib/piezas"

export type ClaveDeAviso = "manual" | "plan" | "piezas"
export interface AvisoDeFirma {
  /** qué espera la firma */
  clave: ClaveDeAviso
  /** su nombre (aria-label y globo al pasar el cursor) */
  texto: string
  /** qué abre al tocarlo: una aplicación del Centro de campaña o el panel de Piezas */
  abre: ClaveDeAviso
}

/** el orden fijo de los recuadros del pizarrón (arriba a la izquierda, de arriba abajo) */
export const ORDEN_DE_LOS_AVISOS: readonly ClaveDeAviso[] = ["manual", "plan", "piezas"]
export const TEXTO_MANUAL_LISTO = "Manual listo · revísalo"
export const TEXTO_DEL_AVISO: Record<ClaveDeAviso, string> = { manual: TEXTO_MANUAL_LISTO, plan: "Plan listo · revísalo", piezas: "Piezas por aprobar · revísalas" }
const aviso = (clave: ClaveDeAviso): AvisoDeFirma => ({ clave, texto: TEXTO_DEL_AVISO[clave], abre: clave })

/** ¿el manual espera la firma? Sin saber (null) no se avisa: no se titila por un error */
export function avisoDelManual(o: { aprobado: boolean | null; reescribiendo: boolean }): AvisoDeFirma | null {
  return o.aprobado === false && !o.reescribiendo ? aviso("manual") : null
}

/** plan y piezas desde la bandeja pendiente del cliente (filas ya leídas): el plan solo si el manual no está SIN aprobar */
export function avisosDeLaBandeja(filas: Array<{ type?: unknown; documento?: unknown; client_id?: unknown }>, aprobado: Map<string, boolean | null>): AvisoDeFirma[] {
  const salida: AvisoDeFirma[] = []
  if (filas.some((f) => f.documento === "plan" && esperaLaFirma(f, aprobado))) salida.push(aviso("plan"))
  if (filas.some((f) => f.type === TIPO_PIEZA)) salida.push(aviso("piezas"))
  return salida
}

/** solo lectura: manual (aprobación + reescritura) y la bandeja pendiente del cliente (plan y piezas). Cada parte que falla, calla sola */
export async function leerAvisosDeFirma(supa: SupabaseClient, cliente: string | null): Promise<AvisoDeFirma[]> {
  if (!cliente) return []
  const aprobado = await manualAprobadoPorCliente(supa, [cliente])
  const salida: AvisoDeFirma[] = []
  if (aprobado.get(cliente) === false) {
    const pc = await supa.from("plan_cambios").select("estado").eq("documento", "manual").eq("client_id", cliente).order("creado_en", { ascending: false }).limit(1).maybeSingle()
    if (!pc.error) {
      const m = avisoDelManual({ aprobado: false, reescribiendo: !!pc.data && esPedidoAbierto(String((pc.data as { estado?: unknown }).estado ?? "")) })
      if (m) salida.push(m)
    }
  }
  const b = await supa.from("hitl_queue").select("type, documento, client_id").eq("status", "pending").is("archivada_en", null).eq("client_id", cliente).limit(200)
  if (!b.error) salida.push(...avisosDeLaBandeja((b.data ?? []) as Array<Record<string, unknown>>, aprobado))
  return ORDEN_DE_LOS_AVISOS.flatMap((k) => salida.filter((a) => a.clave === k))
}
