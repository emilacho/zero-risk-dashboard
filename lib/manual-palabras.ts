/**
 * TABLERO DEL DUEÑO · LAS PALABRAS DEL MANUAL CON SU INTENCIÓN (CC6 · 01-nov · encargo del equipo del manual firmado por Emilio, §1; puerta de CC1 #815).
 * Lógica PURA y la MISMA regla que la plataforma (`zero-risk-platform/src/lib/manual/palabras-con-intencion.ts` · `leerPalabras`), para que el tablero nunca
 * muestre como «bloquea» una palabra que la plataforma lee como contexto:
 *   · `legal`: la prohíbe una norma; exige la cita. Bloquea.
 *   · `del_dueno`: la prohibió el dueño; exige cita y fecha válida. Bloquea.
 *   · `estilo`: contexto de marca. Nunca bloquea. Es toda palabra de la lista que no diga otra cosa, y toda dura a la que le falte su fuente.
 * Fuentes: `client_brand_books.forbidden_words` (la lista completa, como siempre) + `client_brand_books.palabras_con_intencion` (solo lo que no es la omisión).
 */
export type IntencionDeLaPalabra = "legal" | "del_dueno" | "estilo"
export interface PalabraDelManual {
  texto: string
  intencion: IntencionDeLaPalabra
  /** por qué es contexto de marca (si la corrida lo dijo) */
  porque: string | null
  /** la cita de la norma o lo que dijo el dueño */
  cita: string | null
  origen: string | null
  fecha: string | null
  por: string | null
}
type Fila = Record<string, unknown>
const clave = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
const texto = (x: unknown): string => (typeof x === "string" ? x.trim() : "")

function leerEntrada(x: unknown): PalabraDelManual | null {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return null
  const o = x as Fila
  const t = texto(o.texto)
  if (!t) return null
  const base: PalabraDelManual = { texto: t, intencion: "estilo", porque: texto(o.porque) || null, cita: null, origen: null, fecha: null, por: null }
  if (o.intencion !== "legal" && o.intencion !== "del_dueno") return base
  const f = typeof o.fuente === "object" && o.fuente !== null ? (o.fuente as Fila) : {}
  const cita = texto(f.cita), fecha = texto(f.fecha)
  if (!cita) return base
  if (o.intencion === "del_dueno" && (!fecha || Number.isNaN(Date.parse(fecha)))) return base
  return { ...base, intencion: o.intencion, cita, origen: texto(f.origen) || null, fecha: fecha || null, por: texto(f.por) || null }
}

/** todas las palabras con su intención: la unión de las dos columnas, sin repetir (sin tildes ni mayúsculas); una dura gana sobre su estilo */
export function palabrasDelManual(b: { forbidden_words?: unknown; palabras_con_intencion?: unknown } | null | undefined): PalabraDelManual[] {
  const salida = new Map<string, PalabraDelManual>()
  for (const x of Array.isArray(b?.palabras_con_intencion) ? (b!.palabras_con_intencion as unknown[]) : []) {
    const e = leerEntrada(x)
    if (!e) continue
    const previa = salida.get(clave(e.texto))
    if (!previa || (previa.intencion === "estilo" && e.intencion !== "estilo")) salida.set(clave(e.texto), e)
  }
  for (const x of Array.isArray(b?.forbidden_words) ? (b!.forbidden_words as unknown[]) : []) {
    const t = texto(x)
    if (t && !salida.has(clave(t))) salida.set(clave(t), { texto: t, intencion: "estilo", porque: null, cita: null, origen: null, fecha: null, por: null })
  }
  return [...salida.values()]
}

/** las tres filas del tablero, en este orden: lo que bloquea por norma, lo que prohibió el dueño, el contexto de marca */
export const GRUPOS_DE_PALABRAS: Array<{ intencion: IntencionDeLaPalabra; titulo: string; nota: string }> = [
  { intencion: "legal", titulo: "Prohibidas por una norma · bloquean", nota: "Una pieza que las use no sale." },
  { intencion: "del_dueno", titulo: "Prohibidas por ti · bloquean", nota: "Las decidiste tú; ninguna corrida te las cambia." },
  { intencion: "estilo", titulo: "Estilo de la marca · no bloquean", nota: "Los empleados las evitan, pero una pieza no se frena por ellas." },
]
export const agruparPalabras = (p: PalabraDelManual[]) => GRUPOS_DE_PALABRAS.map((g) => ({ ...g, palabras: p.filter((x) => x.intencion === g.intencion).sort((a, b) => a.texto.localeCompare(b.texto, "es")) }))

/** qué puede decidir el dueño sobre cada palabra (la puerta acepta las tres sobre cualquiera; aquí no se ofrece la que no cambia nada) */
export type DecisionSobreLaPalabra = "prohibir" | "contexto" | "quitar"
export function decisionesPara(p: Pick<PalabraDelManual, "intencion">): DecisionSobreLaPalabra[] {
  return p.intencion === "estilo" ? ["prohibir", "quitar"] : ["contexto", "quitar"]
}
export const decisionLegible = (d: DecisionSobreLaPalabra): string => (d === "prohibir" ? "Prohibir" : d === "contexto" ? "Dejar como estilo" : "Quitar de la lista")
/** de dónde sale una palabra dura, en palabras */
export function fuenteLegible(p: PalabraDelManual): string | null {
  if (p.intencion === "legal") return p.cita ? `norma: ${p.cita}` : null
  if (p.intencion === "del_dueno") return [p.cita, p.fecha ? `el ${p.fecha.slice(0, 10)}` : null].filter(Boolean).join(" · ") || null
  return p.porque ? `por qué: ${p.porque}` : null
}
