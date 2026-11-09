/**
 * TU OFICINA · CAPA 2 · DECISIONES (6.20 · 1-nov · encargo «oficina del humano»): todo lo que espera la firma de Emilio, de cualquier departamento.
 * Fuente: la ruta certificada de la plataforma `GET /api/direccion/decisiones` (CC1 #802, contrato en
 * `raw/tasks/2026-11-01-LISTO-CC1-para-certificar-rutas-de-datos-de-tu-oficina.md`), leída por el servidor del tablero con la llave interna.
 * SOLO LECTURA: aquí no se decide nada. Cada decisión se abre en el panel del tablero nuevo donde ya se decide (plan · gran idea · piezas y revisiones); lo que
 * todavía no tiene panel nuevo lo dice tal cual, sin botón falso y sin enlazar al tablero viejo.
 * Reglas del contrato: `completo: false` ⇒ nunca decir «nada pendiente»; `sin_fuente[]` se muestra como «sin dato».
 */

export type TipoDeDecision = "plan" | "gran_idea" | "pieza" | "revision" | "pregunta_al_dueno" | "pregunta_de_finanzas" | "firma_de_finanzas"
export const TIPOS_DE_DECISION: readonly TipoDeDecision[] = ["plan", "gran_idea", "pieza", "revision", "pregunta_al_dueno", "pregunta_de_finanzas", "firma_de_finanzas"]

export interface Decision {
  id: string
  tipo: TipoDeDecision
  subtipo: string | null
  fuente: string | null
  client_id: string | null
  cliente: string | null
  titulo: string
  desde: string | null
  vence: string | null
  vencida: boolean
  prioridad: string | null
  decidir: { ruta: string | null; accion: string | null }
  costo_usd: number | null
  costo_nota: string | null
  /** 04-nov · CONTESTAR EN TU OFICINA (estructura de Agent Inbox). Todo opcional: si la plataforma lo trae, manda; si no, el tablero usa lo que sabe hacer hoy */
  /** las acciones que la oficina de origen permite (`allow_accept/edit/respond/ignore`) */
  permite?: AccionDeDecision[] | null
  /** quién pregunta: la oficina y el empleado (de la fila de la pregunta) */
  pregunta_de?: { oficina: string; agente: string | null } | null
  /** para qué lo necesita la oficina */
  para_que?: string | null
  /** qué se destraba al contestar */
  destraba?: string | null
  /** 09-nov (#957 plataforma) · «Uso» y «Desbloquea» en 1-3 palabras, escritos por la oficina; solo vienen con su largo. Si faltan, el frente muestra la primera frase */
  para_que_corto?: string | null
  destraba_corto?: string | null
  /** un trabajo está detenido esperando esto */
  detiene?: boolean
  /** 05-nov · firma: lo que debes saber antes de cambiar una cifra, en palabras de la oficina */
  al_editar?: string
  /** 05-nov · firma: QUÉ se firma, las cifras que propone la oficina. Sin ellas la tarjeta no ofrece firmar */
  cifras?: CifraDeFirma[]
  /** 05-nov · firma: los críticos que siguen abiertos, en palabras de la oficina */
  criticos?: string[]
  /** 09-nov · el supuesto que propuso la oficina que pregunta: con él (y solo con él) el dueño puede «asumir». Nunca lo inventa el tablero */
  supuesto?: string | null
  /** el texto como lo guardó la fuente (la puerta del cerebro recibe la pregunta tal cual) */
  titulo_interno?: string | null
}
/** una cifra de una firma: `unidad` «US$» se muestra como dinero; cualquier otra va detrás del número («ventas por semana») */
export interface CifraDeFirma { clave: string; nombre: string; valor: number; unidad: string | null; nota: string | null; /** 05-nov · la oficina deja cambiarla antes de firmar (hoy: la meta y el presupuesto) */ editable?: boolean }
export type AccionDeDecision = "aceptar" | "editar" | "responder" | "asumir" | "descartar"
/** lo que aceptan las puertas al contestar (la del dueño: respuesta ≤ 2.000 · motivo de descarte ≤ 300) */
export const TOPE_RESPUESTA = 2000
export const TOPE_MOTIVO = 300
export const ACCIONES_DE_DECISION: readonly AccionDeDecision[] = ["aceptar", "editar", "responder", "asumir", "descartar"]
export interface FuenteDeDecisiones { fuente: string; estado: "ok" | "no_existe" | "error" | "sin_credencial" | string; filas: number; truncado?: boolean; detalle?: string }
export interface Decisiones {
  generado_en: string | null
  completo: boolean
  total: number
  decisiones: Decision[]
  fuentes: FuenteDeDecisiones[]
  sin_fuente: Array<{ que: string; motivo: string }>
  /** 6.52 · los clientes en pausa por decisión de Emilio (los agrega el servidor del tablero) */
  pausados?: ClienteEnPausa[]
}

const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** lo que llega de la plataforma, revisado campo por campo: lo que no cuadra con el contrato se descarta (y la lista queda marcada incompleta) */
export function normalizarDecisiones(raw: unknown): Decisiones {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const lista = Array.isArray(r.decisiones) ? r.decisiones : []
  let descartadas = 0
  const decisiones: Decision[] = []
  for (const x of lista) {
    const d = (x && typeof x === "object" ? x : {}) as Record<string, unknown>
    const tipo = TIPOS_DE_DECISION.find((t) => t === d.tipo)
    const id = txt(d.id), titulo = txt(d.titulo)
    if (!tipo || !id || !titulo) { descartadas++; continue }
    // una decisión que la plataforma marca «reemplazada» ya no espera nada: no se muestra (no es un error de lectura)
    if (/reemplazad|superseded/i.test(`${txt(d.estado) ?? ""} ${txt(d.subtipo) ?? ""} ${txt(d.status) ?? ""}`) || d.reemplazada === true || d.vigente === false) continue
    const dec = (d.decidir && typeof d.decidir === "object" ? d.decidir : {}) as Record<string, unknown>
    decisiones.push({
      id, tipo, titulo,
      subtipo: txt(d.subtipo), fuente: txt(d.fuente), client_id: txt(d.client_id), cliente: txt(d.cliente),
      desde: txt(d.desde), vence: txt(d.vence), vencida: d.vencida === true, prioridad: txt(d.prioridad),
      decidir: { ruta: txt(dec.ruta), accion: txt(dec.accion) },
      ...contextoDeLaPlataforma(d),
      costo_usd: num(d.costo_usd), costo_nota: txt(d.costo_nota),
    })
  }
  const fuentes = (Array.isArray(r.fuentes) ? r.fuentes : []).flatMap((f) => {
    const o = (f && typeof f === "object" ? f : {}) as Record<string, unknown>
    const fuente = txt(o.fuente), estado = txt(o.estado)
    return fuente && estado ? [{ fuente, estado, filas: num(o.filas) ?? 0, ...(o.truncado === true ? { truncado: true } : {}), ...(txt(o.detalle) ? { detalle: txt(o.detalle)! } : {}) }] : []
  })
  const sin_fuente = (Array.isArray(r.sin_fuente) ? r.sin_fuente : []).flatMap((s) => {
    const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>
    const que = txt(o.que), motivo = txt(o.motivo)
    return que ? [{ que, motivo: motivo ?? "" }] : []
  })
  const pausados = (Array.isArray(r.pausados) ? r.pausados : []).flatMap((p) => { const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>; const cliente = txt(o.cliente); return cliente ? [{ cliente, motivo: txt(o.motivo) }] : [] })
  return { generado_en: txt(r.generado_en), completo: r.completo === true && descartadas === 0, total: decisiones.length, decisiones, fuentes, sin_fuente, ...(pausados.length ? { pausados } : {}) }
}

/** la lectura (servidor): la ruta certificada de la plataforma con la llave interna; nunca escribe */
export async function leerDecisiones(d: { plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch } = {}): Promise<{ ok: true; datos: Decisiones } | { ok: false; status: number; error: string }> {
  const base = (d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app").replace(/\/+$/, "")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { ok: false, status: 503, error: "El tablero no tiene la llave con la que lee a la plataforma." }
  try {
    const r = await (d.fetchImpl ?? fetch)(`${base}/api/direccion/decisiones`, { method: "GET", headers: { "x-api-key": llave }, cache: "no-store" })
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null
    if (!r.ok || !j || j.ok !== true) return { ok: false, status: 502, error: `La plataforma no entregó las decisiones (${r.status}).` }
    return { ok: true, datos: normalizarDecisiones(j) }
  } catch {
    return { ok: false, status: 502, error: "No se pudo contactar a la plataforma." }
  }
}

/** cómo se llama cada tipo, en palabras de negocio, y su marca corta para la pantalla */
export const NOMBRE_DEL_TIPO: Record<TipoDeDecision, { nombre: string; plural: string }> = {
  plan: { nombre: "Plan de 90 días", plural: "Planes" },
  gran_idea: { nombre: "Gran idea", plural: "Grandes ideas" },
  pieza: { nombre: "Pieza para publicar", plural: "Piezas" },
  revision: { nombre: "Revisión", plural: "Revisiones" },
  pregunta_al_dueno: { nombre: "Pregunta para ti", plural: "Preguntas para ti" },
  pregunta_de_finanzas: { nombre: "Pregunta de finanzas", plural: "Preguntas de finanzas" },
  firma_de_finanzas: { nombre: "Firma de finanzas", plural: "Firmas de finanzas" },
}

/** dónde se toma cada decisión dentro del tablero nuevo: el panel que se abre, o por qué todavía no se decide aquí */
export type PanelDeDecision = "plan" | "gran_idea" | "piezas"
export function dondeSeDecide(d: Pick<Decision, "tipo">): { panel: PanelDeDecision; boton: string } | { panel: null; nota: string } {
  switch (d.tipo) {
    case "plan": return { panel: "plan", boton: "Abrir el plan para decidir" }
    case "gran_idea": return { panel: "gran_idea", boton: "Abrir la gran idea para decidir" }
    case "pieza": return { panel: "piezas", boton: "Abrir la pieza para decidir" }
    case "revision": return { panel: "piezas", boton: "Abrir la revisión para decidir" }
    case "firma_de_finanzas": return { panel: null, nota: "La firma del tablero financiero todavía no está en el tablero nuevo." }
    case "pregunta_de_finanzas": return { panel: null, nota: "Las preguntas de finanzas todavía no se responden desde el tablero nuevo." }
    case "pregunta_al_dueno": return { panel: null, nota: "Las preguntas para ti todavía no se responden desde el tablero." }
  }
}

/** la prioridad en palabras (la base guarda high · medium · low) */
export function prioridadLegible(p: string | null): { texto: string; nivel: 0 | 1 | 2 | 3 } {
  switch ((p ?? "").toLowerCase()) {
    case "urgent": case "critical": return { texto: "Urgente", nivel: 3 }
    case "high": return { texto: "Alta", nivel: 3 }
    case "medium": return { texto: "Media", nivel: 2 }
    case "low": return { texto: "Baja", nivel: 1 }
    default: return { texto: "Sin prioridad", nivel: 0 }
  }
}

/** «hace 3 días», «hace 5 horas»… (para la espera de cada decisión) */
export function haceCuanto(desde: string | null, ahora: number = Date.now()): string {
  if (!desde) return "sin fecha"
  const t = Date.parse(desde)
  if (!Number.isFinite(t)) return "sin fecha"
  const min = Math.max(0, Math.round((ahora - t) / 60000))
  if (min < 60) return min <= 1 ? "hace un momento" : `hace ${min} minutos`
  const h = Math.round(min / 60)
  if (h < 24) return h === 1 ? "hace una hora" : `hace ${h} horas`
  const dias = Math.round(h / 24)
  return dias === 1 ? "hace un día" : `hace ${dias} días`
}

/** lo que necesita la pantalla del arco: cuántas, si alguna apremia y si la lista está entera */
export interface ResumenDeDecisiones { total: number; apremia: boolean; completo: boolean }
export function resumenDeDecisiones(d: Decisiones): ResumenDeDecisiones {
  // 6.52 · «esperan tu firma» = lo que se firma desde el tablero nuevo y no es de un cliente en pausa (el mismo número en todas partes)
  const firma = gruposDeDecisiones(d).firma
  return { total: firma.length, apremia: firma.some((x) => x.vencida || prioridadLegible(x.prioridad).nivel === 3), completo: d.completo }
}

/** el título limpio para mostrar (la base trae marcas como «⚠️» al inicio) */
export const tituloLimpio = (t: string): string => {
  const sinCodigos = t.replace(/^[\s⚠️❗‼️]+/u, "")
    .replace(/\(\s*(?:P\d+[a-z]?|v(?:ersi[oó]n)?\s?\d+|[A-Z]{2,5}-\d{2,})\s*\)/giu, " ") // «(P3)», «(versión 2)», «(BRF-0001)»
    .replace(/(?<![\p{L}\p{N}])(?:versi[oó]n|v)\s?\d+(?![\p{L}\p{N}])/giu, " ")
    .replace(/(?<![\p{L}\p{N}])[A-Z]{2,5}-\d{2,}(?![\p{L}\p{N}])/gu, " ") // BRF-0001
    .replace(/(?<![\p{L}\p{N}])P\d+[a-z]?(?![\p{L}\p{N}])/gu, " ") // P3 · P4 · P10b
  return sinCodigos.replace(/\s+([:,;.])/g, "$1").replace(/([·:—-])\s*(?=[·:—-])/g, "").replace(/\s{2,}/g, " ").replace(/^[\s·:—-]+|[\s·:—-]+$/g, "").trim()
}

/* ───────────── 6.52 · DECISIONES HABLAN CLARO (corrección aprobada por Emilio 2-nov 20:45Z, `2026-11-02-CORRECCION-LENOVO-a-CC5-decisiones-y-riesgos-hablan-claro.md`) ───────────── */

/** «content-creator» → «Content Creator» (el nombre del empleado, como en el organigrama) */
export const nombreDeEmpleado = (slug: string): string => slug.replace(/[-_]+/g, " ").trim().replace(/\s+/g, " ").split(" ").map((w) => (w ? w[0].toLocaleUpperCase("es") + w.slice(1) : w)).join(" ")
/** lo que pidió cada tipo de aviso interno, en una frase (el empleado se agrega después) */
const PIDIO: Record<string, string> = {
  editor_escalation: "El editor pidió que mires un texto",
  content_piece_review: "Hay una pieza lista para que la revises",
  brand_section_review: "Hay una sección del manual para que la revises",
}
/** el título en español: «editor_escalation · content-creator» → «El editor pidió que mires un texto de 👤 Content Creator»; nunca nombres internos */
export function tituloDeDecision(d: Pick<Decision, "titulo" | "subtipo">): string {
  const t = tituloLimpio(d.titulo)
  const m = t.match(/^([a-z]+(?:_[a-z]+)+)\s*·\s*([a-z0-9]+(?:[-_][a-z0-9]+)*)$/)
  if (m) return `${PIDIO[m[1]] ?? `${mayusculaInicial(m[1].replace(/_/g, " "))}`} de 👤 ${nombreDeEmpleado(m[2])}`
  if (/^[a-z]+(?:_[a-z]+)+$/.test(t)) return PIDIO[t] ?? mayusculaInicial(t.replace(/_/g, " "))
  return t
}
const mayusculaInicial = (s: string) => (s ? s[0].toLocaleUpperCase("es") + s.slice(1) : s)

/** el costo de producir eso (regla de Emilio): el dato si la plataforma lo trae; si no, se dice */
export function costoDeLaDecision(d: Pick<Decision, "costo_usd">): string {
  if (d.costo_usd == null) return "sin dato todavía"
  return d.costo_usd === 0 ? "US$ 0" : `US$ ${d.costo_usd.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: d.costo_usd < 0.01 ? 4 : 2 })}`
}

/** los clientes que Emilio puso en pausa (vienen de las pausas que decidió; lo lee el servidor del tablero) */
export interface ClienteEnPausa { cliente: string; motivo: string | null }
const clave = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()
/**
 * UN SOLO NÚMERO: «esperan tu firma» = lo que se firma desde el tablero y no es de un cliente en pausa. Es el mismo en la tarjeta de la oficina, la cabecera,
 * «Todas» y el carrusel. Lo que se atiende fuera y lo de clientes en pausa van en grupos aparte, cada uno con su número.
 */
export interface GruposDeDecisiones { firma: Decision[]; fuera: Decision[]; pausa: Array<{ cliente: string; motivo: string | null; decisiones: Decision[] }>; /** 04-nov · las de «firma» que tienen un trabajo detenido esperando (van primero) */ detienen: Decision[] }
export function gruposDeDecisiones(d: Pick<Decisiones, "decisiones"> & { pausados?: ClienteEnPausa[] }): GruposDeDecisiones {
  const pausados = new Map((d.pausados ?? []).map((p) => [clave(p.cliente), p]))
  const firma: Decision[] = [], fuera: Decision[] = [], pausa = new Map<string, { cliente: string; motivo: string | null; decisiones: Decision[] }>()
  const detenidas = idsQueDetienenUnTrabajo(d.decisiones)
  for (const x of d.decisiones) {
    if (esLaTarjetaDeLaPausa(x) && d.decisiones.some((y) => y.client_id === x.client_id && y.tipo === "pregunta_al_dueno")) continue // la pausa se dice en sus preguntas
    const p = x.cliente ? pausados.get(clave(x.cliente)) : undefined
    if (p) { const k = clave(p.cliente); const g = pausa.get(k) ?? { cliente: x.cliente ?? p.cliente, motivo: p.motivo, decisiones: [] }; g.decisiones.push(x); pausa.set(k, g) }
    else if (dondeSeDecide(x).panel || accionesDe(x).length || faltaQueLeer(x)) firma.push(x) // una firma a la que le falta información sigue a la vista: dice qué falta y quién la debe
    else fuera.push(x)
  }
  const ordenada = ordenarParaTi(firma, detenidas)
  return { firma: ordenada, fuera, pausa: [...pausa.values()], detienen: ordenada.filter((x) => detenidas.has(x.id)) }
}

/* ───────────── 04-nov · CONTESTAR EN TU OFICINA (`2026-11-04-ENCARGO-LENOVO-a-CC5-decisiones-se-contestan-en-tu-oficina.md` + adendas · boceto aprobado 18:08Z) ───────────── */

/** la tarjeta «El plan está en pausa» que la plataforma agrega por cada pausa de la oficina financiera */
export const esLaTarjetaDeLaPausa = (d: Pick<Decision, "fuente" | "subtipo">): boolean => d.fuente === "esperas_del_dueno" || d.subtipo === "plan_en_pausa"

/** lo que el tablero sabe hacer hoy, por tipo (cada una con su ruta real en la plataforma) */
const LO_QUE_SE_HACE_AQUI: Partial<Record<TipoDeDecision, AccionDeDecision[]>> = {
  pregunta_al_dueno: ["responder", "asumir", "descartar"], // la ruta de la plataforma `/api/dueno/preguntas` (+ la ruta de la pausa de finanzas para responder)
  firma_de_finanzas: ["aceptar", "editar"], // firmar-tablero, con o sin `cambios`
}
/** 05-nov · nunca se firma a ciegas: una firma que no trae las cifras que se firman no tiene nada que leer */
export const faltaQueLeer = (d: Pick<Decision, "tipo" | "cifras">): boolean => d.tipo === "firma_de_finanzas" && !d.cifras?.length
/** una cifra para leer: «US$ 1.341,27» · «5 ventas por semana» */
export function textoDeCifra(c: Pick<CifraDeFirma, "valor" | "unidad">): string {
  const n = c.valor.toLocaleString("es-EC", { maximumFractionDigits: 2, ...(c.unidad === "US$" && !Number.isInteger(c.valor) ? { minimumFractionDigits: 2 } : {}) })
  return c.unidad === "US$" ? `US$ ${n}` : c.unidad ? `${n} ${c.unidad}` : n
}
/** la cifra en su recuadro, como en la imagen aprobada (Lenovo 06-nov): el número solo, grande; la moneda va en el rótulo («5» · «Meta semanal»; «1.341» · «US$ al mes») */
export function cifraEnRecuadro(c: Pick<CifraDeFirma, "valor" | "unidad" | "nombre">): { numero: string; rotulo: string } {
  const numero = c.valor.toLocaleString("es-EC", { maximumFractionDigits: 2, ...(c.unidad === "US$" && !Number.isInteger(c.valor) ? { minimumFractionDigits: 2 } : {}) })
  // la unidad nunca se pierde: el dólar va delante del rótulo; otra unidad, detrás (salvo que el nombre ya la diga)
  if (c.unidad === "US$") return { numero, rotulo: /US\$/.test(c.nombre) ? c.nombre : `US$ ${c.nombre}` }
  return { numero, rotulo: c.unidad && !c.nombre.toLowerCase().includes(c.unidad.toLowerCase()) ? `${c.nombre} · ${c.unidad}` : c.nombre }
}
/** lo decisivo en dos líneas, como en la imagen aprobada: la frase y, debajo, su porqué («Con esta meta el plan no se paga» · «Hacen falta 8 ventas…») */
export function partirLoDecisivo(texto: string): { frase: string; porque: string | null } {
  // solo un «: » fuera de paréntesis y tras una frase corta (si no, el texto queda entero: «(últimos posts: Junio 2020)» no se parte)
  let i = -1, hondo = 0
  for (let k = 0; k < texto.length - 1; k++) {
    const ch = texto[k]
    if (ch === "(") hondo++
    else if (ch === ")") hondo = Math.max(0, hondo - 1)
    else if (ch === ":" && texto[k + 1] === " " && hondo === 0) { i = k; break }
  }
  if (i <= 0 || i > 90 || i === texto.length - 2) return { frase: texto, porque: null }
  const resto = texto.slice(i + 2).trim()
  return { frase: texto.slice(0, i).trim(), porque: resto.charAt(0).toUpperCase() + resto.slice(1) }
}
/**
 * 09-nov · DECISIONES IGUAL A LO APROBADO (firma de Emilio 15:20Z). El frente de la tarjeta es corto; el detalle (al tocar «Decisivo» o «Uso»)
 * guarda SIEMPRE el texto entero. El resumen sale de lo que ya trae cada pieza; si no trae versión corta, se corta sin inventar.
 */
/** las cifras del frente: las dos que decide el dueño (las que deja cambiar; si ninguna, las dos primeras). Las demás van al detalle */
export function cifrasDelFrente(cifras: CifraDeFirma[]): { frente: CifraDeFirma[]; detalle: CifraDeFirma[] } {
  const editables = cifras.filter((c) => c.editable)
  const frente = (editables.length ? editables : cifras).slice(0, 2)
  return { frente, detalle: cifras.filter((c) => !frente.includes(c)) }
}
/** corta un texto sin inventar: hasta `tope` caracteres, en un borde de palabra, y «…» si cortó */
export function cortarSinInventar(texto: string, tope: number): string {
  const s = texto.trim()
  if (s.length <= tope) return s
  const c = s.slice(0, tope + 1), i = c.lastIndexOf(" ")
  let r = i > tope / 2 ? c.slice(0, i) : s.slice(0, tope)
  // nunca un paréntesis abierto: se corta antes de él
  if ((r.match(/\(/g) ?? []).length > (r.match(/\)/g) ?? []).length) r = r.slice(0, r.lastIndexOf("("))
  return r.replace(/[\s,;:.(—-]+$/, "") + "…"
}
/** las frases de un texto (un punto seguido de espacio y mayúscula o número; nunca dentro de un paréntesis) */
export function frasesDe(texto: string): string[] {
  const out: string[] = []
  let hondo = 0, desde = 0
  for (let k = 0; k < texto.length; k++) {
    const ch = texto[k]
    if (ch === "(") hondo++
    else if (ch === ")") hondo = Math.max(0, hondo - 1)
    else if ((ch === "." || ch === "!" || ch === "?") && hondo === 0 && texto[k + 1] === " " && /[A-ZÁÉÍÓÚÑ¿¡0-9]/.test(texto[k + 2] ?? "")) { out.push(texto.slice(desde, k + 1).trim()); desde = k + 2 }
  }
  const resto = texto.slice(desde).trim()
  if (resto) out.push(resto)
  return out
}
/** «Decisivo» en dos líneas: la frase y su porqué (del «:» si lo trae; si no, la primera y la segunda frase), cada una corta. `cortado` = el detalle dice más */
export function decisivoCorto(texto: string): { frase: string; porque: string | null; cortado: boolean } {
  const t = texto.trim(), p = partirLoDecisivo(t)
  const fs = p.porque ? [p.frase, ...frasesDe(p.porque)] : frasesDe(t)
  const primera = fs[0] ?? t, segunda = fs[1] ?? null
  const frase = cortarSinInventar(primera, 70), porque = segunda ? cortarSinInventar(segunda, 90) : null
  return { frase, porque, cortado: fs.length > 2 || frase !== primera || (segunda !== null && porque !== segunda) }
}
/**
 * «Uso» y «Desbloquea» al frente: la PRIMERA FRASE ENTERA (Lenovo 09-nov: nunca palabras cortadas a la mitad).
 * Si el texto trae más de una frase, el resto se lee en el detalle; si es una sola, no se repite allí.
 */
export function primeraFrase(texto: string): string {
  return frasesDe(texto)[0] ?? texto.trim() // frasesDe ya recorta los espacios de cada frase
}
/**
 * Las acciones que muestra la tarjeta. Si la oficina de origen declaró cuáles permite (`permite`), mandan esas, siempre que el tablero tenga con qué hacerlas;
 * si no declaró nada, las de su tipo. Una acción sin ruta real nunca se muestra (nada de botones falsos).
 */
export function accionesDe(d: Pick<Decision, "tipo" | "permite" | "fuente" | "subtipo" | "cifras"> & { supuesto?: string | null }): AccionDeDecision[] {
  if (esLaTarjetaDeLaPausa(d) || faltaQueLeer(d)) return []
  const posibles = LO_QUE_SE_HACE_AQUI[d.tipo] ?? []
  // cambiar una cifra lo tiene que ofrecer la oficina, y tiene que haber una cifra que se pueda cambiar
  // 09-nov · asumir: la oficina tiene que haberlo ofrecido Y haber propuesto un supuesto (sin supuesto no hay nada que asumir)
  const sePuede = (a: AccionDeDecision) => a === "asumir" ? (!!d.permite?.includes("asumir") && !!d.supuesto?.trim()) : a !== "editar" || (!!d.permite?.includes("editar") && !!d.cifras?.some((c) => c.editable))
  return (d.permite ? posibles.filter((a) => d.permite!.includes(a)) : posibles).filter(sePuede)
}

/** las cifras que manda la plataforma: la que no trae clave, nombre y valor numérico no cuenta */
export function leerCifras(v: unknown): CifraDeFirma[] {
  return (Array.isArray(v) ? v : []).flatMap((c): CifraDeFirma[] => {
    const x = (c && typeof c === "object" ? c : {}) as Record<string, unknown>
    const clave = txt(x.clave), nombre = txt(x.nombre), valor = num(x.valor)
    return clave && nombre && valor != null ? [{ clave, nombre, valor, unidad: txt(x.unidad), nota: txt(x.nota), ...(x.editable === true ? { editable: true } : {}) }] : []
  })
}
/** lo que escribe Emilio: «1.341,27» · «1,341.27» · «1341.27» · «1.341» · «US$ 939». null = no es un número */
export function leerNumero(t: string): number | null {
  const s = t.replace(/us\$|\$|\s/gi, "")
  if (!/^\d[\d.,]*$/.test(s)) return null
  let n = s
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) n = s.replace(/[.,]/g, "")
  else if (s.includes(",") && s.includes(".")) n = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")
  else n = s.replace(",", ".")
  const v = Number(n)
  return Number.isFinite(v) ? v : null
}
/** cómo se escribe una cifra en la caja de texto */
export const numeroParaEscribir = (v: number): string => String(v).replace(".", ",")
/** lo que cambiaría al firmar: solo las cifras cuyo valor se mueve */
export function cifrasQueCambian(antes: CifraDeFirma[], despues: CifraDeFirma[]): Array<{ cifra: CifraDeFirma; antes: number }> {
  return despues.flatMap((c) => { const a = antes.find((x) => x.clave === c.clave); return a && a.valor !== c.valor ? [{ cifra: c, antes: a.valor }] : [] })
}

/** lo que la plataforma ya pueda traer de contexto (todo opcional; lo que no viene, no se inventa) */
function contextoDeLaPlataforma(d: Record<string, unknown>): Partial<Decision> {
  const o: Partial<Decision> = {}
  const per = d.permite ?? d.allow
  if (Array.isArray(per)) o.permite = ACCIONES_DE_DECISION.filter((a) => per.includes(a))
  else if (per && typeof per === "object") {
    const p = per as Record<string, unknown>
    o.permite = ACCIONES_DE_DECISION.filter((a) => p[a] === true || p[{ aceptar: "allow_accept", editar: "allow_edit", responder: "allow_respond", asumir: "allow_assume", descartar: "allow_ignore" }[a]] === true)
  }
  const pp = (d.pregunta_de ?? d.preguntado_por) as Record<string, unknown> | undefined
  const oficina = pp && typeof pp === "object" ? txt(pp.oficina) : null
  if (oficina) o.pregunta_de = { oficina, agente: txt(pp!.agente) }
  if (txt(d.para_que)) o.para_que = txt(d.para_que)
  if (txt(d.destraba)) o.destraba = txt(d.destraba)
  // el corto solo vale con su largo (sin largo no hay corto: así lo manda la plataforma y así se lee)
  if (o.para_que && txt(d.para_que_corto)) o.para_que_corto = txt(d.para_que_corto)
  if (o.destraba && txt(d.destraba_corto)) o.destraba_corto = txt(d.destraba_corto)
  if (d.detiene === true || d.detiene_trabajo === true) o.detiene = true
  if (txt(d.titulo_interno)) o.titulo_interno = txt(d.titulo_interno)
  if (txt(d.supuesto)) o.supuesto = txt(d.supuesto)
  const cifras = leerCifras(d.cifras)
  if (cifras.length) o.cifras = cifras
  if (txt(d.al_editar)) o.al_editar = txt(d.al_editar)!
  const criticos = (Array.isArray(d.criticos) ? d.criticos : []).flatMap((c) => { const t = txt(c); return t ? [t] : [] })
  if (criticos.length) o.criticos = criticos
  return o
}

/** las que tienen un trabajo detenido: lo que la plataforma marca, y las preguntas de un cliente cuyo plan está en pausa esperando respuestas */
export function idsQueDetienenUnTrabajo(lista: Decision[]): Set<string> {
  const enPausa = new Set(lista.filter(esLaTarjetaDeLaPausa).map((x) => x.client_id).filter((c): c is string => !!c))
  return new Set(lista.filter((x) => x.detiene === true || (x.tipo === "pregunta_al_dueno" && !!x.client_id && enPausa.has(x.client_id))).map((x) => x.id))
}

/** el orden del encargo (punto 5): primero lo que tiene un trabajo detenido; después, el de la plataforma (lo que vence primero y luego lo más antiguo) */
export function ordenarParaTi(lista: Decision[], detenidas: Set<string> = idsQueDetienenUnTrabajo(lista)): Decision[] {
  return [...lista.filter((x) => detenidas.has(x.id)), ...lista.filter((x) => !detenidas.has(x.id))]
}

/** la oficina que pregunta, con su nombre real */
const OFICINAS: Record<string, string> = {
  financiera: "Oficina financiera", finanzas: "Oficina financiera", planeacion: "Oficina de planeación", creativa: "Oficina creativa", jefatura: "Jefatura",
  marketing: "Departamento de Marketing", cerebro: "El cerebro del cliente", portero: "El cerebro del cliente", alta: "Oficina de altas", onboarding: "Oficina de altas",
}
export function nombreDeOficina(o: string): string {
  const k = o.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/^oficina[\s_-]+(de[\s_-]+)?/, "").trim()
  return OFICINAS[k] ?? OFICINAS[k.split(/[\s_-]+/)[0] ?? ""] ?? mayusculaInicial(o.replace(/[-_]+/g, " "))
}

/** «qué se destraba»: lo que dice la oficina; si un plan en pausa espera esta respuesta, eso (CC1: con la última, sigue en el acto) */
export function queSeDestraba(d: Decision, detenidas: Set<string>): string | null {
  if (d.destraba) return d.destraba
  if (d.tipo === "pregunta_al_dueno" && detenidas.has(d.id)) return `El plan de 90 días${d.cliente ? ` de ${d.cliente}` : ""} sigue en cuanto contestes sus preguntas.`
  return null
}
