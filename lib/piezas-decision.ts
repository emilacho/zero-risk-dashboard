/**
 * LA VENTANA DE PIEZAS · decidir (servidor). Una sola puerta para Aprobar / Pedir cambios / Rechazar:
 *  · solo piezas (`content_piece_review`) y solo si siguen pendientes; si la pantalla de Emilio estaba vieja (`estado_visto` distinto) responde 409 y no toca nada;
 *  · aprobar y rechazar pasan por la plataforma (`resolveHitlApproval` → `PATCH /api/hitl/{id}`): ELLA aplica los efectos. Aprobar NO publica todavía;
 *  · pedir cambios llama a la ruta de la plataforma `POST /api/oficina/cambios` (la construye CC#2); mientras no exista responde 501 con esa causa, sin simular nada.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveHitlApproval, type HitlResolveResult } from "@/lib/hitl-resolve"
import { cargarPieza, type DepsDeLectura, type DetalleDeLaPieza } from "@/lib/piezas-datos"
import { validarDecision, type PedidoDeDecision } from "@/lib/piezas"

export interface DepsDeDecision extends DepsDeLectura {
  supabase: SupabaseClient
  revisor: string
  plataformaUrl?: string
  llave?: string
  resolver?: typeof resolveHitlApproval
}

export interface RespuestaDeDecision { status: number; cuerpo: Record<string, unknown> }

const sinBarra = (u: string) => u.replace(/\/+$/, "")

/** el estado en que Emilio veía la pieza: si ya no es ese, otra decisión se le adelantó */
function conflictoDeEstado(detalle: DetalleDeLaPieza, pedido: PedidoDeDecision): RespuestaDeDecision | null {
  if (detalle.status !== "pending") return { status: 409, cuerpo: { ok: false, error: "ya_resuelta", detalle: `la pieza ya está «${detalle.estado}»`, estado_actual: detalle.status } }
  if (pedido.estado_visto && pedido.estado_visto !== detalle.status) return { status: 409, cuerpo: { ok: false, error: "estado_cambio", detalle: "la pieza cambió mientras la mirabas: recarga", estado_actual: detalle.status } }
  return null
}

export async function pedirCambiosALaPlataforma(id: string, pedido: PedidoDeDecision, d: Pick<DepsDeDecision, "plataformaUrl" | "llave" | "fetchImpl" | "revisor">): Promise<RespuestaDeDecision> {
  const base = sinBarra(d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { status: 503, cuerpo: { ok: false, error: "llave_interna_sin_poner", detalle: "el tablero no tiene la llave con la que llama a la plataforma" } }
  try {
    const r = await (d.fetchImpl ?? fetch)(`${base}/api/oficina/cambios`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": llave },
      body: JSON.stringify({ hitl_id: id, comentario: pedido.comentario, laminas: pedido.laminas ?? [], reviewer: d.revisor }),
    })
    const texto = (await r.text().catch(() => "")).slice(0, 400)
    if (r.status === 404 || r.status === 405) return { status: 501, cuerpo: { ok: false, error: "cambios_no_disponible", detalle: "la plataforma todavía no tiene la ruta «pedir cambios» (la construye CC#2): no se envió nada" } }
    if (!r.ok) return { status: 502, cuerpo: { ok: false, error: "la_plataforma_rechazo", plataforma_status: r.status, detalle: texto } }
    return { status: 200, cuerpo: { ok: true, accion: "cambios", plataforma_status: r.status } }
  } catch (e) {
    return { status: 502, cuerpo: { ok: false, error: "plataforma_sin_respuesta", detalle: e instanceof Error ? e.message : String(e) } }
  }
}

export async function decidirPieza(id: string, raw: unknown, d: DepsDeDecision): Promise<RespuestaDeDecision> {
  const detalle = await cargarPieza(d.supabase, id, d)
  if (!detalle) return { status: 404, cuerpo: { ok: false, error: "no_existe" } }
  if (!detalle.es_pieza) return { status: 400, cuerpo: { ok: false, error: "no_es_pieza", detalle: `esta fila es de tipo «${detalle.tipo}»: aquí solo se aprueban piezas` } }
  const v = validarDecision(raw, detalle.laminas.length, detalle.exige_casilla)
  if (!v.ok) return { status: 400, cuerpo: { ok: false, error: v.error, detalle: v.detalle } }
  const conflicto = conflictoDeEstado(detalle, v.pedido)
  if (conflicto) return conflicto

  if (v.pedido.accion === "cambios") return pedirCambiosALaPlataforma(id, v.pedido, d)

  const resolver = d.resolver ?? resolveHitlApproval
  const res: HitlResolveResult = await resolver(
    { hitl_id: id, decision: v.pedido.accion === "aprobar" ? "approve" : "reject", reviewer_id: d.revisor, rejection_reason: v.pedido.comentario },
    { supabase: d.supabase },
  )
  if (res.mode === "refused") return { status: 400, cuerpo: { ok: false, error: "rechazada_por_la_regla", detalle: res.refused_reason ?? "sin detalle" } }
  if (res.mode === "shadow") return { status: 200, cuerpo: { ok: true, simulado: true, accion: v.pedido.accion, detalle: "SIMULADO: el tablero está en modo sombra y no guardó nada" } }
  if (!res.ok) return { status: 502, cuerpo: { ok: false, error: "la_plataforma_no_guardo", plataforma_status: res.platform_status ?? null, detalle: res.platform_error ?? "sin detalle" } }
  return { status: 200, cuerpo: { ok: true, accion: v.pedido.accion, plataforma_status: res.platform_status ?? null, publica: false, nota: v.pedido.accion === "aprobar" ? "Aprobada. Todavía no se publica en redes: es un paso aparte." : undefined } }
}
