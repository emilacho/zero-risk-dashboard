/**
 * TU OFICINA · OBSERVABILIDAD · UNA CORRIDA POR PEDIDO (6.28 · 1-nov · encargo `2026-11-01-ENCARGO-LENOVO-a-CC5-observabilidad-una-corrida-por-pedido.md`).
 * Como LangSmith: todo lo que nace del mismo pedido es UNA traza con su árbol. La plataforma no deja un id común en `agent_invocations`, así que se agrupa por
 * la mejor llave que sí existe (todo SOLO LECTURA):
 *  · una revisión de la jefatura → `jefatura_pasos.revision_id` (cada paso guarda su ejecución) + el revisor externo `gpt-jefatura-<revisión>-<n>`
 *  · un encargo de la oficina    → `oficina_turnos.encargo_id` + `gpt-oficina-<encargo>-<n>`
 *  · el pedido del dueño          → `plan_cambios` del mismo cliente cuya ventana [creado_en, actualizado_en] contiene la apertura de la revisión
 *    (llave DECLARADA: por cliente y hora, porque ni la revisión ni el plan guardan el id del pedido · PEDIDO a CC1 en el LISTO).
 *  · el plan nuevo que redactó planeación → `plan_aprobaciones.plan_id` = `jefatura_revisiones.artifact_id` y su `sobre_de_reanudacion.planeacion_execution_id` (llave exacta)
 * Cada paso dice quién y qué hizo, con lo que guardan esas tablas (`paso`, `agente`).
 */
import { mayuscula, palabras, type Corrida, type DetalleDeCorrida, type EstadoCorrida, type ListaDeCorridas, type Paso, type Tokens } from "@/lib/direccion-corridas"

export type TipoDePedido = "pedido" | "encargo"
export interface RevisionFila { id: string; client_id: string | null; artifact_type: string | null; artifact_id: string | null; estado: string | null; resultado: string | null; creado_en: string | null; cerrado_en: string | null }
export interface CambioFila { id: string; client_id: string | null; texto: string | null; estado: string | null; plan_nuevo_id: string | null; workflow_execution_id: string | null; creado_en: string | null; actualizado_en: string | null }
export interface EncargoFila { id: string; client_id: string | null; tipo_de_grupo: string | null; estado: string | null; creado_en: string | null; cerrado_en: string | null }
export interface PasoDeGrupo { grupo: string; n: number; paso: string; tipo: string | null; agente: string | null; estado: string | null; workflow_execution_id: string | null; cost_usd: number; inicio: string | null; fin: string | null; error: string | null }
export interface Agrupacion {
  /** ejecución → clave del grupo («pedido:<revisión>» o «encargo:<id>») */
  grupoDe: Map<string, string>
  revisiones: Map<string, RevisionFila>
  encargos: Map<string, EncargoFila>
  /** revisión → el pedido del dueño que la originó */
  cambioDe: Map<string, CambioFila>
  /** revisión → la ejecución de planeación que redactó el plan revisado */
  planeacionDe: Map<string, string>
  /** ejecución de un turno (jefatura u oficina) que NO quedó en ninguna revisión ni encargo → el empleado que se le encargó */
  agenteSuelto?: Map<string, { agente: string; proceso: "jefatura" | "oficina" }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const GPT_DE_GRUPO = /^gpt-(jefatura|oficina)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(\d+)$/i
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : 0)
export const claveDeGrupo = (tipo: TipoDePedido, id: string) => `${tipo}:${id}`
export const esClaveDeGrupo = (id: string) => /^(pedido|encargo):[0-9a-f-]{36}$/i.test(id)

/** ─── quién y qué: nombres de cada paso ─── */
/** «editor_en_jefe» → «Editor en jefe» · «jefe-marketing» → «Jefe marketing» · «GPT» → «Revisor externo» */
export const quien = (agente: string | null): string => (!agente ? "" : /^gpt$/i.test(agente) || /revisor-externo/i.test(agente) ? "Revisor externo" : mayuscula(palabras(agente)))
const OBJETO: Record<string, string> = { plan: "el plan", pieza: "la pieza", brief: "el brief", manual: "el manual" }
const objeto = (t: string | null) => (t && OBJETO[t]) || "el trabajo"
const delObjeto = (t: string | null) => objeto(t).replace(/^el /, "del ").replace(/^la /, "de la ")
export function nombreDelPasoDeJefatura(paso: string, agente: string | null, artefacto: string | null): string {
  const [que, de] = paso.split(":")
  const q = quien(de ?? agente)
  if (que === "revision_fondo") return `${q || "Jefatura"} · revisa el fondo ${delObjeto(artefacto)}`
  if (que === "correccion") return `${q} · corrige ${objeto(artefacto)} con lo que marcó la jefatura`
  if (que === "segunda_mirada") return "Revisor externo · segunda mirada"
  if (que === "decision") return `${q} · decide qué toma del revisor externo`
  return mayuscula(palabras(paso))
}
const DE_LA_OFICINA: Record<string, string> = {
  abrir: "Abre el encargo", asignar_fotos: "Asigna las fotos", narrativa: "escribe la narrativa", direccion_visual: "define la dirección visual", prompts: "escribe las instrucciones de imagen",
  chequear_prompts: "Revisa las instrucciones de imagen", imagen: "Genera la imagen", texto: "escribe el texto", laminas: "diseña las láminas", mirar: "mira las fotos del cliente",
  paquete: "arma el paquete del cerebro", render: "Arma la imagen final", render_2: "Arma la imagen final (segunda vuelta)", armar: "Arma la pieza", armar_2: "Arma la pieza (segunda vuelta)",
  chequeos: "Revisa la pieza", chequeos_2: "Revisa la pieza (segunda vuelta)", jefatura: "Jefatura · revisa la pieza", elegir_version: "Elige la versión", entrega: "Entrega la pieza",
  cierre: "Cierra el encargo", observar: "Observa el resultado", mesa: "Abre la mesa de trabajo",
}
const MESA: Record<string, string> = { dirigir: "dirige la mesa", aportar: "aporta a la mesa", responder: "responde a la mesa", integrar: "integra los aportes", devolver_citas: "devuelve las citas" }
export function nombreDelTurno(paso: string, tipo: string | null, agente: string | null): string {
  const m = paso.match(/^mesa:([a-z_]+):(.+)$/)
  if (m) return `${quien(m[2])} · ${MESA[m[1]] ?? palabras(m[1])}`
  if (paso === "mesa" && tipo === "material") return "Reúne el material de la mesa"
  const que = DE_LA_OFICINA[paso] ?? palabras(paso)
  if (tipo === "portero") return `Portero del cerebro · ${que}`
  return agente && tipo === "agente" ? `${quien(agente)} · ${que}` : mayuscula(que)
}
const TIPO_DE_ENCARGO: Record<string, string> = { post_img: "publicación con imagen", carrusel_mesa: "carrusel", kit_historias: "historias", reel: "reel" }
export function nombreDelGrupo(clave: string, a: Pick<Agrupacion, "revisiones" | "encargos" | "cambioDe"> & { planeacionDe?: Map<string, string> }): string {
  const [tipo, id] = clave.split(":")
  if (tipo === "encargo") { const e = a.encargos.get(id); return `Encargo de oficina · ${e?.tipo_de_grupo ? TIPO_DE_ENCARGO[e.tipo_de_grupo] ?? palabras(e.tipo_de_grupo) : "pieza"}` }
  const r = a.revisiones.get(id)
  if (a.cambioDe.has(id)) return "Cambios al plan de 90 días · pedido del dueño"
  if (r?.artifact_type === "plan" && a.planeacionDe?.has(id)) return "Plan de 90 días · investigación, redacción y revisión"
  if (r?.artifact_type === "plan") return "Revisión del plan de 90 días"
  if (r?.artifact_type === "pieza") return "Revisión de una pieza"
  return `Revisión de la jefatura${r?.artifact_type ? ` · ${palabras(r.artifact_type)}` : ""}`
}

/** el pedido del dueño de una revisión: mismo cliente y la revisión se abrió mientras el pedido estaba vivo (llave declarada, ver arriba) */
export function cambioDeLaRevision(r: RevisionFila, cambios: CambioFila[]): CambioFila | null {
  if (!r.creado_en || r.artifact_type !== "plan") return null
  const t = Date.parse(r.creado_en)
  const candidatos = cambios.filter((c) => c.client_id === r.client_id && c.creado_en && Date.parse(c.creado_en) <= t && t <= Date.parse(c.actualizado_en ?? c.creado_en) + 60_000)
  return candidatos.sort((a, b) => Date.parse(b.creado_en as string) - Date.parse(a.creado_en as string))[0] ?? null
}

/** ─── la lista: las corridas de un mismo pedido se vuelven UNA fila ─── */
const PEOR: EstadoCorrida[] = ["fallida", "atascada", "en_curso", "sin_cierre", "completa"]
export const peorEstado = (es: EstadoCorrida[]): EstadoCorrida => PEOR.find((e) => es.includes(e)) ?? "completa"
const revisionFallida = (r: RevisionFila | undefined) => !!r && /fall|error/i.test(`${r.resultado ?? ""} ${r.estado ?? ""}`)
export function agruparLista(l: ListaDeCorridas, a: Agrupacion): ListaDeCorridas {
  const grupos = new Map<string, Corrida[]>(), salida: (Corrida | string)[] = []
  for (const c of l.corridas) {
    const g = a.grupoDe.get(c.workflow_execution_id) ?? (c.workflow_execution_id.match(GPT_DE_GRUPO) ? a.grupoDe.get(c.workflow_execution_id) : undefined)
    if (!g) {
      const suelto = a.agenteSuelto?.get(c.workflow_execution_id)
      salida.push(suelto ? { ...c, nombre: `${quien(suelto.agente)} · encargo de un turno de la ${suelto.proceso}, sin revisión registrada` } : c)
      continue
    }
    if (!grupos.has(g)) { grupos.set(g, []); salida.push(g) }
    grupos.get(g)!.push(c)
  }
  let quitadas = 0
  const corridas = salida.map((x) => {
    if (typeof x !== "string") return x
    const ms = grupos.get(x)!; quitadas += ms.length - 1
    const ini = ms.map((m) => m.inicio).filter((v): v is string => !!v).sort()
    const cambio = a.cambioDe.get(x.split(":")[1])
    const inicio = [cambio?.creado_en ?? null, ini[0] ?? null].filter((v): v is string => !!v).sort()[0] ?? null
    const fines = [...ms.map((m) => m.fin), cambio?.actualizado_en ?? null].filter((v): v is string => !!v).sort()
    const fin = ms.some((m) => !m.fin && (m.estado === "en_curso" || m.estado === "atascada")) ? null : fines[fines.length - 1] ?? null
    const primero = ms.find((m) => m.cliente) ?? ms[0]
    const g: Corrida = {
      workflow_execution_id: x, workflow_id: null, nombre: nombreDelGrupo(x, a), nombre_tecnico: `${x.startsWith("pedido") ? "jefatura_revisiones" : "oficina_encargos"} ${x.split(":")[1]} · ejecuciones ${ms.map((m) => m.workflow_execution_id).join(", ")}`,
      interno: false, client_id: primero.client_id, cliente: primero.cliente, inicio, fin, duracion_ms: inicio && fin ? Date.parse(fin) - Date.parse(inicio) : null,
      costo_usd: ms.reduce((s, m) => s + m.costo_usd, 0), tokens: ms.reduce((s, m) => s + m.tokens, 0), pasos: ms.reduce((s, m) => s + m.pasos, 0) + (cambio ? 1 : 0),
      despachos: ms.reduce((s, m) => s + m.despachos, 0), fallos: ms.reduce((s, m) => s + m.fallos, 0), ramas: [], estado: peorEstado([...ms.map((m) => m.estado), ...(revisionFallida(a.revisiones.get(x.split(":")[1])) ? ["fallida" as const] : [])]), miembros: ms.map((m) => m.workflow_execution_id),
    }
    return g
  })
  return { ...l, total: Math.max(corridas.length, l.total - quitadas), corridas }
}

/** ─── la traza de un pedido: un árbol con cada paso en orden, nombrado por quién y qué ─── */
const TOK0: Tokens = { entrada: 0, salida: 0, cache_lectura: 0, cache_escritura: 0 }
const estadoDeFila = (e: string | null): string => (!e ? "sin_dato" : /hecho|ok|complet|aplicad|cerrad/i.test(e) ? "completed" : /fall|error/i.test(e) ? "error" : /curso|corr|abiert|pend/i.test(e) ? "running" : e)
export function pasoDeRegistro(id: string, nombre: string, o: { agente?: string | null; inicio?: string | null; fin?: string | null; costo?: number; estado?: string | null; error?: string | null; entrada?: string | null; salida?: string | null }): Paso {
  const inicio = o.inicio ?? o.fin ?? null, fin = o.fin ?? o.inicio ?? null
  return {
    id, origen: "registro", nombre, agente: o.agente ?? null, modelo: null, inicio, fin, duracion_ms: inicio && fin ? Math.max(0, Date.parse(fin) - Date.parse(inicio)) : null, costo_usd: o.costo ?? 0,
    tokens: TOK0, tokens_total: 0, turnos: null, estado: estadoDeFila(o.estado ?? null), error: o.error ?? null, despacho: null,
    entrada: o.entrada ?? null, entrada_recortada: false, salida: o.salida ?? null, salida_total: o.salida ? o.salida.length : null,
  }
}
/** los pasos de una ejecución miembro, ya nombrados (si el empleado dejó fila se usa esa; el encargo solo, si no) */
function pasosDeLaEjecucion(d: DetalleDeCorrida | undefined, nombre: string): Paso[] {
  if (!d) return []
  const todos = d.arbol.flatMap((r) => r.pasos)
  const conFila = todos.filter((p) => p.origen === "invocacion")
  return (conFila.length ? conFila : todos).map((p, i, xs) => ({ ...p, nombre: xs.length > 1 ? `${nombre} (${i + 1})` : nombre }))
}
/** los pasos de la ejecución de planeación: la mesa de análisis en ramas y el redactor en la principal */
function pasosDePlaneacion(d: DetalleDeCorrida | undefined): Paso[] {
  if (!d) return []
  return d.arbol.flatMap((r) => {
    const conFila = r.pasos.filter((p) => p.origen === "invocacion"), ps = conFila.length ? conFila : r.pasos
    const tema = r.rama ? palabras(r.rama.replace(/^[a-z]+[-:]/i, "")) : null
    return ps.map((p) => ({ ...p, nombre: tema ? `${quien(p.agente)} · analiza ${tema}` : `${quien(p.agente) || "Planeación"} · escribe el plan` }))
  })
}
export interface DatosDelPedido {
  clave: string
  revision?: RevisionFila | null; encargo?: EncargoFila | null; cambio?: CambioFila | null
  /** la ejecución de planeación que redactó el plan revisado (plan nuevo, no un pedido de cambios) */
  planeacion?: string | null
  pasos: PasoDeGrupo[]
  /** ejecución → su detalle (lo que entregó la plataforma) */
  detalles: Map<string, DetalleDeCorrida>
  /** cuántas ejecuciones miembro se esperaban (si alguna no se pudo leer, la traza dice «incompleta») */
  esperadas: number
  cliente: { client_id: string | null; cliente: string | null }
}
export function trazaDelPedido(x: DatosDelPedido): DetalleDeCorrida {
  const [tipo] = x.clave.split(":")
  const lista: Paso[] = []
  if (x.cambio) {
    lista.push(pasoDeRegistro(`cambio:${x.cambio.id}`, "Dueño · pide cambios al plan", { inicio: x.cambio.creado_en, estado: "hecho", entrada: x.cambio.texto }))
    if (x.cambio.workflow_execution_id) lista.push(...pasosDeLaEjecucion(x.detalles.get(x.cambio.workflow_execution_id), "Planeación · encarga el plan nuevo a la jefatura"))
  }
  const usadas = new Set<string>()
  if (x.planeacion && !x.cambio) { lista.push(...pasosDePlaneacion(x.detalles.get(x.planeacion))); usadas.add(x.planeacion) }
  for (const p of [...x.pasos].sort((a, b) => a.n - b.n)) {
    const nombre = tipo === "pedido" ? nombreDelPasoDeJefatura(p.paso, p.agente, x.revision?.artifact_type ?? null) : nombreDelTurno(p.paso, p.tipo, p.agente)
    let ej = p.workflow_execution_id
    if (!ej && tipo === "pedido" && p.paso === "segunda_mirada") ej = [...x.detalles.keys()].find((k) => k === `gpt-jefatura-${x.clave.split(":")[1]}-${p.n}`) ?? null
    const delMiembro = ej ? pasosDeLaEjecucion(x.detalles.get(ej), nombre) : []
    if (ej) usadas.add(ej)
    lista.push(...(delMiembro.length ? delMiembro : [pasoDeRegistro(`paso:${x.clave}:${p.n}`, nombre, { agente: p.agente, inicio: p.inicio, fin: p.fin, costo: p.cost_usd, estado: p.estado, error: p.error })]))
  }
  // revisores externos de la oficina (no tienen fila propia en los turnos) y cualquier ejecución miembro que no haya quedado nombrada
  for (const [ej, d] of x.detalles) {
    if (usadas.has(ej) || ej === x.cambio?.workflow_execution_id) continue
    lista.push(...pasosDeLaEjecucion(d, GPT_DE_GRUPO.test(ej) ? "Revisor externo · segunda mirada" : d.corrida.nombre))
  }
  if (x.revision?.cerrado_en) lista.push(pasoDeRegistro(`cierre:${x.revision.id}`, `Jefatura · cierra la revisión${x.revision.resultado ? ` (${palabras(x.revision.resultado)})` : ""}`, { inicio: x.revision.cerrado_en, estado: "hecho" }))
  if (x.cambio?.plan_nuevo_id) lista.push(pasoDeRegistro(`plan:${x.cambio.plan_nuevo_id}`, "Planeación · guarda el plan nuevo", { inicio: x.cambio.actualizado_en, estado: x.cambio.estado, salida: `Plan nuevo guardado (${x.cambio.estado ?? "sin estado"}).` }))
  if (x.encargo?.cerrado_en && !x.pasos.some((p) => p.paso === "cierre")) lista.push(pasoDeRegistro(`cierre:${x.encargo.id}`, "Cierra el encargo", { inicio: x.encargo.cerrado_en, estado: x.encargo.estado }))
  lista.sort((a, b) => (a.inicio ?? "").localeCompare(b.inicio ?? ""))
  const ini = lista.map((p) => p.inicio).filter((v): v is string => !!v).sort()
  const fines = lista.map((p) => p.fin).filter((v): v is string => !!v).sort()
  const miembros = [...x.detalles.values()].map((d) => d.corrida)
  const vivo = miembros.some((m) => m.estado === "en_curso" || m.estado === "atascada")
  const inicio = ini[0] ?? null, fin = vivo ? null : fines[fines.length - 1] ?? null
  const corrida: Corrida = {
    workflow_execution_id: x.clave, workflow_id: null, nombre: nombreDelGrupo(x.clave, { revisiones: new Map(x.revision ? [[x.revision.id, x.revision]] : []), encargos: new Map(x.encargo ? [[x.encargo.id, x.encargo]] : []), cambioDe: new Map(x.cambio && x.revision ? [[x.revision.id, x.cambio]] : []), planeacionDe: new Map(x.planeacion && x.revision ? [[x.revision.id, x.planeacion]] : []) }),
    nombre_tecnico: `${tipo === "pedido" ? "jefatura_revisiones" : "oficina_encargos"} ${x.clave.split(":")[1]}${x.cambio ? ` · plan_cambios ${x.cambio.id}` : ""} · ejecuciones ${[...x.detalles.keys()].join(", ") || "ninguna"}`,
    interno: false, client_id: x.cliente.client_id, cliente: x.cliente.cliente, inicio, fin, duracion_ms: inicio && fin ? Date.parse(fin) - Date.parse(inicio) : null,
    costo_usd: lista.reduce((s, p) => s + p.costo_usd, 0), tokens: lista.reduce((s, p) => s + p.tokens_total, 0), pasos: lista.length, despachos: 0,
    fallos: lista.filter((p) => /error|fail/i.test(p.estado) || !!p.error).length, ramas: [], estado: peorEstado([...miembros.map((m) => m.estado), ...(revisionFallida(x.revision ?? undefined) ? ["fallida" as const] : [])]), miembros: [...x.detalles.keys()],
  }
  return { generado_en: new Date().toISOString(), completo: x.detalles.size >= x.esperadas, corrida, arbol: [{ rama: null, costo_usd: corrida.costo_usd, pasos: lista }], sin_enlace_a_trazas: [...x.detalles.values()][0]?.sin_enlace_a_trazas ?? null }
}

/** ─── servidor: lectura de las tablas que encadenan (solo SELECT) ─── */
type Respuesta = PromiseLike<{ data: unknown[] | null; error: unknown }>
interface Consulta extends Respuesta { in: (k: string, v: string[]) => Consulta; eq: (k: string, v: string) => Consulta; gte: (k: string, v: string) => Consulta; like: (k: string, v: string) => Consulta; order: (k: string, o?: { ascending?: boolean }) => Consulta; limit: (n: number) => Consulta }
export type BaseDeLectura = { from: (t: string) => { select: (c: string) => Consulta } }
const filas = async (q: Respuesta): Promise<Record<string, unknown>[] | null> => { try { const { data, error } = await q; return error || !Array.isArray(data) ? null : data.map(obj) } catch { return null } }
const COL_PASO = "n, paso, tipo, agente, estado, workflow_execution_id, cost_usd, inicio, fin, error"
const pasoDeFila = (grupo: string, f: Record<string, unknown>): PasoDeGrupo => ({ grupo, n: num(f.n), paso: txt(f.paso) ?? "paso", tipo: txt(f.tipo), agente: txt(f.agente), estado: txt(f.estado), workflow_execution_id: txt(f.workflow_execution_id), cost_usd: num(f.cost_usd), inicio: txt(f.inicio), fin: txt(f.fin), error: txt(f.error) })
const revisionDeFila = (f: Record<string, unknown>): RevisionFila => ({ id: String(f.id), client_id: txt(f.client_id), artifact_type: txt(f.artifact_type), artifact_id: txt(f.artifact_id), estado: txt(f.estado), resultado: txt(f.resultado), creado_en: txt(f.creado_en), cerrado_en: txt(f.cerrado_en) })
const cambioDeFila = (f: Record<string, unknown>): CambioFila => ({ id: String(f.id), client_id: txt(f.client_id), texto: txt(f.texto), estado: txt(f.estado), plan_nuevo_id: txt(f.plan_nuevo_id), workflow_execution_id: txt(f.workflow_execution_id), creado_en: txt(f.creado_en), actualizado_en: txt(f.actualizado_en) })
const encargoDeFila = (f: Record<string, unknown>): EncargoFila => ({ id: String(f.id), client_id: txt(f.client_id), tipo_de_grupo: txt(f.tipo_de_grupo), estado: txt(f.estado), creado_en: txt(f.creado_en), cerrado_en: txt(f.cerrado_en) })
const COL_REV = "id, client_id, artifact_type, artifact_id, estado, resultado, creado_en, cerrado_en"
const COL_CAMBIO = "id, client_id, texto, estado, plan_nuevo_id, workflow_execution_id, creado_en, actualizado_en"

async function cambiosPara(db: BaseDeLectura, revs: RevisionFila[]): Promise<Map<string, CambioFila>> {
  const m = new Map<string, CambioFila>()
  const planes = revs.filter((r) => r.artifact_type === "plan" && r.client_id && r.creado_en)
  if (!planes.length) return m
  const desde = new Date(Math.min(...planes.map((r) => Date.parse(r.creado_en as string))) - 6 * 3600_000).toISOString()
  const fs = await filas(db.from("plan_cambios").select(COL_CAMBIO).in("client_id", [...new Set(planes.map((r) => r.client_id as string))]).gte("creado_en", desde).limit(200))
  const cambios = (fs ?? []).map(cambioDeFila)
  for (const r of planes) { const c = cambioDeLaRevision(r, cambios); if (c) m.set(r.id, c) }
  return m
}

/** la planeación que redactó cada plan revisado (llave exacta: la aprobación del plan guarda su ejecución) */
async function planeacionesPara(db: BaseDeLectura, revs: RevisionFila[]): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  const planes = revs.filter((r) => r.artifact_type === "plan" && r.artifact_id && UUID.test(r.artifact_id))
  if (!planes.length) return m
  const fs = await filas(db.from("plan_aprobaciones").select("plan_id, planeacion:sobre_de_reanudacion->>planeacion_execution_id, workflow_execution_id").in("plan_id", [...new Set(planes.map((r) => r.artifact_id as string))]).limit(200))
  const porPlan = new Map((fs ?? []).map((f) => [txt(f.plan_id), txt(f.planeacion) ?? txt(f.workflow_execution_id)] as const))
  for (const r of planes) { const e = porPlan.get(r.artifact_id); if (e) m.set(r.id, e) }
  return m
}

/** para la lista: qué ejecuciones pertenecen a qué pedido. `null` = no se pudo leer (la lista queda sin agrupar y se dice) */
export async function leerAgrupacion(db: BaseDeLectura, ejecuciones: string[]): Promise<Agrupacion | null> {
  const grupoDe = new Map<string, string>(), revIds = new Set<string>(), encIds = new Set<string>()
  const planas = [...new Set(ejecuciones.filter((e) => !GPT_DE_GRUPO.test(e)))].slice(0, 500)
  for (const e of ejecuciones) { const m = e.match(GPT_DE_GRUPO); if (m) { const tipo: TipoDePedido = m[1].toLowerCase() === "jefatura" ? "pedido" : "encargo"; grupoDe.set(e, claveDeGrupo(tipo, m[2].toLowerCase())); (tipo === "pedido" ? revIds : encIds).add(m[2].toLowerCase()) } }
  const [jp, ot] = planas.length ? await Promise.all([
    filas(db.from("jefatura_pasos").select("revision_id, workflow_execution_id").in("workflow_execution_id", planas).limit(2000)),
    filas(db.from("oficina_turnos").select("encargo_id, workflow_execution_id").in("workflow_execution_id", planas).limit(2000)),
  ]) : [[], []]
  if (!jp || !ot) return null
  for (const f of jp) { const r = txt(f.revision_id), e = txt(f.workflow_execution_id); if (r && e && UUID.test(r)) { grupoDe.set(e, claveDeGrupo("pedido", r)); revIds.add(r) } }
  for (const f of ot) { const r = txt(f.encargo_id), e = txt(f.workflow_execution_id); if (r && e && UUID.test(r) && !grupoDe.has(e)) { grupoDe.set(e, claveDeGrupo("encargo", r)); encIds.add(r) } }
  const [rv, en] = await Promise.all([
    revIds.size ? filas(db.from("jefatura_revisiones").select(COL_REV).in("id", [...revIds]).limit(500)) : Promise.resolve([]),
    encIds.size ? filas(db.from("oficina_encargos").select("id, client_id, tipo_de_grupo, estado, creado_en, cerrado_en").in("id", [...encIds]).limit(500)) : Promise.resolve([]),
  ])
  const revisiones = new Map((rv ?? []).map((f) => { const r = revisionDeFila(f); return [r.id, r] as const }))
  const encargos = new Map((en ?? []).map((f) => { const e = encargoDeFila(f); return [e.id, e] as const }))
  const [cambioDe, planeacionDe] = await Promise.all([cambiosPara(db, [...revisiones.values()]), planeacionesPara(db, [...revisiones.values()])])
  for (const [rev, e] of planeacionDe) if (!cambioDe.has(rev) && !grupoDe.has(e)) grupoDe.set(e, claveDeGrupo("pedido", rev))
  // la ejecución de planeación que abrió el pedido del dueño también es parte del pedido
  for (const [rev, c] of cambioDe) if (c.workflow_execution_id && !grupoDe.has(c.workflow_execution_id)) grupoDe.set(c.workflow_execution_id, claveDeGrupo("pedido", rev))
  // los turnos sueltos (sin revisión ni encargo): se nombran por el empleado que se les encargó
  const TURNOS: Record<string, "jefatura" | "oficina"> = { o8qaF7bI0PKv2XGZ: "jefatura", bTbWL9lUvQCfStAz: "oficina" }
  const sueltas = planas.filter((e) => !grupoDe.has(e))
  const agenteSuelto = new Map<string, { agente: string; proceso: "jefatura" | "oficina" }>()
  if (sueltas.length) {
    const ds = await filas(db.from("agent_dispatches").select("workflow_id, workflow_execution_id, agent_name").in("workflow_execution_id", sueltas).in("workflow_id", Object.keys(TURNOS)).limit(1000))
    for (const f of ds ?? []) { const e = txt(f.workflow_execution_id), ag = txt(f.agent_name), w = txt(f.workflow_id); if (e && ag && w && TURNOS[w] && !agenteSuelto.has(e)) agenteSuelto.set(e, { agente: ag, proceso: TURNOS[w] }) }
  }
  return { grupoDe, revisiones, encargos, cambioDe, planeacionDe, agenteSuelto }
}

/** para la traza: todo lo de UN pedido. `leerEjecucion` trae el detalle de cada ejecución miembro (la ruta certificada de la plataforma) */
export async function leerDatosDelPedido(db: BaseDeLectura, clave: string, leerEjecucion: (id: string) => Promise<DetalleDeCorrida | null>): Promise<DatosDelPedido | null> {
  if (!esClaveDeGrupo(clave)) return null
  const [tipo, id] = clave.split(":") as [TipoDePedido, string]
  if (tipo === "pedido") {
    const [rv, ps, gpt] = await Promise.all([
      filas(db.from("jefatura_revisiones").select(COL_REV).eq("id", id).limit(1)),
      filas(db.from("jefatura_pasos").select(COL_PASO).eq("revision_id", id).order("n").limit(200)),
      filas(db.from("agent_invocations").select("workflow_execution_id").like("workflow_execution_id", `gpt-jefatura-${id}-%`).limit(50)),
    ])
    if (!rv || !rv.length || !ps) return null
    const revision = revisionDeFila(rv[0])
    const [cambios, planeaciones] = await Promise.all([cambiosPara(db, [revision]), planeacionesPara(db, [revision])])
    const cambio = cambios.get(revision.id) ?? null, planeacion = cambio ? null : planeaciones.get(revision.id) ?? null
    const pasos = ps.map((f) => pasoDeFila(clave, f))
    const ejecuciones = new Set([...pasos.map((p) => p.workflow_execution_id), ...(gpt ?? []).map((f) => txt(f.workflow_execution_id)), cambio?.workflow_execution_id ?? null, planeacion].filter((v): v is string => !!v))
    const detalles = await detallesDe([...ejecuciones], leerEjecucion)
    const uno = [...detalles.values()].find((d) => d.corrida.cliente)
    return { clave, revision, cambio, planeacion, pasos, detalles, esperadas: ejecuciones.size, cliente: { client_id: uno?.corrida.client_id ?? revision.client_id, cliente: uno?.corrida.cliente ?? null } }
  }
  const [en, ts, gpt] = await Promise.all([
    filas(db.from("oficina_encargos").select("id, client_id, tipo_de_grupo, estado, creado_en, cerrado_en").eq("id", id).limit(1)),
    filas(db.from("oficina_turnos").select(COL_PASO).eq("encargo_id", id).order("n").limit(300)),
    filas(db.from("agent_invocations").select("workflow_execution_id").like("workflow_execution_id", `gpt-oficina-${id}-%`).limit(50)),
  ])
  if (!en || !en.length || !ts) return null
  const encargo = encargoDeFila(en[0])
  const pasos = ts.map((f) => pasoDeFila(clave, f))
  const ejecuciones = new Set([...pasos.map((p) => p.workflow_execution_id), ...(gpt ?? []).map((f) => txt(f.workflow_execution_id))].filter((v): v is string => !!v))
  const detalles = await detallesDe([...ejecuciones], leerEjecucion)
  const uno = [...detalles.values()].find((d) => d.corrida.cliente)
  return { clave, encargo, pasos, detalles, esperadas: ejecuciones.size, cliente: { client_id: uno?.corrida.client_id ?? encargo.client_id, cliente: uno?.corrida.cliente ?? null } }
}
async function detallesDe(ids: string[], leer: (id: string) => Promise<DetalleDeCorrida | null>): Promise<Map<string, DetalleDeCorrida>> {
  const m = new Map<string, DetalleDeCorrida>()
  const rs = await Promise.all(ids.slice(0, 40).map(async (e) => [e, await leer(e).catch(() => null)] as const))
  for (const [e, d] of rs) if (d) m.set(e, d)
  return m
}
