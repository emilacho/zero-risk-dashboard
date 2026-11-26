/**
 * PROPUESTAS (Sprint 2 · boceto aprobado por Emilio 16-nov 22:23 · `raw/evidencia/2026-11-16-sprint2-tarjeta-propuestas/`).
 * La mesa presenta N propuestas en borrador UNA sola vez; Emilio elige una y la aprueba, o deja observaciones y la mesa vuelve a presentar.
 * Contrato de la plataforma: ADENDA 1 de CC1 en `raw/tasks/2026-11-16-RESPUESTA-CC1-a-CC2-CC3-CC5-sprint2-hoja-fase-y-propuestas.md`
 * (`Decision.tipo = 'propuestas'` con `propuestas: { encargo_id, brief_id, ronda, quedan_vueltas, avisos, lista[] }`), más los 3 campos opcionales
 * que pide la decisión de Emilio 22:23 (`video_url`, `costo`, `imagenes` por plano · `RESPUESTA-CC5-a-CC1-…-campos-de-video-y-costo.md`).
 * Lo que no cuadra con el contrato se descarta; lo que falta queda como «sin dato» (guion rojo): nada se inventa.
 */

export interface PlanoDePropuesta {
  n: number
  desde: number | null
  hasta: number | null
  /** el papel del plano en la historia (captar · situar · informar · prueba · giro · conclusion · llamado · ambiente u otro tal cual) */
  rol: string | null
  dice: string | null
  /** lo que se ve: se muestra en el cuadro vacío mientras no hay imagen */
  se_ve: string | null
  texto_en_pantalla: string | null
  producto: boolean | null
  /** los cuadros en borrador del plano (más de uno si dura más de 3 s); vacío = todavía no hay imagen */
  imagenes: string[]
  /** 17-nov · imagen: la lámina usa una foto propia del cliente (no generada). null = no se dijo */
  foto_propia: boolean | null
  /** 26-nov · de dónde salió la imagen, como lo dice la plataforma («imagen de tu web», «cuadro de tu video», «foto propia», «imagen generada»). null = no se dijo */
  origen_de_la_foto: string | null
}
/** 17-nov · el texto que acompaña la publicación de una pieza de imagen (pie, hashtags, llamado) */
export interface TextoDeLaPublicacion { texto_base: string | null; pie_de_foto: string | null; hashtags: string[]; llamado: string | null }
export interface PropuestaDeVideo {
  id: string
  nombre: string
  concepto: string | null
  segundos: number | null
  red: string | null
  objetivo: string | null
  por_que: string | null
  /** el borrador en video (animatic); null = todavía no está */
  video_url: string | null
  /** lo que costó el borrador y lo que costará el final (Emilio 22:23: «costo visible sí») */
  costo: { borrador_usd: number | null; final_usd: number | null }
  /** en imagen, cada lámina (carrusel/kit) o la pieza (post) viaja como un «plano» sin segundos */
  planos: PlanoDePropuesta[]
  /** 17-nov · imagen: el pie, los hashtags y el llamado de la publicación; null = no viene (video, o la mesa no lo escribió) */
  texto_de_la_publicacion: TextoDeLaPublicacion | null
}
/** 17-nov · contrato `CONTRATO-CC5-a-CC1-CC6-CC7-propuestas-en-imagen.md` §2: sin `familia`, video (como hasta hoy) */
export type FamiliaDePropuestas = "video" | "imagen"
export type ClaseDeImagen = "kit" | "carrusel" | "post_img"
const CLASES_DE_IMAGEN: readonly ClaseDeImagen[] = ["kit", "carrusel", "post_img"]
export interface Propuestas {
  encargo_id: string
  brief_id: string | null
  ronda: number
  /** cuántas rondas de cambios quedan; 0 = solo se puede aprobar. null = la plataforma no lo dijo (se ofrece pedir cambios y ella decide) */
  quedan_vueltas: number | null
  avisos: string[]
  lista: PropuestaDeVideo[]
  /** 17-nov · de qué es la pieza: video o imagen (en imagen, `clase` dice si es kit, carrusel o post; null = no se dijo) */
  familia: FamiliaDePropuestas
  clase: ClaseDeImagen | null
}

/** lo que el dueño escribe al pedir cambios (la puerta de la plataforma: 1 a 2.000) */
export const TOPE_OBSERVACIONES = 2000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)
const noNegativo = (v: unknown): number | null => { const n = num(v); return n != null && n >= 0 ? n : null }
/** solo direcciones web: un texto cualquiera no se pone como imagen ni como video */
const url = (v: unknown): string | null => { const t = txt(v); return t && /^https?:\/\//i.test(t) ? t : null }

function leerPlano(v: unknown, k: number): PlanoDePropuesta {
  const p = obj(v)
  // varios cuadros (`imagenes`) si vienen; si no, el único de `imagen_url` (ADENDA 1 de CC1)
  const varios = (Array.isArray(p.imagenes) ? p.imagenes : []).map(url).filter((x): x is string => !!x)
  const imagenes = varios.length ? varios : [url(p.imagen_url)].filter((x): x is string => !!x)
  return {
    n: num(p.n) ?? k + 1,
    desde: noNegativo(p.desde), hasta: noNegativo(p.hasta),
    rol: txt(p.rol), dice: txt(p.dice), se_ve: txt(p.se_ve), texto_en_pantalla: txt(p.texto_en_pantalla),
    producto: typeof p.producto === "boolean" ? p.producto : null,
    imagenes,
    foto_propia: typeof p.foto_propia === "boolean" ? p.foto_propia : null,
    origen_de_la_foto: txt(p.origen_de_la_foto),
  }
}

/** el texto de la publicación: solo si trae algo legible (si no, null: la tarjeta no inventa un pie) */
function leerTextoDeLaPublicacion(v: unknown): TextoDeLaPublicacion | null {
  const t = obj(v)
  const r = {
    texto_base: txt(t.texto_base), pie_de_foto: txt(t.pie_de_foto), llamado: txt(t.llamado),
    hashtags: (Array.isArray(t.hashtags) ? t.hashtags : []).map(txt).filter((x): x is string => !!x),
  }
  return r.texto_base || r.pie_de_foto || r.llamado || r.hashtags.length ? r : null
}

function leerPropuesta(v: unknown): PropuestaDeVideo | null {
  const p = obj(v)
  const id = txt(p.id), nombre = txt(p.nombre)
  if (!id || !nombre) return null
  const c = obj(p.costo)
  return {
    id, nombre,
    concepto: txt(p.concepto), segundos: noNegativo(p.segundos), red: txt(p.red), objetivo: txt(p.objetivo), por_que: txt(p.por_que),
    video_url: url(p.video_url),
    costo: { borrador_usd: noNegativo(c.borrador_usd), final_usd: noNegativo(c.final_usd) },
    planos: (Array.isArray(p.planos) ? p.planos : []).map(leerPlano),
    texto_de_la_publicacion: leerTextoDeLaPublicacion(p.texto_de_la_publicacion),
  }
}

/** las propuestas de una decisión, revisadas contra el contrato. Sin encargo, sin ronda o sin ninguna propuesta legible no hay nada que decidir: null */
export function leerPropuestas(v: unknown): Propuestas | null {
  const p = obj(v)
  const encargo = txt(p.encargo_id), ronda = num(p.ronda)
  if (!encargo || !UUID.test(encargo) || ronda == null || !Number.isInteger(ronda) || ronda < 1) return null
  const ids = new Set<string>()
  const lista = (Array.isArray(p.lista) ? p.lista : []).map(leerPropuesta).filter((x): x is PropuestaDeVideo => !!x && !ids.has(x.id) && !!ids.add(x.id))
  if (!lista.length) return null
  const qv = num(p.quedan_vueltas)
  return {
    encargo_id: encargo, brief_id: txt(p.brief_id), ronda,
    quedan_vueltas: qv != null && Number.isInteger(qv) && qv >= 0 ? qv : null,
    avisos: (Array.isArray(p.avisos) ? p.avisos : []).map(txt).filter((x): x is string => !!x),
    lista,
    // 17-nov · imagen: solo con `familia: 'imagen'` explícito; cualquier otra cosa (o nada) es video, como hasta hoy
    familia: p.familia === "imagen" ? "imagen" : "video",
    clase: p.familia === "imagen" && CLASES_DE_IMAGEN.includes(p.clase as ClaseDeImagen) ? (p.clase as ClaseDeImagen) : null,
  }
}

/** 17-nov · cómo se llama cada «plano» de una propuesta de imagen (contrato §3): «Lámina n» en historia y carrusel (aunque tengan una sola · obs. 2 de CC7),
 *  «Pieza» en la foto. Sin clase, «Pieza» si es una sola y «Lámina n» si son varias */
export function nombreDeLaLamina(clase: ClaseDeImagen | null, n: number, total: number): string {
  if (clase === "post_img") return "Pieza"
  return clase === null && total === 1 ? "Pieza" : `Lámina ${n}`
}

/** 17-nov · obs. 1 de CC7: los textos de la publicación que vengan, TODOS (texto, pie y llamado), sin repetir uno igual: nada se oculta al aprobar */
export function textosDeLaPublicacion(t: TextoDeLaPublicacion | null): Array<{ campo: "texto_base" | "pie_de_foto" | "llamado"; texto: string }> {
  if (!t) return []
  const vistos = new Set<string>()
  return (["texto_base", "pie_de_foto", "llamado"] as const).flatMap((campo) => {
    const texto = t[campo]
    if (!texto || vistos.has(texto)) return []
    vistos.add(texto)
    return [{ campo, texto }]
  })
}

/** 17-nov · la clase en palabras, para la ficha de la propuesta («Carrusel · 5 láminas») */
export function claseLegible(clase: ClaseDeImagen | null, laminas: number): string {
  const nombre = clase === "kit" ? "Historia" : clase === "carrusel" ? "Carrusel" : clase === "post_img" ? "Foto" : "Imagen"
  return clase === "post_img" ? nombre : `${nombre} · ${laminas} ${laminas === 1 ? "lámina" : "láminas"}`
}

/** «US$ 1,25» (o null si no hay dato: el dibujante pone el guion rojo) */
export function dolares(n: number | null): string | null {
  if (n == null) return null
  return `US$ ${n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** los segundos de un plano: «3–6 s»; sin uno de los dos extremos, null */
export function tramo(p: Pick<PlanoDePropuesta, "desde" | "hasta">): string | null {
  return p.desde != null && p.hasta != null ? `${fmt(p.desde)}–${fmt(p.hasta)} s` : null
}
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("es-EC", { maximumFractionDigits: 1 }))

/** el papel del plano en palabras: las claves de la biblioteca (CC4) con su tilde y mayúscula; otro papel, tal cual */
const ROL: Record<string, string> = { captar: "Captar", situar: "Situar", informar: "Informar", prueba: "Prueba", giro: "Giro", conclusion: "Conclusión", llamado: "Llamado", ambiente: "Ambiente" }
export function rolLegible(rol: string | null): string | null {
  if (!rol) return null
  return ROL[rol.toLowerCase()] ?? rol.charAt(0).toLocaleUpperCase("es") + rol.slice(1)
}

/** cómo se cuenta lo que hay: «3 propuestas en borrador» */
export const resumenDeLasPropuestas = (p: Pick<Propuestas, "lista">): string => `${p.lista.length} ${p.lista.length === 1 ? "propuesta" : "propuestas"} en borrador`

/* ───────────── contestar: por la puerta de siempre (`/api/acciones/{propuestas-aprobar|propuestas-cambios}` → plataforma `POST /api/tablero/{accion}`) ───────────── */

export type ResultadoDePropuestas = { ok: true; estado: "aprobada" | "observaciones" } | { ok: false; motivo: string; /** la tarjeta muestra algo que ya pasó: hay que volver a leer */ recargar: boolean }

/** los motivos de la plataforma (ADENDA 1 de CC1 §2), dichos en palabras: nunca un código crudo */
const MOTIVO: Record<string, { texto: string; recargar: boolean }> = {
  ronda_vieja: { texto: "Estas propuestas ya cambiaron: la mesa presentó una ronda nueva. Vuelve a abrirlas.", recargar: true },
  no_espera_al_dueno: { texto: "Esto ya se decidió: el encargo no está esperando tu elección.", recargar: true },
  propuesta_inexistente: { texto: "Esa propuesta ya no está en esta ronda. Vuelve a abrirlas.", recargar: true },
  sin_vueltas: { texto: "Ya no quedan rondas de cambios: elige una de estas propuestas y apruébala.", recargar: false },
  encargo_inexistente: { texto: "El encargo ya no existe.", recargar: true },
}

export async function contestarPropuestas(
  accion: "propuestas-aprobar" | "propuestas-cambios",
  cuerpo: { encargo_id: string; ronda: number; propuesta_id?: string; observaciones?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoDePropuestas> {
  try {
    const r = await fetchImpl(`/api/acciones/${accion}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) })
    const j = obj(await r.json().catch(() => ({})))
    if (r.ok && j.ok === true) return { ok: true, estado: accion === "propuestas-aprobar" ? "aprobada" : "observaciones" }
    const plataforma = obj(j.plataforma)
    const codigo = txt(plataforma.error) ?? txt(j.plataforma_error) ?? txt(j.error) ?? ""
    const m = MOTIVO[codigo]
    if (m) return { ok: false, motivo: m.texto, recargar: m.recargar }
    if (j.error === "todavia_no_disponible") return { ok: false, motivo: "La plataforma todavía no recibe esta decisión: no se hizo ningún cambio.", recargar: false }
    if (j.error === "sin_sesion" || j.error === "sin_permiso") return { ok: false, motivo: "Tu sesión no tiene permiso para decidir aquí. Vuelve a entrar.", recargar: false }
    if (r.status === 400 && txt(j.detalle)) return { ok: false, motivo: `No salió: ${txt(j.detalle)}.`, recargar: false }
    return { ok: false, motivo: "No salió: la plataforma no respondió bien. No se cambió nada; vuelve a intentarlo.", recargar: false }
  } catch {
    return { ok: false, motivo: "No salió: no hubo conexión. No se cambió nada; vuelve a intentarlo.", recargar: false }
  }
}
