/**
 * OBSERVABILIDAD FÁCIL DE LEER (6.47 · 2-nov · encargo `2026-11-02-ENCARGO-LENOVO-a-CC5-observabilidad-facil-de-leer.md`, firmado por Emilio).
 * Una capa de lectura ENCIMA de la lista de corridas (que se conserva): resumen arriba (LangSmith / Langfuse), «lo que falló» primero con el motivo en
 * palabras y el salto al paso (Datadog), grupos por proceso · cliente · empleado (gráficos agrupados de LangSmith) y el trabajo interno oculto por defecto.
 * Definiciones (las mismas en todo el tablero):
 *  · corrida = un pedido · % con error = con error ÷ corridas del período (las «en curso» no cuentan) · demora típica = la mediana (y la más lenta aparte)
 *  · costo = misma fuente y misma función que Dinero (`resumenDelPeriodo` sobre los movimientos de Dinero) · interno = cerebro, portero, pruebas y ensayos.
 */
import { anteriorDe, diaLocal, diasEntre, horaLocal, rangoDe, resumenDelPeriodo, sumarDias, type Dinero, type Movimiento, type Periodo } from "@/lib/dinero-completo"
import { OTROS_PROCESOS, clienteVisible, mayuscula, type Corrida, type DetalleDeCorrida, type GrupoAgregado, arbolDeNodos } from "@/lib/direccion-corridas"

/** ─── interno: mantenimiento del cerebro y del portero, pruebas y ensayos ─── */
const NOMBRE_INTERNO = /^Cerebro ·|^Portero · .*\bprueba\b|\bprueba\b|\bensayo\b/i
export const esNombreInterno = (nombre: string | null | undefined): boolean => !!nombre && NOMBRE_INTERNO.test(nombre)
export const esCorridaInterna = (c: Pick<Corrida, "interno" | "nombre">): boolean => c.interno || esNombreInterno(c.nombre)
export const esMovimientoInterno = (x: Pick<Movimiento, "proceso">): boolean => esNombreInterno(x.proceso)

/** ─── el motivo del error en palabras (el texto técnico va plegado debajo) ─── */
const MOTIVOS: Array<[RegExp, string]> = [
  [/timeout|timed out|tiempo|deadline|ETIMEDOUT|504|aborted/i, "se acabó el tiempo"],
  [/credit|saldo|balance|billing|quota|insufficient/i, "se acabó el saldo del proveedor"],
  [/rate.?limit|429|too many/i, "el proveedor pidió esperar (demasiados pedidos)"],
  [/max.?tokens|tope|cap|upper.?bound|presupuesto|budget|freno/i, "se cortó por el tope de gasto o de largo"],
  [/overloaded|529|503|502|500|no respond|empty response|sin respuesta|ECONNRESET|fetch failed|network/i, "el modelo no respondió"],
  [/401|403|unauthori|forbidden|permiso|api.?key|llave/i, "faltó permiso o la llave no sirvió"],
  [/json|parse|schema|formato|invalid|zod/i, "la respuesta vino con mal formato"],
  [/client_id|falta|missing|required|not found|404|sin dato|null/i, "faltó un dato del cliente o del pedido"],
  [/review|revisi|rechaz|reject|gate|veredicto|no pas/i, "la revisión no pasó"],
  [/atascad|stuck|nunca/i, "se quedó sin dar señales de vida"],
]
export function motivoEnPalabras(error: string | null | undefined, estado?: string): string {
  if (estado === "atascada") return "se quedó sin dar señales de vida"
  if (!error) return "terminó con error sin dejar el motivo"
  for (const [re, t] of MOTIVOS) if (re.test(error)) return t
  return "terminó con un error técnico"
}

/** ─── dónde falló: el primer paso en rojo de la traza, «paso k de n» ─── */
export interface DondeFallo { clave: string | null; paso: number | null; de: number; nombre: string | null; error: string | null; motivo: string; /** quién falló y si el fallo lo anotó el proceso (no el libro del empleado) */ agente: string | null; del_proceso: boolean }
export function dondeFallo(d: DetalleDeCorrida): DondeFallo {
  const pasos = arbolDeNodos(d).filter((n) => n.tipo === "paso")
  const i = pasos.findIndex((n) => n.estado === "fallida" || n.estado === "atascada")
  const n = i >= 0 ? pasos[i] : null
  return { clave: n?.clave ?? null, paso: i >= 0 ? i + 1 : null, de: pasos.length, nombre: n?.nombre ?? null, error: n?.error ?? null, motivo: motivoEnPalabras(n?.error, n?.estado ?? d.corrida.estado), agente: n?.paso?.agente ?? null, del_proceso: !!n?.paso && n.paso.origen !== "invocacion" }
}

/** ─── el período: el MISMO selector y los mismos días que Dinero (hora de Ecuador) ─── */
export interface Ventana { r: { desde: string; hasta: string }; ant: { desde: string; hasta: string; nombre: string }; dias: number; dias_periodo: number }
/** cuántos días hay que pedir a la plataforma: solo el período (para que el tope de 200 no se lo coma el anterior) y, aparte, el período más el anterior (hasta 30) */
export function ventanaDe(p: Periodo, hoy: string): Ventana {
  const r = rangoDe(p, hoy), ant = anteriorDe(p, r)
  return { r: { desde: r.desde, hasta: r.hasta }, ant, dias: Math.min(30, diasEntre(ant.desde, hoy).length), dias_periodo: Math.min(30, diasEntre(r.desde, hoy).length) }
}
export const enRango = (c: Pick<Corrida, "inicio">, r: { desde: string; hasta: string }) => !!c.inicio && diaLocal(c.inicio) >= r.desde && diaLocal(c.inicio) <= r.hasta

/** ─── lo que alcanza a leer: si la plataforma cortó la lista (200 ejecuciones), los números se rotulan «sobre las últimas N» ─── */
export interface Cobertura { cubre: boolean; desde_dia: string | null; cortada: boolean }
/** ¿una lectura de `dias` días (cortada o no) cubre entero lo que empieza en `desde`? Con corte, solo desde la corrida más vieja que llegó (ese día puede estar incompleto) */
export function cobertura(corridas: Pick<Corrida, "inicio">[], cortada: boolean, dias: number, desde: string, hoy: string): Cobertura {
  const ds = corridas.map((c) => (c.inicio ? diaLocal(c.inicio) : null)).filter((x): x is string => !!x).sort()
  const viejo = ds[0] ?? null
  const piso = cortada ? (viejo ? sumarDias(viejo, 1) : hoy) : sumarDias(hoy, -(Math.min(30, dias) - 1))
  return { cubre: desde >= piso, desde_dia: viejo, cortada }
}

/** ─── el resumen arriba ─── */
export interface Numeros { corridas: number; con_error: number; pct_error: number | null; mediana_ms: number | null; max_ms: number | null; mas_lenta: string | null }
export const mediana = (xs: number[]): number | null => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const terminada = (c: Corrida) => c.estado !== "en_curso"
export function numerosDe(cs: Corrida[]): Numeros {
  const cuentan = cs.filter(terminada), errores = cuentan.filter((c) => c.estado === "fallida").length
  const conDur = cs.filter((c) => terminada(c) && c.estado !== "atascada" && c.duracion_ms != null)
  const lenta = conDur.reduce<Corrida | null>((m, c) => (!m || (c.duracion_ms ?? 0) > (m.duracion_ms ?? 0) ? c : m), null)
  return { corridas: cs.length, con_error: errores, pct_error: cuentan.length ? Math.round((errores / cuentan.length) * 1000) / 10 : null, mediana_ms: mediana(conDur.map((c) => c.duracion_ms as number)), max_ms: lenta?.duracion_ms ?? null, mas_lenta: lenta?.nombre ?? null }
}
/** la serie de cada día del período (para el mini gráfico de cada tarjeta) */
export function seriePorDia(cs: Corrida[], r: { desde: string; hasta: string }, f: (xs: Corrida[]) => number | null): Array<number | null> {
  const por = new Map<string, Corrida[]>()
  for (const c of cs) if (c.inicio) { const d = diaLocal(c.inicio); por.set(d, [...(por.get(d) ?? []), c]) }
  return diasEntre(r.desde, r.hasta).map((d) => f(por.get(d) ?? []))
}

/** ─── el costo: Dinero, con su misma función. Con interno = el número de Dinero al centavo ─── */
export interface CostoDelPeriodo { total: number; anterior: number; variacion_pct: number | null; por_dia: number[] }
export function costoDelPeriodo(d: Dinero, v: Ventana, hoy: string, conInterno: boolean): CostoDelPeriodo {
  const movs = conInterno ? d.movimientos : d.movimientos.filter((x) => !esMovimientoInterno(x))
  const k = resumenDelPeriodo(movs, v.r, v.ant, hoy)
  const por = new Map<string, number>(); for (const x of movs) if (x.d >= v.r.desde && x.d <= v.r.hasta) por.set(x.d, (por.get(x.d) ?? 0) + x.usd)
  return { total: k.total, anterior: k.anterior, variacion_pct: k.variacion_pct, por_dia: diasEntre(v.r.desde, v.r.hasta).map((x) => Math.round((por.get(x) ?? 0) * 100) / 100) }
}
/** el costo de cada corrida leído de Dinero (por sus ejecuciones): así el costo de un grupo es la misma cuenta que Dinero */
export function costoPorEjecucion(d: Dinero | null): Map<string, number> {
  const m = new Map<string, number>()
  if (!d) return m
  for (const x of d.movimientos) if (x.corrida) { const k = x.corrida.split(":")[0]; m.set(k, (m.get(k) ?? 0) + x.usd) }
  return m
}
export const ejecucionesDe = (c: Pick<Corrida, "workflow_execution_id" | "miembros">): string[] => (c.miembros?.length ? c.miembros : [c.workflow_execution_id]).map((x) => x.split(":")[0])
export const costoDeLaCorrida = (c: Corrida, porEj: Map<string, number> | null): number => (porEj ? Math.round([...new Set(ejecucionesDe(c))].reduce((s, e) => s + (porEj.get(e) ?? 0), 0) * 10000) / 10000 : c.costo_usd)

/** ─── agrupar por proceso · cliente · empleado ─── */
export type AgruparPor = "proceso" | "cliente" | "empleado"
export const NOMBRE_DE_AGRUPAR: Record<AgruparPor, string> = { proceso: "Proceso", cliente: "Cliente", empleado: "Empleado" }
export interface Grupo { clave: string; nombre: string; corridas: Corrida[]; numeros: Numeros; costo: number; tendencia: number[]; llamadas?: number }
/** el proceso de una corrida en palabras de oficina: «Plan de 90 días», «Cambios al plan», «Manual de marca»… (el nombre completo sigue en la fila) */
export function procesoDe(c: Pick<Corrida, "nombre">): string {
  const n = c.nombre
  if (/^Cambios? al plan/i.test(n)) return "Cambios al plan"
  if (/^Cambios? al manual/i.test(n)) return "Cambios al manual"
  if (/plan de 90 d[ií]as/i.test(n)) return "Plan de 90 días"
  if (/^Alta de un cliente|manual de marca|brand book/i.test(n)) return "Manual de marca y alta"
  if (/^Cerebro ·/i.test(n)) return "Mantenimiento del cerebro"
  if (/^Portero ·/i.test(n)) return "Portero del cerebro"
  if (/^(Pieza|Cadena) ·|pieza|video|imágen/i.test(n)) return "Piezas y video"
  if (/^Jefatura|revisi[oó]n de la jefatura/i.test(n)) return "Revisión de la jefatura"
  if (/oficina|encargo de un turno/i.test(n)) return "Oficina"
  if (/^Finanzas/i.test(n)) return "Finanzas"
  if (/prueba|ensayo/i.test(n)) return "Pruebas y ensayos"
  if (n === OTROS_PROCESOS || /^Ejecución \d+$|^Corrida sin nombre/.test(n)) return OTROS_PROCESOS
  return n.split(" · ")[0]
}
export function agrupar(cs: Corrida[], por: Exclude<AgruparPor, "empleado">, porEj: Map<string, number> | null, r: { desde: string; hasta: string }): Grupo[] {
  const m = new Map<string, Corrida[]>()
  for (const c of cs) { const k = por === "proceso" ? procesoDe(c) : clienteVisible(c) ?? "Sin cliente"; m.set(k, [...(m.get(k) ?? []), c]) }
  return [...m.entries()].map(([k, xs]) => ({ clave: k, nombre: k, corridas: xs, numeros: numerosDe(xs), costo: Math.round(xs.reduce((s, c) => s + costoDeLaCorrida(c, porEj), 0) * 100) / 100, tendencia: seriePorDia(xs, r, (d) => d.length).map((x) => x ?? 0) }))
    .sort((a, b) => b.numeros.con_error - a.numeros.con_error || b.costo - a.costo || b.numeros.corridas - a.numeros.corridas)
}

/** ─── empleados: la lectura propia del tablero sobre el libro de los empleados (completa, sin el tope de 200) ─── */
export interface EmpleadoObs { slug: string; nombre: string; llamadas: number; errores: number; mediana_ms: number | null; max_ms: number | null; usd: number; ejecuciones: string[]; interno: boolean }
export function agruparPorEmpleado(es: EmpleadoObs[], cs: Corrida[], r: { desde: string; hasta: string }): Grupo[] {
  return es.map((e) => {
    const ej = new Set(e.ejecuciones)
    const xs = cs.filter((c) => ejecucionesDe(c).some((x) => ej.has(x)))
    return { clave: e.slug, nombre: e.nombre, corridas: xs, llamadas: e.llamadas, numeros: { corridas: xs.length, con_error: e.errores, pct_error: e.llamadas ? Math.round((e.errores / e.llamadas) * 1000) / 10 : null, mediana_ms: e.mediana_ms, max_ms: e.max_ms, mas_lenta: null }, costo: Math.round(e.usd * 100) / 100, tendencia: seriePorDia(xs, r, (d) => d.length).map((x) => x ?? 0) }
  }).sort((a, b) => b.numeros.con_error - a.numeros.con_error || b.costo - a.costo)
}
/** un fallo que anotó el proceso (la jefatura, la oficina) no queda en el libro del empleado: se le suma para que «los que más fallan» no contradiga a «lo que falló» */
export function conFallosDelProceso(es: EmpleadoObs[], fallos: Array<Pick<DondeFallo, "agente" | "del_proceso">>, canonico: (s: string) => string): EmpleadoObs[] {
  const extra = new Map<string, number>()
  for (const f of fallos) if (f.del_proceso && f.agente) { const k = canonico(f.agente); extra.set(k, (extra.get(k) ?? 0) + 1) }
  return extra.size ? es.map((e) => { const x = extra.get(canonico(e.slug)) ?? 0; return x ? { ...e, errores: e.errores + x, llamadas: e.llamadas } : e }) : es
}
/** los 5 que más fallan (con al menos un error) y los 5 que más tardan (mediana) */
export function topEmpleados(es: EmpleadoObs[]): { fallan: EmpleadoObs[]; tardan: EmpleadoObs[] } {
  return {
    fallan: es.filter((e) => e.errores > 0).sort((a, b) => b.errores - a.errores || b.llamadas - a.llamadas).slice(0, 5),
    tardan: es.filter((e) => e.mediana_ms != null).sort((a, b) => (b.mediana_ms ?? 0) - (a.mediana_ms ?? 0)).slice(0, 5),
  }
}

/** ─── servidor: estadística por empleado leída del libro (solo lectura) ─── */
export interface FilaDeInvocacion { agent_name: string | null; status: string | null; duration_ms: number | string | null; cost_usd: number | string | null; workflow_id: string | null; workflow_execution_id: string | null }
export function empleadosDe(filas: FilaDeInvocacion[], nombreDe: (slug: string) => string, nombreDelProceso: (wid: string | null) => string): { todo: EmpleadoObs[]; sin_interno: EmpleadoObs[] } {
  type Acc = { llamadas: number; errores: number; ms: number[]; usd: number; ej: Set<string> }
  const todo = new Map<string, Acc>(), sin = new Map<string, Acc>()
  const sumar = (m: Map<string, Acc>, slug: string, f: FilaDeInvocacion) => {
    const a = m.get(slug) ?? { llamadas: 0, errores: 0, ms: [], usd: 0, ej: new Set<string>() }
    a.llamadas++; if (/error|fail|timeout|cancel/i.test(String(f.status ?? ""))) a.errores++
    const ms = Number(f.duration_ms); if (f.duration_ms != null && Number.isFinite(ms) && ms >= 0) a.ms.push(ms)
    const usd = Number(f.cost_usd); if (Number.isFinite(usd) && usd > 0) a.usd += usd
    if (f.workflow_execution_id) a.ej.add(String(f.workflow_execution_id).split(":")[0])
    m.set(slug, a)
  }
  for (const f of filas) {
    const slug = String(f.agent_name ?? "sin empleado")
    sumar(todo, slug, f)
    if (!esNombreInterno(nombreDelProceso(f.workflow_id))) sumar(sin, slug, f)
  }
  const salida = (m: Map<string, Acc>, interno: boolean): EmpleadoObs[] => [...m.entries()].map(([slug, a]) => {
    const s = [...a.ms].sort((x, y) => x - y)
    return { slug, nombre: nombreDe(slug), llamadas: a.llamadas, errores: a.errores, mediana_ms: mediana(s), max_ms: s.length ? s[s.length - 1] : null, usd: Math.round(a.usd * 10000) / 10000, ejecuciones: [...a.ej].slice(0, 400), interno }
  })
  return { todo: salida(todo, true), sin_interno: salida(sin, false) }
}

/** ─── formatos cortos para el resumen ─── */
export function demoraCorta(ms: number | null): string {
  if (ms == null) return "—"
  const s = ms / 1000
  if (s < 60) return `${Math.round(s)} s`
  const m = s / 60
  return m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`
}
export function variacion(ahora: number | null, antes: number | null): { texto: string; sube: boolean } | null {
  if (ahora == null || antes == null) return null
  if (antes === 0) return ahora === 0 ? { texto: "igual", sube: false } : { texto: `▲ antes 0`, sube: true }
  const p = Math.round(((ahora - antes) / antes) * 100)
  return p === 0 ? { texto: "igual", sube: false } : { texto: `${p > 0 ? "▲" : "▼"} ${Math.abs(p)} %`, sube: p > 0 }
}

/**
 * ─── 6.49 · OBSERVABILIDAD VISUAL (boceto aprobado por Emilio 2-nov · `2026-11-02-BOCETO-CC5-a-EMILIO-observabilidad-visual.md`) ───
 * Gráficos grandes por día (por hora si el período es Hoy, como Dinero), los días que la lectura no alcanzó dibujados «no leído» (nunca como cero)
 * y la corrida con error como cascada: un tramo por fase, su largo = su tiempo real, el que falló en rojo.
 */
export interface Cubetas { rotulos: string[]; porHora: boolean }
export const cubetasDe = (v: Ventana): Cubetas =>
  v.dias_periodo === 1 ? { rotulos: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")), porHora: true } : { rotulos: diasEntre(v.r.desde, v.r.hasta), porHora: false }
const cubetaDe = (iso: string, porHora: boolean): string => (porHora ? String(horaLocal(iso)).padStart(2, "0") : diaLocal(iso))
/** la serie de cada día (u hora) del período */
export function serieDe<T>(cs: Corrida[], k: Cubetas, f: (xs: Corrida[]) => T): T[] {
  const por = new Map<string, Corrida[]>()
  for (const c of cs) if (c.inicio) { const b = cubetaDe(c.inicio, k.porHora); por.set(b, [...(por.get(b) ?? []), c]) }
  return k.rotulos.map((r) => f(por.get(r) ?? []))
}
/** el costo de cada día (u hora): los movimientos de Dinero, la misma cuenta */
export function costoPorCubeta(d: Dinero, v: Ventana, k: Cubetas, conInterno: boolean): number[] {
  const movs = conInterno ? d.movimientos : d.movimientos.filter((x) => !esMovimientoInterno(x))
  const por = new Map<string, number>()
  for (const x of movs) if (x.d >= v.r.desde && x.d <= v.r.hasta) { const b = k.porHora ? String(horaLocal(x.t)).padStart(2, "0") : x.d; por.set(b, (por.get(b) ?? 0) + x.usd) }
  return k.rotulos.map((r) => Math.round((por.get(r) ?? 0) * 100) / 100)
}
/** las cubetas anteriores a la ejecución más vieja que entregó la lectura (cuando vino cortada): «no leído», no cero */
export function noLeidas(k: Cubetas, desdeIso: string | null, dia: string): boolean[] {
  if (!desdeIso) return k.rotulos.map(() => false)
  const d = diaLocal(desdeIso), h = horaLocal(desdeIso)
  return k.rotulos.map((r) => (k.porHora ? d === dia && Number(r) < h : r < d))
}
/** la ejecución más vieja de una lectura cortada (null si la lectura entregó todo) */
export function desdeDeLaLectura(corridas: Pick<Corrida, "inicio">[], cortada: boolean): string | null {
  if (!cortada) return null
  return corridas.reduce<string | null>((m, c) => (c.inicio && (!m || c.inicio < m) ? c.inicio : m), null)
}
const fecha = (d: string) => new Date(`${d}T12:00:00Z`)
const corta = (d: string, o: Intl.DateTimeFormatOptions) => fecha(d).toLocaleDateString("es-EC", { timeZone: "UTC", ...o }).replace(".", "")
/** «mar 27» (pocos días) o «27 oct» (muchos); la hora como «15 h» */
export const rotuloDe = (r: string, k: Cubetas, n: number): string => (k.porHora ? `${Number(r)} h` : n <= 10 ? `${corta(r, { weekday: "short" })} ${fecha(r).getUTCDate()}` : `${fecha(r).getUTCDate()} ${corta(r, { month: "short" })}`)
/** «dom 1 nov» o «hoy, 15:00» para el detalle al pasar el cursor */
export const rotuloLargo = (r: string, k: Cubetas): string => (k.porHora ? `Hoy, ${r}:00` : `${corta(r, { weekday: "short" })} ${fecha(r).getUTCDate()} ${corta(r, { month: "short" })}`)

export interface Fase { nombre: string; pasos: number; desde_ms: number; dur_ms: number; fallo: boolean; clave: string }
export interface Cascada { fases: Fase[]; total_ms: number; inicio: string }
const accionDe = (n: string) => { const i = n.indexOf(" · "); return i >= 0 ? n.slice(i + 3) : n }
/**
 * la cascada de una corrida: los pasos que se pisan en el tiempo forman una fase («Analiza · 5 empleados en paralelo»); el largo de cada fase es su
 * tiempo real; la que tiene el paso con error va en rojo. Los pasos de 0 s que salieron bien (cierres) no se dibujan.
 */
export function cascadaDe(d: DetalleDeCorrida): Cascada | null {
  const pasos = arbolDeNodos(d)
    .filter((n) => n.tipo === "paso" && n.inicio)
    .map((n) => { const a = Date.parse(n.inicio!); return { n, a, b: a + (n.duracion_ms ?? 0), mal: n.estado === "fallida" || n.estado === "atascada" } })
    .filter((p) => Number.isFinite(p.a) && (p.b > p.a || p.mal))
    .sort((x, y) => x.a - y.a)
  if (!pasos.length) return null
  const grupos: (typeof pasos)[] = []
  let fin = -Infinity
  for (const p of pasos) {
    if (grupos.length && p.a < fin) { grupos[grupos.length - 1].push(p); fin = Math.max(fin, p.b) } else { grupos.push([p]); fin = p.b }
  }
  const t0 = pasos[0].a, tf = Math.max(...pasos.map((p) => p.b))
  const fases = grupos.map((g): Fase => {
    const a = Math.min(...g.map((p) => p.a)), b = Math.max(...g.map((p) => p.b)), mal = g.find((p) => p.mal)
    const acciones = g.map((p) => accionDe(p.n.nombre)), primeras = acciones.map((x) => x.split(/\s+/)[0].toLocaleLowerCase("es"))
    const comun = primeras.every((x) => x === primeras[0]) ? mayuscula(primeras[0]) : null
    const nombre = g.length === 1 ? mayuscula(acciones[0]) : `${comun ? `${comun} · ` : ""}${g.length} empleados en paralelo`
    return { nombre, pasos: g.length, desde_ms: a - t0, dur_ms: b - a, fallo: !!mal, clave: (mal ?? g[0]).n.clave }
  })
  return { fases, total_ms: Math.max(1, tf - t0), inicio: new Date(t0).toISOString() }
}

/**
 * ─── 6.50 · LA LECTURA AGREGADA (CC1 · #853): corridas y errores ENTEROS del período y del anterior, sin el tope de 200 ───
 * Aquí una corrida = una ejecución de un proceso (así cuenta la plataforma); la lista y «lo que falló» siguen agrupando por pedido.
 * La demora por día no viene en la lectura agregada: ese gráfico sigue saliendo de la lista.
 */
export const gruposVisibles = (gs: GrupoAgregado[], conInterno: boolean): GrupoAgregado[] => (conInterno ? gs : gs.filter((g) => !g.interno && !esNombreInterno(g.nombre)))
export interface NumerosAgregados { corridas: number; con_error: number; pct_error: number | null; max_ms: number | null }
export function numerosDelAgregado(gs: GrupoAgregado[]): NumerosAgregados {
  const corridas = gs.reduce((s, g) => s + g.ejecuciones, 0), con_error = gs.reduce((s, g) => s + g.con_error, 0), cuentan = corridas - gs.reduce((s, g) => s + g.en_curso, 0)
  const maxs = gs.flatMap((g) => (g.max_ms == null ? [] : [g.max_ms]))
  return { corridas, con_error, pct_error: cuentan > 0 ? Math.round((con_error / cuentan) * 1000) / 10 : null, max_ms: maxs.length ? Math.max(...maxs) : null }
}
/** la lectura agregada solo cuenta las EJECUCIONES caídas; un pedido que la revisión de la jefatura marcó con error (se anota aparte) no entra.
 *  Para que el número nunca contradiga a «lo que falló», los errores son al menos los pedidos con error que trae la lista. */
export function conErroresDeLaLista(a: NumerosAgregados, fallidasDeLaLista: number): NumerosAgregados {
  if (fallidasDeLaLista <= a.con_error) return a
  const con_error = Math.min(a.corridas, fallidasDeLaLista), cuentan = a.pct_error != null && a.con_error > 0 ? Math.round(a.con_error / (a.pct_error / 100)) : a.corridas
  return { ...a, con_error, pct_error: cuentan > 0 ? Math.round((con_error / cuentan) * 1000) / 10 : null }
}
/** corridas y errores de cada día del período (por día: la lectura agregada no trae horas) */
export function serieDelAgregado(gs: GrupoAgregado[], k: Cubetas): Array<{ total: number; con_error: number }> {
  const por = new Map<string, { total: number; con_error: number }>()
  for (const g of gs) for (const x of g.por_dia) { const c = por.get(x.d) ?? { total: 0, con_error: 0 }; c.total += x.ejecuciones; c.con_error += x.con_error; por.set(x.d, c) }
  return k.rotulos.map((r) => por.get(r) ?? { total: 0, con_error: 0 })
}
