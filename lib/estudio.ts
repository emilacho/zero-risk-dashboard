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
  /** en la papelera desde (GO 09-nov 22:45Z) · null o ausente = en la galería */
  en_papelera_desde?: string | null
}

export interface Catalogo {
  listos: { imagen: boolean; video: boolean; "3d": boolean; almacen: boolean; animar?: boolean; varias?: boolean }
  /** imagen con 2 o más referencias (GO 09-nov 22:45Z) · falta mientras la plataforma no lo tenga */
  varias?: { modelo: string; nombre: string; minimo: number; maximo: number; resolucion: string; precio_usd: number }
  imagen: { modelo: string; formatos: string[]; precio: Record<string, { sin_foto: number; con_foto: number }> }
  video: { modelos: Array<{ id: string; nombre: string }>; formatos: string[]; resoluciones: string[]; segundos: { min: number; max: number } }
  "3d": { modelos: Array<{ id: string; nombre: string; nota: string; precio: { normal: number; alta: number } }>; imagen_previa_usd: number }
  /** animar un modelo 3D (GO 06-nov) · falta mientras la plataforma no lo tenga */
  animar?: { precio: { base: number; por_movimiento: number }; maximo: number; comunes: Array<{ id: number; nombre: string }>; biblioteca: Array<readonly [number, string, string]> }
}

export interface Cotizacion { total_usd: number; partes: Array<{ que: string; usd: number }> }

/** lo que la puerta deja pasar a la plataforma: nada más */
export const RUTAS_DEL_ESTUDIO: Readonly<Record<string, "GET" | "POST">> = { catalogo: "GET", piezas: "GET", pieza: "GET", cotizar: "POST", crear: "POST", animar: "POST", papelera: "GET", "mover-a-papelera": "POST", recuperar: "POST" }

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

/** el cuerpo de una creación: el pedido con una clave nueva siempre (sin clave la plataforma no puede evitar el doble cobro) */
export const cuerpoDeCreacion = (pedido: Record<string, unknown>, clave: string = claveNueva()) => ({ ...pedido, clave })

/** la galería se pide siempre por cliente: nunca sin client_id */
export const rutaDeGaleria = (clienteId: string) => `/api/estudio/piezas?client_id=${encodeURIComponent(clienteId)}`

/** solo entra a la galería lo que es del cliente que está a la vista (una respuesta tardía o una pieza de otro cliente se descarta) */
export function piezasDelCliente(clienteVisto: string | null, actuales: Pieza[], nuevas: Pieza[], reemplazar: boolean): Pieza[] {
  const suyas = nuevas.filter((p) => !!clienteVisto && p.client_id === clienteVisto)
  if (reemplazar) return suyas
  return [...suyas, ...actuales.filter((p) => !suyas.some((n) => n.id === p.id))]
}

/** cuánto suele tardar cada tipo (con holgura): pasado eso la pieza dice que tarda más de lo normal, en vez de «Creando…» sin fin */
export const MINUTOS_NORMALES: Record<TipoDePieza, number> = { imagen: 5, video: 20, "3d": 20 }
export function tardaMasDeLoNormal(p: Pick<Pieza, "tipo" | "estado" | "creado_en">, ahoraMs: number): boolean {
  const desde = Date.parse(p.creado_en)
  return p.estado === "creando" && Number.isFinite(desde) && ahoraMs - desde > MINUTOS_NORMALES[p.tipo] * 60_000
}

export const NOMBRE_DEL_TIPO: Record<TipoDePieza, string> = { imagen: "Imagen", video: "Video", "3d": "3D" }

/** ¿hay texto suficiente? En 3D con foto el texto sobra (se convierte la foto) */
export const textoListo = (tipo: TipoDePieza, texto: string, conFoto: boolean) => texto.trim().length >= 3 || (tipo === "3d" && conFoto)

/** la pista del botón cuando solo falta el texto; en escritorio no se muestra (boceto aprobado 09-nov: «Crear» centrado) */
export const PISTA_DE_TEXTO = "escribe qué quieres"
/** un aviso largo («proveedor no conectado todavía», «sin precio: …») taparía «Crear» centrado en la columna de 400 px (CC6 #304) */
export const LARGO_MAXIMO_CENTRADO = 20
/** ¿«Crear» va centrado en escritorio? Sí con el precio, la pista oculta o un aviso corto; con un aviso largo vuelve a la izquierda */
export const crearCentrado = (costo: string) => costo === PISTA_DE_TEXTO || costo.length <= LARGO_MAXIMO_CENTRADO
/** clases del botón que cambian con el costo: centrado en escritorio (el costo queda a la derecha sin empujarlo) o como antes */
export const claseDelCentrado = (costo: string) => (crearCentrado(costo) ? "relative md:justify-center" : "")
/** clases del costo dentro del botón: centrado, va a la derecha sin empujar «Crear»; la pista se oculta en escritorio */
export const claseDelCosto = (costo: string) => `text-dato font-medio opacity-90${crearCentrado(costo) ? " md:absolute md:right-4" : ""}${costo === PISTA_DE_TEXTO ? " md:hidden" : ""}`

/**
 * El botón Crear: solo se enciende con cliente, texto, proveedor conectado y una COTIZACIÓN en la mano (el dueño ve el costo antes, siempre).
 * Sin precio (p. ej. el proveedor de video no cotizó) no se crea. Sin tope: ningún monto apaga el botón.
 */
export function estadoDelBoton(x: { clienteId: string | null; textoListo: boolean; listo: boolean | null; cotizacion: Cotizacion | null; cotizando: boolean; sinPrecio: string | null; creando: boolean }): { habilitado: boolean; costo: string } {
  const habilitado = !!x.clienteId && x.textoListo && x.listo === true && !!x.cotizacion && !x.creando && !x.cotizando
  const costo = x.listo === false ? "proveedor no conectado todavía" : x.sinPrecio ? "sin precio: no se puede crear" : x.cotizando ? "cotizando…" : x.cotizacion ? `≈ ${dolares(x.cotizacion.total_usd)}` : !x.clienteId ? "elige el cliente" : PISTA_DE_TEXTO
  return { habilitado, costo }
}

export interface Opciones { formato: string; modelo3d: string; calidad: "normal" | "alta"; modeloVideo: string; segundos: number; resolucion: string }

// ── varias imágenes (GO 09-nov 22:45Z · boceto aprobado por Emilio + los 4 puntos de CC6) ────────────

/** el máximo de imágenes adjuntas (la primera prueba pagada confirma el real del proveedor) */
export const MAXIMO_DE_IMAGENES = 6
export const FORMATOS_DE_SUBIDA = ["image/png", "image/jpeg", "image/webp"] as const
export type ImagenAdjunta = { numero: number } & ({ b64: string } | { pieza_id: string })

/** las imágenes en el orden de sus números: el mismo con que salen hacia el modelo */
export const enOrden = <T extends { numero: number }>(lista: readonly T[]): T[] => [...lista].sort((a, b) => a.numero - b.numero)

/**
 * agregar imágenes: cada una toma el número libre más bajo (del 1 al máximo). Las que ya estaban NO cambian de número (punto 1 de CC6).
 * Las que no caben quedan afuera y se cuentan (punto 3).
 */
export function agregarImagenes<T extends { numero: number }>(actuales: readonly T[], nuevas: ReadonlyArray<Omit<T, "numero">>, maximo = MAXIMO_DE_IMAGENES): { lista: T[]; fuera: number } {
  const lista = [...actuales]
  let fuera = 0
  for (const n of nuevas) {
    const libre = Array.from({ length: maximo }, (_, i) => i + 1).find((k) => !lista.some((x) => x.numero === k))
    if (libre === undefined) { fuera++; continue }
    lista.push({ ...n, numero: libre } as T)
  }
  return { lista, fuera }
}

/** quitar una imagen: las demás conservan su número */
export const quitarImagen = <T extends { numero: number }>(lista: readonly T[], numero: number): T[] => lista.filter((x) => x.numero !== numero)

/** de los archivos elegidos, cuáles se suben y cuáles no (formato que no sirve · no caben), para decirlo en una línea; nunca un fallo mudo */
export function revisarArchivos<T extends { name: string; type: string }>(archivos: readonly T[], libres: number): { suben: T[]; formato: string[]; sinCupo: string[] } {
  const buenos = archivos.filter((a) => (FORMATOS_DE_SUBIDA as readonly string[]).includes(a.type))
  const cupo = Math.max(0, libres)
  return { suben: buenos.slice(0, cupo), formato: archivos.filter((a) => !buenos.includes(a)).map((a) => a.name), sinCupo: buenos.slice(cupo).map((a) => a.name) }
}

/** la línea que explica qué quedó afuera al subir */
export function lineaDeLoQueNoSubio(x: { formato: string[]; sinCupo: string[]; fallidas?: string[] }, maximo = MAXIMO_DE_IMAGENES): string | null {
  const partes: string[] = []
  if (x.sinCupo.length) partes.push(`No cupieron (máximo ${maximo}): ${x.sinCupo.join(", ")}`)
  if (x.formato.length) partes.push(`No son png, jpg ni webp: ${x.formato.join(", ")}`)
  if (x.fallidas?.length) partes.push(`No se pudieron leer: ${x.fallidas.join(", ")}`)
  return partes.length ? `${partes.join(". ")}.` : null
}

/** Video y 3D aceptan una sola imagen: se conservan todas y se usa la de número más bajo, con una línea que lo dice (punto 2 de CC6) */
export function avisoDeUnaSola(tipo: TipoDePieza, lista: ReadonlyArray<{ numero: number }>): string | null {
  if (tipo === "imagen" || lista.length < 2) return null
  return `${NOMBRE_DEL_TIPO[tipo]} usa solo la imagen ${enOrden(lista)[0].numero}; las demás quedan guardadas para Imagen.`
}

/** el texto bajo «Crear» con varias referencias: «Imagen con 3 referencias · US$ 0,15» (boceto aprobado) */
export function lineaDeReferencias(c: Cotizacion | null): string | null {
  if (!c || c.partes.length !== 1 || !/referencias/.test(c.partes[0].que)) return null
  const que = c.partes[0].que
  return `${que.charAt(0).toUpperCase()}${que.slice(1)} · ${dolares(c.partes[0].usd)}`
}

/** el cuerpo que va a la plataforma: solo los campos de ese tipo. Imagen con 2 o más → `fotos` en el orden de sus números; si no, la de número más bajo */
export function cuerpoDelPedido(clienteId: string | null, tipo: TipoDePieza, texto: string, o: Opciones, adjuntas: { b64: string } | { pieza_id: string } | readonly ImagenAdjunta[] | null): Record<string, unknown> {
  const lista: ImagenAdjunta[] = !adjuntas ? [] : Array.isArray(adjuntas) ? enOrden(adjuntas as readonly ImagenAdjunta[]) : [{ ...(adjuntas as { b64: string } | { pieza_id: string }), numero: 1 }]
  const foto = lista[0] ?? null
  const base: Record<string, unknown> = { client_id: clienteId, tipo, prompt: texto }
  if (tipo === "imagen") base.formato = o.formato
  if (tipo === "3d") Object.assign(base, { modelo: o.modelo3d, calidad: o.calidad })
  if (tipo === "video") Object.assign(base, { modelo: o.modeloVideo, formato: ["9:16", "16:9", "1:1"].includes(o.formato) ? o.formato : "9:16", segundos: o.segundos, resolucion: o.resolucion })
  if (tipo === "imagen" && lista.length >= 2) {
    base.fotos = lista.map((x) => ("b64" in x ? { numero: x.numero, b64: x.b64 } : { numero: x.numero, pieza_id: x.pieza_id }))
    return base
  }
  if (foto && "b64" in foto) base.foto_b64 = foto.b64
  if (foto && "pieza_id" in foto) base.foto_pieza_id = foto.pieza_id
  return base
}

/** lo que se manda a cotizar: sin las fotos (el precio solo depende de si las hay y de cuántas) */
export function cuerpoDeCotizacion(cuerpo: Record<string, unknown>): Record<string, unknown> {
  const sinFoto = Object.fromEntries(Object.entries(cuerpo).filter(([k]) => k !== "foto_b64" && k !== "foto_pieza_id" && k !== "fotos"))
  const n = Array.isArray(cuerpo.fotos) ? cuerpo.fotos.length : 0
  return { ...sinFoto, prompt: (typeof sinFoto.prompt === "string" && sinFoto.prompt) || "cotización", con_foto: "foto_b64" in cuerpo || "foto_pieza_id" in cuerpo || n > 0, ...(n ? { n_fotos: n } : {}) }
}

// ── la ✕ y la papelera (decisión B de Emilio · GO 09-nov 22:45Z) ─────────────

export const DIAS_EN_LA_PAPELERA = 30
/** una pieza que se está creando no se manda a la papelera (su cobro se anota al terminar) */
export const sePuedeQuitar = (p: Pick<Pieza, "estado">) => p.estado !== "creando"
/** días que le quedan en la papelera (misma cuenta que la plataforma) */
export function diasQueQuedan(desde: string | null | undefined, ahoraMs: number): number {
  const t = Date.parse(desde ?? "")
  if (!Number.isFinite(t)) return DIAS_EN_LA_PAPELERA
  return Math.max(0, Math.ceil((t + DIAS_EN_LA_PAPELERA * 86_400_000 - ahoraMs) / 86_400_000))
}
export const textoDeDias = (n: number) => (n === 0 ? "se borra hoy" : n === 1 ? "se borra mañana" : `se borra en ${n} días`)
export const rutaDePapelera = (clienteId: string) => `/api/estudio/papelera?client_id=${encodeURIComponent(clienteId)}`

// ── animar un modelo 3D (GO de Lenovo 06-nov) ─────────────────────────────────

/** el modelo de la animación (lo fija la plataforma) */
export const MODELO_DE_ANIMACION = "meshy-animar"

/** se anima un 3D listo en GLB que no sea ya una animación */
export const esAnimable = (p: Pick<Pieza, "tipo" | "estado" | "archivo_tipo" | "modelo">) => p.tipo === "3d" && p.estado === "lista" && p.archivo_tipo === "glb" && p.modelo !== MODELO_DE_ANIMACION

/** el costo antes de crear: esqueleto + cada movimiento (misma cuenta que la plataforma) */
export function cotizarAnimacion(precio: { base: number; por_movimiento: number }, n: number): Cotizacion {
  const partes = [{ que: "esqueleto", usd: precio.base }, { que: `${n} movimiento${n === 1 ? "" : "s"}`, usd: +(precio.por_movimiento * n).toFixed(4) }]
  return { total_usd: +partes.reduce((s, x) => s + x.usd, 0).toFixed(4), partes }
}

/** marcar o desmarcar un movimiento, sin pasar del máximo */
export function alternarMovimiento(elegidos: number[], id: number, maximo: number): number[] {
  if (elegidos.includes(id)) return elegidos.filter((x) => x !== id)
  return elegidos.length >= maximo ? elegidos : [...elegidos, id]
}

/** el botón «Animar»: se enciende con cliente, la función conectada y al menos un movimiento; el costo siempre a la vista */
export function estadoDeAnimar(x: { clienteId: string | null; conectado: boolean; cotizacion: Cotizacion | null; enviando: boolean }): { habilitado: boolean; costo: string } {
  const habilitado = !!x.clienteId && x.conectado && !!x.cotizacion && !x.enviando
  return { habilitado, costo: x.cotizacion ? dolares(x.cotizacion.total_usd) : "elige un movimiento" }
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

/** el buscador de la biblioteca: por nombre o grupo (los guiones bajos cuentan como espacios); vacío no muestra nada */
export function buscarMovimientos(biblioteca: ReadonlyArray<readonly [number, string, string]>, consulta: string, tope = 40): Array<readonly [number, string, string]> {
  const q = sinTildes(consulta.trim()).replace(/_/g, " ")
  if (q.length < 2) return []
  return biblioteca.filter(([, nombre, grupo]) => sinTildes(nombre).replace(/_/g, " ").includes(q) || sinTildes(grupo).includes(q)).slice(0, tope)
}

/** el nombre que se muestra de un movimiento: el común si lo es, si no el de la biblioteca sin guiones bajos */
export function nombreDelMovimiento(cat: Catalogo["animar"] | undefined, id: number): string {
  const comun = cat?.comunes.find((m) => m.id === id)
  if (comun) return comun.nombre
  const fila = cat?.biblioteca.find((m) => m[0] === id)
  return fila ? fila[1].replace(/_/g, " ") : `#${id}`
}

export interface Clip { action_id: number; nombre: string; glb: string | null; fbx: string | null }

/** los movimientos guardados de una animación (vacío si no lo es o si aún no termina) */
export function clipsDe(p: Pick<Pieza, "modelo" | "parametros">): Clip[] {
  if (p.modelo !== MODELO_DE_ANIMACION || !Array.isArray(p.parametros?.archivos)) return []
  return (p.parametros.archivos as unknown[]).filter((x): x is Clip => !!x && typeof x === "object" && typeof (x as Clip).action_id === "number")
}

/** qué hacer con la respuesta de animar: un error se muestra; la pieza de otro cliente (Emilio cambió de cliente mientras tanto) no entra */
export function respuestaDeAnimar(j: { ok?: boolean; pieza?: Pieza; error?: string; detalle?: string }, status: number, clienteVisto: string | null): { error: string } | { otroCliente: true } | { pieza: Pieza } {
  if (!j.ok || !j.pieza) return { error: j.detalle ?? j.error ?? `No se pudo animar (${status}).` }
  if (j.pieza.client_id !== clienteVisto) return { otroCliente: true }
  return { pieza: j.pieza }
}

/** el pedido de animación que va a la plataforma */
export const cuerpoDeAnimacion = (clienteId: string, piezaId: string, movimientos: number[], clave: string = claveNueva()) => ({ client_id: clienteId, origen_pieza_id: piezaId, movimientos, clave })
