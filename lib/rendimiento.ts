/**
 * LA FICHA DE RENDIMIENTO DE CADA EMPLEADO · lógica pura (CC6 · 02-nov · diseño de Lenovo aprobado por Emilio + RESPUESTA-LENOVO-a-CC6-ficha-de-rendimiento).
 * Base: sus últimas 10 ENTREGAS REVISADAS por la jefatura (mínimo 5) frente a las 10 anteriores (mínimo 5). Diez dimensiones en el orden del diseño; lo que no tiene
 * dato se dice «sin dato todavía» (nada se inventa). La FLECHA de forma (como en FIFA) resume las dimensiones que cuentan para la nota (1, 2, 3, 4, 5, 7, 8, 9 · no 6 ni 10),
 * con «Aprobado a la primera» pesando el doble. Informa: no bloquea ni decide nada sobre el empleado.
 */
export type Forma = "arriba" | "sube" | "estable" | "baja" | "cae"
export interface Dimension { n: number; nombre: string; puntaje: number | null; valor: string | null; detalle: string; cuenta: boolean }
export interface Rendimiento { agente: string; revisadas: number; previas: number; forma: Forma | null; motivo_sin_flecha: string | null; puntaje: number | null; puntaje_previo: number | null; dimensiones: Dimension[] }

/** una revisión de la jefatura de una entrega del empleado: su resultado y cuántas observaciones que bloquean le hizo */
export interface RevisionCruda { creado_en: string; resultado: string; bloqueos: number }
export interface TrabajoCrudo { creado_en: string; status: string; stop_reason: string | null; num_turns: number | null; brain_hit: boolean | null; cost_usd: number | null; duration_ms: number | null }
export interface EscaladaCruda { creado_en: string }

export const MINIMO_DE_TAREAS = 5
export const VENTANA = 10
/** los umbrales de la flecha (Emilio: rojo = caída de 20 puntos o más; los demás, proporcionales y simétricos) */
export const UMBRALES = { arriba: 20, sube: 7, baja: -7, cae: -20 } as const
export function formaDe(delta: number): Forma {
  if (delta >= UMBRALES.arriba) return "arriba"
  if (delta >= UMBRALES.sube) return "sube"
  if (delta <= UMBRALES.cae) return "cae"
  if (delta <= UMBRALES.baja) return "baja"
  return "estable"
}
export const FORMA_LEGIBLE: Record<Forma, { flecha: string; texto: string; color: string }> = {
  arriba: { flecha: "↑", texto: "en gran forma", color: "#4ade80" },
  sube: { flecha: "↗", texto: "mejorando", color: "#a7f3d0" },
  estable: { flecha: "→", texto: "estable", color: "#ffb347" },
  baja: { flecha: "↘", texto: "bajando", color: "#fb923c" },
  cae: { flecha: "↓", texto: "cayó de golpe", color: "#f87171" },
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null)
const mediana = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const entre = <T extends { creado_en: string }>(xs: T[], desde: string | null, hasta: string | null) => xs.filter((x) => (!desde || x.creado_en >= desde) && (!hasta || x.creado_en < hasta))
const usd = (v: number) => `US$ ${v.toFixed(2).replace(".", ",")}`
const seg = (ms: number) => `${Math.round(ms / 1000)} s`

/** el puntaje 0–100 de un tramo (las revisiones, y el trabajo y las escaladas de su mismo periodo) y el detalle de cada dimensión */
function tramo(revs: RevisionCruda[], trabajos: TrabajoCrudo[], escaladas: EscaladaCruda[], todos: TrabajoCrudo[]): { puntaje: number | null; dimensiones: Dimension[] } {
  // 1 · aprobado a la primera: «limpia» o «con desacuerdo» sin ninguna observación que bloquee (si bloqueó, se la devolvieron a corregir); por tope o fallida no cuentan
  const contables = revs.filter((r) => r.resultado === "limpia" || r.resultado === "con_desacuerdo")
  const aprobadas = contables.filter((r) => r.bloqueos === 0).length
  const d1 = pct(aprobadas, contables.length)
  // 2 · cumplió la tarea: terminó completa y sin cortarse por largo
  const completas = trabajos.filter((t) => t.status === "completed" && t.stop_reason !== "max_tokens").length
  const d2 = pct(completas, trabajos.length)
  // 4 · camino: vueltas por trabajo (una vuelta = 100; cada vuelta de más resta)
  const vueltas = trabajos.map((t) => t.num_turns).filter((n): n is number => n != null && n > 0)
  const promVueltas = vueltas.length ? vueltas.reduce((a, b) => a + b, 0) / vueltas.length : null
  const d4 = promVueltas == null ? null : Math.round(100 / promVueltas)
  // 5 · usó lo disponible: consultó la carpeta del cliente (solo los trabajos que lo registran)
  const conCarpeta = trabajos.filter((t) => t.brain_hit != null)
  const d5 = pct(conCarpeta.filter((t) => t.brain_hit).length, conCarpeta.length)
  // 8 · escalado a Emilio: lo que llegó a su bandeja en el periodo, por entrega revisada (menos es mejor)
  const d8 = revs.length ? Math.round(100 * (1 - Math.min(1, escaladas.length / revs.length))) : null
  // 10 · costo y tiempo: solo dato, frente a su propio promedio
  const c = mediana(trabajos.map((t) => t.cost_usd).filter((x): x is number => x != null)), cT = mediana(todos.map((t) => t.cost_usd).filter((x): x is number => x != null))
  const s = mediana(trabajos.map((t) => t.duration_ms).filter((x): x is number => x != null)), sT = mediana(todos.map((t) => t.duration_ms).filter((x): x is number => x != null))
  const dimensiones: Dimension[] = [
    { n: 1, nombre: "Aprobado a la primera", puntaje: d1, valor: d1 == null ? null : `${aprobadas} de ${contables.length}`, detalle: contables.length ? `la jefatura lo aprobó sin devolver${revs.length > contables.length ? ` · ${revs.length - contables.length} no cuentan (cortadas por tope o fallidas)` : ""}` : "ninguna revisión terminó: las cortadas por tope o fallidas no cuentan", cuenta: true },
    { n: 2, nombre: "Cumplió la tarea", puntaje: d2, valor: d2 == null ? null : `${completas} de ${trabajos.length}`, detalle: trabajos.length ? "terminó completa, sin cortarse" : "sin trabajos registrados en el periodo", cuenta: true },
    { n: 3, nombre: "Veracidad", puntaje: null, valor: null, detalle: "el evaluador automático no recibe registros; la jefatura no marca «sin fuente» aparte", cuenta: true },
    { n: 4, nombre: "Camino", puntaje: d4, valor: promVueltas == null ? null : `${Math.round(promVueltas * 10) / 10} ${promVueltas === 1 ? "vuelta" : "vueltas"}`, detalle: "por trabajo, en promedio · reintentos: sin dato todavía", cuenta: true },
    { n: 5, nombre: "Usó lo disponible", puntaje: d5, valor: d5 == null ? null : `${conCarpeta.filter((t) => t.brain_hit).length} de ${conCarpeta.length}`, detalle: conCarpeta.length ? "consultó la carpeta del cliente" : "sus trabajos no registran si consultó la carpeta", cuenta: true },
    { n: 6, nombre: "Información que le faltó", puntaje: null, valor: null, detalle: "no baja su nota · va a «carpeta incompleta» del cliente", cuenta: false },
    { n: 7, nombre: "Preguntó en vez de asumir", puntaje: null, valor: null, detalle: "nadie registra todavía cuándo pregunta", cuenta: true },
    { n: 8, nombre: "Escalado a Emilio", puntaje: d8, valor: revs.length ? `${escaladas.length} ${escaladas.length === 1 ? "vez" : "veces"}` : null, detalle: "llegó a tu bandeja en el periodo, aunque haya vencido", cuenta: true },
    { n: 9, nombre: "Aporte usado en reuniones", puntaje: null, valor: null, detalle: "la sala no marca todavía si su aporte se usó", cuenta: true },
    { n: 10, nombre: "Costo y tiempo", puntaje: null, valor: c != null && s != null ? `${seg(s)} · ${usd(c)}` : null, detalle: cT != null && sT != null ? `por trabajo, frente a ${seg(sT)} · ${usd(cT)} de su promedio · solo dato, no baja la nota` : "solo dato, no baja la nota", cuenta: false },
  ]
  const conNota = dimensiones.filter((d) => d.cuenta && d.puntaje != null)
  const peso = (d: Dimension) => (d.n === 1 ? 2 : 1)
  const total = conNota.reduce((a, d) => a + peso(d), 0)
  const puntaje = total && d1 != null ? Math.round(conNota.reduce((a, d) => a + d.puntaje! * peso(d), 0) / total) : null
  return { puntaje, dimensiones }
}

/** el rendimiento de un empleado: sus revisiones (de la más nueva a la más vieja), sus trabajos y lo que llegó a la bandeja */
export function rendimientoDe(agente: string, revisiones: RevisionCruda[], trabajos: TrabajoCrudo[], escaladas: EscaladaCruda[]): Rendimiento {
  const revs = [...revisiones].sort((a, b) => b.creado_en.localeCompare(a.creado_en))
  const ahora = revs.slice(0, VENTANA), antes = revs.slice(VENTANA, VENTANA * 2)
  const desde = ahora.length ? ahora[ahora.length - 1].creado_en : null, desdeAntes = antes.length ? antes[antes.length - 1].creado_en : null
  const t1 = tramo(ahora, entre(trabajos, desde, null), entre(escaladas, desde, null), trabajos)
  const t0 = antes.length >= MINIMO_DE_TAREAS ? tramo(antes, entre(trabajos, desdeAntes, desde), entre(escaladas, desdeAntes, desde), trabajos) : null
  let motivo: string | null = null
  if (ahora.length < MINIMO_DE_TAREAS) motivo = "pocas tareas todavía"
  else if (!t0) motivo = "pocas tareas anteriores para comparar"
  else if (t1.puntaje == null || t0.puntaje == null) motivo = "sin entregas aprobables para comparar"
  const forma = !motivo && t1.puntaje != null && t0?.puntaje != null ? formaDe(t1.puntaje - t0.puntaje) : null
  return { agente, revisadas: ahora.length, previas: antes.length, forma, motivo_sin_flecha: forma ? null : motivo, puntaje: ahora.length >= MINIMO_DE_TAREAS ? t1.puntaje : null, puntaje_previo: t0?.puntaje ?? null, dimensiones: t1.dimensiones }
}
