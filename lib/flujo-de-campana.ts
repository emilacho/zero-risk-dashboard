/**
 * EL BOTÓN «FLUJO DE LA CAMPAÑA» (GO de Lenovo 18-nov · boceto aprobado por Emilio 13:43 Zúrich) · la parte del tablero.
 *   · LEER: el color y la línea salen de la campaña real (`cadena_campanas.estado` + `estado_motivo`), con la MISMA regla que la plataforma
 *     (`zero-risk-platform/src/lib/cadena/flujo-de-campana.ts`): verde en marcha · dorado si la pausó el tablero (con su hito) · rojo si se paró sola;
 *   · TOCAR: la acción la aplica la PLATAFORMA (`POST /api/cadena/campanas {accion: "flujo", quiero}`) como decisión HUMANA (`workflow_id = 'tablero'`);
 *     el tablero no escribe nada en la base. Un 409 (la causa sigue, por ejemplo) vuelve como dato para la pantalla, sin alarma.
 * Agnóstico: cualquier cliente, cualquier campaña.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { nombreGenericoDelPlan, NOMBRE_GENERICO_SIN_PLAN } from "@/lib/nombre-generico-del-plan"

/** 🔴 CONTRATO con la plataforma (`PREFIJO_DE_PAUSA_DEL_TABLERO`): el mismo texto exacto en los dos lados, con su prueba en cada uno */
export const PREFIJO_DE_PAUSA_DEL_TABLERO = "pausada desde el tablero"
export const WORKFLOW_DEL_TABLERO = "tablero"
export const ESTADOS_EN_MARCHA = ["abierta", "estrategia", "calendario", "activa"] as const

export type ColorDelFlujo = "verde" | "dorado" | "rojo"
export interface FlujoDeCampana { color: ColorDelFlujo; linea: string; estado: string }
/** 19-nov · VARIAS CAMPAÑAS (botón aprobado por Emilio 21:45 Zúrich: 3 lugares, uno por campaña, con su nombre) · una campaña viva del cliente y su botón */
export interface CampanaDelFlujo { campana_id: string; nombre: string | null; flujo: FlujoDeCampana | null }
/** la última campaña y su botón, como siempre (el botón de hoy no cambia) */
export interface LecturaDelFlujo { campana_id: string | null; flujo: FlujoDeCampana | null }
/** los estados que NO son campaña viva (no ocupan lugar de botón) */
export const ESTADOS_MUERTOS = ["cerrada", "reemplazada"] as const

const SEPARADOR = " · "
const PAUSA = new RegExp(`^${PREFIJO_DE_PAUSA_DEL_TABLERO}${SEPARADOR}vuelve a: (\\w+)${SEPARADOR}(.+)$`)

export function leerPausaDelTablero(motivo: string | null | undefined): { vuelve_a: string; hito: string } | null {
  const m = PAUSA.exec(String(motivo ?? ""))
  if (!m || !(ESTADOS_EN_MARCHA as readonly string[]).includes(m[1])) return null
  return { vuelve_a: m[1], hito: m[2] }
}

/** el motivo en pocas palabras (el detalle va en Alertas) · la MISMA regla que `motivoBreve` de la plataforma */
export function motivoBreve(motivo: string | null | undefined): string {
  const t = String(motivo ?? "").trim()
  if (/presupuesto de planificación se agotó/i.test(t)) return "se acabó la bolsa de planificación"
  if (/presupuesto del lector/i.test(t)) return "se acabó la bolsa del lector"
  if (/pasaron 7 días en necesita_humano/i.test(t)) return "lleva 7 días esperándote"
  if (!t) return "necesita que lo mires"
  const corto = t.split(/[(:·]/)[0].trim()
  return corto.length > 60 ? `${corto.slice(0, 57).trimEnd()}…` : corto
}

export function flujoDeCampana(c: { estado: string | null | undefined; estado_motivo?: string | null } | null): FlujoDeCampana | null {
  if (!c || !c.estado) return null
  const e = String(c.estado)
  if ((ESTADOS_EN_MARCHA as readonly string[]).includes(e)) return { color: "verde", linea: "EN MARCHA", estado: e }
  if (e === "pausada") {
    const p = leerPausaDelTablero(c.estado_motivo)
    if (p) return { color: "dorado", linea: `PARADO POR TI · ${p.hito}`, estado: e }
  }
  if (e === "pausada" || e === "necesita_humano") return { color: "rojo", linea: `DETENIDO · ${motivoBreve(c.estado_motivo)}`, estado: e }
  return null
}

/** qué hace un toque según el color: verde para · dorado y rojo intentan reanudar */
export const quieroAlTocar = (f: FlujoDeCampana): "parar" | "reanudar" => (f.color === "verde" ? "parar" : "reanudar")

/** la campaña del cliente que se muestra (la última de verdad, como el pizarrón) y su botón */
export async function leerFlujo(supabase: SupabaseClient, clienteId: string): Promise<LecturaDelFlujo> {
  const r = await supabase.from("cadena_campanas").select("id, estado, estado_motivo").eq("client_id", clienteId).eq("seco", false).order("creada_en", { ascending: false }).limit(1).maybeSingle()
  if (r.error) throw new Error(`leer la campaña: ${r.error.message}`)
  const c = r.data as { id: string; estado: string; estado_motivo: string | null } | null
  return { campana_id: c?.id ?? null, flujo: flujoDeCampana(c) }
}

type FilaViva = { id: string; estado: string; estado_motivo: string | null; nombre_de_campana?: string | null; plan_id?: string | null }
/** 19-nov · las campañas vivas del cliente (no cerradas, no reemplazadas, no archivadas), de la más vieja a la más nueva, con su nombre y su botón.
 *  Si la base todavía no tiene la columna del nombre (migración `202611192130` de la plataforma sin aplicar), se lee sin ella: el botón nunca se cae por eso.
 *  21-nov · Emilio 10:30Z (por Lenovo 10:31Z): una campaña SIN nombre se entrega con el genérico de su Plan de Marketing, AL LEER y sin escribir en la base; nunca null.
 *  Si el plan no se puede leer, el genérico fijo (el nombre nunca tumba la lectura). */
export async function campanasVivas(supabase: SupabaseClient, clienteId: string): Promise<CampanaDelFlujo[]> {
  const leer = (columnas: string) => supabase.from("cadena_campanas").select(columnas).eq("client_id", clienteId).eq("seco", false)
    .not("estado", "in", `(${ESTADOS_MUERTOS.join(",")})`).is("archivada_en", null).order("creada_en", { ascending: true })
  let r = await leer("id, estado, estado_motivo, nombre_de_campana, plan_id")
  if (r.error && /nombre_de_campana/.test(r.error.message ?? "")) r = await leer("id, estado, estado_motivo, plan_id")
  if (r.error) throw new Error(`leer las campañas: ${r.error.message}`)
  const filas = (r.data ?? []) as unknown as FilaViva[]
  const planes = [...new Set(filas.filter((x) => !nombreDeCampana(x.nombre_de_campana)).map((x) => x.plan_id).filter((p): p is string => typeof p === "string" && p !== ""))]
  const genericos = await nombresGenericos(supabase, planes)
  return filas.map((x) => ({ campana_id: x.id, nombre: nombreDeCampana(x.nombre_de_campana) ?? genericos.get(x.plan_id ?? "") ?? NOMBRE_GENERICO_SIN_PLAN, flujo: flujoDeCampana(x) }))
}
/** el nombre genérico por plan (solo de las campañas sin nombre) · una lectura que falla deja el genérico fijo: nunca tumba la lectura del flujo */
async function nombresGenericos(supabase: SupabaseClient, planes: string[]): Promise<Map<string, string>> {
  if (planes.length === 0) return new Map()
  const r = await supabase.from("client_historical_outputs").select("id, content_text, content").in("id", planes)
  if (r.error) return new Map()
  const texto = (v: unknown): string | null => (typeof v === "string" ? v : null)
  return new Map(((r.data ?? []) as Array<{ id: string; content_text?: unknown; content?: unknown }>).map((p) => [p.id, nombreGenericoDelPlan(texto(p.content_text) ?? texto(p.content))]))
}
const nombreDeCampana = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)

export interface DepsDelFlujo { supabase: SupabaseClient; plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch; ahora?: () => string }
export interface RespuestaDelFlujo { status: number; cuerpo: Record<string, unknown> }
const sinBarra = (u: string) => u.replace(/\/+$/, "")
const UUID = /^[0-9a-f-]{36}$/i

/** el toque: se valida, se confirma que la campaña existe y se manda a la plataforma · la respuesta trae `flujo` (el botón como queda) */
export async function tocarFlujo(raw: unknown, d: DepsDelFlujo): Promise<RespuestaDelFlujo> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const campana = typeof r.campana_id === "string" && UUID.test(r.campana_id) ? r.campana_id : null
  const quiero = r.quiero === "parar" || r.quiero === "reanudar" ? r.quiero : null
  if (!campana || !quiero) return { status: 400, cuerpo: { ok: false, error: "pedido_invalido", detalle: "faltan la campaña o qué quieres hacer (parar o reanudar)" } }
  const c = await d.supabase.from("cadena_campanas").select("id").eq("id", campana).eq("seco", false).maybeSingle()
  if (c.error) return { status: 502, cuerpo: { ok: false, error: "base_no_responde", detalle: c.error.message } }
  if (!c.data) return { status: 404, cuerpo: { ok: false, error: "no_existe", detalle: "no hay una campaña con ese id" } }

  const base = sinBarra(d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { status: 503, cuerpo: { ok: false, error: "llave_interna_sin_poner", detalle: "el tablero no tiene la llave con la que llama a la plataforma" } }
  const ahora = (d.ahora ?? (() => new Date().toISOString()))()
  const cuerpo = { accion: "flujo", campana_id: campana, quiero, workflow_id: WORKFLOW_DEL_TABLERO, workflow_execution_id: `${WORKFLOW_DEL_TABLERO}:flujo:${campana}:${ahora}` }
  try {
    const resp = await (d.fetchImpl ?? fetch)(`${base}/api/cadena/campanas`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": llave }, body: JSON.stringify(cuerpo) })
    const txt = await resp.text().catch(() => "")
    let j: Record<string, unknown> = {}
    try { j = txt ? (JSON.parse(txt) as Record<string, unknown>) : {} } catch { j = { detalle: txt.slice(0, 400) } }
    // la plataforma todavía sin la acción: se dice, no se simula
    // (404/405 = sin la ruta · 400 `E-ACCION` = la ruta existe pero no conoce `flujo`, `puerta-http.ts` de la plataforma)
    if (resp.status === 404 || resp.status === 405 || (resp.status === 400 && j.code === "E-ACCION")) return { status: 501, cuerpo: { ok: false, error: "flujo_no_publicado", detalle: "la plataforma todavía no tiene el botón del flujo" } }
    if (resp.ok) return { status: 200, cuerpo: { ok: true, ...j } }
    // 409 (la causa sigue · sin flujo): pasa tal cual, con el botón que manda la plataforma, para que la pantalla lo diga sin alarma
    return { status: resp.status, cuerpo: { ok: false, ...j } }
  } catch (e) {
    return { status: 502, cuerpo: { ok: false, error: "plataforma_no_responde", detalle: e instanceof Error ? e.message : String(e) } }
  }
}
