/**
 * LAS SECCIONES NUEVAS DEL MANUAL · lógica pura (CC6 · 02-nov · ENCARGO-LENOVO-a-CC6-secciones-nuevas-del-manual · ADENDA 1 firmada por Emilio).
 * Tono según el canal + reglas de escritura · Dirección de fotografía · Uso del logo y jerarquía tipográfica · Historia y origen.
 * Viven en el borrador del manual (`content_text.brand_book_draft`) con su `_field_meta.<clave>` (estado y fuente). Las claves salen del contrato con CC1
 * (CONTRATO-CC1-a-CC6-CC2-secciones-nuevas-del-manual: 6 claves, listas de textos salvo la historia) y están TODAS aquí. Una sección sin dato NO se muestra:
 * vacío, `[]` o texto que empieza con `PENDIENTE` cuenta como sin dato. Lo propuesto termina en «[propuesta del agente — razón]»: se rotula y el corchete no se ve.
 * El valor se lee con tolerancia: texto, lista de textos, lista de objetos u objeto de textos/listas; lo que no es nada de eso no se pinta.
 */
import { notasDelCampo, type NotaDelCampo } from "@/lib/manual-notas"

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

/** «… [propuesta del agente — razón]» al final del texto: la marca de lo que propuso un empleado (contrato CC1) */
const MARCA_PROPUESTA = /\s*\[propuesta del agente[^\]]*\]\s*$/i
export const esPropuestaDelAgente = (t: unknown): boolean => typeof t === "string" && MARCA_PROPUESTA.test(t)
const sinMarca = (t: string) => t.replace(MARCA_PROPUESTA, "").trim()
/** un texto con contenido: sin la marca de propuesta; lo que empieza con PENDIENTE no es dato */
const limpio = (v: unknown): string => { const t = typeof v === "string" ? sinMarca(v) : typeof v === "number" ? String(v) : ""; return /^PENDIENTE\b/i.test(t) ? "" : t }
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

export type OrigenDeSeccion = "propuesta" | "dueno" | "aceptado" | "sistema" | "falta"
export interface SeccionLeida { id: string; titulo: string; partes: Array<{ clave: string; etiqueta: string; /** null = falta (auditoría 02-nov: las 6 secciones se ven siempre, aunque estén vacías) */ valor: ValorDeSeccion | null; origen: OrigenDeSeccion; /** el texto para «Editar»: la lista, una por línea, sin marcas */ para_editar: string; /** CC6 · 02-nov: datos marcados por la puerta o el juez */ notas?: NotaDelCampo[] }> }
export const ORIGEN_DE_SECCION: Record<OrigenDeSeccion, { texto: string; tono: "ambar" | "verde" | "neutro" }> = {
  propuesta: { texto: "propuesta del sistema · por validar", tono: "ambar" },
  dueno: { texto: "escrito por ti", tono: "verde" },
  aceptado: { texto: "validado por ti", tono: "verde" },
  sistema: { texto: "del sistema", tono: "neutro" },
  falta: { texto: "falta · la propone el equipo nuevo", tono: "ambar" },
}
function origenDe(meta: Fila, crudo: unknown): OrigenDeSeccion {
  if (meta.fuente === "dueno") return "dueno"
  if (meta.aceptado_por_el_dueno) return "aceptado"
  const marcado = esPropuestaDelAgente(crudo) || (Array.isArray(crudo) && crudo.some(esPropuestaDelAgente))
  if (meta.estado === "propuesta_del_agente" || meta.estado === "propuesta" || marcado) return "propuesta"
  return "sistema"
}
const paraEditar = (v: unknown): string => (Array.isArray(v) ? v.map(limpio).filter(Boolean).join("\n") : limpio(v))

/** las 6 secciones nuevas, SIEMPRE (auditoría 02-nov, aprobada por Emilio): las partes sin dato salen como «falta · la propone el equipo nuevo» y cuentan en «Lo que falta» */
export function seccionesNuevasDelBorrador(borrador: unknown): SeccionLeida[] {
  const b = objeto(borrador), meta = objeto(b._field_meta)
  return SECCIONES_NUEVAS.map((s) => ({
    id: s.id, titulo: s.titulo,
    partes: s.claves.map((k) => {
      const valor = valorDeSeccion(b[k.clave])
      return { ...k, valor, origen: valor ? origenDe(objeto(meta[k.clave]), b[k.clave]) : ("falta" as const), para_editar: valor ? paraEditar(b[k.clave]) : "", notas: notasDelCampo(objeto(meta[k.clave])) }
    }),
  }))
}
/** lo que falta de las secciones nuevas, con su nombre legible (para sumarlo a «Lo que falta» del manual) */
export function faltantesDeLasSecciones(secciones: SeccionLeida[]): Array<{ clave: string; etiqueta: string }> {
  return secciones.flatMap((s) => s.partes.filter((p) => !p.valor).map((p) => ({ clave: p.clave, etiqueta: s.partes.length === 1 ? s.titulo : p.etiqueta === "Por canal" ? s.titulo : p.etiqueta })))
}

/** la jerarquía tipográfica en filas (para la barra, junto a Tipografías) */
export function jerarquiaTipografica(borrador: unknown): Array<{ uso: string; familia: string }> {
  const v = objeto(borrador).jerarquia_tipografica
  // contrato CC1: una lista de textos («Títulos: Alfa Slab One»); también acepta objetos { uso, familia }
  if (!Array.isArray(v)) return []
  return v.map((x) => {
    if (typeof x === "string") { const t = limpio(x); const m = /^([^:—–-]{2,40})\s*[:—–-]\s*(.+)$/.exec(t); return m ? { uso: m[1].trim(), familia: m[2].trim() } : { uso: "", familia: "" } }
    const o = objeto(x); return { uso: limpio(o.uso), familia: limpio(o.familia) }
  }).filter((x) => x.uso && x.familia)
}
