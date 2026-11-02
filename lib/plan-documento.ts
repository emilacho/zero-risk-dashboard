/**
 * EL PLAN EN SECCIONES (CC6 · 02-nov · pedido de Emilio: «que esté bien segmentado para que el lector no se pierda entre párrafos gigantes»).
 * Lógica PURA: parte el documento del plan (markdown) en sus secciones `##`, con un resumen corto de cada una, y lo convierte en bloques simples
 * (títulos, párrafos, listas, tablas, citas) para pintarlo. Referencia de lectura: estilo GitBook (índice a la izquierda, secciones plegables).
 * Nada se inventa: el resumen es el comienzo de la sección tal cual; los datos clave se copian de líneas del documento o dicen «ver la sección».
 */
export interface SeccionDelPlan {
  /** ancla estable («resumen-ejecutivo») */
  id: string
  titulo: string
  /** las primeras líneas de la sección, sin formato, para leer sin abrirla */
  resumen: string[]
  /** el texto completo de la sección (markdown, sin su título) */
  cuerpo: string
  /** los subtítulos `###` que trae (para el índice) */
  subtitulos: string[]
  caracteres: number
}
export interface DocumentoEnSecciones {
  titulo: string | null
  /** la línea de debajo del título (p. ej. «Olón, Santa Elena, Ecuador · 2 de noviembre de 2026 – 24 de enero de 2027») */
  bajada: string | null
  secciones: SeccionDelPlan[]
}

const limpio = (s: string): string => s.replace(/\*\*|__|`/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim()
export const anclaDe = (t: string): string => limpio(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "seccion"
/** la sección «Qué cambió» ya se muestra arriba, en la decisión: no se repite */
const esQueCambio = (t: string) => /^qu[ée]\s+cambi[óo]\s+en\s+esta\s+versi[óo]n/i.test(limpio(t))

/** el resumen de una sección: hasta `n` líneas con contenido (párrafo o viñetas), sin tablas ni títulos, cada una recortada */
export function resumenDeLaSeccion(cuerpo: string, n = 3, largo = 220): string[] {
  const salida: string[] = []
  for (const cruda of cuerpo.split("\n")) {
    const l = cruda.trim()
    if (!l || /^#{1,6}\s/.test(l) || l.startsWith("|") || /^-{3,}$/.test(l) || /^```/.test(l)) { if (salida.length && !l) { /* fin de párrafo */ } continue }
    const t = limpio(l.replace(/^>\s*/, "").replace(/^([-*•]|\d+[.)])\s+/, ""))
    if (!t) continue
    salida.push(t.length > largo ? `${t.slice(0, largo - 1).replace(/\s+\S*$/, "")}…` : t)
    if (salida.length >= n) break
  }
  return salida
}

/** el documento en secciones `##` (lo de antes del primer `##` da el título y la bajada) */
export function seccionesDelPlan(md: string | null | undefined): DocumentoEnSecciones {
  const texto = String(md ?? "").replace(/\r/g, "")
  const lineas = texto.split("\n")
  let titulo: string | null = null, bajada: string | null = null
  const secciones: SeccionDelPlan[] = []
  let actual: { titulo: string; lineas: string[] } | null = null
  const usados = new Map<string, number>()
  const cerrar = () => {
    if (!actual || esQueCambio(actual.titulo)) { actual = null; return }
    const cuerpo = actual.lineas.join("\n").replace(/^\s*-{3,}\s*$/gm, "").trim()
    let id = anclaDe(actual.titulo)
    const n = (usados.get(id) ?? 0) + 1; usados.set(id, n); if (n > 1) id = `${id}-${n}`
    const subtitulos = [...cuerpo.matchAll(/^###\s+(.+)$/gm)].map((m) => limpio(m[1]))
    // si la sección empieza con subtítulos o con una tabla, el resumen son sus subtítulos o la primera fila de la tabla
    const primera = cuerpo.split("\n").map((l) => l.trim()).find((l) => l && !/^-{3,}$/.test(l)) ?? ""
    let resumen = /^###\s/.test(primera) ? subtitulos.slice(0, 4) : resumenDeLaSeccion(cuerpo)
    if (!resumen.length && subtitulos.length) resumen = subtitulos.slice(0, 4)
    if (!resumen.length) {
      const filas = cuerpo.split("\n").filter((l) => l.trim().startsWith("|") && !/^\|?\s*:?-{2,}/.test(l.trim()))
      if (filas.length) resumen = [`Tabla de ${filas.length - 1} ${filas.length - 1 === 1 ? "fila" : "filas"}: ${limpio(filas[0].trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()).filter(Boolean).join(" · "))}`]
    }
    secciones.push({ id, titulo: limpio(actual.titulo), resumen, cuerpo, subtitulos, caracteres: cuerpo.length })
    actual = null
  }
  for (const l of lineas) {
    const h2 = l.match(/^##\s+(.+?)\s*#*\s*$/)
    if (h2 && !l.startsWith("###")) { cerrar(); actual = { titulo: h2[1], lineas: [] }; continue }
    if (actual) { actual.lineas.push(l); continue }
    const h1 = l.match(/^#\s+(.+)$/)
    if (h1 && !titulo) { titulo = limpio(h1[1]); continue }
    if (titulo && !bajada && l.trim() && !/^-{3,}$/.test(l.trim())) bajada = limpio(l)
  }
  cerrar()
  return { titulo, bajada, secciones }
}

// ── los datos clave (tarjetas de arriba): copiados de líneas del documento; si no están, se dice ──
export interface DatoClave { clave: "fechas" | "lugar" | "presupuesto" | "meta"; etiqueta: string; valor: string | null; seccion: string | null }
const FECHAS = /(\d{1,2}\s+de\s+[a-záéíóú]+(?:\s+de\s+\d{4})?\s*[–-]\s*\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4})/i
export function datosClave(doc: DocumentoEnSecciones): DatoClave[] {
  const porTitulo = (re: RegExp) => doc.secciones.find((s) => re.test(s.titulo)) ?? null
  const bajada = doc.bajada ?? ""
  const fechas = bajada.match(FECHAS)?.[1] ?? null
  const lugar = bajada ? limpio(bajada.replace(FECHAS, "").replace(/[·|]\s*$/, "").replace(/\s*[·|]\s*$/, "")) || null : null
  const pres = porTitulo(/^presupuesto/i)
  // presupuesto: la primera línea de su sección que trae una cifra en dinero (tal cual)
  const dinero = /(US\$|\$|USD)\s?\d/
  const lineaPres = pres ? pres.cuerpo.split("\n").map((l) => l.trim()).find((l) => l && !/^\|?\s*:?-{2,}/.test(l) && dinero.test(l)) ?? null : null
  const totalLimpio = lineaPres ? limpio(lineaPres.replace(/^([-*•]|\d+[.)])\s+/, "").replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((x) => x.trim()).filter(Boolean).join(" · ")) : null
  // la meta: la primera línea de «Ingresos» (o del resumen) que habla del número que persigue el plan
  const ingresos = porTitulo(/^ingresos/i), resumen = porTitulo(/^resumen/i)
  const candidatas = [ingresos, resumen].filter((x): x is SeccionDelPlan => !!x).flatMap((x) => x.resumen.map((r) => ({ r, id: x.id })))
  const lineaMeta = candidatas.find((x) => /(n[uú]mero|meta|objetivo|persigue)/i.test(x.r) && /\d/.test(x.r)) ?? (resumen?.resumen[0] ? { r: resumen.resumen[0], id: resumen.id } : null)
  return [
    { clave: "fechas", etiqueta: "Fechas", valor: fechas, seccion: null },
    { clave: "lugar", etiqueta: "Dónde", valor: lugar, seccion: null },
    { clave: "presupuesto", etiqueta: "Presupuesto", valor: totalLimpio, seccion: pres?.id ?? null },
    { clave: "meta", etiqueta: "La meta", valor: lineaMeta?.r ?? null, seccion: lineaMeta?.id ?? null },
  ]
}

// ── el markdown en bloques simples (para pintarlo sin una librería) ──
export type Bloque =
  | { tipo: "titulo"; nivel: 3 | 4; texto: string }
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; ordenada: boolean; items: string[] }
  | { tipo: "tabla"; cabecera: string[]; filas: string[][] }
  | { tipo: "cita"; texto: string }
export function bloquesDelMarkdown(md: string): Bloque[] {
  const lineas = md.replace(/\r/g, "").split("\n")
  const salida: Bloque[] = []
  const celdas = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())
  let i = 0
  while (i < lineas.length) {
    const l = lineas[i], t = l.trim()
    if (!t || /^-{3,}$/.test(t) || /^```/.test(t)) { i++; continue }
    const h = t.match(/^(#{3,6})\s+(.+)$/)
    if (h) { salida.push({ tipo: "titulo", nivel: h[1].length === 3 ? 3 : 4, texto: h[2].replace(/\s*#+$/, "") }); i++; continue }
    if (t.startsWith("|")) {
      const grupo: string[] = []
      while (i < lineas.length && lineas[i].trim().startsWith("|")) { grupo.push(lineas[i]); i++ }
      const filas = grupo.map(celdas).filter((f) => !f.every((c) => /^:?-{2,}:?$/.test(c)))
      if (filas.length) salida.push({ tipo: "tabla", cabecera: filas[0], filas: filas.slice(1) })
      continue
    }
    if (/^([-*•])\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      const ordenada = /^\d+[.)]\s+/.test(t)
      const items: string[] = []
      while (i < lineas.length) {
        const x = lineas[i].trim()
        if (/^([-*•])\s+/.test(x) || /^\d+[.)]\s+/.test(x)) { items.push(x.replace(/^([-*•]|\d+[.)])\s+/, "")); i++; continue }
        if (x && items.length && /^\s{2,}/.test(lineas[i])) { items[items.length - 1] += ` ${x}`; i++; continue }
        break
      }
      salida.push({ tipo: "lista", ordenada, items })
      continue
    }
    if (t.startsWith(">")) {
      const partes: string[] = []
      while (i < lineas.length && lineas[i].trim().startsWith(">")) { partes.push(lineas[i].trim().replace(/^>\s?/, "")); i++ }
      salida.push({ tipo: "cita", texto: partes.join(" ") })
      continue
    }
    const partes: string[] = []
    while (i < lineas.length) {
      const x = lineas[i].trim()
      if (!x || x.startsWith("|") || /^#{1,6}\s/.test(x) || /^([-*•])\s+/.test(x) || /^\d+[.)]\s+/.test(x) || x.startsWith(">") || /^-{3,}$/.test(x)) break
      partes.push(x); i++
    }
    salida.push({ tipo: "parrafo", texto: partes.join(" ") })
  }
  return salida
}

/** un texto en trozos: negritas aparte y cifras/fechas destacadas (US$ 1.200, 15 %, 2 nov, semana 3) */
export type Trozo = { t: string; negrita?: boolean; cifra?: boolean }
const CIFRA = /(US\$\s?[\d.,]+(?:\s?(?:mil|k))?|\$\s?[\d.,]+|\d+(?:[.,]\d+)?\s?%|\d{1,2}\s+(?:de\s+)?(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-záéíóú]*(?:\s+(?:de\s+)?\d{4})?|semanas?\s+\d+(?:\s*[-–]\s*\d+)?)/gi
export function trozosDelTexto(texto: string): Trozo[] {
  const salida: Trozo[] = []
  for (const parte of texto.split(/(\*\*[^*]+\*\*)/)) {
    if (!parte) continue
    const negrita = /^\*\*[^*]+\*\*$/.test(parte)
    const cuerpo = (negrita ? parte.slice(2, -2) : parte).replace(/`/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    let ultimo = 0
    for (const m of cuerpo.matchAll(CIFRA)) {
      if (m.index! > ultimo) salida.push({ t: cuerpo.slice(ultimo, m.index), ...(negrita ? { negrita } : {}) })
      salida.push({ t: m[0], cifra: true, ...(negrita ? { negrita } : {}) })
      ultimo = m.index! + m[0].length
    }
    if (ultimo < cuerpo.length) salida.push({ t: cuerpo.slice(ultimo), ...(negrita ? { negrita } : {}) })
  }
  return salida
}
