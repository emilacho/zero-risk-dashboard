/**
 * LA VIGENCIA DEL PLAN · la MISMA regla que el cerebro y el alta (encargo de Lenovo 06-nov · «el panel ofrece aprobar un plan ya rechazado»).
 * Copia fiel, sin cambios de lógica, de la plataforma:
 *  · `zero-risk-platform/src/lib/cerebro/estado-en-plataforma.ts` (#930 `ce228bf` · #931 `e02b9e0`): `estadoDeLaSalida` y la lectura de la cola y las aprobaciones;
 *  · `zero-risk-platform/src/lib/portero-alimenta/plan-vigente.ts` (#928 `d46bf35`): qué planes del cliente cuentan (sin los de prueba).
 * Si la regla cambia allá, cambia aquí en el mismo encargo. Un plan rechazado, reemplazado o vencido sigue en el historial, pero nunca se ofrece para aprobar.
 * Solo LEE filas ya traídas: US$ 0, sin modelo.
 */
type Fila = Record<string, unknown>

export type EstadoEnPlataforma = "aprobado" | "abierto" | "rechazado" | "reemplazado" | "vencido"
export type DecisionDeLaCola = "aprobada" | "rechazada" | "cambio_pedido"

export interface EstadoDeLaSalida {
  estado: EstadoEnPlataforma
  /** rechazada, reemplazada o vencida: no puede ser la vigente */
  cerrada: boolean
  /** por qué está cerrada, en palabras (null si no lo está) */
  motivo: string | null
  rechazo: { por: string | null; en: string | null; nota: string | null } | null
}
export interface SenalesDeLaSalida {
  decision?: DecisionDeLaCola | null
  decision_en?: string | null
  decision_por?: string | null
  vencida_en?: string | null
  vencida_por?: string | null
  aprobacion?: string | null
}

const objeto = (v: unknown): Fila => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Fila) : {})
const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const conNota = (base: string, nota: string | null): string => (nota ? `${base}: ${nota}` : base)
const conAutor = (base: string, por: string | null | undefined): string => (por ? `${base} por ${por}` : base)

function rechazoEnLaEtiqueta(pt: Fila): EstadoDeLaSalida["rechazo"] {
  const por = texto(pt.rechazado_por), en = texto(pt.rechazado_en), nota = texto(pt.nota_de_rechazo)
  return por || en || nota ? { por, en, nota } : null
}
const reemplazadaEnLaEtiqueta = (pt: Fila): boolean => pt.vigente === false || !!texto(pt.superseded_por)

/** una fila marcada así no recoge una decisión de nadie: limpieza, archivo o una versión superada */
function marcadaSinDecision(marcas: Fila): boolean {
  return marcas.superada === true || marcas.archivada === true || Object.keys(marcas).some((k) => k.startsWith("no_es_decision") && marcas[k] === true)
}
const TIPOS_DE_UNA_PARTE = new Set(["palabra_del_dueno"])
export const esDeUnaParte = (f: Fila): boolean => TIPOS_DE_UNA_PARTE.has(String(f.type))
export function quienResolvio(f: Fila): string | null {
  return texto(objeto(f.decision).por) ?? texto(f.resolved_by) ?? texto(f.reviewer)
}
export function filaConDecisionReal(f: Fila): boolean {
  if (marcadaSinDecision(objeto(f.decision))) return false
  return ![objeto(f.decision).por, f.resolved_by, f.reviewer].some((q) => /limpieza/i.test(texto(q) ?? ""))
}

export function estadoDeLaSalida(f: { status?: unknown; provenance_tag?: unknown }, s: SenalesDeLaSalida = {}): EstadoDeLaSalida {
  const pt = objeto(f.provenance_tag)
  const rechazo = rechazoEnLaEtiqueta(pt)
  const cerrar = (estado: EstadoEnPlataforma, motivo: string): EstadoDeLaSalida => ({ estado, cerrada: true, motivo, rechazo })
  const aprobadaPorEstado = f.status === "approved" || f.status === "published"
  if (f.status === "rejected" && !marcadaSinDecision(pt)) return cerrar("rechazado", conNota(conAutor("rechazado en la plataforma", rechazo?.por ?? null), rechazo?.nota ?? null))
  if (reemplazadaEnLaEtiqueta(pt) || s.aprobacion === "reemplazado") return cerrar("reemplazado", "reemplazado por una versión más nueva")
  const vencioDespues = !!s.vencida_en && (!s.decision_en || s.vencida_en > s.decision_en)
  if (s.decision === "rechazada" && !vencioDespues) return cerrar("rechazado", conAutor("rechazado en la revisión", s.decision_por))
  if (vencioDespues && !aprobadaPorEstado) return cerrar("vencido", s.vencida_por ? `su revisión venció sin aprobación; la cerró ${s.vencida_por}` : "su revisión venció sin aprobación")
  if (s.aprobacion === "cambios_pedidos") return { estado: "abierto", cerrada: false, motivo: null, rechazo }
  const aprobada = s.decision ? s.decision === "aprobada" : s.aprobacion === "aprobado" || aprobadaPorEstado
  return { estado: aprobada ? "aprobado" : "abierto", cerrada: false, motivo: null, rechazo }
}

const DECISION: Record<string, DecisionDeLaCola> = { approved: "aprobada", rejected: "rechazada", edited: "cambio_pedido" }
const fechaDe = (f: Fila): string => {
  const t = Date.parse(String(f.resolved_at ?? f.created_at ?? ""))
  return Number.isNaN(t) ? "" : new Date(t).toISOString()
}
export function vencimientosDeLaCola(cola: Fila[]): Map<string, { en: string; por: string | null }> {
  const salida = new Map<string, { en: string; por: string | null }>()
  for (const f of cola) {
    const id = f.output_id === null || f.output_id === undefined ? "" : String(f.output_id)
    if (!id || objeto(f.decision).vencida !== true || !filaConDecisionReal(f) || esDeUnaParte(f)) continue
    const fecha = fechaDe(f)
    if (fecha >= (salida.get(id)?.en ?? "")) salida.set(id, { en: fecha, por: quienResolvio(f) })
  }
  return salida
}
export function aprobacionesPorPlan(filas: Fila[]): Map<string, string> {
  const orden = [...filas].sort((a, b) => (Number(a.version) || 0) - (Number(b.version) || 0) || (String(a.creado_en ?? "") < String(b.creado_en ?? "") ? -1 : 1))
  const salida = new Map<string, string>()
  for (const f of orden) if (f.plan_id && typeof f.estado === "string") salida.set(String(f.plan_id), f.estado)
  return salida
}
export function decisionesDeLaCola(cola: Fila[]): Map<string, { decision: DecisionDeLaCola; en: string; por: string | null }> {
  const salida = new Map<string, { decision: DecisionDeLaCola; en: string; por: string | null }>()
  for (const f of cola) {
    const id = f.output_id === null || f.output_id === undefined ? "" : String(f.output_id)
    const decision = DECISION[String(f.status)]
    if (!id || !decision || objeto(f.decision).vencida === true || !filaConDecisionReal(f) || esDeUnaParte(f)) continue
    const en = fechaDe(f)
    if (en >= (salida.get(id)?.en ?? "")) salida.set(id, { decision, en, por: quienResolvio(f) })
  }
  return salida
}

/** el estado de cada plan del cliente, con la cola y las aprobaciones del cliente (igual que `planesDeNoventaDias`). Los de prueba también se leen:
 *  el alta los saca porque no son un plan REAL, pero el panel puede mostrar un cliente de práctica y ahí rige la misma vigencia. */
export function vigenciaDeLosPlanes(planes: Fila[], cola: Fila[], aprobaciones: Fila[]): Map<string, EstadoDeLaSalida> {
  const decisiones = decisionesDeLaCola(cola), vencimientos = vencimientosDeLaCola(cola), aprob = aprobacionesPorPlan(aprobaciones)
  const salida = new Map<string, EstadoDeLaSalida>()
  for (const f of planes) {
    const id = String(f.id), d = decisiones.get(id), v = vencimientos.get(id)
    salida.set(id, estadoDeLaSalida(f, { decision: d?.decision ?? null, decision_en: d?.en ?? null, decision_por: d?.por ?? null, vencida_en: v?.en ?? null, vencida_por: v?.por ?? null, aprobacion: aprob.get(id) ?? null }))
  }
  return salida
}
