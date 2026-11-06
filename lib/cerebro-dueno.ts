/**
 * LA ESCRITURA DEL DUEÑO EN EL CEREBRO (sprint 6.8): el tablero NO escribe en las tablas del cerebro. Lo que Emilio escribe o corrige va por la puerta del dueño de la
 * plataforma (`POST /api/brain/alimentar/dueno`, llave interna), que es la misma por la que entran las respuestas por Slack y las ediciones del manual: queda como ficha
 * «confirmada por el dueño», reemplaza a la anterior del mismo tema, cierra la pregunta pendiente si la había y avisa al índice que buscan las oficinas. US$ 0, sin modelo.
 * Si la puerta no está (404/405), está apagada (`{apagado:true}`) o rechaza, se dice tal cual: nada se guarda a medias desde aquí.
 * 06-nov · condición A de CC7 (#939/#940): CONTESTAR UNA PREGUNTA PENDIENTE (viene `pregunta_id`) ya no va por la puerta del cerebro, que no cierra la fila de la
 * plataforma: va a `POST /api/dueno/preguntas` con `accion:"responder"`, que guarda la ficha en el cerebro y cierra la pregunta. Un dato suelto (sin pregunta) sigue por la puerta.
 */
import { cuerpoParaLaPuertaDelDueno } from "@/lib/cerebro"

export interface DepsDelDueno { plataformaUrl?: string | null; llave?: string | null; fetchImpl?: typeof fetch; ahora?: Date; /** quién contesta (la sesión de administrador) */ revisor?: string | null }
export type RespuestaDelDueno = { status: number; cuerpo: Record<string, unknown> }

const sinBarra = (u: string) => u.replace(/\/+$/, "")

export async function guardarDatoDelDueno(raw: unknown, d: DepsDelDueno = {}): Promise<RespuestaDelDueno> {
  const v = cuerpoParaLaPuertaDelDueno(raw, d.ahora)
  if ("error" in v) return { status: 400, cuerpo: { ok: false, error: "entrada_invalida", detalle: v.error } }
  const base = sinBarra(d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { status: 503, cuerpo: { ok: false, error: "llave_interna_sin_poner", detalle: "el tablero no tiene la llave con la que llama a la plataforma" } }
  if (v.dato.pregunta_id) return contestarLaPregunta(v.cuerpo, v.dato.pregunta_id, base, llave, d)
  try {
    const r = await (d.fetchImpl ?? fetch)(`${base}/api/brain/alimentar/dueno`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": llave }, body: JSON.stringify(v.cuerpo) })
    const texto = await r.text().catch(() => "")
    let j: Record<string, unknown> = {}
    try { j = JSON.parse(texto) as Record<string, unknown> } catch { j = {} }
    if (r.status === 404 && !j.error) return { status: 501, cuerpo: { ok: false, error: "puerta_no_disponible", detalle: "la plataforma no tiene la puerta del dueño en esta dirección: no se guardó nada" } }
    if (r.status === 405) return { status: 501, cuerpo: { ok: false, error: "puerta_no_disponible", detalle: "la plataforma no acepta escribir por la puerta del dueño: no se guardó nada" } }
    if (r.ok && j.apagado === true) return { status: 503, cuerpo: { ok: false, error: "puerta_apagada", detalle: String(j.detalle ?? "PORTERO_DUENO apagado") } }
    if (r.status === 400 || r.status === 404) return { status: r.status, cuerpo: { ok: false, error: String(j.error ?? "la_plataforma_rechazo"), detalle: String(j.detalle ?? j.detail ?? texto.slice(0, 300)) } }
    if (!r.ok) return { status: 502, cuerpo: { ok: false, error: "la_plataforma_rechazo", plataforma_status: r.status, detalle: String(j.detalle ?? j.detail ?? j.error ?? texto.slice(0, 300)) } }
    if (j.ok !== true) return { status: 502, cuerpo: { ok: false, error: "la_plataforma_no_guardo", detalle: String(j.detalle ?? j.error ?? texto.slice(0, 300)), errores: j.errores ?? null } }
    return {
      status: 200,
      cuerpo: { ok: true, guardada: j.guardada === true, ficha_id: j.ficha_id ?? null, tema: j.tema ?? v.dato.tema, sede: j.sede ?? null, reemplaza: j.reemplaza ?? [], llego_tarde: j.llego_tarde ?? false, errores: Array.isArray(j.errores) ? j.errores : [], canal: j.canal ?? null, respondido_en: j.respondido_en ?? null },
    }
  } catch (e) {
    return { status: 502, cuerpo: { ok: false, error: "plataforma_sin_respuesta", detalle: e instanceof Error ? e.message : String(e) } }
  }
}

/** una pregunta pendiente se contesta por la ruta de la plataforma (#939): guarda en el cerebro y cierra la fila; 409 = otro la cerró antes */
async function contestarLaPregunta(c: Record<string, unknown>, pregunta_id: string, base: string, llave: string, d: DepsDelDueno): Promise<RespuestaDelDueno> {
  const cuerpo = {
    accion: "responder", client_id: c.client_id, pregunta_id, respuesta: c.respuesta, decidido_por: d.revisor || "emilio",
    canal: c.canal, mensaje_ref: c.mensaje_ref, respondido_en: c.respondido_en, workflow_id: c.workflow_id, workflow_execution_id: c.workflow_execution_id,
  }
  try {
    const r = await (d.fetchImpl ?? fetch)(`${base}/api/dueno/preguntas`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": llave }, body: JSON.stringify(cuerpo) })
    const texto = await r.text().catch(() => "")
    let j: Record<string, unknown> = {}
    try { j = JSON.parse(texto) as Record<string, unknown> } catch { j = {} }
    const detalle = String(j.detalle ?? j.error ?? texto.slice(0, 300))
    if (r.status === 404 && !j.error) return { status: 501, cuerpo: { ok: false, error: "puerta_no_disponible", detalle: "la plataforma todavía no tiene la ruta de las preguntas: no se guardó nada" } }
    if (r.status === 409) return { status: 409, cuerpo: { ok: false, error: "ya_cerrada", detalle: "la pregunta ya no estaba pendiente: alguien la cerró antes" } }
    if (r.status === 400 || r.status === 404) return { status: r.status, cuerpo: { ok: false, error: String(j.error ?? "la_plataforma_rechazo"), detalle } }
    if (!r.ok) return { status: 502, cuerpo: { ok: false, error: "la_plataforma_rechazo", plataforma_status: r.status, detalle } }
    if (j.ok !== true || j.guardada !== true) return { status: 502, cuerpo: { ok: false, error: "la_plataforma_no_guardo", detalle } }
    return { status: 200, cuerpo: { ok: true, guardada: true, ficha_id: j.ficha_ref ?? null, tema: c.tema ?? null, sede: c.sede_clave ?? null, reemplaza: [], llego_tarde: false, errores: [], canal: c.canal ?? null, respondido_en: c.respondido_en ?? null, preguntas_cerradas: Number(j.preguntas_cerradas ?? 0) } }
  } catch (e) {
    return { status: 502, cuerpo: { ok: false, error: "plataforma_sin_respuesta", detalle: e instanceof Error ? e.message : String(e) } }
  }
}
