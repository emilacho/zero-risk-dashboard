/**
 * «ARCHIVAR» Y «ELIMINAR» UNA CAMPAÑA (26-nov · GO de Lenovo 11:57Z · diseño de Emilio) · la parte del tablero.
 *   · las dos opciones aparecen a la derecha del botón «Flujo de la campaña» al dejar el cursor encima (`BotonFlujo.tsx`);
 *   · ARCHIVAR = un clic: la plataforma la archiva en CUALQUIER estado (también la activa), detiene lo que está en curso sin gastar más,
 *     guarda el historial y lo gastado, libera el lugar; se puede deshacer desde el archivo. Motivo fijo: «archivada desde el tablero»;
 *   · ELIMINAR = dos clics en el mismo botón (el primero pide «¿Seguro?»): la plataforma borra la campaña y lo suyo en una sola operación.
 * El tablero no escribe nada en la base: valida, confirma que la campaña existe y manda el pedido a la plataforma con la llave interna.
 * Agnóstico: cualquier cliente, cualquier campaña.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

/** 🔴 CONTRATO con la plataforma (`MOTIVO_DEL_TABLERO` en `src/lib/oficina/archivo-de-campana.ts`) */
export const MOTIVO_DEL_TABLERO = "archivada desde el tablero"
export const ACCIONES_DEL_ARCHIVO = ["archivar", "eliminar"] as const
export type AccionDelArchivo = (typeof ACCIONES_DEL_ARCHIVO)[number]
/** la ruta de la plataforma de cada acción */
export const RUTA_DE_LA_ACCION: Record<AccionDelArchivo, string> = { archivar: "/api/cadena/archivo/archivar", eliminar: "/api/cadena/archivo/eliminar" }

export interface DepsDelArchivo { supabase: SupabaseClient; plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch }
export interface RespuestaDelArchivo { status: number; cuerpo: Record<string, unknown> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const sinBarra = (u: string) => u.replace(/\/+$/, "")

/** el cuerpo que va a la plataforma: SIEMPRE con `dry_run:false` (el clic es la decisión); archivar lleva el motivo fijo */
export function cuerpoDeLaAccion(accion: AccionDelArchivo, campanaId: string): Record<string, unknown> {
  return accion === "archivar" ? { campana_id: campanaId, dry_run: false, motivo: MOTIVO_DEL_TABLERO } : { campana_id: campanaId, dry_run: false }
}

export async function tocarArchivo(raw: unknown, d: DepsDelArchivo): Promise<RespuestaDelArchivo> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const campana = typeof r.campana_id === "string" && UUID.test(r.campana_id) ? r.campana_id : null
  const accion = (ACCIONES_DEL_ARCHIVO as readonly unknown[]).includes(r.accion) ? (r.accion as AccionDelArchivo) : null
  if (!campana || !accion) return { status: 400, cuerpo: { ok: false, error: "pedido_invalido", detalle: "faltan la campaña o la acción (archivar o eliminar)" } }
  const c = await d.supabase.from("cadena_campanas").select("id").eq("id", campana).eq("seco", false).maybeSingle()
  if (c.error) return { status: 502, cuerpo: { ok: false, error: "base_no_responde", detalle: c.error.message } }
  if (!c.data) return { status: 404, cuerpo: { ok: false, error: "no_existe", detalle: "no hay una campaña con ese id" } }

  const base = sinBarra(d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { status: 503, cuerpo: { ok: false, error: "llave_interna_sin_poner", detalle: "el tablero no tiene la llave con la que llama a la plataforma" } }
  try {
    const resp = await (d.fetchImpl ?? fetch)(`${base}${RUTA_DE_LA_ACCION[accion]}`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": llave }, body: JSON.stringify(cuerpoDeLaAccion(accion, campana)) })
    const txt = await resp.text().catch(() => "")
    let j: Record<string, unknown> = {}
    try { j = txt ? (JSON.parse(txt) as Record<string, unknown>) : {} } catch { j = { detalle: txt.slice(0, 400) } }
    // la plataforma todavía sin la ruta (eliminar se publica con su migración): se dice, no se simula
    if (resp.status === 404 && !j.error) return { status: 501, cuerpo: { ok: false, error: "accion_no_publicada", detalle: `la plataforma todavía no tiene «${accion}»` } }
    if (resp.status === 405) return { status: 501, cuerpo: { ok: false, error: "accion_no_publicada", detalle: `la plataforma todavía no tiene «${accion}»` } }
    if (resp.ok && j.ok === true) return { status: 200, cuerpo: { ok: true, accion, ...j } }
    return { status: resp.ok ? 502 : resp.status, cuerpo: { ok: false, accion, ...j } }
  } catch (e) {
    return { status: 502, cuerpo: { ok: false, error: "plataforma_no_responde", detalle: e instanceof Error ? e.message : String(e) } }
  }
}
