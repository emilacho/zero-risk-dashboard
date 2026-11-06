// REVISIÓN AUTOMÁTICA DEL ESTILO BASE (aprobado por Emilio 2026-11-05 · guía: zr-vault 00-meta/ESTILO-DASHBOARD.md · tokens: app/estilo-base.css).
// Rechaza colores, tamaños de letra, pesos, radios y sombras fuera de los tokens.
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
export const MIGRADOS = ["components/nuevo/EstiloBase.tsx", "components/nuevo/PanelRiesgos.tsx", "components/nuevo/PanelDecisiones.tsx", "components/nuevo/EditorDeCifra.tsx", "components/nuevo/BotonesDelMarco.tsx"]
const PALETA = "zinc|amber|rose|emerald|sky|red|orange|yellow|green|blue|neutral|stone|slate|gray|lime|teal|cyan|indigo|violet|purple|fuchsia|pink"
const PROPIEDAD = "text|bg|border(?:-[trblxy])?|ring|outline|fill|stroke|from|to|via|decoration|divide|placeholder|caret|accent|shadow"
const RADIOS_OK = new Set(["rounded-panel", "rounded-tarjeta", "rounded-control", "rounded-full", "rounded-none"])
const SOMBRAS_OK = new Set(["shadow-none"])
/** ¿la posición i de la línea cae dentro de un comentario? (// … · /* … · línea que sigue un bloque con «*») */
const enComentario = (l, i) => { const t = l.trimStart(); if (t.startsWith("*") || t.startsWith("/*")) return true; const c = [l.indexOf("//"), l.indexOf("/*")].filter((x) => x >= 0); return c.length > 0 && Math.min(...c) < i }
const REGLAS = [
  ["color suelto (usa un token: carbon, grafito, grafito-2, hueso, gris, apagado, oro, ambar, sobre-ambar, alarma, linea, linea-oro, linea-alarma, velo)", (l) => [...l.matchAll(/(.?)#([0-9a-fA-F]{3,8})\b/g)].some((m) => !(/^\d+$/.test(m[2]) && /^[\s(]$/.test(m[1]) && enComentario(l, m.index))) || /\b(?:rgba?|hsla?|oklch|oklab|color-mix)\(/.test(l)], // «ver #283» SOLO en un comentario (número de una entrega) no es color; en código, «#222» sí
  ["color de Tailwind fuera de los tokens", (l) => new RegExp(`\\b(?:${PROPIEDAD})-(?:(?:${PALETA})-\\d{2,3}|white|black|transparent\\/[\\d.\\[\\]]+|current\\/[\\d.\\[\\]]+|\\[[^\\]]*\\])`).test(l)],
  ["tamaño de letra fuera de los tokens (titulo 20 · cuerpo 15 · dato 13 · rotulo 11 · cifra 24 · numero 36)", (l) => /\btext-(?:\[[\d.]+(?:px|rem|em)\]|xs|sm|base|lg|xl|[2-9]xl)(?![\w-])|fontSize[=:]/.test(l)],
  ["peso fuera de los 2 (normal · medio)", (l) => /\bfont-(?:thin|extralight|light|medium|semibold|bold|extrabold|black|\[\d+\])(?![\w-])|fontWeight[=:]/.test(l)],
  ["radio fuera de los tokens (panel · tarjeta · control · píldora)", (l) => [...l.matchAll(/(?<![\w-])rounded(?:-[\w[\].]+)*(?![\w-])/g)].some((m) => !RADIOS_OK.has(m[0])) || /border-?[rR]adius[=:]/.test(l)],
  ["sombra (el estilo base no usa sombras)", (l) => [...l.matchAll(/(?<![\w-])shadow(?:-[\w[\].,()/]+)*(?![\w-])/g)].some((m) => !SOMBRAS_OK.has(m[0])) || /box-?[sS]hadow[=:]/.test(l)],
]
const PERMISO = /estilo-ok:\s*\p{L}[\p{L} ,.]{8,}/u
const hallazgos = []
const revisar = (f, n, linea) => { if (PERMISO.test(linea)) return; for (const [que, falla] of REGLAS) if (falla(linea)) hallazgos.push({ f, n, que }) }
const revisarEntero = (f) => readFileSync(f, "utf8").split("\n").forEach((l, i) => revisar(f, i + 1, l))

if (modo === "probar") {
  const deben = [
    ["#e8731a", 0], ["rgba(0,0,0,.5)", 0], ["hsl(20 80% 50%)", 0], ["text-amber-200", 1], ["text-white", 1], ["bg-black/70", 1], ["bg-transparent/40", 1], ["bg-[#111]", 0], ["fill=\"#111\"", 0], ["color: #111;", 0], ["border: 1px solid #222", 0], ["border: 1px solid #222;", 0], ["boxShadow: \"#000 0px\"", 0], ["color: \"#123\" // ver la guía", 0], ["border-white/10", 1],
    ["text-[13px]", 2], ["text-[0.8rem]", 2], ["text-sm", 2], ["fontSize={13}", 2], ["font-semibold", 3], ["font-light", 3], ["font-medium", 3], ["fontWeight: 600", 3],
    ["rounded-md", 4], ["rounded-lg", 4], ["rounded", 4], ["rounded-[10px]", 4], ["rounded-t-xl", 4], ["borderRadius: 6", 4],
    ["shadow", 5], ["shadow-2xl", 5], ["shadow-[0_0_10px_red]", 5], ["boxShadow: 'x'", 5],
  ]
  const pasan = ["bg-grafito text-gris text-cuerpo font-medio rounded-tarjeta border-linea", "rounded-full rounded-control rounded-panel", "className=\"text-rotulo text-oro tracking-rotulo\"", "bg-ambar text-sobre-ambar text-numero text-cifra", "x // estilo-ok: el logo exige su contorno exacto #e8731a", "bg-transparent", "shadow-none", "// lo pidió CC6 (#283) · ver #289.", " * corrección de la entrega #290", "{/* entrega #291 */}"]
  const noPasan = ["x // estilo-ok:", "x // estilo-ok: ok"]
  let fallos = 0
  for (const [linea, i] of deben) { const ok = REGLAS[i][1](linea) && !PERMISO.test(linea); if (!ok) { fallos++; console.error(`NO frena «${linea}» (regla ${i})`) } }
  for (const linea of pasan) { hallazgos.length = 0; revisar("x", 1, linea); if (hallazgos.length) { fallos++; console.error(`frena de más «${linea}»: ${hallazgos.map((h) => h.que).join(" | ")}`) } }
  for (const linea of noPasan) { hallazgos.length = 0; revisar("x", 1, "text-[13px] " + linea); if (!hallazgos.length) { fallos++; console.error(`el permiso sin razón dejó pasar «${linea}»`) } }
  console.log(fallos ? `${fallos} casos fallan` : `ok · ${deben.length} frenan, ${pasan.length} pasan, ${noPasan.length} permisos sin razón no valen`)
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
  let f = null, n = 0
  for (const l of diff.split("\n")) {
    if (l.startsWith("+++ ")) { f = l.slice(6); continue }
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)/); if (h) { n = Number(h[1]); continue }
    if (!f || !CARPETAS.test(f) || EXENTOS.test(f) || MIGRADOS.includes(f)) continue
    if (l.startsWith("+") && !l.startsWith("+++")) { revisar(f, n, l.slice(1)); n++ }
  }
}
const porRegla = {}; for (const h of hallazgos) porRegla[h.que] = (porRegla[h.que] ?? 0) + 1
const porArchivo = {}; for (const h of hallazgos) porArchivo[h.f] = (porArchivo[h.f] ?? 0) + 1
console.log(JSON.stringify({ modo, total: hallazgos.length, porRegla, archivos: Object.keys(porArchivo).length }, null, 1))
if (modo === "diff" && hallazgos.length) { for (const h of hallazgos.slice(0, 60)) console.error(`${h.f}:${h.n} · ${h.que}`); process.exit(1) }
