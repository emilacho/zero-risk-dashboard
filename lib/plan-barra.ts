/**
 * LA BARRA LATERAL DEL PLAN · lógica pura (CC6 · 02-nov · boceto aprobado por Emilio, segundo documento tras el manual).
 * Estado de la decisión · Meta · Fechas · Presupuesto · Sedes y canales · Fases (mini línea de tiempo) · Lo que te toca. Datos reales; lo que falta se dice.
 * Sin cifras de gasto: lo gastado vive en Dinero (regla de Emilio), aquí solo el presupuesto que el plan propone.
 */
import type { PlanDelCliente } from "@/lib/plan-datos"
import { datosClave, resumenDeLaSeccion, seccionesDelPlan } from "@/lib/plan-documento"
import { leerElCiclo, sedeLegible, textoDeLaMeta } from "@/lib/plan"
import { redDelTablero } from "@/lib/pizarron"
import { periodoDelPlan, textoDelPeriodo } from "@/lib/plan-periodo"
import { PLAN_ESPERA_EL_MANUAL } from "@/lib/manual-primero"


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
  const doc = d?.prosa ? seccionesDelPlan(d.prosa) : null
  const claves = doc ? datosClave(doc) : []
  const dato = (k: string) => claves.find((x) => x.clave === k)?.valor ?? null
  // la meta ENTERA (Lenovo 02-nov: se cortaba con «…» en la parte importante): el resumen recorta, así que se busca la línea completa en su sección
  const metaDelDocumento = (): string | null => {
    const m = claves.find((x) => x.clave === "meta")
    if (!m?.valor || !m.valor.endsWith("…") || !doc) return m?.valor ?? null
    const inicio = m.valor.slice(0, -1).trim()
    const sec = doc.secciones.find((x) => x.id === m.seccion)
    return (sec && resumenDeLaSeccion(sec.cuerpo, 200, 100_000).find((l) => l.startsWith(inicio))) || m.valor
  }
  // fechas y días: UNA sola fuente, el propio plan (auditoría 6 · `lib/plan-periodo.ts`); el documento sin fechas legibles se cita tal cual
  const periodo = periodoDelPlan(p)
  const total: number | null = periodo?.dias ?? null
  let fechas: BarraDelPlan["fechas"] = periodo?.desde ? { texto: textoDelPeriodo(periodo), detalle: c ? null : "según el plan (todavía sin campaña)" } : null
  if (!fechas && dato("fechas")) fechas = { texto: dato("fechas")!, detalle: "según el documento (todavía sin campaña)" }
  const meta = (d?.plan ? textoDeLaMeta(d.plan) : null) ?? metaDelDocumento()
  const dia = p.fase_activa.situacion === "en_curso" ? p.fase_activa.dia : null
  const fases: FaseDeLaBarra[] = (e?.fases ?? []).slice().sort((a, b) => a.dia_desde - b.dia_desde).map((f) => ({
    clave: f.clave, objetivo: f.objetivo, desde: f.dia_desde, hasta: f.dia_hasta,
    estado: dia == null ? (p.fase_activa.situacion === "despues" ? "hecha" : "por_venir") : dia > f.dia_hasta ? "hecha" : dia >= f.dia_desde ? "en_curso" : "por_venir",
  }))
  const canales = [...new Set((e?.redes ?? []).filter((r) => r.rol !== "no").map((r) => redDelTablero(r.red).nombre))]
  // lo que le toca al dueño: decidir el plan, las aprobaciones de su bandeja, lo que contradijo un revisor y la campaña detenida
  const teToca: string[] = []
  const esperaElManual = p.manual_aprobado === false
  if (esperaElManual) teToca.push(PLAN_ESPERA_EL_MANUAL)
  else if (lectura?.puede_aprobar) teToca.push("Aprobar el plan o pedir cambios")
  const bandeja = p.esperas.grupos.find((g) => g.tipo === "aprobacion_bandeja")?.n ?? 0
  if (bandeja) teToca.push(bandeja === 1 ? "1 aprobación en tu bandeja" : `${bandeja} aprobaciones en tu bandeja`)
  for (const x of p.palabra_del_dueno ?? []) teToca.push(x.requiere_humano ? `Revisar: ${x.titulo.replace(/^Plan de 90 días:\s*/i, "")}` : `Mirar: ${x.titulo.replace(/^Plan de 90 días:\s*/i, "")}`)
  if (c?.estado === "pausada" || c?.estado === "necesita_humano") teToca.push(c.estado === "pausada" ? `La campaña está pausada${c.estado_motivo ? ` (${c.estado_motivo})` : ""}: reanudarla es decisión tuya` : "La campaña necesita una decisión tuya")
  return {
    decision: esperaElManual ? { titulo: PLAN_ESPERA_EL_MANUAL, estado: "espera_el_manual" } : lectura ? { titulo: lectura.titulo, estado: lectura.estado } : null,
    meta, fechas, presupuesto: dato("presupuesto"),
    sedes: (c?.sedes ?? d?.plan?.zonas ?? []).map(sedeLegible),
    canales, fases, dia, total_dias: total ?? (fases.length ? Math.max(...fases.map((f) => f.hasta)) : null), te_toca: teToca,
  }
}
