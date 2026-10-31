/**
 * EL MANUAL DE MARCA EN EL DASHBOARD NUEVO (sprint 6.3 · Emilio 31-oct: «ya no uses el dashboard viejo · el manual de marca ya mostrarlo en el nuevo estilo»).
 * Lógica pura sobre la fila de `client_brand_books`: la identidad visual (colores y letras con su procedencia), las listas de palabras y las etiquetas legibles.
 * Los campos de texto los lee `lib/manual-lector.ts` (el mismo lector que usaba la ficha vieja). Nada escribe.
 */
import { CAMPOS_DEL_LECTOR } from "@/lib/manual-lector"

export interface ColorDelManual { hex: string; rol: string | null; procedencia: string | null }
export interface TipografiaDelManual { familia: string; rol: string | null; procedencia: string | null }

type Fila = Record<string, unknown>
const objeto = (v: unknown): Fila => {
  if (typeof v === "string") { try { const x = JSON.parse(v); return x && typeof x === "object" && !Array.isArray(x) ? (x as Fila) : {} } catch { return {} } }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Fila) : {}
}
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : typeof v === "string" ? (() => { try { const x = JSON.parse(v); return Array.isArray(x) ? x : [] } catch { return [] } })() : [])
const textoONulo = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)

/** los textos de una lista guardada como arreglo (o como JSON en texto); lo vacío se descarta */
export function listaDeTextos(v: unknown): string[] {
  return lista(v).map((x) => (typeof x === "string" ? x.trim() : x && typeof x === "object" ? textoONulo((x as Fila).texto ?? (x as Fila).valor) ?? "" : "")).filter(Boolean)
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i
const hexLimpio = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  if (!HEX.test(s)) return null
  const h = s.replace("#", "").toLowerCase()
  return "#" + (h.length === 3 ? h.split("").map((c) => c + c).join("") : h)
}

/** la paleta: columna `primary_colors` (objetos con `hex`/`color`, rol y procedencia, o textos «#1a0828») y, si está vacía, la capa gráfica del borrador */
export function coloresDelManual(fila: Fila | null): ColorDelManual[] {
  if (!fila) return []
  const leer = (v: unknown): ColorDelManual[] => lista(v).map((x): ColorDelManual | null => {
    if (typeof x === "string") { const hex = hexLimpio(x); return hex ? { hex, rol: null, procedencia: null } : null }
    const o = objeto(x); const hex = hexLimpio(o.hex ?? o.color ?? o.valor)
    return hex ? { hex, rol: textoONulo(o.rol), procedencia: textoONulo(o.procedencia) } : null
  }).filter((c): c is ColorDelManual => c != null)
  const columna = leer(fila.primary_colors)
  if (columna.length) return columna
  const visual = objeto(objeto(objeto(objeto(fila.content_text).brand_book_draft).visual).capa_grafica)
  return leer(visual.paleta)
}

/** las letras: columna `typography` (arreglo de objetos con `family`/`familia`, rol y procedencia; un objeto vacío = sin dato) y, si no, la capa gráfica del borrador */
export function tipografiasDelManual(fila: Fila | null): TipografiaDelManual[] {
  if (!fila) return []
  const leer = (v: unknown): TipografiaDelManual[] => lista(v).map((x): TipografiaDelManual | null => {
    if (typeof x === "string") return textoONulo(x) ? { familia: x.trim(), rol: null, procedencia: null } : null
    const o = objeto(x); const familia = textoONulo(o.family ?? o.familia ?? o.nombre)
    return familia ? { familia, rol: textoONulo(o.rol), procedencia: textoONulo(o.procedencia) } : null
  }).filter((t): t is TipografiaDelManual => t != null)
  const columna = leer(fila.typography)
  if (columna.length) return columna
  const visual = objeto(objeto(objeto(objeto(fila.content_text).brand_book_draft).visual).capa_grafica)
  return leer(visual.tipografias ?? visual.tipografia ?? visual.letras)
}

/** de dónde salió un color o una letra, en palabras */
export function procedenciaLegible(p: string | null): string | null {
  if (!p) return null
  if (p === "sitio:hoja_de_estilo") return "de la hoja de estilo del sitio"
  if (p.startsWith("sitio")) return "del sitio web"
  if (p.startsWith("redes") || p.startsWith("instagram") || p.startsWith("facebook")) return "de las redes"
  if (p.startsWith("dueno") || p.startsWith("dueño")) return "dicho por el dueño"
  if (p.startsWith("logo")) return "del logotipo"
  return p.replace(/[_:]/g, " ")
}

export function rolDelColorLegible(rol: string | null): string {
  if (rol === "principal") return "principal"
  if (rol === "secundario") return "secundario"
  if (rol === "acento") return "acento"
  if (rol === "fondo") return "fondo"
  return rol ?? "de apoyo"
}

export function rolDeLaLetraLegible(rol: string | null): string {
  if (rol === "cuerpo") return "cuerpo de texto"
  if (rol === "titulos" || rol === "títulos" || rol === "display") return "títulos"
  return rol ?? "complementaria"
}

/** negro o blanco según el color de fondo, para que el código del color se lea encima */
export function contrasteDelTexto(hex: string): "#000" | "#fff" {
  const h = hex.replace("#", "")
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? "#000" : "#fff"
}

export function politicaDeCompetidoresLegible(v: unknown): string | null {
  switch (textoONulo(v)) {
    case null: return null
    case "never_mention": return "Nunca se nombra a la competencia"
    case "mention_allowed": case "allowed": return "Se puede nombrar a la competencia"
    case "compare_allowed": case "compare": return "Se puede comparar con la competencia"
    default: return String(v)
  }
}

export function origenDelManualLegible(v: unknown): string | null {
  switch (textoONulo(v)) {
    case null: return null
    case "onboarding_collaborative_build": return "Construido en el alta, con los datos del cliente"
    case "onboarding": return "Construido en el alta"
    case "manual": case "dueno": return "Escrito a mano"
    default: return String(v).replace(/_/g, " ")
  }
}

/** el borrador del manual (`content_text.brand_book_draft`), venga como objeto o como texto JSON */
export function borradorDelManual(fila: Fila | null): Fila { return fila ? objeto(objeto(fila.content_text).brand_book_draft) : {} }

/** el agente a veces antepone «PROPUESTA (no es dato del cliente): …» al valor; se separa para mostrar el valor limpio con su marca de propuesta */
const PREFIJO_PROPUESTA = /^\s*PROPUESTA\s*\((?:no es dato del cliente)[^)]*\)\s*:?\s*/i
export function separarPropuesta(valor: string | null): { valor: string | null; propuesta: boolean } {
  if (valor == null) return { valor: null, propuesta: false }
  const limpio = valor.replace(PREFIJO_PROPUESTA, "").trim()
  return { valor: limpio || null, propuesta: limpio !== valor.trim() }
}

/** lo que falta, en palabras: la clave del lector, su clave en la plataforma (`meta`) o los campos que el lector no muestra (productos · sedes) */
const HUECOS_FUERA_DEL_LECTOR: Record<string, string> = { productos: "Productos o servicios", sedes: "Sedes", nunca_hace: "Lo que la marca nunca dice o hace", tagline: "Eslogan", tagline_opciones: "Eslogan" }
export function etiquetaDelHueco(clave: string): string {
  const c = CAMPOS_DEL_LECTOR.find((x) => x.clave === clave || x.meta === clave || x.columna === clave)
  return c?.etiqueta ?? HUECOS_FUERA_DEL_LECTOR[clave] ?? clave.replace(/_/g, " ")
}

/**
 * Lo que Emilio puede EDITAR desde el dashboard (sprint 6.4): los campos que la plataforma acepta por `PATCH /api/manual/{client}/campos`
 * (`clave_del_tablero` en `campos-del-manual.ts` de la plataforma: 7 campos). Misión, visión, personalidad, mensajes clave, propuestas de valor,
 * productos, sedes y las palabras son editables en la plataforma pero AÚN no tienen clave de tablero: pedirlas es trabajo de la plataforma, no se finge aquí.
 * `lista`: se escribe una por línea. El sistema versiona (max+1 vigente), marca «escrito por el dueño» y re-indexa el cerebro: el siguiente empleado lee lo nuevo.
 */
export const EDITABLES_DESDE_EL_TABLERO: ReadonlyArray<{ clave: string; etiqueta: string; lista: boolean; ayuda: string }> = [
  { clave: "proposito", etiqueta: "Propósito", lista: false, ayuda: "Para qué existe la marca, en una o dos frases." },
  { clave: "eslogan", etiqueta: "Eslogan", lista: false, ayuda: "La frase corta que acompaña a la marca." },
  { clave: "voz", etiqueta: "Voz de la marca", lista: false, ayuda: "Cómo habla: tono, trato, palabras que la distinguen." },
  { clave: "posicionamiento", etiqueta: "Posicionamiento", lista: false, ayuda: "Qué lugar ocupa frente a las demás y por qué." },
  { clave: "publico", etiqueta: "Público", lista: false, ayuda: "A quién le habla y qué busca esa gente." },
  { clave: "valores", etiqueta: "Valores", lista: true, ayuda: "Uno por línea." },
  { clave: "nunca", etiqueta: "Lo que la marca nunca dice o hace", lista: true, ayuda: "Uno por línea." },
]
export const esEditableDesdeElTablero = (clave: string) => EDITABLES_DESDE_EL_TABLERO.some((e) => e.clave === clave)

/** el cuerpo que recibe `POST /api/acciones/manual-campos` (lo valida `lib/tablero-acciones.ts` y lo hace la plataforma) */
export function cuerpoDeEdicion(clienteId: string, clave: string, texto: string, porque: string): { client_id: string; campos: Record<string, string>; comentario?: string } | { error: string } {
  const e = EDITABLES_DESDE_EL_TABLERO.find((x) => x.clave === clave)
  if (!e) return { error: `«${clave}» todavía no se edita desde aquí` }
  const t = e.lista ? texto.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).join("\n") : texto.trim()
  if (!t) return { error: "Escribe algo antes de guardar" }
  if (t.length > 2000) return { error: "Máximo 2.000 caracteres" }
  const p = porque.trim()
  return { client_id: clienteId, campos: { [clave]: t }, ...(p ? { comentario: p.slice(0, 1000) } : {}) }
}

/** lo que se escribe en el cuadro de edición a partir de lo que ya hay (una lista guardada «a · b» vuelve a ser una por línea) */
export function textoParaEditar(clave: string, valor: string | null): string {
  if (!valor) return ""
  return EDITABLES_DESDE_EL_TABLERO.find((x) => x.clave === clave)?.lista ? valor.split(" · ").map((s) => s.trim()).filter(Boolean).join("\n") : valor
}

/** «hace 3 días» para la fecha del manual, sin librerías */
export function fechaCortaEC(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("es-EC", { timeZone: "America/Guayaquil", day: "numeric", month: "short", year: "numeric" })
}
