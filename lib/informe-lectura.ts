/**
 * EL INFORME EN LECTURA FÁCIL (CC4 · 03-nov · encargo de Lenovo, firma de Emilio 17:43Z · auditoría n.º 12): arriba un resumen grande (qué pasó · qué conviene),
 * debajo las secciones con título, las fuentes en una línea chica y lo técnico plegado. Lógica PURA: no toca lo guardado, solo decide qué se ve y con qué palabras.
 * Nada de `**` sueltos, códigos de ficha, ids ni nombres de campo a la vista: lo que parece interno va a «técnico» o no va.
 */
import { bloquesDelResumen, type BloqueDelResumen } from "@/lib/informes"
import { sinCodigosDeFicha } from "@/lib/informe-legible"

const CLAVES_QUE_PASO = ["narrative", "narrativa", "summary", "resumen", "texto"]
const CLAVES_QUE_CONVIENE = ["recommendations", "recomendaciones", "next_steps", "next_week_focus", "blockers"]
const ES_FUENTE = /^(sources?|fuentes?|citas?|citations?|refs?|references?|referencias?)$/i
const ES_TECNICA = /(^|[_-])(id|ids|uuid|slug|hash|run|execution|workflow|agent|agente|raw|debug|trace|schema|version)([_-]|$)|^charts?$|^gr[aá]ficos?$/i
const MARCAS = /^(narrative|narrativa|summary|resumen|texto|highlights|kpis|metrics|metricas|next_week_focus|next_steps|blockers|recommendations|title)$/i

/** el texto sin marcas de markdown ni códigos de ficha: para una vista previa o una línea, donde no se pinta el formato */
export function sinMarcas(t: string): string {
  return sinCodigosDeFicha(String(t ?? ""))
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:]|$)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\*{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** las primeras oraciones que quepan en `max` caracteres (nunca corta una palabra a la mitad) */
export function primerasOraciones(t: string, max = 320): string {
  const x = sinMarcas(t)
  if (x.length <= max) return x
  const oraciones = x.match(/[^.!?]+[.!?]+(\s|$)/g) ?? []
  let sal = ""
  for (const o of oraciones) { if ((sal + o).length > max) break; sal += o }
  if (sal.trim()) return sal.trim()
  const corte = x.slice(0, max).replace(/\s+\S*$/, "")
  return `${corte}…`
}

export interface LecturaDelInforme {
  /** «qué pasó»: lo primero que dice el informe, en pocas oraciones, o null si no trae */
  que_paso: string | null
  /** «qué conviene»: las primeras recomendaciones, próximos pasos o lo que frena, o null */
  que_conviene: string[]
  /** las secciones con título (lo que sobra tras separar fuentes y técnico) */
  secciones: BloqueDelResumen[]
  /** las fuentes, para una línea chica al final */
  fuentes: string[]
  /** lo que parece interno: plegado, nunca en el cuerpo */
  tecnico: Array<{ clave: string; valor: string }>
}

const esObjetoCrudo = (s: string) => /^[{[]/.test(s.trim())

function aplanado(v: unknown): string[] {
  if (v == null || v === "") return []
  if (Array.isArray(v)) return v.flatMap((x) => aplanado(x))
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).flatMap((x) => aplanado(x))
  return [String(v)]
}

export function lecturaDelInforme(resumen: Record<string, unknown>): LecturaDelInforme {
  const crudo = resumen && typeof resumen === "object" ? resumen : {}
  const limpio: Record<string, unknown> = {}
  const fuentes: string[] = []
  const tecnico: Array<{ clave: string; valor: string }> = []
  for (const [k, v] of Object.entries(crudo)) {
    if (ES_FUENTE.test(k)) { fuentes.push(...aplanado(v).map((s) => sinMarcas(s)).filter(Boolean)); continue }
    if (!MARCAS.test(k) && ES_TECNICA.test(k)) { const t = aplanado(v).join(", "); if (t) tecnico.push({ clave: k, valor: t }); continue }
    limpio[k] = v
  }
  const bloques = bloquesDelResumen(limpio).flatMap((b): BloqueDelResumen[] => {
    // un objeto que quedó como JSON crudo no se muestra en el cuerpo: va a técnico
    const pares = b.pares?.filter((p) => !esObjetoCrudo(p.valor))
    const crudos = b.pares?.filter((p) => esObjetoCrudo(p.valor)) ?? []
    for (const p of crudos) tecnico.push({ clave: `${b.titulo} · ${p.clave}`, valor: p.valor })
    if (b.pares && !pares?.length) return []
    return [{ ...b, parrafo: b.parrafo != null ? sinCodigosDeFicha(b.parrafo) : undefined, vinetas: b.vinetas?.map((x) => sinCodigosDeFicha(x)).filter((x) => esObjetoCrudo(x) ? false : true), pares: pares?.map((p) => ({ clave: sinMarcas(p.clave), valor: sinMarcas(p.valor) })) }]
  }).filter((b) => b.parrafo || b.vinetas?.length || b.pares?.length)

  const primeraPrincipal = CLAVES_QUE_PASO.map((c) => bloques.find((b) => b.clave === c && b.parrafo)).find(Boolean)
  const que_paso = primeraPrincipal?.parrafo ? primerasOraciones(primeraPrincipal.parrafo, 320) || null : null
  const que_conviene: string[] = []
  for (const c of CLAVES_QUE_CONVIENE) {
    const b = bloques.find((x) => x.clave === c)
    if (!b) continue
    const items = b.vinetas?.length ? b.vinetas : b.parrafo ? [b.parrafo] : []
    for (const it of items) { const s = primerasOraciones(it, 180); if (s && que_conviene.length < 3) que_conviene.push(s) }
    if (que_conviene.length) break
  }
  return { que_paso, que_conviene, secciones: bloques, fuentes: [...new Set(fuentes)], tecnico }
}
