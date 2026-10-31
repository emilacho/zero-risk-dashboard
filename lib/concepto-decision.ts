/**
 * LA TARJETA «GRAN IDEA» · decidir (servidor) · T4. Dos botones: Aprobar / Pedir cambios (nota obligatoria + a qué apunta: el concepto o el brief).
 *  · la decisión la aplica la PLATAFORMA (`POST /api/cadena/concepto {accion: "decidir"}`): cierra la tarjeta, resuelve la espera, abre la versión siguiente si hay cambios;
 *    el tablero no escribe nada en la base;
 *  · entra como decisión HUMANA: `workflow_id = 'tablero'` y un `workflow_execution_id` propio (`tablero:<hitl_id>:<hora>`) que deja rastro; la plataforma solo
 *    acepta ese origen para DECIDIR (no para abrir ni entregar mesas);
 *  · si la pantalla de Emilio estaba vieja (`estado_visto` distinto) o la tarjeta ya no está pendiente, 409 y no se manda nada;
 *  · mientras la plataforma no tenga la ruta (se publica en T9), 501 con esa causa, sin simular nada.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { cargarConcepto, type DetalleDelConcepto } from "@/lib/concepto-datos"

export const NOTA_MINIMA = 10
export const NOTA_MAXIMA = 2000
export const WORKFLOW_DEL_TABLERO = "tablero"

export type ApuntaA = "concepto" | "brief"
export interface PedidoDeDecisionDeConcepto { accion: "aprobar" | "cambios"; nota: string | null; apunta_a: ApuntaA | null; estado_visto: string | null }

export interface DepsDeDecisionDeConcepto {
  supabase: SupabaseClient
  revisor: string
  plataformaUrl?: string
  llave?: string
  fetchImpl?: typeof fetch
  ahora?: () => string
}
export interface RespuestaDeDecision { status: number; cuerpo: Record<string, unknown> }

const sinBarra = (u: string) => u.replace(/\/+$/, "")

/** LA MISMA regla que exige la plataforma: aprobar con nota opcional; cambios con nota (≥ 10 letras) y a qué apunta (concepto | brief) */
export function validarDecisionDeConcepto(raw: unknown): { ok: true; pedido: PedidoDeDecisionDeConcepto } | { ok: false; error: string; detalle: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const accion = r.accion === "aprobar" || r.accion === "cambios" ? r.accion : null
  if (!accion) return { ok: false, error: "accion_invalida", detalle: "la acción debe ser «aprobar» o «cambios»" }
  const nota = typeof r.nota === "string" && r.nota.trim() ? r.nota.trim().slice(0, NOTA_MAXIMA) : null
  const apunta = r.apunta_a === "concepto" || r.apunta_a === "brief" ? r.apunta_a : null
  if (accion === "cambios") {
    if (!nota || nota.length < NOTA_MINIMA) return { ok: false, error: "nota_corta", detalle: `para pedir cambios escribe qué quieres distinto (mínimo ${NOTA_MINIMA} letras)` }
    if (!apunta) return { ok: false, error: "apunta_a_falta", detalle: "di a qué apuntan los cambios: al concepto (otra ronda de la mesa) o al brief (brief nuevo y concepto sobre él)" }
  }
  return { ok: true, pedido: { accion, nota, apunta_a: accion === "cambios" ? apunta : null, estado_visto: typeof r.estado_visto === "string" ? r.estado_visto : null } }
}

function conflicto(d: DetalleDelConcepto, p: PedidoDeDecisionDeConcepto): RespuestaDeDecision | null {
  if (d.status !== "pending") return { status: 409, cuerpo: { ok: false, error: "ya_resuelta", detalle: `la gran idea ya está «${d.estado}»`, estado_actual: d.status } }
  if (p.estado_visto && p.estado_visto !== d.status) return { status: 409, cuerpo: { ok: false, error: "estado_cambio", detalle: "la tarjeta cambió mientras la mirabas: recarga", estado_actual: d.status } }
  if (d.campana_id == null || d.version == null) return { status: 409, cuerpo: { ok: false, error: "tarjeta_sin_destino", detalle: "la tarjeta no dice a qué campaña ni versión apunta: no se puede decidir" } }
  return null
}

export async function decidirConcepto(hitlId: string, raw: unknown, d: DepsDeDecisionDeConcepto): Promise<RespuestaDeDecision> {
  const detalle = await cargarConcepto(d.supabase, hitlId)
  if (!detalle) return { status: 404, cuerpo: { ok: false, error: "no_existe", detalle: "no hay una tarjeta de gran idea con ese id" } }
  const v = validarDecisionDeConcepto(raw)
  if (!v.ok) return { status: 400, cuerpo: { ok: false, error: v.error, detalle: v.detalle } }
  const c = conflicto(detalle, v.pedido)
  if (c) return c

  const base = sinBarra(d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { status: 503, cuerpo: { ok: false, error: "llave_interna_sin_poner", detalle: "el tablero no tiene la llave con la que llama a la plataforma" } }
  const ahora = (d.ahora ?? (() => new Date().toISOString()))()
  const cuerpo = {
    accion: "decidir",
    campana_id: detalle.campana_id,
    version: detalle.version,
    decision: v.pedido.accion,
    nota: v.pedido.nota,
    ...(v.pedido.apunta_a ? { apunta_a: v.pedido.apunta_a } : {}),
    autor: d.revisor,
    workflow_id: WORKFLOW_DEL_TABLERO,
    workflow_execution_id: `${WORKFLOW_DEL_TABLERO}:${hitlId}:${ahora}`,
  }
  try {
    const r = await (d.fetchImpl ?? fetch)(`${base}/api/cadena/concepto`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": llave }, body: JSON.stringify(cuerpo) })
    const txt = await r.text().catch(() => "")
    let j: Record<string, unknown> = {}
    try { j = txt ? (JSON.parse(txt) as Record<string, unknown>) : {} } catch { j = { detalle: txt.slice(0, 400) } }
    // reserva 2 de CC3 (T4): un 404 CON `code: E-CAMPANA` es la cadena diciendo que no conoce la campaña, no una ruta sin publicar
    if (r.status === 404 && String(j.code ?? "") === "E-CAMPANA") return { status: 404, cuerpo: { ok: false, error: "campana_inexistente", detalle: String(j.detalle ?? "la cadena no conoce la campaña de esta tarjeta"), plataforma_status: 404 } }
    if (r.status === 404 || r.status === 405) return { status: 501, cuerpo: { ok: false, error: "cadena_no_publicada", detalle: "la plataforma todavía no tiene la ruta de la gran idea (se publica en T9): no se envió nada" } }
    if (r.status === 409) return { status: 409, cuerpo: { ok: false, error: String(j.error ?? "la_cadena_dijo_que_no"), detalle: String(j.detalle ?? txt.slice(0, 400)), plataforma_status: 409 } }
    if (!r.ok) return { status: 502, cuerpo: { ok: false, error: "la_plataforma_rechazo", plataforma_status: r.status, detalle: String(j.detalle ?? j.error ?? txt.slice(0, 400)) } }
    const siguiente = typeof j.siguiente === "string" ? j.siguiente : null
    return {
      status: 200,
      cuerpo: {
        ok: true,
        accion: v.pedido.accion,
        version: j.version ?? detalle.version,
        ya_decidido: j.ya_decidido === true,
        plataforma_status: r.status,
        nota: v.pedido.accion === "aprobar"
          ? "Gran idea aprobada. La cadena sigue con el calendario de la primera tanda."
          : v.pedido.apunta_a === "brief" ? "Cambios pedidos al brief: se escribe un brief nuevo y, sobre él, otra gran idea." : "Cambios pedidos: la mesa de creativos hace otra ronda con tu nota.",
        ...(siguiente ? { siguiente } : {}),
      },
    }
  } catch (e) {
    return { status: 502, cuerpo: { ok: false, error: "plataforma_sin_respuesta", detalle: e instanceof Error ? e.message : String(e) } }
  }
}
