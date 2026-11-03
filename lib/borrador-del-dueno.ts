/**
 * EL BORRADOR DE «TUS CAMBIOS» (CC6 · 03-nov · corrección de Lenovo 18:13Z: «Tus cambios se pierden al cerrar el manual»).
 * Cada acción pendiente se guarda sola en la PLATAFORMA (contrato CC1 #872), por cliente y por versión del documento: al volver a abrir el manual,
 * en este u otro equipo, «Tus cambios» aparece igual. Rutas propias de la plataforma, no `/api/tablero` (esa deja una fila imborrable por toque).
 *   GET    /api/borradores-del-dueno?client_id&documento  → { ok, borrador: null | { documento_id, acciones, revision, actualizado_en, … } }
 *   PUT    /api/borradores-del-dueno { client_id, documento, documento_id, acciones, revision_base? }  → { ok, borrador } · 409 borrador_cambio
 *   DELETE /api/borradores-del-dueno?client_id&documento  → { ok, borrador: null }
 * El tablero no escribe la base: esta capa valida y pasa con la llave interna; la pantalla llama a `/api/borrador`.
 */
import type { TusCambios } from "@/lib/pedido-del-manual"

export type DocumentoDelBorrador = "manual" | "plan"
export interface BorradorDelDueno { documento_id: string; acciones: TusCambios; revision: number | null; actualizado_en: string | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** el límite real del pedido (CC1 #872) */
export const TOPE_DEL_BORRADOR = 600_000
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const textos = (v: unknown): Record<string, string> => (esObjeto(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "string")) as Record<string, string> : {})

/** lo que vuelve de la plataforma, leído con cuidado: lo que no tenga forma de «Tus cambios» no se pinta */
export function borradorLeido(b: unknown): BorradorDelDueno | null {
  if (!esObjeto(b) || typeof b.documento_id !== "string" || !esObjeto(b.acciones)) return null
  const a = b.acciones
  const acciones: TusCambios = {
    campos: textos(a.campos),
    como: textos(a.como) as TusCambios["como"],
    notas: textos(a.notas),
    libre: typeof a.libre === "string" ? a.libre : "",
    ...(esObjeto(a.detalle) ? { detalle: textos(a.detalle) } : {}),
  }
  return { documento_id: b.documento_id, acciones, revision: typeof b.revision === "number" ? b.revision : null, actualizado_en: typeof b.actualizado_en === "string" ? b.actualizado_en : null }
}

/** vacío = no hay nada pendiente (se borra en vez de guardar) */
export const borradorVacio = (c: TusCambios) => !Object.keys(c.campos).length && !Object.keys(c.notas).length && !c.libre.trim()

/** «borrador guardado · hace N min» */
export function haceCuanto(iso: string | null, ahora: Date): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return "borrador guardado"
  const min = Math.max(0, Math.floor((ahora.getTime() - Date.parse(iso)) / 60_000))
  return min < 1 ? "borrador guardado · hace un momento" : min < 60 ? `borrador guardado · hace ${min} min` : `borrador guardado · hace ${Math.floor(min / 60)} h`
}

// ── la capa del servidor del tablero (la usa `app/api/borrador/route.ts`) ──
export interface DepsDelBorrador { plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch; revisor?: string }
type Salida = { status: number; cuerpo: Record<string, unknown> }
const mal = (detalle: string): Salida => ({ status: 400, cuerpo: { ok: false, error: "pedido_invalido", detalle } })

export async function pasarAlBorrador(metodo: "GET" | "PUT" | "DELETE", entrada: Record<string, unknown>, d: DepsDelBorrador = {}): Promise<Salida> {
  const client_id = String(entrada.client_id ?? ""), documento = String(entrada.documento ?? "")
  if (!UUID.test(client_id)) return mal("falta el cliente")
  if (documento !== "manual" && documento !== "plan") return mal("el documento es «manual» o «plan»")
  let cuerpo: string | undefined
  if (metodo === "PUT") {
    if (typeof entrada.documento_id !== "string" || !entrada.documento_id.trim()) return mal("falta la versión del documento")
    if (!esObjeto(entrada.acciones)) return mal("faltan los cambios")
    const rb = entrada.revision_base
    if (rb !== undefined && (typeof rb !== "number" || !Number.isInteger(rb) || rb < 0)) return mal("la revisión base no es válida")
    cuerpo = JSON.stringify({ client_id, documento, documento_id: entrada.documento_id, acciones: entrada.acciones, ...(rb !== undefined ? { revision_base: rb } : {}), reviewer: d.revisor ?? "emilio" })
    if (cuerpo.length > TOPE_DEL_BORRADOR) return mal(`el borrador pasa de ${TOPE_DEL_BORRADOR.toLocaleString("es-EC")} caracteres`)
  }
  const base = (d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app").replace(/\/+$/, "")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { status: 503, cuerpo: { ok: false, error: "llave_interna_sin_poner", detalle: "el tablero no tiene la llave con la que llama a la plataforma" } }
  const url = `${base}/api/borradores-del-dueno${metodo === "PUT" ? "" : `?client_id=${encodeURIComponent(client_id)}&documento=${documento}`}`
  try {
    const r = await (d.fetchImpl ?? fetch)(url, { method: metodo, headers: { "Content-Type": "application/json", "x-api-key": llave }, ...(cuerpo ? { body: cuerpo } : {}), cache: "no-store" })
    const j = await r.json().catch(() => ({})) as Record<string, unknown>
    if (r.status === 404 || r.status === 405) return { status: 501, cuerpo: { ok: false, error: "todavia_no_disponible", detalle: "la plataforma todavía no guarda borradores" } }
    return { status: r.status, cuerpo: esObjeto(j) ? j : {} }
  } catch (e) {
    return { status: 502, cuerpo: { ok: false, error: "plataforma_sin_respuesta", detalle: e instanceof Error ? e.message : String(e) } }
  }
}

// ── lo que llama la pantalla ──
type Fetch = typeof fetch
export async function leerBorrador(cliente: string, documento: DocumentoDelBorrador, f: Fetch = fetch): Promise<{ ok: boolean; borrador: BorradorDelDueno | null }> {
  try {
    const r = await f(`/api/borrador?client_id=${encodeURIComponent(cliente)}&documento=${documento}`, { cache: "no-store" })
    const j = await r.json().catch(() => ({})) as Record<string, unknown>
    return r.ok && j.ok ? { ok: true, borrador: borradorLeido(j.borrador) } : { ok: false, borrador: null }
  } catch { return { ok: false, borrador: null } }
}
export async function guardarBorrador(cliente: string, documento: DocumentoDelBorrador, documento_id: string, acciones: TusCambios, revision_base: number | null, f: Fetch = fetch): Promise<{ ok: boolean; borrador: BorradorDelDueno | null; otroEquipo: boolean }> {
  try {
    const r = await f("/api/borrador", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id: cliente, documento, documento_id, acciones, ...(revision_base != null ? { revision_base } : {}) }) })
    const j = await r.json().catch(() => ({})) as Record<string, unknown>
    if (r.status === 409 && j.error === "borrador_cambio") return { ok: false, borrador: borradorLeido(j.borrador), otroEquipo: true }
    return { ok: r.ok && j.ok === true, borrador: borradorLeido(j.borrador), otroEquipo: false }
  } catch { return { ok: false, borrador: null, otroEquipo: false } }
}
export async function borrarBorrador(cliente: string, documento: DocumentoDelBorrador, f: Fetch = fetch): Promise<boolean> {
  try {
    const r = await f(`/api/borrador?client_id=${encodeURIComponent(cliente)}&documento=${documento}`, { method: "DELETE" })
    return r.ok
  } catch { return false }
}

// ── las decisiones del panel, puras (se prueban sin navegador) ──
/** al abrir el manual: el borrador de ESTA versión vuelve a «Tus cambios»; el de otra versión se pregunta; vacío o sin borrador, nada */
export function queHacerAlAbrir(b: BorradorDelDueno | null, manualId: string): { tipo: "recuperar"; acciones: TusCambios } | { tipo: "preguntar"; borrador: BorradorDelDueno } | { tipo: "nada" } {
  if (!b || borradorVacio(b.acciones)) return { tipo: "nada" }
  return b.documento_id === manualId ? { tipo: "recuperar", acciones: b.acciones } : { tipo: "preguntar", borrador: b }
}
/**
 * qué hacer con lo que hay en pantalla: nada (no se leyó aún el borrador de este manual, o no cambió), borrar (quedó vacío) o guardar.
 * Un borrador de la versión anterior sin decidir no se borra solo: se espera a que Emilio elija «Seguir con él» o «Descartar».
 */
export function pasoDelGuardado(o: { leido: boolean; igualAlUltimo: boolean; vacio: boolean; hayViejoSinDecidir: boolean; /** hay un borrador guardado que borrar */ hayGuardado: boolean }): "nada" | "borrar" | "guardar" {
  if (!o.leido || o.igualAlUltimo) return "nada"
  if (o.vacio) return o.hayViejoSinDecidir || !o.hayGuardado ? "nada" : "borrar"
  return "guardar"
}
