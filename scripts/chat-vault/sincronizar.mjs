/**
 * 02-nov · CHAT de /nuevo · ADENDA 3 (firmada por Emilio) · sincroniza el vault (solo las carpetas permitidas) a la tabla `chat_vault_docs` de Supabase, SOLO LECTURA para el chat.
 * Corre en la computadora de Emilio cada 3 minutos (Programador de tareas de Windows). Sube solo lo que cambió (sha). Ningún archivo con aspecto de secreto sube.
 * Además arma el documento `traspaso`: el núcleo fijo (00-meta/HANDOFF-chat-de-nuevo.md) + una parte viva que se regenera aquí (marcas de los CC, decisiones recientes, papeles recientes). Nadie la edita a mano.
 *
 * Uso:  doppler run -p zero-risk -c prd -- node scripts/chat-vault/sincronizar.mjs [--seco]
 * Variables: SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) · SUPABASE_SERVICE_ROLE_KEY · VAULT_DIR (opcional; por omisión la carpeta del vault de Emilio).
 * Nunca imprime valores de variables ni el contenido de un archivo: solo cifras y rutas.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { CARPETAS_PERMITIDAS, motivoDeSecreto, planDeSubida, shaDe, tituloDe } from './nucleo.mjs'

const VAULT = process.env.VAULT_DIR || 'C:/Users/emili/OneDrive/Documents/zr-vault'
const SECO = process.argv.includes('--seco')
const TABLA = 'chat_vault_docs'
const LOTE = 25

function recorrer(base, dentro, salida = []) {
  const dir = path.join(base, dentro)
  let ents
  try { ents = fs.readdirSync(dir, { withFileTypes: true }) } catch { return salida }
  for (const e of ents) {
    const rel = (dentro ? dentro + '/' : '') + e.name
    if (e.isDirectory()) {
      if (e.name === '.obsidian' || e.name === '.git' || e.name === 'node_modules' || e.name === 'credentials') continue
      recorrer(base, rel, salida)
    } else if (e.isFile() && (e.name.toLowerCase().endsWith('.md') || /-marca$/i.test(e.name))) salida.push(rel)
  }
  return salida
}

function leerArchivos() {
  const rutas = []
  for (const c of CARPETAS_PERMITIDAS) recorrer(VAULT, c, rutas)
  const out = []
  for (const ruta of rutas) {
    try {
      const st = fs.statSync(path.join(VAULT, ruta))
      if (st.size > 400_000) { out.push({ ruta, cuerpo: 'x'.repeat(400_001), modificado_en: st.mtime.toISOString() }); continue } // el plan lo salta por tamaño sin leerlo entero
      out.push({ ruta, cuerpo: fs.readFileSync(path.join(VAULT, ruta), 'utf8'), modificado_en: st.mtime.toISOString() })
    } catch { /* un archivo que no se deja leer se salta */ }
  }
  return out
}

const primeraLinea = (t) => String(t).split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#') && !l.startsWith('---')) ?? ''

/** parte viva del traspaso: solo lo que está en el vault (los datos de la plataforma los trae la herramienta consultar_plataforma al momento de preguntar) */
export function armarParteViva(archivos, ahora = new Date(), omitidos = []) {
  // todo fragmento que entra al traspaso pasa por el mismo filtro de secretos que los archivos (observación de CC3 sobre #149)
  const seguro = (t, que) => { const m = motivoDeSecreto(t); if (!m) return t; omitidos.push(que + ': parece traer ' + m); return '(omitido: parece traer ' + m + ')' }
  const L = ['## Parte viva (se regenera sola · ' + ahora.toISOString().slice(0, 13) + ':00Z)', '']
  const marcas = archivos.filter((a) => /^raw\/estado\/CC\d+-marca$/i.test(a.ruta.replace(/\.md$/i, '')) || /^raw\/estado\/.*marca.*\.md$/i.test(a.ruta))
  if (marcas.length) {
    L.push('### Qué dice cada empleado técnico (última línea de su marca)')
    for (const m of marcas.sort((a, b) => a.ruta.localeCompare(b.ruta))) {
      const ult = String(m.cuerpo).split(/\r?\n/).filter(Boolean).pop() ?? ''
      L.push('- ' + path.basename(m.ruta).replace(/\.md$/i, '') + ': ' + seguro(ult.slice(0, 280), m.ruta))
    }
    L.push('')
  }
  const dec = archivos.filter((a) => a.ruta.startsWith('wiki/decisions/')).sort((a, b) => String(b.modificado_en).localeCompare(String(a.modificado_en))).slice(0, 10)
  if (dec.length) {
    L.push('### Últimas decisiones')
    for (const d of dec) L.push('- ' + seguro(tituloDe(d.ruta, d.cuerpo), d.ruta) + ' (' + d.ruta + ')')
    L.push('')
  }
  const hace2d = ahora.getTime() - 48 * 3600e3
  const pap = archivos.filter((a) => a.ruta.startsWith('raw/tasks/') && Date.parse(a.modificado_en) >= hace2d && /(ENCARGO|LISTO|ESTADO|SENAL|AVISO|HALLAZGO)/.test(a.ruta)).sort((a, b) => String(b.modificado_en).localeCompare(String(a.modificado_en))).slice(0, 25)
  if (pap.length) {
    L.push('### Papeles de las últimas 48 horas')
    for (const p of pap) L.push('- ' + path.basename(p.ruta).replace(/\.md$/i, '') + ' — ' + seguro(primeraLinea(p.cuerpo), p.ruta).replace(/\[[A-Z-]+\d*\]\s*/g, '').slice(0, 160))
    L.push('')
  }
  return L.join('\n').slice(0, 14_000)
}

export function armarTraspaso(archivos, ahora = new Date(), omitidos = []) {
  const nucleo = archivos.find((a) => a.ruta === '00-meta/HANDOFF-chat-de-nuevo.md')
  let base = nucleo ? String(nucleo.cuerpo) : '# Traspaso del chat\n\n(Falta el núcleo fijo 00-meta/HANDOFF-chat-de-nuevo.md.)'
  const m = motivoDeSecreto(base)
  if (m) { omitidos.push('núcleo fijo: parece traer ' + m); base = '# Traspaso del chat\n\n(El núcleo fijo no se incluyó: parece traer ' + m + '.)' }
  return base.trimEnd() + '\n\n' + armarParteViva(archivos, ahora, omitidos) + '\n'
}

async function rest(metodo, ruta, { cuerpo, cabeceras } = {}) {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !llave) throw new Error('faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno')
  const r = await fetch(url + '/rest/v1/' + ruta, { method: metodo, headers: { apikey: llave, Authorization: 'Bearer ' + llave, 'Content-Type': 'application/json', ...cabeceras }, body: cuerpo ? JSON.stringify(cuerpo) : undefined })
  if (!r.ok) throw new Error(`${metodo} ${ruta.split('?')[0]} → ${r.status}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

async function existentes(llamar = rest) {
  const todas = []
  for (let desde = 0; ; desde += 1000) {
    const f = await llamar('GET', `${TABLA}?select=ruta,sha&order=ruta&limit=1000&offset=${desde}`)
    todas.push(...f)
    if (f.length < 1000) break
  }
  return todas
}

export async function principal({ leer = leerArchivos, llamar = rest, seco = SECO, log = console.log } = {}) {
  const archivos = leer()
  const omitidos = []
  let traspaso = armarTraspaso(archivos, new Date(), omitidos)
  // última red: si el traspaso final aún parece traer un secreto, NO se sube (queda el anterior) y se dice por qué
  const secretoFinal = motivoDeSecreto(traspaso)
  if (secretoFinal) { omitidos.push('traspaso final: parece traer ' + secretoFinal); traspaso = null }
  for (const o of omitidos) log('  traspaso: ' + o)
  // en --seco la tabla puede no existir todavía (antes de la migración): se simula vacía; sin --seco un fallo se dice y se para
  const ya = await existentes(llamar).catch((e) => { if (seco) { log('(la tabla aún no existe o no se pudo leer: se simula vacía)'); return [] } throw e })
  const plan = planDeSubida(archivos, ya)
  const tr = traspaso == null ? null : { ruta: 'traspaso', titulo: 'Traspaso vivo del chat', cuerpo: traspaso, sha: shaDe(traspaso), modificado_en: new Date().toISOString() }
  const yaTr = ya.find((e) => e.ruta === 'traspaso')
  const subir = !tr || (yaTr && yaTr.sha === tr.sha) ? plan.subir : [...plan.subir, tr]
  log(`vault: ${archivos.length} archivos · suben ${subir.length} · se retiran ${plan.retirar.length} · saltados ${plan.saltados.length}`)
  for (const s of plan.saltados.filter((x) => x.motivo.startsWith('parece') || x.motivo.startsWith('pasa')).slice(0, 30)) log('  salta: ' + s.ruta + ' — ' + s.motivo)
  if (seco) { log('(--seco: no se escribió nada)'); return { subir, retirar: plan.retirar, saltados: plan.saltados } }
  for (let i = 0; i < subir.length; i += LOTE) {
    const lote = subir.slice(i, i + LOTE).map((d) => ({ ...d, actualizado_en: new Date().toISOString() }))
    await llamar('POST', `${TABLA}?on_conflict=ruta`, { cuerpo: lote, cabeceras: { Prefer: 'resolution=merge-duplicates,return=minimal' } })
  }
  for (let i = 0; i < plan.retirar.length; i += LOTE) {
    const rutas = plan.retirar.slice(i, i + LOTE).map((r) => '"' + r.replace(/"/g, '') + '"').join(',')
    await llamar('DELETE', `${TABLA}?ruta=in.(${encodeURIComponent(rutas)})`)
  }
  // registro de lo saltado por parecer secreto: solo ruta y motivo, nunca el valor
  const reg = plan.saltados.filter((x) => x.motivo.startsWith('parece'))
  log(`listo · ${subir.length} subidos · ${plan.retirar.length} retirados · ${reg.length} con aspecto de secreto sin subir`)
  return { subir, retirar: plan.retirar, saltados: plan.saltados }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  principal().catch((e) => { console.error('sincronizar-vault-chat: ' + (e instanceof Error ? e.message : 'falló')); process.exit(1) })
}
