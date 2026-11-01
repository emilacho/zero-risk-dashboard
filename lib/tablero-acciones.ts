/**
 * LO QUE EMILIO MANEJA DESDE EL TABLERO (30-oct · «el dashboard se maneja, no solo se mira»).
 * Regla de oro: el tablero NO escribe la base. Cada botón es una acción con nombre que pasa por una sola puerta del tablero (`/api/acciones/{accion}`, solo administrador con sesión)
 * y de ahí a la ruta de la plataforma `POST /api/tablero/{accion}` con la llave interna; la plataforma hace el cambio y deja el rastro en `eventos_de_emilio`.
 * Si la plataforma todavía no tiene la ruta responde 404/405 y aquí se dice «todavía no disponible» (501): nunca se simula un cambio.
 * Una acción que GASTA dinero exige `confirmo_gasto: true` (el botón lo manda solo después de mostrar el tope) y se rechaza sin él.
 */
import { vaciarCache } from "@/lib/cache-corta"

export type NombreDeAccion =
  | "rehacer-pieza"
  | "plan-aprobar" | "plan-cambios" | "plan-responder"
  | "firmar-tablero"
  | "cliente-editar" | "cliente-nuevo" | "cliente-baja" | "cliente-tope"
  | "oficina-estado" | "oficina-tope"
  | "revision-resolver"
  | "manual-campos" | "manual-validar"

type Cuerpo = Record<string, unknown>
export type Validacion = { ok: true; cuerpo: Cuerpo } | { ok: false; error: string; detalle: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const esObjeto = (v: unknown): v is Cuerpo => !!v && typeof v === "object" && !Array.isArray(v)
const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "")
const mal = (detalle: string): Validacion => ({ ok: false, error: "pedido_invalido", detalle })

/** las que tienen interruptor propio; el cerebro y su portero se manejan por sus pausas, no desde aquí */
export const OFICINAS_MANEJABLES = ["creativa", "financiera", "jefatura", "planeacion"] as const
export const REDES = ["instagram", "facebook", "tiktok", "linkedin", "youtube"] as const
/** tope de un pedido de cambios al plan (contrato CC1: ≤ 8 · el panel lo muestra y lo confirma) */
export const TOPE_PEDIR_CAMBIOS_USD = 8
/** tope por pieza de la mesa creativa (firma de Emilio, 30-oct): se muestra antes de confirmar */
export const TOPE_POR_PIEZA_USD = 5

export interface DefinicionDeAccion {
  /** cuánto puede costar como máximo; si hay valor, el botón muestra el tope y exige confirmar */
  gasta: null | { tope_usd: number }
  validar: (c: Cuerpo) => Validacion
  /** ruta de la plataforma; por omisión `/api/tablero/{accion}` */
  ruta?: (c: Cuerpo) => string
  metodo?: "POST" | "PATCH"
}

const conId = (c: Cuerpo, campo: string): string | null => (typeof c[campo] === "string" && UUID.test(c[campo] as string) ? (c[campo] as string) : null)
const comentario = (c: Cuerpo, min: number, max = 2000): string | null => { const t = texto(c.comentario); return t.length >= min && t.length <= max ? t : null }

export const ACCIONES: Record<NombreDeAccion, DefinicionDeAccion> = {
  "rehacer-pieza": {
    gasta: { tope_usd: TOPE_POR_PIEZA_USD },
    validar: (c) => { const id = conId(c, "encargo_id"); return id ? { ok: true, cuerpo: { encargo_id: id, ...(texto(c.comentario) ? { comentario: texto(c.comentario).slice(0, 2000) } : {}) } } : mal("falta la pieza que se rehace") },
  },
  // CICLO DEL PLAN (CC6 · 01-nov · contrato certificado de CC1 §2): con `plan_id` van las puertas nuevas. Sin él queda la forma vieja (`campana_id`, la ficha del
  // cliente en el tablero de siempre), tal cual estaba: esa página no se toca y la plataforma la rechaza con 400 sin cambiar nada (ADENDA 1 de CC1).
  "plan-aprobar": {
    gasta: null,
    validar: (c) => {
      const plan = conId(c, "plan_id")
      if (plan) { const t = texto(c.comentario); return t.length > 1000 ? mal("el comentario pasa de 1.000 caracteres") : { ok: true, cuerpo: { plan_id: plan, ...(t ? { comentario: t } : {}) } } }
      const id = conId(c, "campana_id"); return id ? { ok: true, cuerpo: { campana_id: id } } : mal("falta el plan")
    },
  },
  "plan-cambios": {
    // GASTA cuando va con `plan_id` (el jefe de marketing reescribe y la jefatura revisa): el servidor exige la confirmación y el tope, no solo la pantalla
    gasta: null,
    validar: (c) => {
      const plan = conId(c, "plan_id")
      if (plan) {
        const t = texto(c.texto), tope = Number(c.tope_usd)
        if (t.length < 5 || t.length > 4000) return mal("cuenta qué debe cambiar (de 5 a 4.000 caracteres)")
        if (c.confirmo_gasto !== true) return { ok: false, error: "falta_confirmar_gasto", detalle: `pedir cambios gasta (tope hasta US$ ${TOPE_PEDIR_CAMBIOS_USD}): confírmalo antes` }
        if (!Number.isFinite(tope) || tope <= 0) return mal("falta el tope del gasto")
        if (tope > TOPE_PEDIR_CAMBIOS_USD) return mal(`el tope pasa de US$ ${TOPE_PEDIR_CAMBIOS_USD}`)
        return { ok: true, cuerpo: { plan_id: plan, texto: t, confirmo_gasto: true, tope_usd: tope } }
      }
      const id = conId(c, "campana_id"), t = comentario(c, 5); return !id ? mal("falta el plan") : !t ? mal("cuenta qué quieres cambiar (de 5 a 2.000 caracteres)") : { ok: true, cuerpo: { campana_id: id, comentario: t } }
    },
  },
  "plan-responder": {
    gasta: null,
    validar: (c) => { const id = conId(c, "espera_id"), t = texto(c.respuesta); return !id ? mal("falta la pregunta que se contesta") : t.length < 1 || t.length > 2000 ? mal("escribe la respuesta (hasta 2.000 caracteres)") : { ok: true, cuerpo: { espera_id: id, respuesta: t } } },
  },
  "firmar-tablero": { gasta: null, validar: (c) => { const id = conId(c, "tablero_id"); return id ? { ok: true, cuerpo: { tablero_id: id } } : mal("falta el tablero que se firma") } },
  "cliente-editar": {
    gasta: null,
    validar: (c) => {
      const id = conId(c, "client_id")
      if (!id) return mal("falta el cliente")
      if (!esObjeto(c.campos)) return mal("faltan los datos que cambian")
      const campos: Cuerpo = {}
      for (const k of ["rubro", "ciudad", "sitio", "redes"]) {
        const v = (c.campos as Cuerpo)[k]
        if (v === undefined) continue
        if (k === "presupuesto") { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return mal("el presupuesto debe ser un número positivo"); campos[k] = n; continue }
        if (k === "redes") { if (!esObjeto(v)) return mal("las redes deben ir como lista de usuarios"); campos[k] = Object.fromEntries(Object.entries(v).filter(([r]) => (REDES as readonly string[]).includes(r)).map(([r, u]) => [r, texto(u).slice(0, 120)])); continue }
        const t = texto(v); if (t.length > 300) return mal(`«${k}» es demasiado largo`); campos[k] = t
      }
      return Object.keys(campos).length ? { ok: true, cuerpo: { client_id: id, campos } } : mal("no cambió nada")
    },
  },
  "cliente-tope": {
    gasta: null,
    validar: (c) => {
      const id = conId(c, "client_id"), n = Number(c.tope_usd)
      if (!id) return mal("falta el cliente")
      return !Number.isFinite(n) || n <= 0 || n > 1000 ? mal("el tope debe estar entre 0,01 y 1.000 dólares") : { ok: true, cuerpo: { client_id: id, tope_usd: Math.round(n * 100) / 100 } }
    },
  },
  "cliente-nuevo": {
    gasta: null,
    validar: (c) => {
      const nombre = texto(c.nombre), rubro = texto(c.rubro)
      if (nombre.length < 2 || nombre.length > 120) return mal("escribe el nombre del cliente")
      if (rubro.length < 3 || rubro.length > 200) return mal("cuenta de qué rubro es")
      const out: Cuerpo = { nombre, rubro }
      if (texto(c.ciudad)) out.ciudad = texto(c.ciudad).slice(0, 120)
      if (texto(c.sitio)) out.sitio = texto(c.sitio).slice(0, 300)
      if (c.presupuesto !== undefined && c.presupuesto !== "") { const n = Number(c.presupuesto); if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return mal("el presupuesto debe ser un número positivo"); out.presupuesto = n }
      return { ok: true, cuerpo: out }
    },
  },
  "cliente-baja": {
    gasta: null,
    validar: (c) => { const id = conId(c, "client_id"), t = comentario(c, 5, 500); return !id ? mal("falta el cliente") : !t ? mal("cuenta por qué se da de baja (mínimo 5 caracteres)") : { ok: true, cuerpo: { client_id: id, comentario: t } } },
  },
  "oficina-estado": {
    gasta: null,
    validar: (c) => { const o = texto(c.oficina), e = texto(c.estado); return !(OFICINAS_MANEJABLES as readonly string[]).includes(o) ? mal("oficina desconocida") : e !== "encendida" && e !== "apagada" ? mal("el estado es «encendida» o «apagada»") : { ok: true, cuerpo: { oficina: o, estado: e } } },
  },
  "oficina-tope": {
    gasta: null,
    validar: (c) => { const o = texto(c.oficina), n = Number(c.tope_usd); return !(OFICINAS_MANEJABLES as readonly string[]).includes(o) ? mal("oficina desconocida") : !Number.isFinite(n) || n <= 0 || n > 1000 ? mal("el tope debe estar entre 0,01 y 1.000 dólares") : { ok: true, cuerpo: { oficina: o, tope_usd: Math.round(n * 100) / 100 } } },
  },
  "revision-resolver": {
    gasta: null,
    validar: (c) => {
      const id = conId(c, "hitl_id"), d = texto(c.decision)
      if (!id) return mal("falta la revisión")
      if (d !== "aprobar" && d !== "rechazar") return mal("la decisión es «aprobar» o «rechazar»")
      const t = texto(c.comentario)
      if (d === "rechazar" && t.length < 5) return mal("cuenta por qué se rechaza (mínimo 5 caracteres)")
      return { ok: true, cuerpo: { hitl_id: id, decision: d, ...(t ? { comentario: t.slice(0, 2000) } : {}) } }
    },
  },
  "manual-campos": {
    gasta: null, metodo: "PATCH",
    ruta: (c) => `/api/manual/${String(c.client_id)}/campos`,
    validar: (c) => {
      const id = conId(c, "client_id")
      if (!id) return mal("falta el cliente")
      if (!esObjeto(c.campos)) return mal("faltan los campos que cambian")
      const campos: Cuerpo = {}
      let porque = texto(c.comentario)
      for (const [k, v] of Object.entries(c.campos)) {
        if (k === "comentario_porque") { porque = texto(v) || porque; continue }
        if (!CAMPOS_DEL_MANUAL.some((x) => x.clave === k)) return mal(`«${k}» no es un campo que se pueda editar`)
        const t = texto(v); if (t.length === 0 || t.length > 2000) return mal(`«${k}» debe tener entre 1 y 2.000 caracteres`); campos[k] = t
      }
      if (!Object.keys(campos).length) return mal("no cambió nada")
      return { ok: true, cuerpo: { client_id: id, campos, ...(porque ? { comentario: porque.slice(0, 1000) } : {}) } }
    },
  },
  "manual-validar": {
    gasta: null,
    validar: (c) => { const id = conId(c, "client_id"); return id ? { ok: true, cuerpo: { client_id: id } } : mal("falta el cliente") },
  },
}

/** los campos del manual que Emilio puede escribir (respuesta de Lenovo antiguo, 30-oct); lo observado por el sistema es PROPUESTA y no se edita a mano */
export const CAMPOS_DEL_MANUAL: Array<{ clave: string; etiqueta: string; largo: boolean }> = [
  { clave: "proposito", etiqueta: "Propósito", largo: true },
  { clave: "eslogan", etiqueta: "Eslogan", largo: false },
  { clave: "voz", etiqueta: "Voz", largo: true },
  { clave: "posicionamiento", etiqueta: "Posicionamiento", largo: true },
  { clave: "publico", etiqueta: "Público", largo: true },
  { clave: "valores", etiqueta: "Valores", largo: true },
  { clave: "nunca", etiqueta: "Lo que la marca nunca dice o hace", largo: true },
]

export interface RespuestaDeAccion { status: number; cuerpo: Record<string, unknown> }
export interface DepsDeAccion { revisor: string; plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch }

const sinBarra = (u: string) => u.replace(/\/+$/, "")

export function esNombreDeAccion(n: string): n is NombreDeAccion { return Object.prototype.hasOwnProperty.call(ACCIONES, n) }

export async function ejecutarAccion(nombre: string, raw: unknown, d: DepsDeAccion): Promise<RespuestaDeAccion> {
  if (!esNombreDeAccion(nombre)) return { status: 404, cuerpo: { ok: false, error: "accion_desconocida" } }
  const def = ACCIONES[nombre]
  const c = esObjeto(raw) ? raw : {}
  const v = def.validar(c)
  if (!v.ok) return { status: 400, cuerpo: { ok: false, error: v.error, detalle: v.detalle } }
  // un botón que gasta no puede gastar sin que Emilio haya visto el tope: el servidor lo exige, no solo la pantalla
  if (def.gasta && c.confirmo_gasto !== true) return { status: 400, cuerpo: { ok: false, error: "falta_confirmar_gasto", detalle: `esta acción puede costar hasta US$ ${def.gasta.tope_usd}: confírmalo antes`, tope_usd: def.gasta.tope_usd } }
  const base = sinBarra(d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { status: 503, cuerpo: { ok: false, error: "llave_interna_sin_poner", detalle: "el tablero no tiene la llave con la que llama a la plataforma" } }
  const ruta = def.ruta ? def.ruta(v.cuerpo) : `/api/tablero/${nombre}`
  const cuerpoFinal = nombre === "manual-campos" ? { ...v.cuerpo, client_id: undefined } : v.cuerpo
  try {
    const r = await (d.fetchImpl ?? fetch)(`${base}${ruta}`, {
      method: def.metodo ?? "POST",
      headers: { "Content-Type": "application/json", "x-api-key": llave },
      body: JSON.stringify({ ...cuerpoFinal, reviewer: d.revisor, origen: "dashboard", ...(def.gasta ? { confirmo_gasto: true, tope_usd: def.gasta.tope_usd } : {}) }),
    })
    vaciarCache() // después de una acción la próxima lectura es fresca (el reflejo inmediato manda sobre la caché corta)
    const t = (await r.text().catch(() => "")).slice(0, 600)
    let datos: Record<string, unknown> = {}
    try { const j = JSON.parse(t); if (esObjeto(j)) datos = j } catch { /* texto plano */ }
    // un 404 CON motivo de la plataforma (p. ej. `plan_inexistente` del ciclo del plan) no es «la ruta no existe»: se pasa con su motivo (CC6 · 01-nov)
    if (r.status === 404 && typeof datos.error === "string" && /^[a-z_]+$/.test(datos.error) && datos.error !== "not_found") return { status: 404, cuerpo: { ok: false, error: "no_encontrado", detalle: String(datos.detalle ?? datos.error), plataforma: datos } }
    if (r.status === 404 || r.status === 405) return { status: 501, cuerpo: { ok: false, error: "todavia_no_disponible", detalle: "la plataforma todavía no tiene esta acción: no se hizo ningún cambio" } }
    if (r.status === 401 || r.status === 403) return { status: 502, cuerpo: { ok: false, error: "la_plataforma_no_acepto_la_llave", plataforma_status: r.status, detalle: "el tablero no pudo identificarse ante la plataforma" } }
    if (r.status === 409) return { status: 409, cuerpo: { ok: false, error: "conflicto", detalle: String(datos.detalle ?? datos.error ?? "otra decisión se adelantó: recarga"), plataforma: datos } }
    // `plataforma_error` = el código de la plataforma tal cual (p. ej. `planes_error` del ciclo del plan antes de la «ventana»): la pantalla lo traduce sin mostrar el detalle técnico
    if (!r.ok) return { status: 502, cuerpo: { ok: false, error: "la_plataforma_rechazo", plataforma_status: r.status, ...(typeof datos.error === "string" ? { plataforma_error: datos.error } : {}), detalle: String(datos.detalle ?? datos.error ?? t) } }
    return { status: 200, cuerpo: { ok: true, accion: nombre, plataforma_status: r.status, resultado: datos } }
  } catch (e) {
    return { status: 502, cuerpo: { ok: false, error: "plataforma_sin_respuesta", detalle: e instanceof Error ? e.message : String(e) } }
  }
}
