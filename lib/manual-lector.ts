/**
 * El LECTOR DEL MANUAL del tablero (30-oct · «manual sale solo» E2). La ficha del cliente deja de leer columnas sueltas: lee el manual como lo lee el PDF a Drive,
 * columna primero y, si está vacía, el borrador (`content_text.brand_book_draft`). Dice quién lo validó y qué falta, con la misma lectura que la plataforma
 * (`src/lib/manual/campos-del-manual.ts`). El tablero no importa código de la plataforma: esta lista es un espejo pequeño y una prueba la compara con la definición.
 */
export interface CampoDelLector { clave: string; etiqueta: string; columna: string; borrador: string[]; lista?: boolean; obligatorio: boolean }

export const CAMPOS_DEL_LECTOR: readonly CampoDelLector[] = [
  { clave: 'proposito', etiqueta: 'Propósito', columna: 'brand_purpose', borrador: ['proposito', 'brand_purpose'], obligatorio: true },
  { clave: 'mision', etiqueta: 'Misión', columna: 'brand_mission', borrador: ['mision', 'brand_mission'], obligatorio: true },
  { clave: 'vision', etiqueta: 'Visión', columna: 'brand_vision', borrador: ['vision', 'brand_vision'], obligatorio: true },
  { clave: 'valores', etiqueta: 'Valores', columna: 'brand_values', borrador: ['valores', 'brand_values'], lista: true, obligatorio: true },
  { clave: 'eslogan', etiqueta: 'Eslogan', columna: 'tagline', borrador: [], obligatorio: true },
  { clave: 'voz', etiqueta: 'Voz de la marca', columna: 'voice_description', borrador: ['voice_description'], obligatorio: true },
  { clave: 'personalidad', etiqueta: 'Personalidad', columna: 'brand_personality', borrador: ['personalidad', 'brand_personality'], lista: true, obligatorio: false },
  { clave: 'posicionamiento', etiqueta: 'Posicionamiento', columna: 'positioning', borrador: ['positioning'], obligatorio: false },
  { clave: 'mensajes_clave', etiqueta: 'Mensajes clave', columna: 'key_messages', borrador: ['mensajes_clave', 'key_messages'], lista: true, obligatorio: false },
  { clave: 'propuestas_de_valor', etiqueta: 'Propuestas de valor', columna: 'value_propositions', borrador: ['propuestas_de_valor', 'value_propositions'], lista: true, obligatorio: false },
] as const

export type EstadoDelCampo = 'lleno' | 'propuesta' | 'hueco'
export interface CampoLeido { clave: string; etiqueta: string; valor: string | null; estado: EstadoDelCampo; nota: string | null; /** la razón de la propuesta del agente, aparte del valor (para mostrarla discreta) */ explicacion: string | null }
export interface ManualLeido {
  campos: CampoLeido[]
  /** quién lo validó: la jefatura, el dueño o nadie (propuesta) */
  validadoPor: 'jefatura' | 'dueno' | 'propuesta'
  validadoEn: string | null
  rotulo: string
  completo: boolean
  huecos: string[]
  /** el rótulo del apartado visual cuando el manual está completo pero no se observó una letra */
  rotuloVisual: string | null
}

const objeto = (v: unknown): Record<string, unknown> => {
  if (typeof v === 'string') { try { const x = JSON.parse(v); return x && typeof x === 'object' ? (x as Record<string, unknown>) : {} } catch { return {} } }
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}
const texto = (v: unknown): string | null => {
  if (Array.isArray(v)) { const t = v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean); return t.length ? t.join(' · ') : null }
  if (typeof v === 'string') { const t = v.trim(); return t && !/^pendiente\b/i.test(t) ? t : null }
  return null
}

/**
 * El agente deja su nota de procedencia pegada al valor: «texto [propuesta del agente — razón]». La pantalla muestra SOLO el valor; la nota se separa (todos los campos, todos los clientes).
 * Se quita cualquier «[propuesta del agente …]» (al final, al principio o en medio) y se junta su razón.
 */
export function separarNota(valor: string | null): { valor: string | null; explicacion: string | null; propuesta: boolean } {
  if (valor == null) return { valor: null, explicacion: null, propuesta: false }
  const razones: string[] = []
  const limpio = valor
    .replace(/\[\s*propuesta del agente\s*(?:[—–:-]\s*)?([^\]]*)\]/gi, (_m, razon: string) => { if (razon.trim()) razones.push(razon.trim()); return ' ' })
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim()
  const propuesta = limpio !== valor.trim()
  // otras anotaciones internas pegadas al final de un valor o de un elemento de lista («… [canal preferido S1-S4 + diferenciador …]»): también son nota, no contenido
  const notas: string[] = []
  const sinNotas = limpio.replace(/\s*\[([^\]]{25,})\](?=\s*·|\s*$)/g, (_m, nota: string) => { notas.push(nota.trim()); return '' }).trim()
  const todas = [...razones, ...notas]
  return { valor: sinNotas || null, explicacion: todas.length ? todas.join(' · ') : null, propuesta }
}

/** quién validó el manual (un manual validado antes de existir `validado_por` lo validó el dueño) */
export function quienValido(fila: { human_validated?: unknown; provenance_tag?: unknown } | null): 'jefatura' | 'dueno' | 'propuesta' {
  if (!fila || fila.human_validated !== true) return 'propuesta'
  return objeto(fila.provenance_tag).validado_por === 'jefatura' ? 'jefatura' : 'dueno'
}

export function rotuloDeQuienValido(q: 'jefatura' | 'dueno' | 'propuesta', cuando: string | null): string {
  const fecha = cuando ? ` · ${String(cuando).slice(0, 10)}` : ''
  if (q === 'jefatura') return `Validado por la jefatura${fecha}`
  if (q === 'dueno') return `Validado por el dueño${fecha}`
  return 'Propuesta del sistema · sin validar'
}

export function leerManual(fila: Record<string, unknown> | null): ManualLeido | null {
  if (!fila) return null
  const contenido = objeto(fila.content_text)
  const borrador = objeto(contenido.brand_book_draft)
  const meta = objeto(borrador._field_meta)
  const completitud = objeto(contenido.completitud)
  const huecosDeclarados = Array.isArray(completitud.huecos) ? (completitud.huecos as Array<Record<string, unknown>>).map((h) => String(h.clave)) : null
  const campos: CampoLeido[] = CAMPOS_DEL_LECTOR.map((c) => {
    let valor = texto(fila[c.columna])
    if (valor == null) for (const k of c.borrador) { valor = texto(borrador[k]); if (valor != null) break }
    const m = objeto(meta[c.clave])
    const sep = separarNota(valor)
    valor = sep.valor
    const esPropuesta = valor != null && (sep.propuesta || m.estado === 'propuesta')
    const estado: EstadoDelCampo = valor == null ? 'hueco' : esPropuesta ? 'propuesta' : 'lleno'
    const nota = estado === 'hueco' ? 'Sin dato: se buscó en lo raspado del sitio, las redes y los mapas' : estado === 'propuesta' ? 'Propuesta del agente, sin validar' : null
    return { clave: c.clave, etiqueta: c.etiqueta, valor, estado, nota, explicacion: sep.explicacion }
  })
  const faltan = campos.filter((c, i) => CAMPOS_DEL_LECTOR[i].obligatorio && c.estado === 'hueco').map((c) => c.clave)
  const huecos = huecosDeclarados ?? faltan
  const completo = typeof completitud.completo === 'boolean' ? completitud.completo : faltan.length === 0
  const visual = objeto(completitud.visual)
  const q = quienValido({ human_validated: fila.human_validated, provenance_tag: fila.provenance_tag })
  const tag = objeto(fila.provenance_tag)
  const validadoEn = typeof tag.validado_en === 'string' ? tag.validado_en : null
  // lo opcional vacío no se muestra como hueco: solo lo obligatorio se declara
  const visibles = campos.filter((c, i) => c.valor != null || CAMPOS_DEL_LECTOR[i].obligatorio)
  return {
    campos: visibles, validadoPor: q, validadoEn, rotulo: rotuloDeQuienValido(q, validadoEn), completo, huecos,
    rotuloVisual: completo && visual.tipografia === 'sin_letra_observada' ? 'Completo · sin letra observada' : null,
  }
}
