/**
 * «CREAR CAMPAÑA» (20-nov · GO Lenovo 22:05 Zúrich · boceto aprobado por Emilio 22:03, «PERFECTO»: `raw/evidencia/2026-11-20-boceto-crear-campana-formulario/`).
 * Contrato de CC1 (entrega 2, 21:04Z al pie de `2026-11-20-GO-LENOVO-a-CC1-CC3-crear-campana-lo-de-atras.md`).
 * Las 5 preguntas del formulario y sus reglas, iguales para la pantalla y para el servidor del tablero (una sola fuente):
 *   nombre · cambio · fechas (inicio, fin y fechas clave) · tope (obligatorio, nunca debajo del mínimo que lee la plataforma) · tu brief (con la oferta adentro).
 * Los topes de texto y de fechas son los CHECK de `cadena_pedidos_de_campana` (CC1 #1255 · migración 202611201900); el mínimo del tope y
 * «el inicio no antes de hoy» los vuelve a validar la plataforma (`POST /api/tablero/crear-campana`, entrega 2 de CC1). El tablero no escribe la base.
 */
import { TOPE_DEL_TEXTO_DEL_DUENO } from "@/lib/tope-del-texto"

export const TOPE_DEL_NOMBRE = 120
export const TOPE_DEL_CAMBIO = 4_000
export const TOPE_DEL_BRIEF = TOPE_DEL_TEXTO_DEL_DUENO
export const TOPE_DE_FECHAS_CLAVE = 20
export const TOPE_DEL_QUE = 120
/** `fecha_fin - fecha_inicio <= 366` (CHECK de la base) */
export const DIAS_MAXIMOS_DE_CAMPANA = 366
/** `llave_formulario` (contrato CC1): un uuid que el tablero arma UNA vez al abrir el formulario; repetirla da `ya_pedida` y no abre dos campañas */
export const LLAVE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * una `llave_formulario` nueva (uuid v4). `crypto.randomUUID` no existe fuera de https ni en navegadores viejos: ahí se arma con
 * `crypto.getRandomValues`, que sí existe. Sin ninguno de los dos no hay llave y el formulario no deja crear (nunca una llave adivinable).
 */
export function nuevaLlave(c: Pick<Crypto, "getRandomValues"> & { randomUUID?: () => string } | undefined = globalThis.crypto): string | null {
  if (!c) return null
  if (typeof c.randomUUID === "function") return c.randomUUID()
  if (typeof c.getRandomValues !== "function") return null
  const b = c.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export interface FechaClave { fecha: string; que: string }
export interface RespuestasDeCrear {
  nombre: string
  cambio: string
  inicio: string
  fin: string
  claves: FechaClave[]
  /** lo escrito en la casilla (texto: «150», «150,50») */
  tope: string
  brief: string
}

export const PASOS = [
  { clave: "nombre", rotulo: "Nombre", pregunta: "¿Cómo se llama la campaña?" },
  { clave: "cambio", rotulo: "Cambio", pregunta: "¿Qué tiene que hacer o pensar distinto la gente después de la campaña?" },
  { clave: "fechas", rotulo: "Fechas", pregunta: "¿Cuándo empieza y cuándo termina?" },
  { clave: "tope", rotulo: "Tope", pregunta: "¿Cuánto es lo máximo que puede gastar?" },
  { clave: "brief", rotulo: "Tu brief", pregunta: null },
] as const

export const VACIAS: RespuestasDeCrear = { nombre: "", cambio: "", inicio: "", fin: "", claves: [], tope: "", brief: "" }

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const esFecha = (s: unknown): s is string => typeof s === "string" && FECHA.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
const dias = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
const largo = (s: string) => s.trim().length

/** el tope escrito como número (acepta coma decimal); null si no es un número positivo con hasta 2 decimales */
export function topeEscrito(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? n : null
}

/** las fechas clave que cuentan: las que tienen fecha y qué (una fila a medio llenar no se manda) */
export const clavesLlenas = (claves: FechaClave[]): FechaClave[] => claves.map((c) => ({ fecha: c.fecha, que: c.que.trim() })).filter((c) => esFecha(c.fecha) && c.que.length > 0)

/** la fecha de hoy en Ecuador (YYYY-MM-DD): el inicio no puede ser antes */
export function hoyEnEcuador(ahora = new Date()): string {
  return new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 10)
}

/**
 * ¿la respuesta de cada paso está lista? (el «Siguiente» de ese paso se apaga mientras no lo está).
 * `minimo` null = la ruta del mínimo no contestó: el tope nunca queda listo y no se puede crear (Lenovo 19:06Z).
 */
export function pasosListos(r: RespuestasDeCrear, minimo: number | null, hoy = hoyEnEcuador()): [boolean, boolean, boolean, boolean, boolean] {
  const tope = topeEscrito(r.tope)
  const fechasBien = esFecha(r.inicio) && esFecha(r.fin) && r.inicio >= hoy && dias(r.inicio, r.fin) > 0 && dias(r.inicio, r.fin) <= DIAS_MAXIMOS_DE_CAMPANA
  const clavesBien = r.claves.length <= TOPE_DE_FECHAS_CLAVE && r.claves.every((c) => largo(c.que) <= TOPE_DEL_QUE && (c.fecha === "" || esFecha(c.fecha)))
  return [
    largo(r.nombre) >= 1 && largo(r.nombre) <= TOPE_DEL_NOMBRE,
    largo(r.cambio) >= 1 && largo(r.cambio) <= TOPE_DEL_CAMBIO,
    fechasBien && clavesBien,
    tope != null && minimo != null && Number.isFinite(minimo) && tope >= minimo,
    largo(r.brief) >= 1 && largo(r.brief) <= TOPE_DEL_BRIEF,
  ]
}

/** el mínimo que devuelve la plataforma (`{ ok: true, minimo_usd }`); null si no vino un número positivo */
export function minimoDeLaRespuesta(j: unknown): number | null {
  if (!j || typeof j !== "object") return null
  const o = j as Record<string, unknown>
  const m = Number(o.minimo_usd)
  return o.ok === true && typeof o.minimo_usd !== "boolean" && o.minimo_usd !== null && Number.isFinite(m) && m > 0 ? m : null
}

/** el cuerpo que va a `POST /api/acciones/crear-campana` (y de ahí, tal cual, a la plataforma) */
export function cuerpoDeCrear(clienteId: string, llave: string, r: RespuestasDeCrear) {
  return {
    client_id: clienteId,
    llave_formulario: llave,
    nombre: r.nombre.trim(),
    cambio: r.cambio.trim(),
    fecha_inicio: r.inicio,
    fecha_fin: r.fin,
    fechas_clave: clavesLlenas(r.claves),
    tope_usd: topeEscrito(r.tope),
    brief_libre: r.brief.trim(),
  }
}

type Cuerpo = Record<string, unknown>
export type ValidacionDeCrear = { ok: true; cuerpo: Cuerpo } | { ok: false; error: string; detalle: string }
const mal = (detalle: string): ValidacionDeCrear => ({ ok: false, error: "pedido_invalido", detalle })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "")

/**
 * la validación del SERVIDOR del tablero (la pantalla puede mentir): mismas reglas que `pasosListos`, salvo el mínimo,
 * que lo exige la plataforma con su propio cálculo (409 `tope_bajo_minimo`, contrato de CC1). Devuelve el cuerpo limpio que se reenvía.
 */
export function validarCrear(c: Cuerpo, hoy = hoyEnEcuador()): ValidacionDeCrear {
  const cliente = typeof c.client_id === "string" && UUID.test(c.client_id) ? c.client_id : null
  if (!cliente) return mal("falta el cliente")
  const llave = typeof c.llave_formulario === "string" && LLAVE.test(c.llave_formulario) ? c.llave_formulario : null
  if (!llave) return mal("falta la llave del pedido")
  const nombre = txt(c.nombre), cambio = txt(c.cambio), brief = txt(c.brief_libre)
  if (nombre.length < 1 || nombre.length > TOPE_DEL_NOMBRE) return mal(`el nombre va de 1 a ${TOPE_DEL_NOMBRE} caracteres`)
  if (cambio.length < 1 || cambio.length > TOPE_DEL_CAMBIO) return mal(`el cambio va de 1 a ${TOPE_DEL_CAMBIO.toLocaleString("es-EC")} caracteres`)
  if (brief.length < 1 || brief.length > TOPE_DEL_BRIEF) return mal(`el brief va de 1 a ${TOPE_DEL_BRIEF.toLocaleString("es-EC")} caracteres`)
  const inicio = c.fecha_inicio, fin = c.fecha_fin
  if (!esFecha(inicio) || !esFecha(fin)) return mal("faltan las fechas de inicio y fin")
  if (inicio < hoy) return mal("el inicio no puede ser antes de hoy")
  const d = dias(inicio, fin)
  if (d <= 0) return mal("el fin va después del inicio")
  if (d > DIAS_MAXIMOS_DE_CAMPANA) return mal(`la campaña dura como máximo ${DIAS_MAXIMOS_DE_CAMPANA} días`)
  if (!Array.isArray(c.fechas_clave) || c.fechas_clave.length > TOPE_DE_FECHAS_CLAVE) return mal(`las fechas clave van en una lista de hasta ${TOPE_DE_FECHAS_CLAVE}`)
  const claves: FechaClave[] = []
  for (const x of c.fechas_clave) {
    const o = x && typeof x === "object" ? (x as Cuerpo) : {}
    const que = txt(o.que)
    if (!esFecha(o.fecha) || que.length < 1 || que.length > TOPE_DEL_QUE) return mal(`cada fecha clave lleva su fecha y qué pasa (hasta ${TOPE_DEL_QUE} caracteres)`)
    claves.push({ fecha: o.fecha, que })
  }
  const tope = typeof c.tope_usd === "number" && Number.isFinite(c.tope_usd) && c.tope_usd > 0 && c.tope_usd < 100_000_000 && Math.abs(Math.round(c.tope_usd * 100) - c.tope_usd * 100) < 1e-6 ? c.tope_usd : null
  if (tope == null) return mal("falta el tope")
  return { ok: true, cuerpo: { client_id: cliente, llave_formulario: llave, nombre, cambio, fecha_inicio: inicio, fecha_fin: fin, fechas_clave: claves, tope_usd: tope, brief_libre: brief } }
}

/** «5 dic 2026» */
export function fechaCorta(iso: string): string {
  if (!esFecha(iso)) return "—"
  const [a, m, d] = iso.split("-").map(Number)
  return `${d} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][m - 1]} ${a}`
}

/** «US$ 150» · «US$ 150,50» */
export const dolares = (n: number) => `US$ ${n.toLocaleString("es-EC", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

export interface FechasDelMinimo { inicio: string; fin: string }
/** las fechas con que se pide el mínimo: las dos bien escritas y el fin después del inicio; si no, ninguna (la plataforma pide «las dos o ninguna») */
export function fechasDelMinimo(inicio: unknown, fin: unknown): FechasDelMinimo | null {
  return esFecha(inicio) && esFecha(fin) && dias(inicio, fin) > 0 ? { inicio, fin } : null
}
/** el mínimo que trae el 409 `tope_bajo_minimo` de la plataforma (el de las fechas de la campaña); null si no trae uno válido */
export function minimoDelRechazo(j: Record<string, unknown> | null): number | null {
  const p = j?.plataforma && typeof j.plataforma === "object" ? (j.plataforma as Record<string, unknown>) : null
  return p ? minimoDeLaRespuesta({ ok: true, minimo_usd: p.minimo_usd }) : null
}
export interface DepsDelMinimo { plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch }
export type RespuestaDelMinimo = { status: number; cuerpo: { ok: true; minimo_usd: number } | { ok: false; error: string } }
/** sin Plan de Marketing aprobado no hay campaña nueva (409 de la plataforma): la pantalla lo dice */
export const SIN_PLAN_APROBADO = "sin_plan_aprobado"

/**
 * el mínimo del tope para ESTE cliente (la planificación más una pieza en su peor caso), de la ruta de solo lectura de la plataforma
 * `GET /api/tablero-minimo-de-campana?client_id=…&fecha_inicio=…&fecha_fin=…` (CC1, entrega 2 · #1259). El mínimo DEPENDE DE LAS FECHAS: sin ellas la plataforma
 * usa la ventana del plan, y al crear compara con el de las fechas de la campaña (21-nov · 🟡 de CC5 y CC7). Sin respuesta válida no hay mínimo y el formulario
 * no deja crear: nunca se inventa uno.
 */
export async function leerMinimo(clienteId: string, d: DepsDelMinimo = {}, fechas: FechasDelMinimo | null = null): Promise<RespuestaDelMinimo> {
  if (!UUID.test(clienteId)) return { status: 400, cuerpo: { ok: false, error: "falta_el_cliente" } }
  const base = (d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app").replace(/\/+$/, "")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { status: 503, cuerpo: { ok: false, error: "llave_interna_sin_poner" } }
  try {
    const conFechas = fechas ? `&fecha_inicio=${encodeURIComponent(fechas.inicio)}&fecha_fin=${encodeURIComponent(fechas.fin)}` : ""
    const r = await (d.fetchImpl ?? fetch)(`${base}/api/tablero-minimo-de-campana?client_id=${encodeURIComponent(clienteId)}${conFechas}`, { headers: { "x-api-key": llave }, cache: "no-store" })
    if (r.status === 404 || r.status === 405) return { status: 501, cuerpo: { ok: false, error: "todavia_no_disponible" } }
    const j = await r.json().catch(() => null)
    if (r.status === 409 && j && (j as Record<string, unknown>).error === SIN_PLAN_APROBADO) return { status: 409, cuerpo: { ok: false, error: SIN_PLAN_APROBADO } }
    const minimo = r.ok ? minimoDeLaRespuesta(j) : null
    return minimo == null ? { status: 502, cuerpo: { ok: false, error: "sin_minimo" } } : { status: 200, cuerpo: { ok: true, minimo_usd: minimo } }
  } catch {
    return { status: 502, cuerpo: { ok: false, error: "plataforma_sin_respuesta" } }
  }
}
