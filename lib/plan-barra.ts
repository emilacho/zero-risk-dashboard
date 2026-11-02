/**
 * LA BARRA LATERAL DEL PLAN · lógica pura (CC6 · 02-nov · boceto aprobado por Emilio, segundo documento tras el manual).
 * Estado de la decisión · Meta · Fechas · Presupuesto · Sedes y canales · Fases (mini línea de tiempo) · Lo que te toca. Datos reales; lo que falta se dice.
 * Sin cifras de gasto: lo gastado vive en Dinero (regla de Emilio), aquí solo el presupuesto que el plan propone.
 */
import type { PlanDelCliente } from "@/lib/plan-datos"
import { datosClave, seccionesDelPlan } from "@/lib/plan-documento"
import { leerElCiclo, sedeLegible, textoDeLaMeta } from "@/lib/plan"
import { redDelTablero } from "@/lib/pizarron"

const DIA_MS = 86_400_000
const fecha = (f: string) => new Date(`${f}T00:00:00Z`)
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const corta = (f: string) => { const d = fecha(f); return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}` }

export interface FaseDeLaBarra { clave: string; objetivo: string; desde: number; hasta: number; estado: "hecha" | "en_curso" | "por_venir" }
export interface BarraDelPlan {
  decision: { titulo: string; estado: string } | null
  meta: string | null
  fechas: { texto: string; detalle: string | null } | null
  presupuesto: string | null
  sedes: string[]
  canales: string[]
  fases: FaseDeLaBarra[]
  /** el día de la campaña hoy (1 = arranque) y el total, para la línea de tiempo */
  dia: number | null
  total_dias: number | null
  te_toca: string[]
}

/** la barra del plan con lo que ya leyó el panel (no lee la base) */
export function barraDelPlan(p: PlanDelCliente): BarraDelPlan {
  const c = p.campana, e = p.estrategia, d = p.documento
  const lectura = d && p.ciclo ? leerElCiclo(d.status, p.ciclo) : null
  const claves = d?.prosa ? datosClave(seccionesDelPlan(d.prosa)) : []
  const dato = (k: string) => claves.find((x) => x.clave === k)?.valor ?? null
  // fechas: las de la campaña (lo que corre de verdad); sin campaña, las que escribe el documento
  let fechas: BarraDelPlan["fechas"] = null, total: number | null = null
  if (c?.desde && c?.hasta) {
    total = Math.round((fecha(c.hasta).getTime() - fecha(c.desde).getTime()) / DIA_MS) + 1
    fechas = { texto: `${corta(c.desde)} → ${corta(c.hasta)} · ${Math.round(total / 7)} semanas`, detalle: null }
  } else if (dato("fechas")) fechas = { texto: dato("fechas")!, detalle: "según el documento (todavía sin campaña)" }
  const meta = (d?.plan ? textoDeLaMeta(d.plan) : null) ?? dato("meta")
  const dia = p.fase_activa.situacion === "en_curso" ? p.fase_activa.dia : null
  const fases: FaseDeLaBarra[] = (e?.fases ?? []).slice().sort((a, b) => a.dia_desde - b.dia_desde).map((f) => ({
    clave: f.clave, objetivo: f.objetivo, desde: f.dia_desde, hasta: f.dia_hasta,
    estado: dia == null ? (p.fase_activa.situacion === "despues" ? "hecha" : "por_venir") : dia > f.dia_hasta ? "hecha" : dia >= f.dia_desde ? "en_curso" : "por_venir",
  }))
  const canales = [...new Set((e?.redes ?? []).filter((r) => r.rol !== "no").map((r) => redDelTablero(r.red).nombre))]
  // lo que le toca al dueño: decidir el plan, las aprobaciones de su bandeja, lo que contradijo un revisor y la campaña detenida
  const teToca: string[] = []
  if (lectura?.puede_aprobar) teToca.push("Aprobar el plan o pedir cambios")
  const bandeja = p.esperas.grupos.find((g) => g.tipo === "aprobacion_bandeja")?.n ?? 0
  if (bandeja) teToca.push(bandeja === 1 ? "1 aprobación en tu bandeja" : `${bandeja} aprobaciones en tu bandeja`)
  for (const x of p.palabra_del_dueno ?? []) teToca.push(x.requiere_humano ? `Revisar: ${x.titulo.replace(/^Plan de 90 días:\s*/i, "")}` : `Mirar: ${x.titulo.replace(/^Plan de 90 días:\s*/i, "")}`)
  if (c?.estado === "pausada" || c?.estado === "necesita_humano") teToca.push(c.estado === "pausada" ? `La campaña está pausada${c.estado_motivo ? ` (${c.estado_motivo})` : ""}: reanudarla es decisión tuya` : "La campaña necesita una decisión tuya")
  return {
    decision: lectura ? { titulo: lectura.titulo, estado: lectura.estado } : null,
    meta, fechas, presupuesto: dato("presupuesto"),
    sedes: (c?.sedes ?? d?.plan?.zonas ?? []).map(sedeLegible),
    canales, fases, dia, total_dias: total ?? (fases.length ? Math.max(...fases.map((f) => f.hasta)) : null), te_toca: teToca,
  }
}
