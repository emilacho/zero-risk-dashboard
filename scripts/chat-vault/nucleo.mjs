/**
 * 02-nov · CHAT de /nuevo · ADENDA 2/3 · lo que SUBE el vault a Supabase (solo lectura para el chat). Piezas puras: sin red, sin disco, para probarlas sin llaves.
 * Lo que no es de esta lista, o parece un secreto, NO sube. Un archivo con secreto queda anotado en el registro (ruta + motivo), nunca su valor.
 */
import { createHash } from 'node:crypto'

/** carpetas del vault que el chat puede leer (la lista blanca). `00-meta/credentials/` queda fuera aunque esté dentro de `00-meta`. */
export const CARPETAS_PERMITIDAS = ['00-meta', 'wiki', 'raw/tasks', 'raw/estado', 'runbooks', 'projects', 'areas']
export const CARPETAS_PROHIBIDAS = ['00-meta/credentials', '.obsidian', '.git', 'node_modules']
export const TOPE_BYTES = 200_000

const norm = (r) => String(r).replace(/\\/g, '/').replace(/^\/+/, '')

/** ¿esta ruta (relativa al vault) puede subir? solo .md, dentro de la lista blanca, fuera de las prohibidas */
export function rutaPermitida(ruta) {
  const r = norm(ruta)
  const esMarca = /^raw\/estado\/[^/]+-marca$/i.test(r) // las marcas de los CC no llevan extensión
  if (!esMarca && !r.toLowerCase().endsWith('.md')) return false
  if (r.split('/').some((p) => p === '..')) return false
  const enCarpeta = (c) => r === c || r.startsWith(c + '/')
  if (CARPETAS_PROHIBIDAS.some((c) => enCarpeta(c) || r.split('/').includes(c))) return false
  return CARPETAS_PERMITIDAS.some(enCarpeta)
}

const PATRONES = [
  ['llave de api (sk-)', /\bsk-[A-Za-z0-9_-]{16,}/],
  ['token JWT (eyJ)', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/],
  ['encabezado Bearer', /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/],
  ['llave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['token de GitHub', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ['token de Slack', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['llave de AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['llave de servicio asignada', /service_role["']?\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/i],
  ['contraseña asignada', /\b(?:password|passwd|contrase(?:ñ|n)a|secret|api[_-]?key|token)["']?\s*[:=]\s*["']?(?!\s*(?:\*|<|\$|\{|xxx|tu_|your|placeholder|redact|oculto|null|undefined|false|true))[A-Za-z0-9_\-./+=]{12,}/i],
]

/** devuelve el motivo (sin el valor) si el texto parece traer un secreto; si no, null */
export function motivoDeSecreto(texto) {
  const t = String(texto ?? '')
  for (const [motivo, re] of PATRONES) if (re.test(t)) return motivo
  return null
}

export const shaDe = (texto) => createHash('sha256').update(String(texto), 'utf8').digest('hex')

export function tituloDe(ruta, cuerpo) {
  const m = /^\s*#\s+(.+)$/m.exec(String(cuerpo ?? ''))
  const t = (m ? m[1] : norm(ruta).split('/').pop().replace(/\.md$/i, '')).trim()
  return t.slice(0, 200)
}

/**
 * Decide qué sube, qué se borra y qué se salta.
 * `archivos`: [{ ruta, cuerpo, modificado_en }] leídos del disco · `existentes`: [{ ruta, sha }] ya en la tabla.
 * Solo sube lo que cambió (sha). Lo que ya no está en el vault (o ya no es subible) se retira de la tabla, salvo el documento `traspaso`.
 */
export function planDeSubida(archivos, existentes, { reservadas = ['traspaso'] } = {}) {
  const ya = new Map((existentes ?? []).map((e) => [e.ruta, e.sha]))
  const subir = [], saltados = [], vigentes = new Set(reservadas)
  for (const a of archivos ?? []) {
    const ruta = norm(a.ruta)
    if (!rutaPermitida(ruta)) { saltados.push({ ruta, motivo: 'fuera de la lista blanca' }); continue }
    const cuerpo = String(a.cuerpo ?? '')
    if (Buffer.byteLength(cuerpo, 'utf8') > TOPE_BYTES) { saltados.push({ ruta, motivo: 'pasa el tope de tamaño' }); continue }
    const secreto = motivoDeSecreto(cuerpo)
    if (secreto) { saltados.push({ ruta, motivo: 'parece traer ' + secreto }); continue }
    vigentes.add(ruta)
    const sha = shaDe(cuerpo)
    if (ya.get(ruta) === sha) continue
    subir.push({ ruta, titulo: tituloDe(ruta, cuerpo), cuerpo, sha, modificado_en: a.modificado_en ?? null })
  }
  const retirar = [...ya.keys()].filter((r) => !vigentes.has(r))
  return { subir, retirar, saltados }
}
