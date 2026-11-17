/**
 * EL BANCO DE IDEAS DE LA GRAN IDEA · ver, editar y retirar (17-nov · GO Lenovo «construir» · boceto aprobado por Emilio 06:28, «Retirar» en la ADENDA 06:33).
 *  · Ver: las ideas de la versión aprobada, plegables por capítulo; las retiradas no se muestran ni se cuentan.
 *  · Editar: patrón del manual · «Editar» por campo, lo editado queda en «Tus cambios» y sale junto con «Pedir los cambios». No reescribe ni gasta.
 *  · Retirar: la plataforma marca la idea `retirada` (no la borra) y reasigna las filas del calendario que la usaban.
 *  · El tablero NO escribe la base: todo va a la plataforma (`POST /api/cadena/concepto/banco`, contrato de CC1 · PROPUESTA 17-nov + RESPUESTA CC5),
 *    que guarda antes/después, quién y cuándo en el historial del banco y rehace `linea`.
 * Las funciones de lectura y del pedido son puras; `pedirAlBanco` es la única que llama afuera (con `fetchImpl` inyectable).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { cargarConcepto, type CapituloDelConcepto, type DetalleDelConcepto, type IdeaDelBanco } from "@/lib/concepto-datos"
import { WORKFLOW_DEL_TABLERO } from "@/lib/concepto-decision"

/** los campos que se editan desde el tablero (los del boceto aprobado) */
export const CAMPOS_EDITABLES = ["idea", "mensaje", "gancho", "protagonista"] as const
export type CampoEditable = (typeof CAMPOS_EDITABLES)[number]
export const ETIQUETA_DEL_CAMPO: Record<CampoEditable, string> = { idea: "La idea", mensaje: "Mensaje", gancho: "Gancho", protagonista: "Protagonista" }
/** tope por campo (lo mismo que pide la RESPUESTA de CC5 a la plataforma) */
export const TOPE_DEL_CAMPO = 2000
/** tope de ideas en una sola tanda de cambios */
export const TOPE_DE_IDEAS_POR_PEDIDO = 200
/** cuántas ideas se ven por capítulo antes de «ver todas» */
export const IDEAS_A_LA_VISTA = 5
/** cuidado 3 de CC6 · lo que dice «Pedir los cambios» */
export const ALCANCE_DE_LOS_CAMBIOS = "Afecta a las piezas que aún no tienen brief."
/** ADENDA 06:33 · la reasignación de las filas del calendario la hace la plataforma SIN avisarle a Emilio: la pantalla solo confirma el retiro */
export const AL_RETIRAR = "La idea sale del banco; queda en el historial."

const RED: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn", youtube: "YouTube", whatsapp: "WhatsApp" }
/** el nombre de la red como lo lee Emilio */
export const nombreDeRed = (r: string): string => RED[r.trim().toLowerCase()] ?? (r ? r.charAt(0).toUpperCase() + r.slice(1) : "Sin red")

/** las ideas que siguen en el banco (las retiradas quedan en el historial, no a la vista) */
export const ideasVigentes = (banco: IdeaDelBanco[]): IdeaDelBanco[] => banco.filter((i) => !i.retirada)

export interface CapituloDelBanco { clave: string; nombre: string; ideas: IdeaDelBanco[] }
/** PURA · las ideas vigentes agrupadas en el orden de los capítulos; las que no calzan con ninguno van al final, sin perderse */
export function bancoPorCapitulo(banco: IdeaDelBanco[], capitulos: Pick<CapituloDelConcepto, "clave" | "fase" | "nombre">[]): CapituloDelBanco[] {
  const out: CapituloDelBanco[] = []
  const usadas = new Set<IdeaDelBanco>()
  const vigentes = ideasVigentes(banco)
  for (const c of capitulos) {
    const ideas = vigentes.filter((i) => i.capitulo != null && (i.capitulo === c.clave || (c.fase != null && i.capitulo === c.fase)) && !usadas.has(i))
    ideas.forEach((i) => usadas.add(i))
    if (ideas.length) out.push({ clave: c.clave, nombre: c.nombre || c.clave, ideas })
  }
  const sueltas = vigentes.filter((i) => !usadas.has(i))
  if (sueltas.length) out.push({ clave: "_sin_capitulo", nombre: "Sin capítulo", ideas: sueltas })
  return out
}

/** las ediciones en espera: idea → campo → texto nuevo */
export type EdicionesDelBanco = Record<string, Partial<Record<CampoEditable, string>>>
/** PURA · agrega (o quita, si vuelve al texto guardado) una edición en espera */
export function conEdicion(ed: EdicionesDelBanco, idea: IdeaDelBanco, campo: CampoEditable, nuevo: string): EdicionesDelBanco {
  const t = nuevo.replace(/\s+/g, " ").trim().slice(0, TOPE_DEL_CAMPO)
  const deLaIdea = { ...(ed[idea.id] ?? {}) }
  if (!t || t === idea[campo]) delete deLaIdea[campo]
  else deLaIdea[campo] = t
  const out = { ...ed }
  if (Object.keys(deLaIdea).length) out[idea.id] = deLaIdea
  else delete out[idea.id]
  return out
}
/** PURA · cuántos campos hay editados en espera */
export const cuantosCambios = (ed: EdicionesDelBanco): number => Object.values(ed).reduce((n, x) => n + Object.keys(x).length, 0)

export type PedidoDelBanco =
  | { accion: "editar"; version: number; cambios: Array<{ idea_id: string; campos: Partial<Record<CampoEditable, string>> }> }
  | { accion: "retirar"; version: number; idea_id: string }

const ID_DE_IDEA = /^[A-Za-z0-9_.-]{1,40}$/
/** LA MISMA regla en el navegador y en el servidor: qué se puede mandar a la plataforma */
export function validarPedidoDelBanco(raw: unknown): { ok: true; pedido: PedidoDelBanco } | { ok: false; error: string; detalle: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const version = typeof r.version === "number" && Number.isInteger(r.version) && r.version > 0 ? r.version : null
  if (version == null) return { ok: false, error: "version_falta", detalle: "falta la versión de la gran idea que estabas viendo" }
  if (r.accion === "retirar") {
    if (typeof r.idea_id !== "string" || !ID_DE_IDEA.test(r.idea_id)) return { ok: false, error: "idea_invalida", detalle: "no se reconoce la idea a retirar" }
    return { ok: true, pedido: { accion: "retirar", version, idea_id: r.idea_id } }
  }
  if (r.accion !== "editar") return { ok: false, error: "accion_invalida", detalle: "la acción debe ser «editar» o «retirar»" }
  if (!Array.isArray(r.cambios) || !r.cambios.length) return { ok: false, error: "sin_cambios", detalle: "no hay cambios para pedir" }
  if (r.cambios.length > TOPE_DE_IDEAS_POR_PEDIDO) return { ok: false, error: "demasiados_cambios", detalle: `como máximo ${TOPE_DE_IDEAS_POR_PEDIDO} ideas por pedido` }
  const vistos = new Set<string>()
  const cambios: Array<{ idea_id: string; campos: Partial<Record<CampoEditable, string>> }> = []
  for (const c of r.cambios as unknown[]) {
    const x = (c && typeof c === "object" ? c : {}) as Record<string, unknown>
    if (typeof x.idea_id !== "string" || !ID_DE_IDEA.test(x.idea_id) || vistos.has(x.idea_id)) return { ok: false, error: "idea_invalida", detalle: "una de las ideas no se reconoce o viene repetida" }
    vistos.add(x.idea_id)
    const crudos = (x.campos && typeof x.campos === "object" ? x.campos : {}) as Record<string, unknown>
    const campos: Partial<Record<CampoEditable, string>> = {}
    for (const [k, v] of Object.entries(crudos)) {
      if (!(CAMPOS_EDITABLES as readonly string[]).includes(k)) return { ok: false, error: "campo_invalido", detalle: `el campo «${k}» no se edita desde aquí` }
      const t = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : ""
      if (!t) return { ok: false, error: "campo_vacio", detalle: `«${ETIQUETA_DEL_CAMPO[k as CampoEditable]}» no puede quedar vacío` }
      if (t.length > TOPE_DEL_CAMPO) return { ok: false, error: "campo_largo", detalle: `«${ETIQUETA_DEL_CAMPO[k as CampoEditable]}» pasa de ${TOPE_DEL_CAMPO} caracteres` }
      campos[k as CampoEditable] = t
    }
    if (!Object.keys(campos).length) return { ok: false, error: "sin_cambios", detalle: "una de las ideas no trae ningún cambio" }
    cambios.push({ idea_id: x.idea_id, campos })
  }
  return { ok: true, pedido: { accion: "editar", version, cambios } }
}

/** PURA · el cuerpo que manda la pantalla con lo que está en espera */
export function cuerpoDeEdicion(version: number, ed: EdicionesDelBanco): PedidoDelBanco {
  return { accion: "editar", version, cambios: Object.entries(ed).filter(([, c]) => Object.keys(c).length).map(([idea_id, campos]) => ({ idea_id, campos })) }
}

/** se edita solo la gran idea APROBADA: es la que leen el calendario y las hojas */
export const bancoEditable = (d: Pick<DetalleDelConcepto, "estado" | "version" | "campana_id">): boolean => d.estado === "aprobada" && d.version != null && d.campana_id != null

export interface DepsDelBanco { supabase: SupabaseClient; revisor: string; plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch; ahora?: () => string }
export interface RespuestaDelBanco { status: number; cuerpo: Record<string, unknown> }
const sinBarra = (u: string) => u.replace(/\/+$/, "")

/** el pedido (editar en tanda o retirar) va a la plataforma; si la pantalla estaba vieja o la gran idea no está aprobada, 409 y no se manda nada */
export async function pedirAlBanco(hitlId: string, raw: unknown, d: DepsDelBanco): Promise<RespuestaDelBanco> {
  const detalle = await cargarConcepto(d.supabase, hitlId)
  if (!detalle) return { status: 404, cuerpo: { ok: false, error: "no_existe", detalle: "no hay una tarjeta de gran idea con ese id" } }
  const v = validarPedidoDelBanco(raw)
  if (!v.ok) return { status: 400, cuerpo: { ok: false, error: v.error, detalle: v.detalle } }
  if (!bancoEditable(detalle)) return { status: 409, cuerpo: { ok: false, error: "no_aprobada", detalle: "el banco se edita en la gran idea aprobada" } }
  if (v.pedido.version !== detalle.version) return { status: 409, cuerpo: { ok: false, error: "version_cambio", detalle: "la gran idea cambió mientras la mirabas: recarga" } }
  const vigentes = new Set(ideasVigentes(detalle.banco).map((i) => i.id))
  const ids = v.pedido.accion === "editar" ? v.pedido.cambios.map((c) => c.idea_id) : [v.pedido.idea_id]
  const falta = ids.find((id) => !vigentes.has(id))
  if (falta) return { status: 409, cuerpo: { ok: false, error: "idea_no_vigente", detalle: "una de las ideas ya no está en el banco (¿la retiraron?): recarga" } }

  const base = sinBarra(d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { status: 503, cuerpo: { ok: false, error: "llave_interna_sin_poner", detalle: "el tablero no tiene la llave con la que llama a la plataforma" } }
  const ahora = (d.ahora ?? (() => new Date().toISOString()))()
  const cuerpo = { ...v.pedido, campana_id: detalle.campana_id, autor: d.revisor, workflow_id: WORKFLOW_DEL_TABLERO, workflow_execution_id: `${WORKFLOW_DEL_TABLERO}:banco:${hitlId}:${ahora}` }
  try {
    const r = await (d.fetchImpl ?? fetch)(`${base}/api/cadena/concepto/banco`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": llave }, body: JSON.stringify(cuerpo) })
    const txt = await r.text().catch(() => "")
    let j: Record<string, unknown> = {}
    try { j = txt ? (JSON.parse(txt) as Record<string, unknown>) : {} } catch { j = { detalle: txt.slice(0, 400) } }
    if (r.status === 404 || r.status === 405) return { status: 501, cuerpo: { ok: false, error: "plataforma_sin_ruta", detalle: "la plataforma todavía no tiene la ruta del banco de ideas: no se envió nada" } }
    // la plataforma (ENTREGA CC1 #1084) responde `{ok:false, error, code, detalle}`: `detalle` está en lenguaje claro y es lo único que se lee en pantalla
    if (r.status === 409) return { status: 409, cuerpo: { ok: false, error: String(j.code ?? j.error ?? "la_cadena_dijo_que_no"), detalle: String(j.detalle ?? "la gran idea cambió mientras la mirabas: recarga") } }
    if (!r.ok || j.ok !== true) return { status: 502, cuerpo: { ok: false, error: "la_plataforma_rechazo", plataforma_status: r.status, detalle: String(j.detalle ?? "la plataforma no pudo guardar el cambio") } }
    return {
      status: 200,
      cuerpo: {
        ok: true,
        accion: v.pedido.accion,
        version: j.version ?? detalle.version,
        nota: j.sin_cambios === true ? "No había cambios que guardar: el texto ya era ese." : v.pedido.accion === "editar"
          ? `Cambios guardados en ${ids.length === 1 ? "1 idea" : `${ids.length} ideas`}. ${ALCANCE_DE_LOS_CAMBIOS}`
          : "Idea retirada del banco.",
      },
    }
  } catch (e) {
    return { status: 502, cuerpo: { ok: false, error: "plataforma_sin_respuesta", detalle: e instanceof Error ? e.message : String(e) } }
  }
}
