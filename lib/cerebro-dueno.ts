/**
 * LA ESCRITURA DEL DUEÑO EN EL CEREBRO (sprint 6.8): el tablero NO escribe en las tablas del cerebro. Lo que Emilio escribe o corrige va por la puerta del dueño de la
 * plataforma (`POST /api/brain/alimentar/dueno`, llave interna), que es la misma por la que entran las respuestas por Slack y las ediciones del manual: queda como ficha
 * «confirmada por el dueño», reemplaza a la anterior del mismo tema, cierra la pregunta pendiente si la había y avisa al índice que buscan las oficinas. US$ 0, sin modelo.
 * Si la puerta no está (404/405), está apagada (`{apagado:true}`) o rechaza, se dice tal cual: nada se guarda a medias desde aquí.
 */
import { cuerpoParaLaPuertaDelDueno } from "@/lib/cerebro"

export interface DepsDelDueno { plataformaUrl?: string | null; llave?: string | null; fetchImpl?: typeof fetch; ahora?: Date }
export type RespuestaDelDueno = { status: number; cuerpo: Record<string, unknown> }

const sinBarra = (u: string) => u.replace(/\/+$/, "")

export async function guardarDatoDelDueno(raw: unknown, d: DepsDelDueno = {}): Promise<RespuestaDelDueno> {
  const v = cuerpoParaLaPuertaDelDueno(raw, d.ahora)
  if ("error" in v) return { status: 400, cuerpo: { ok: false, error: "entrada_invalida", detalle: v.error } }
  const base = sinBarra(d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { status: 503, cuerpo: { ok: false, error: "llave_interna_sin_poner", detalle: "el tablero no tiene la llave con la que llama a la plataforma" } }
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
