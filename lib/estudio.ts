/**
 * EL ESTUDIO DE LA CÁMARA (dpto de marketing · GO de Lenovo 05-nov) · lo que comparten el panel y la puerta del tablero.
 * El tablero no llama a los proveedores ni ve sus llaves: todo pasa por `/api/estudio/*` (solo administrador) y de ahí a la plataforma con la llave interna.
 * Sin tope de gasto (firma de Emilio): el costo se cotiza ANTES de crear y se muestra en el botón.
 */

export type TipoDePieza = "imagen" | "video" | "3d"
export type EstadoDePieza = "creando" | "lista" | "fallida"

export interface Pieza {
  id: string
  client_id: string
  tipo: TipoDePieza
  estado: EstadoDePieza
  paso: string | null
  prompt: string
  modelo: string
  parametros: Record<string, unknown>
  foto_partida_url: string | null
  costo_estimado_usd: number | string
  costo_usd: number | string
  archivo_url: string | null
  archivo_tipo: string | null
  miniatura_url: string | null
  aviso: string | null
  error: string | null
  creado_en: string
  terminado_en: string | null
}

export interface Catalogo {
  listos: { imagen: boolean; video: boolean; "3d": boolean; almacen: boolean }
  imagen: { modelo: string; formatos: string[]; precio: Record<string, { sin_foto: number; con_foto: number }> }
  video: { modelos: Array<{ id: string; nombre: string }>; formatos: string[]; resoluciones: string[]; segundos: { min: number; max: number } }
  "3d": { modelos: Array<{ id: string; nombre: string; nota: string; precio: { normal: number; alta: number } }>; imagen_previa_usd: number }
}

export interface Cotizacion { total_usd: number; partes: Array<{ que: string; usd: number }> }

/** lo que la puerta deja pasar a la plataforma: nada más */
export const RUTAS_DEL_ESTUDIO: Readonly<Record<string, "GET" | "POST">> = { catalogo: "GET", piezas: "GET", pieza: "GET", cotizar: "POST", crear: "POST" }

const sinBarra = (s: string) => s.replace(/\/+$/, "")

/** la llamada a la plataforma (servidor del tablero): ruta permitida, la llave interna puesta aquí, la respuesta tal cual */
export async function alEstudio(ruta: string, metodo: string, consulta: string, cuerpo: string | null, d: { fetch?: typeof fetch; base?: string; llave?: string } = {}): Promise<{ status: number; cuerpo: unknown }> {
  if (RUTAS_DEL_ESTUDIO[ruta] !== metodo) return { status: 404, cuerpo: { ok: false, error: "ruta_no_permitida" } }
  const base = sinBarra(d.base ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { status: 500, cuerpo: { ok: false, error: "llave_interna_no_configurada" } }
  // la consulta solo lleva los parámetros que usan las rutas
  const q = new URLSearchParams()
  const entrada = new URLSearchParams(consulta)
  for (const k of ["id", "client_id", "tipo", "limite"]) { const v = entrada.get(k); if (v) q.set(k, v) }
  try {
    const r = await (d.fetch ?? fetch)(`${base}/api/estudio/${ruta}${q.size ? `?${q}` : ""}`, {
      method: metodo,
      headers: { "x-api-key": llave, ...(cuerpo ? { "Content-Type": "application/json" } : {}) },
      body: metodo === "POST" ? cuerpo ?? "{}" : undefined,
      cache: "no-store",
    })
    const j = (await r.json().catch(() => null)) as unknown
    // la plataforma responde 404/405 sin JSON si todavía no tiene la ruta publicada: se dice, nunca se simula
    if (j === null) return (r.status === 404 || r.status === 405) ? { status: 501, cuerpo: { ok: false, error: "todavia_no_disponible" } } : { status: 502, cuerpo: { ok: false, error: "respuesta_no_json", status_plataforma: r.status } }
    return { status: r.status, cuerpo: j }
  } catch (e) {
    return { status: 502, cuerpo: { ok: false, error: "plataforma_no_responde", detalle: e instanceof Error ? e.message : String(e) } }
  }
}

/** dólares con la precisión que tiene sentido para una pieza (una imagen cuesta menos de 2 centavos) */
export function dolares(usd: number | string | null | undefined): string {
  const n = Number(usd)
  if (!Number.isFinite(n)) return "—"
  if (n === 0) return "US$ 0"
  const dec = n < 0.1 ? 3 : 2
  return `US$ ${n.toLocaleString("es-EC", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
}

/** una clave nueva por clic: la plataforma no cobra dos veces la misma */
export function claveNueva(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === "function") return `estudio-${c.randomUUID()}`
  return `estudio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export const NOMBRE_DEL_TIPO: Record<TipoDePieza, string> = { imagen: "Imagen", video: "Video", "3d": "3D" }

/** ¿hay texto suficiente? En 3D con foto el texto sobra (se convierte la foto) */
export const textoListo = (tipo: TipoDePieza, texto: string, conFoto: boolean) => texto.trim().length >= 3 || (tipo === "3d" && conFoto)

/**
 * El botón Crear: solo se enciende con cliente, texto, proveedor conectado y una COTIZACIÓN en la mano (el dueño ve el costo antes, siempre).
 * Sin precio (p. ej. el proveedor de video no cotizó) no se crea. Sin tope: ningún monto apaga el botón.
 */
export function estadoDelBoton(x: { clienteId: string | null; textoListo: boolean; listo: boolean | null; cotizacion: Cotizacion | null; cotizando: boolean; sinPrecio: string | null; creando: boolean }): { habilitado: boolean; costo: string } {
  const habilitado = !!x.clienteId && x.textoListo && x.listo === true && !!x.cotizacion && !x.creando && !x.cotizando
  const costo = x.listo === false ? "proveedor no conectado todavía" : x.sinPrecio ? "sin precio: no se puede crear" : x.cotizando ? "cotizando…" : x.cotizacion ? `≈ ${dolares(x.cotizacion.total_usd)}` : !x.clienteId ? "elige el cliente" : "escribe qué quieres"
  return { habilitado, costo }
}

export interface Opciones { formato: string; modelo3d: string; calidad: "normal" | "alta"; modeloVideo: string; segundos: number; resolucion: string }

/** el cuerpo que va a la plataforma: solo los campos de ese tipo; la foto, subida o de la galería */
export function cuerpoDelPedido(clienteId: string | null, tipo: TipoDePieza, texto: string, o: Opciones, foto: { b64: string } | { pieza_id: string } | null): Record<string, unknown> {
  const base: Record<string, unknown> = { client_id: clienteId, tipo, prompt: texto }
  if (tipo === "imagen") base.formato = o.formato
  if (tipo === "3d") Object.assign(base, { modelo: o.modelo3d, calidad: o.calidad })
  if (tipo === "video") Object.assign(base, { modelo: o.modeloVideo, formato: ["9:16", "16:9", "1:1"].includes(o.formato) ? o.formato : "9:16", segundos: o.segundos, resolucion: o.resolucion })
  if (foto && "b64" in foto) base.foto_b64 = foto.b64
  if (foto && "pieza_id" in foto) base.foto_pieza_id = foto.pieza_id
  return base
}

/** lo que se manda a cotizar: sin la foto (el precio solo depende de si la hay) */
export function cuerpoDeCotizacion(cuerpo: Record<string, unknown>): Record<string, unknown> {
  const sinFoto = Object.fromEntries(Object.entries(cuerpo).filter(([k]) => k !== "foto_b64" && k !== "foto_pieza_id"))
  return { ...sinFoto, prompt: (typeof sinFoto.prompt === "string" && sinFoto.prompt) || "cotización", con_foto: "foto_b64" in cuerpo || "foto_pieza_id" in cuerpo }
}
