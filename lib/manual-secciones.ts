/**
 * LAS SECCIONES NUEVAS DEL MANUAL · lógica pura (CC6 · 02-nov · ENCARGO-LENOVO-a-CC6-secciones-nuevas-del-manual · ADENDA 1 firmada por Emilio).
 * Tono según el canal + reglas de escritura · Dirección de fotografía · Uso del logo y jerarquía tipográfica · Historia y origen.
 * Viven en el borrador del manual (`content_text.brand_book_draft`) con su `_field_meta.<clave>` (estado y fuente). Las claves salen del contrato con CC1
 * (PEDIDO-CC6-a-CC1-contrato-secciones-nuevas-del-manual) y están TODAS aquí, en un solo lugar. Una sección sin dato NO se muestra.
 * El valor se lee con tolerancia: texto, lista de textos, lista de objetos u objeto de textos/listas; lo que no es nada de eso no se pinta.
 */
type Fila = Record<string, unknown>
const objeto = (v: unknown): Fila => { if (typeof v === "string") { try { v = JSON.parse(v) } catch { return {} } } return v && typeof v === "object" && !Array.isArray(v) ? (v as Fila) : {} }

export const SECCIONES_NUEVAS: ReadonlyArray<{ id: string; titulo: string; claves: ReadonlyArray<{ clave: string; etiqueta: string }> }> = [
  { id: "tono-por-canal", titulo: "Tono según el canal", claves: [{ clave: "tono_por_canal", etiqueta: "Por canal" }, { clave: "reglas_de_escritura", etiqueta: "Reglas de escritura" }] },
  { id: "fotografia", titulo: "Dirección de fotografía", claves: [{ clave: "direccion_de_fotografia", etiqueta: "Cómo se fotografía" }] },
  { id: "logo-y-letras", titulo: "Uso del logo y jerarquía tipográfica", claves: [{ clave: "uso_del_logo", etiqueta: "Uso del logo" }, { clave: "jerarquia_tipografica", etiqueta: "Jerarquía tipográfica" }] },
  { id: "historia", titulo: "Historia y origen", claves: [{ clave: "historia_y_origen", etiqueta: "Historia" }] },
]

/** el valor ya ordenado para dibujarlo: un párrafo, viñetas, filas (lista de objetos) o apartados (objeto) */
export type ValorDeSeccion =
  | { tipo: "texto"; texto: string }
  | { tipo: "lista"; items: string[] }
  | { tipo: "filas"; filas: Array<{ titulo: string; texto: string; extra: string[] }> }
  | { tipo: "apartados"; apartados: Array<{ etiqueta: string; valor: ValorDeSeccion }> }

const limpio = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "")
const textos = (v: unknown): string[] => (Array.isArray(v) ? v.map(limpio).filter(Boolean) : [])
const ETIQUETAS: Record<string, string> = { luz: "Luz", encuadre: "Encuadre", plato_estrella: "El plato estrella", no_mostrar: "Qué no mostrar", versiones: "Versiones", fondos: "Fondos", no_hacer: "Qué no hacer", canal: "Canal", tono: "Tono", ejemplos: "Ejemplos" }
export const etiquetaDe = (k: string): string => ETIQUETAS[k] ?? (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ")

export function valorDeSeccion(v: unknown): ValorDeSeccion | null {
  const t = limpio(v)
  if (t) return { tipo: "texto", texto: t }
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === "string" || typeof x === "number")) { const items = textos(v); return items.length ? { tipo: "lista", items } : null }
    const filas = v.filter((x) => x && typeof x === "object" && !Array.isArray(x)).map((x) => {
      const o = x as Fila
      const titulo = limpio(o.canal) || limpio(o.uso) || limpio(o.titulo) || limpio(o.nombre)
      const texto = limpio(o.tono) || limpio(o.familia) || limpio(o.texto) || limpio(o.descripcion)
      return { titulo, texto, extra: textos(o.ejemplos) }
    }).filter((f) => f.titulo || f.texto)
    return filas.length ? { tipo: "filas", filas } : null
  }
  const o = objeto(v)
  const apartados = Object.entries(o).filter(([k]) => !k.startsWith("_")).map(([k, x]) => ({ etiqueta: etiquetaDe(k), valor: valorDeSeccion(x) })).filter((a): a is { etiqueta: string; valor: ValorDeSeccion } => !!a.valor)
  return apartados.length ? { tipo: "apartados", apartados } : null
}

export type OrigenDeSeccion = "propuesta" | "dueno" | "aceptado" | "sistema"
export interface SeccionLeida { id: string; titulo: string; partes: Array<{ clave: string; etiqueta: string; valor: ValorDeSeccion; origen: OrigenDeSeccion }> }
export const ORIGEN_DE_SECCION: Record<OrigenDeSeccion, { texto: string; tono: "ambar" | "verde" | "neutro" }> = {
  propuesta: { texto: "propuesta del sistema · por validar", tono: "ambar" },
  dueno: { texto: "escrito por ti", tono: "verde" },
  aceptado: { texto: "validado por ti", tono: "verde" },
  sistema: { texto: "del sistema", tono: "neutro" },
}
function origenDe(meta: Fila): OrigenDeSeccion {
  if (meta.fuente === "dueno") return "dueno"
  if (meta.aceptado_por_el_dueno) return "aceptado"
  if (meta.estado === "propuesta" || /propuesta/i.test(limpio(meta.fuente))) return "propuesta"
  return "sistema"
}

/** las secciones nuevas que TIENEN dato (las vacías no se muestran) */
export function seccionesNuevasDelBorrador(borrador: unknown): SeccionLeida[] {
  const b = objeto(borrador), meta = objeto(b._field_meta)
  return SECCIONES_NUEVAS.map((s) => ({
    id: s.id, titulo: s.titulo,
    partes: s.claves.map((k) => ({ ...k, valor: valorDeSeccion(b[k.clave]), origen: origenDe(objeto(meta[k.clave])) })).filter((p): p is SeccionLeida["partes"][number] => !!p.valor),
  })).filter((s) => s.partes.length > 0)
}

/** la jerarquía tipográfica en filas (para la barra, junto a Tipografías) */
export function jerarquiaTipografica(borrador: unknown): Array<{ uso: string; familia: string }> {
  const v = objeto(borrador).jerarquia_tipografica
  return Array.isArray(v) ? v.map((x) => objeto(x)).map((o) => ({ uso: limpio(o.uso), familia: limpio(o.familia) })).filter((x) => x.uso && x.familia) : []
}
