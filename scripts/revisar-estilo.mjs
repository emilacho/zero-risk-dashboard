// REVISIÓN AUTOMÁTICA DEL ESTILO BASE (aprobado por Emilio 2026-11-05 · guía: zr-vault 00-meta/ESTILO-DASHBOARD.md · tokens: app/estilo-base.css).
// Rechaza colores, tamaños de letra, pesos, radios y sombras fuera de los tokens, y botones con letra distinta de 18 (token «boton», 09-nov).
//  · modo «diff» (CI): las líneas AGREGADAS en /nuevo frente a la base, y ENTERO cada archivo ya migrado (MIGRADOS: no puede volver atrás).
//  · modo «todo»: cuenta lo que hoy queda fuera de los tokens en /nuevo (lo que falta migrar).
//  · modo «probar»: cada regla debe frenar su caso y dejar pasar los tokens (lo corre la prueba `estilo-base-revision`).
// Excepción decidida: «estilo-ok: <razón de unas palabras>» en la misma línea. Sin la base para comparar, FALLA con el motivo (nunca pasa a ciegas).
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"

const modo = process.argv[2] ?? "diff", base = process.argv[3] ?? "origin/main"
const CARPETAS = /^(components\/nuevo|app\/nuevo)\//
const EXENTOS = /^components\/nuevo\/escena\/|TablerosDeDireccion\.tsx$|GloboQueGira\.tsx$/ // dibujos de la escena: ilustración, no interfaz
/** pantallas ya migradas al estilo base: se revisan enteras en cada cambio; cada migración agrega la suya */
export const MIGRADOS = ["components/nuevo/EstiloBase.tsx", "components/nuevo/PanelRiesgos.tsx", "components/nuevo/PanelDecisiones.tsx", "components/nuevo/EditorDeCifra.tsx", "components/nuevo/BotonesDelMarco.tsx", "components/nuevo/PanelAplicaciones.tsx", "components/nuevo/FichaDeDecision.tsx"]
const PALETA = "zinc|amber|rose|emerald|sky|red|orange|yellow|green|blue|neutral|stone|slate|gray|lime|teal|cyan|indigo|violet|purple|fuchsia|pink"
const PROPIEDAD = "text|bg|border(?:-[trblxy])?|ring|outline|fill|stroke|from|to|via|decoration|divide|placeholder|caret|accent|shadow"
const RADIOS_OK = new Set(["rounded-panel", "rounded-tarjeta", "rounded-control", "rounded-full", "rounded-none"])
const SOMBRAS_OK = new Set(["shadow-none"])
/** ¿la posición i de la línea cae dentro de un comentario? (// … · /* … · línea que sigue un bloque con «*») */
const enComentario = (l, i) => { const t = l.trimStart(); if (t.startsWith("*") || t.startsWith("/*")) return true; const c = [l.indexOf("//"), l.indexOf("/*")].filter((x) => x >= 0); return c.length > 0 && Math.min(...c) < i }
/** NOMBRES PROPIOS DEL SISTEMA (Emilio 09-nov · GO ficha única): mayúscula en cada palabra principal. La MISMA lista que «lib/ficha-de-decision.ts» (una prueba lo exige) */
export const NOMBRES_PROPIOS = ["Plan de Marketing", "Campaña de Marketing", "Tablero Financiero", "Oficina Financiera"]
const REGLAS = [
  ["color suelto (usa un token: carbon, grafito, grafito-2, hueso, gris, apagado, oro, ambar, sobre-ambar, alarma, linea, linea-oro, linea-alarma, velo)", (l) => [...l.matchAll(/(.?)#([0-9a-fA-F]{3,8})\b/g)].some((m) => !(/^\d+$/.test(m[2]) && /^[\s(]$/.test(m[1]) && enComentario(l, m.index))) || /\b(?:rgba?|hsla?|oklch|oklab|color-mix)\(/.test(l)], // «ver #283» SOLO en un comentario (número de una entrega) no es color; en código, «#222» sí
  ["color de Tailwind fuera de los tokens", (l) => new RegExp(`\\b(?:${PROPIEDAD})-(?:(?:${PALETA})-\\d{2,3}|white|black|transparent\\/[\\d.\\[\\]]+|current\\/[\\d.\\[\\]]+|\\[[^\\]]*\\])`).test(l)],
  ["tamaño de letra fuera de los tokens (titulo 20 · cuerpo 15 · dato 13 · rotulo 11 · cifra 24 · numero 36 · boton 18)", (l) => /\btext-(?:\[[\d.]+(?:px|rem|em)\]|xs|sm|base|lg|xl|[2-9]xl)(?![\w-])|fontSize[=:]/.test(l)],
  ["peso fuera de los 2 (normal · medio)", (l) => /\bfont-(?:thin|extralight|light|medium|semibold|bold|extrabold|black|\[\d+\])(?![\w-])|fontWeight[=:]/.test(l)],
  ["radio fuera de los tokens (panel · tarjeta · control · píldora)", (l) => [...l.matchAll(/(?<![\w-])rounded(?:-[\w[\].]+)*(?![\w-])/g)].some((m) => !RADIOS_OK.has(m[0])) || /border-?[rR]adius[=:]/.test(l)],
  ["sombra (el estilo base no usa sombras)", (l) => [...l.matchAll(/(?<![\w-])shadow(?:-[\w[\].,()/]+)*(?![\w-])/g)].some((m) => !SOMBRAS_OK.has(m[0])) || /box-?[sS]hadow[=:]/.test(l)],
  ["nombre propio del sistema sin su mayúscula (Plan de Marketing · Campaña de Marketing · Tablero Financiero · Oficina Financiera)", (l) => NOMBRES_PROPIOS.some((n) => [...l.matchAll(new RegExp(n.replace(/ /g, "\\s+"), "giu"))].some((m) => m[0] !== n && !enComentario(l, m.index)))],
]
const PERMISO = /estilo-ok:\s*\p{L}[\p{L} ,.]{8,}/u
const hallazgos = []
// BOTONES (09-nov, Emilio · imagen APROBADO-botones-letra-18.png): todo botón ámbar o de borde oro lleva letra 18 («text-boton»), peso medio.
// Se mira la etiqueta <button …> ENTERA (puede ocupar varias líneas). Las tarjetas que se tocan (rounded-tarjeta/panel) no son botones.
const QUE_BOTON = "botón con letra distinta de 18 (todo botón ámbar o de borde oro usa text-boton)"
const TAMANOS = /(?<![\w:-])text-(?:titulo|cuerpo|dato|rotulo|cifra|numero|\[[\d.]+(?:px|rem|em)\]|xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/
const CON_CONSTANTE = /\b(?:BOTON_PRINCIPAL|BOTON_SECUNDARIO|PRINCIPAL|SECUNDARIO)\b/
const LETRA_18 = /(?<![\w:-])text-boton(?![\w-])/
const esCaja = (t) => (/(?<![\w:-])(?:bg-ambar|border-linea-oro|border-oro)(?![\w-])|\bbackground:\s*[^,}]*\bAMBAR\b/.test(t) || CON_CONSTANTE.test(t)) && !/(?<![\w:-])rounded-(?:tarjeta|panel)(?![\w-])/.test(t)
/** ¿esta etiqueta de botón está mal? (caja ámbar u oro sin text-boton, o con otro tamaño encima). Un <button … /> sin letra (barra de un gráfico) no cuenta */
export const botonMal = (t) => !t.endsWith("/>") && esCaja(t) && !PERMISO.test(t) && (!(LETRA_18.test(t) || CON_CONSTANTE.test(t)) || TAMANOS.test(t))
/** la constante que arma un botón (const BOTON_X = "… bg-ambar …") también debe llevar text-boton */
const constanteMal = (l) => /\bconst\s+BOTON_\w+\s*=/.test(l) && esCaja(l.replace(/\bconst\s+BOTON_\w+/, "")) && (!LETRA_18.test(l) || TAMANOS.test(l))
/** las etiquetas <button …> de un archivo, con la línea donde empiezan y terminan */
export function etiquetasDeBoton(src) {
  const out = []; let i = 0
  while ((i = src.indexOf("<button", i)) >= 0) {
    let j = i + 7, d = 0, q = null
    for (; j < src.length; j++) { const c = src[j]; if (q) { if (c === q) q = null; continue } if (c === '"' || c === "'" || c === "`") { q = c; continue } if (c === "{") d++; else if (c === "}") d--; else if (c === ">" && d === 0) break }
    const tag = src.slice(i, j + 1), desde = src.slice(0, i).split("\n").length
    out.push({ tag, desde, hasta: desde + tag.split("\n").length - 1 }); i = j
  }
  return out
}
/** botones del archivo; con «tocadas» (números de línea), solo los que la entrega toca */
const revisarBotones = (f, src, tocadas = null) => { for (const e of etiquetasDeBoton(src)) { if (tocadas && ![...Array(e.hasta - e.desde + 1).keys()].some((k) => tocadas.has(e.desde + k))) continue; if (botonMal(e.tag)) hallazgos.push({ f, n: e.desde, que: QUE_BOTON }) } }
const revisar = (f, n, linea) => { if (PERMISO.test(linea)) return; for (const [que, falla] of REGLAS) if (falla(linea)) hallazgos.push({ f, n, que }); if (constanteMal(linea)) hallazgos.push({ f, n, que: QUE_BOTON }) }
const revisarEntero = (f) => { const src = readFileSync(f, "utf8"); src.split("\n").forEach((l, i) => revisar(f, i + 1, l)); revisarBotones(f, src) }

if (modo === "probar") {
  const deben = [
    ["#e8731a", 0], ["rgba(0,0,0,.5)", 0], ["hsl(20 80% 50%)", 0], ["text-amber-200", 1], ["text-white", 1], ["bg-black/70", 1], ["bg-transparent/40", 1], ["bg-[#111]", 0], ["fill=\"#111\"", 0], ["color: #111;", 0], ["border: 1px solid #222", 0], ["border: 1px solid #222;", 0], ["boxShadow: \"#000 0px\"", 0], ["color: \"#123\" // ver la guía", 0], ["border-white/10", 1],
    ["text-[13px]", 2], ["text-[0.8rem]", 2], ["text-sm", 2], ["fontSize={13}", 2], ["font-semibold", 3], ["font-light", 3], ["font-medium", 3], ["fontWeight: 600", 3],
    ["rounded-md", 4], ["rounded-lg", 4], ["rounded", 4], ["rounded-[10px]", 4], ["rounded-t-xl", 4], ["borderRadius: 6", 4],
    ["shadow", 5], ["shadow-2xl", 5], ["shadow-[0_0_10px_red]", 5], ["boxShadow: 'x'", 5], ["la Oficina financiera debe mandar", 6], ["\"plan de marketing\"", 6], ["Ir a la Campaña de marketing", 6],
  ]
  const pasan = ["Ir al Plan de Marketing → · Tablero Financiero: espera", "// la oficina financiera, en un comentario", "bg-grafito text-gris text-cuerpo font-medio rounded-tarjeta border-linea", "rounded-full rounded-control rounded-panel", "className=\"text-rotulo text-oro tracking-rotulo\"", "bg-ambar text-sobre-ambar text-numero text-cifra", "x // estilo-ok: el logo exige su contorno exacto #e8731a", "bg-transparent", "shadow-none", "// lo pidió CC6 (#283) · ver #289.", " * corrección de la entrega #290", "{/* entrega #291 */}"]
  const noPasan = ["x // estilo-ok:", "x // estilo-ok: ok"]
  let fallos = 0
  const botonesMal = ['<button className="rounded-control bg-ambar px-3 text-cuerpo font-medio text-sobre-ambar">', '<button className="rounded-control border border-linea-oro text-dato text-oro">', '<button className={`${BOTON_PRINCIPAL} text-cuerpo`}>', '<button\n  className="rounded-control px-4 font-medio"\n  style={{ background: listo ? AMBAR : "#3a2a1a" }}>', '<button className="rounded-full border border-linea-oro px-4 text-oro">']
  const botonesBien = ['<button className="rounded-control bg-ambar text-boton font-medio">', '<button className={BOTON_SECUNDARIO}>', '<button className={`w-full ${SECUNDARIO}`}>', '<button className="rounded-tarjeta border border-linea-oro text-cuerpo">', '<button className="text-dato text-gris hover:border-linea-oro">', '<button className="absolute h-[18px]" style={{ background: f.fallo ? ROJO : AMBAR }} />', '<button\n  className="rounded-control px-4 text-boton font-medio"\n  style={{ background: listo ? AMBAR : "#3a2a1a" }}>']
  for (const t of botonesMal) { const [e] = etiquetasDeBoton(t.endsWith("/>") ? t : t + "x</button>"); if (!e || !botonMal(e.tag)) { fallos++; console.error(`NO frena el botón «${t}»`) } }
  for (const t of botonesBien) { const [e] = etiquetasDeBoton(t.endsWith("/>") ? t : t + "x</button>"); if (!e || botonMal(e.tag)) { fallos++; console.error(`frena de más el botón «${t}»`) } }
  const constantes = [["export const BOTON_PRINCIPAL = 'rounded-control bg-ambar px-3 text-cuerpo font-medio'", true], ["export const BOTON_SECUNDARIO = 'border border-linea-oro text-oro'", true], ["export const BOTON_PRINCIPAL = 'rounded-control bg-ambar px-3 text-boton font-medio'", false]]
  for (const [l, mal] of constantes) { hallazgos.length = 0; revisar("x", 1, l); if (hallazgos.some((h) => h.que === QUE_BOTON) !== mal) { fallos++; console.error(`la constante «${l}» ${mal ? "no frena" : "frena de más"}`) } }
  for (const [linea, i] of deben) { const ok = REGLAS[i][1](linea) && !PERMISO.test(linea); if (!ok) { fallos++; console.error(`NO frena «${linea}» (regla ${i})`) } }
  for (const linea of pasan) { hallazgos.length = 0; revisar("x", 1, linea); if (hallazgos.length) { fallos++; console.error(`frena de más «${linea}»: ${hallazgos.map((h) => h.que).join(" | ")}`) } }
  for (const linea of noPasan) { hallazgos.length = 0; revisar("x", 1, "text-[13px] " + linea); if (!hallazgos.length) { fallos++; console.error(`el permiso sin razón dejó pasar «${linea}»`) } }
  console.log(fallos ? `${fallos} casos fallan` : `ok · ${deben.length} frenan, ${pasan.length} pasan, ${noPasan.length} permisos sin razón no valen · botones: ${botonesMal.length} frenan, ${botonesBien.length} pasan, ${constantes.length} constantes`)
  process.exit(fallos ? 1 : 0)
}
if (modo === "todo") {
  const archivos = execSync("git ls-files components/nuevo app/nuevo", { encoding: "utf8" }).split("\n").filter((f) => /\.(tsx?|css)$/.test(f) && !EXENTOS.test(f))
  for (const f of archivos) revisarEntero(f)
} else {
  try { execSync(`git merge-base ${base} HEAD`, { stdio: "ignore" }) } catch {
    try { execSync("git fetch --no-tags --unshallow origin main", { stdio: "ignore" }) } catch { /* puede que ya no sea superficial */ }
    try { execSync(`git merge-base ${base} HEAD`, { stdio: "ignore" }) } catch { console.error(`No encuentro la base ${base}: baja el repositorio con la historia completa (fetch-depth: 0). No reviso a ciegas.`); process.exit(2) }
  }
  for (const f of MIGRADOS) revisarEntero(f)
  const diff = execSync(`git diff --unified=0 ${base}...HEAD -- components/nuevo app/nuevo`, { encoding: "utf8" })
  let f = null, n = 0; const tocadas = {}
  for (const l of diff.split("\n")) {
    if (l.startsWith("+++ ")) { f = l.slice(6); continue }
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)/); if (h) { n = Number(h[1]); continue }
    if (!f || !CARPETAS.test(f) || EXENTOS.test(f) || MIGRADOS.includes(f)) continue
    if (l.startsWith("+") && !l.startsWith("+++")) { revisar(f, n, l.slice(1)); (tocadas[f] ??= new Set()).add(n); n++ }
  }
  for (const [g, ns] of Object.entries(tocadas)) revisarBotones(g, readFileSync(g, "utf8"), ns) // el botón ENTERO si la entrega toca alguna de sus líneas
}
const porRegla = {}; for (const h of hallazgos) porRegla[h.que] = (porRegla[h.que] ?? 0) + 1
const porArchivo = {}; for (const h of hallazgos) porArchivo[h.f] = (porArchivo[h.f] ?? 0) + 1
console.log(JSON.stringify({ modo, total: hallazgos.length, porRegla, archivos: Object.keys(porArchivo).length }, null, 1))
if (modo === "diff" && hallazgos.length) { for (const h of hallazgos.slice(0, 60)) console.error(`${h.f}:${h.n} · ${h.que}`); process.exit(1) }
