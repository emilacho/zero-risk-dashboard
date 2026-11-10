/**
 * UNA SOLA FICHA DE DECISIÓN (GO Lenovo 09-nov · boceto aprobado por Emilio 21:18Z: `raw/evidencia/2026-11-09-ficha-de-decision/APROBADO-ficha-v7-completa.png`).
 * Contrato: `DISENO.md` §2 (CC1 plataforma + CC4 tablero), con los 3 ajustes de la v7 (nota CC4→CC1 09-nov): `detiene.que`, «sin fecha límite»
 * explícito (`espera.sin_limite`, CC6) y el texto del enlace del pie sale de esta lista cerrada (no de la oficina).
 * Toda decisión se lee igual: los MISMOS bloques, en el MISMO orden, y lo que no tiene dato muestra un guion rojo (ningún bloque se esconde).
 * Los botones son solo los del vocabulario fijo. La ficha no trae clase ni tipo: el dibujante no puede elegir nada por tipo.
 */
import { decisivoCorto, type AccionDeDecision, type CifraDeFirma, type Decision } from "@/lib/direccion-decisiones"

/** el vocabulario FIJO: las únicas 5 palabras que puede tener un botón de decisión */
export type Verbo = "aprobar" | "pedir_cambios" | "responder" | "asumir" | "descartar"
export const NOMBRE_DEL_VERBO: Record<Verbo, string> = { aprobar: "Aprobar", pedir_cambios: "Pedir cambios", responder: "Responder", asumir: "Asumir", descartar: "Descartar" }
/** el nombre del botón MIENTRAS SALE (CC6 #310 menor 2: la tarjeta vieja decía «Descartando…»/«Enviando…»; no basta `aria-busy`) */
export const NOMBRE_MIENTRAS_SALE: Record<Verbo, string> = { aprobar: "Aprobando…", pedir_cambios: "Enviando…", responder: "Enviando…", asumir: "Asumiendo…", descartar: "Descartando…" }
/** orden de los botones, siempre igual: Descartar a la izquierda, luego Asumir, luego Pedir cambios; la principal (ámbar) siempre a la derecha */
const ORDEN: Record<Verbo, number> = { descartar: 0, asumir: 1, pedir_cambios: 2, responder: 3, aprobar: 3 }
/** cómo se contesta hoy cada verbo (la puerta del servidor del tablero: `/api/direccion/decisiones/contestar`). Sin puerta, no hay botón */
export const ACCION_DEL_VERBO: Record<Verbo, AccionDeDecision | null> = { aprobar: "aceptar", responder: "responder", asumir: "asumir", descartar: "descartar", pedir_cambios: null }
/** al revés: qué verbo está saliendo cuando el panel contesta una acción de hoy */
export const VERBO_DE_LA_ACCION: Partial<Record<AccionDeDecision, Verbo>> = { aceptar: "aprobar", responder: "responder", asumir: "asumir", descartar: "descartar" }
/** T1: las decisiones que el tablero ya dibuja con la ficha (las demás siguen en la tarjeta de siempre hasta el T2) */
export const esPregunta = (d: Pick<Decision, "tipo" | "cifras">): boolean => (d.tipo === "pregunta_al_dueno" || d.tipo === "pregunta_de_finanzas") && !d.cifras?.length
/** la lista CERRADA de puertas que una ficha puede nombrar (regla 1 del contrato: un nombre, nunca una dirección). Una puerta desconocida no da botón */
/** la MISMA lista que `DESTINOS` de la plataforma (CC1 #959 T0): una prueba lo exige */
export const PUERTAS_DE_LA_FICHA = ["firmar-tablero", "recalcular-tablero", "plan-aprobar", "plan-cambios", "revision-resolver", "dueno-preguntas"] as const
export type Puerta = (typeof PUERTAS_DE_LA_FICHA)[number]

/** las pantallas donde se hace lo que no cabe en la ficha (ADENDA 2 de Emilio). El texto del enlace sale de aquí, nunca de la oficina */
export type Pantalla = "plan" | "piezas" | "gran_idea" | "manual"
/** `propio`: nombre propio del sistema fijado por Emilio (mayúscula en cada palabra principal y línea dorada). Los demás, pendientes de su nombre */
/** `en`: cómo se dice «Se decide en …» (CC6 #321 opción a: lo que se decide en otra pantalla no «solo avisa») */
export const NOMBRE_DE_LA_PANTALLA: Record<Pantalla, { ir: string; en: string; nombre: string; propio: boolean }> = {
  plan: { ir: "Ir al", en: "en el", nombre: "Plan de Marketing", propio: true }, piezas: { ir: "Ir a", en: "en", nombre: "Piezas", propio: false }, gran_idea: { ir: "Ir a la", en: "en la", nombre: "Gran idea", propio: false }, manual: { ir: "Ir al", en: "en el", nombre: "Manual de marca", propio: false },
}
/** NOMBRES PROPIOS DEL SISTEMA (Emilio, 09-nov · regla del estilo base): mayúscula en cada palabra principal; dentro del texto, una línea dorada sutil debajo.
 *  Uno nuevo se agrega aquí solo con el nombre que dio Emilio (si no está definido, se pregunta por Lenovo; no se inventa) */
export const NOMBRES_PROPIOS: readonly string[] = ["Plan de Marketing", "Campaña de Marketing", "Tablero Financiero", "Oficina Financiera", "Departamento de Marketing", "Departamento de Finanzas"]

/** LOS DEPARTAMENTOS (Emilio, 09-nov 23:29Z): sus únicos nombres son estos, completos. Si no caben, «Marketing» o «Finanzas»; nunca «Financiero» ni «Plan de 90 días».
 *  T2: el nombre llega en la ficha de la plataforma (CC1, de una tabla única); esto es lo del tablero mientras tanto */
export type ClaveDeDepartamento = "marketing" | "finanzas"
export const NOMBRE_DEL_DEPARTAMENTO: Record<ClaveDeDepartamento, string> = { marketing: "Departamento de Marketing", finanzas: "Departamento de Finanzas" }
export const NOMBRE_CORTO_DEL_DEPARTAMENTO: Record<ClaveDeDepartamento, string> = { marketing: "Marketing", finanzas: "Finanzas" }
/** de qué departamento es cada oficina que pregunta (\`dueno_preguntas.oficina\`). Planeación, la Oficina Creativa y Revisión trabajan dentro de Marketing (Lenovo 09-nov) */
const DEPARTAMENTO_DE_LA_OFICINA: Record<string, ClaveDeDepartamento> = {
  financiera: "finanzas", finanzas: "finanzas", marketing: "marketing", planeacion: "marketing", creativa: "marketing", revision: "marketing",
}
export function departamentoDeLaOficina(oficina: string | null | undefined): ClaveDeDepartamento | null {
  const k = String(oficina ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/^oficina[\s_-]+(de[\s_-]+)?/, "").replace(/[\s_-]+oficina$/, "").trim()
  return DEPARTAMENTO_DE_LA_OFICINA[k] ?? DEPARTAMENTO_DE_LA_OFICINA[k.split(/[\s_-]+/)[0] ?? ""] ?? null
}

export interface Accion {
  verbo: Verbo
  /** una sola por ficha: el botón ámbar */
  principal?: true
  /** qué escribe el dueño antes; si es obligatorio, lo dice la oficina */
  pide?: { que: "texto" | "motivo"; obligatorio: boolean }
  /** la oficina SOLO puede agregar una nota; si gasta o no lo decide la puerta */
  nota_de_gasto?: string
  destino: string
}
export interface FichaDeDecision {
  version: 1
  id: string
  cuenta: { client_id: string | null; nombre: string } | null
  departamento: { oficina: string; nombre: string; agente?: string }
  que_se_decide: string
  decisivo?: Array<{ corto: string; largo: string }>
  uso?: { corto?: string; largo: string }
  desbloquea?: { corto?: string; largo: string }
  /** v7: qué se detiene («el plan»); sin el campo no hay rótulo */
  detiene?: { que: string }
  propuesta?: { cifras?: CifraDeFirma[]; supuesto?: string; al_cambiar?: string }
  /** v7 + CC6: «no vence» es EXPLÍCITO (`sin_limite: true`, «Sin fecha límite»). `vence` null o ausente sin `sin_limite` = no se sabe (guion rojo) */
  espera: { desde: string | null; vence?: string | null; sin_limite?: true; al_vencer?: string; /** la versión de lo que se decide: a la derecha de la fecha (CC1 #969) */ version_del_documento?: number; /** ya pasó su fecha límite: «· vencida» junto a Vence (como la tarjeta de antes · CC6 #321) */ vencida?: true }
  costo?: { usd?: number; nota: string }
  origen: { fuente: string; ref: string }
  acciones: Accion[]
  donde_se_hace?: { pantalla: Pantalla }
}

const VERBOS = new Set<string>(Object.keys(NOMBRE_DEL_VERBO))
const PUERTAS = new Set<string>(PUERTAS_DE_LA_FICHA)
const PANTALLAS = new Set<string>(Object.keys(NOMBRE_DE_LA_PANTALLA))

/** la ficha se revisa ENTERA: con 4 acciones, 2 principales, un verbo fuera del vocabulario o una pantalla desconocida se rechaza (no se recorta).
 *  Una acción cuya puerta no está en la lista cerrada, o que hoy no tiene puerta en el tablero, se omite y queda constancia (nunca un botón falso) */
export function revisarFicha(f: FichaDeDecision): { ok: true; acciones: Accion[]; omitidas: Accion[] } | { ok: false; motivo: string } {
  if (f.version !== 1) return { ok: false, motivo: "versión de ficha desconocida" }
  if (!f.que_se_decide?.trim()) return { ok: false, motivo: "falta qué se decide" }
  if (f.acciones.length > 3) return { ok: false, motivo: "más de 3 acciones" }
  if (f.acciones.filter((a) => a.principal).length > 1) return { ok: false, motivo: "más de una acción principal" }
  if (f.acciones.some((a) => !VERBOS.has(a.verbo))) return { ok: false, motivo: "un botón fuera del vocabulario fijo" }
  if (new Set(f.acciones.map((a) => a.verbo)).size !== f.acciones.length) return { ok: false, motivo: "un verbo repetido" }
  if (f.donde_se_hace && !PANTALLAS.has(f.donde_se_hace.pantalla)) return { ok: false, motivo: "una pantalla desconocida" }
  const sirven = (a: Accion) => PUERTAS.has(a.destino) && ACCION_DEL_VERBO[a.verbo] !== null
  const acciones = f.acciones.filter(sirven).sort((a, b) => (a.principal ? 9 : ORDEN[a.verbo]) - (b.principal ? 9 : ORDEN[b.verbo]))
  return { ok: true, acciones, omitidas: f.acciones.filter((a) => !sirven(a)) }
}

/** parte un texto en trozos y marca los nombres propios del sistema (sin importar cómo vinieron escritos: salen con su mayúscula) */
export function conNombresPropios(texto: string): Array<{ texto: string; propio: boolean }> {
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const patron = new RegExp(`(${[...NOMBRES_PROPIOS].sort((a, b) => b.length - a.length).map(escapar).join("|")})`, "giu")
  const canon = new Map(NOMBRES_PROPIOS.map((n) => [n.toLocaleLowerCase("es"), n]))
  return texto.split(patron).filter((t) => t !== "").map((t) => { const n = canon.get(t.toLocaleLowerCase("es")); return n ? { texto: n, propio: true } : { texto: t, propio: false } })
}

/** el nombre de la oficina en la fila de cuenta y departamento: si es nombre propio, con su mayúscula (en esa fila sin línea) */
export const nombrePropioO = (t: string): string => conNombresPropios(t).map((p) => p.texto).join("")

/** T1 · TRADUCTOR DEL TABLERO (solo las preguntas; las demás siguen en la tarjeta de siempre hasta el T2). Si la plataforma ya manda `ficha`, manda la suya.
 *  Nada se inventa: lo que la fila no trae, la ficha no lo trae, y el dibujante pone el guion rojo */
export function fichaDeLaPregunta(d: Decision, x: { departamento: string; detiene: boolean; destraba: string | null; destrabaCorto?: string | null; conAsumir: boolean; responder: boolean; descartar: boolean }): FichaDeDecision {
  const acciones: Accion[] = [
    ...(x.descartar ? [{ verbo: "descartar" as const, pide: { que: "motivo" as const, obligatorio: false }, destino: "dueno-preguntas" }] : []),
    ...(x.conAsumir ? [{ verbo: "asumir" as const, destino: "dueno-preguntas" }] : []),
    ...(x.responder ? [{ verbo: "responder" as const, principal: true as const, pide: { que: "texto" as const, obligatorio: true }, destino: "dueno-preguntas" }] : []),
  ]
  return {
    version: 1, id: d.id,
    cuenta: d.cliente ? { client_id: d.client_id, nombre: d.cliente } : null,
    departamento: { oficina: d.pregunta_de?.oficina ?? d.fuente ?? "", nombre: x.departamento, ...(d.pregunta_de?.agente ? { agente: d.pregunta_de.agente } : {}) },
    que_se_decide: d.titulo,
    ...(d.criticos?.length ? { decisivo: d.criticos.map((c) => ({ corto: decisivoCorto(c).frase, largo: c })) } : {}),
    ...(d.para_que ? { uso: { largo: d.para_que, ...(d.para_que_corto ? { corto: d.para_que_corto } : {}) } } : {}),
    ...(x.destraba ? { desbloquea: { largo: x.destraba, ...(x.destrabaCorto ? { corto: x.destrabaCorto } : d.destraba && d.destraba_corto ? { corto: d.destraba_corto } : {}) } } : {}),
    ...(x.detiene ? { detiene: { que: "el plan" } } : {}),
    ...(d.supuesto ? { propuesta: { supuesto: d.supuesto } } : {}),
    // la pregunta no trae plazo: la fila no lo sabe (guion rojo), salvo que la plataforma mande uno
    espera: { desde: d.desde, ...(d.vence ? { vence: d.vence } : {}), ...(d.vencida && d.vence ? { vencida: true as const } : {}) },
    origen: { fuente: d.fuente ?? "", ref: d.id },
    acciones,
  }
}

/** 10-nov · T2 (SEÑAL Lenovo 01:10Z · DISENO §9): las demás decisiones también por la ficha. La pantalla dueña, traducida a la lista cerrada */
export const PANTALLA_DEL_PANEL: Record<string, Pantalla> = { plan: "plan", gran_idea: "gran_idea", piezas: "piezas", manual: "manual" }
/** las fuentes que declaran que no vencen (como la plataforma, `NO_VENCEN`): el Tablero Financiero se reemplaza solo con una versión nueva (v7 «Sin fecha límite») */
const NO_VENCEN = new Set(["finanzas_tableros"])

/** T2 · TRADUCTOR DEL TABLERO para todo lo que no es pregunta: firma, plan, gran idea, piezas, revisiones, campaña y avisos.
 *  Refleja lo que hoy se ofrece y nada más: «Firmar» pasa a Aprobar; «Cambiar cifra» deja de ser botón (se toca la cifra); lo que se decide en otra
 *  pantalla queda sin verbo y con su enlace «Ir al …». Lo que la fila no trae, la ficha no lo trae (guion rojo) */
export function fichaDeLaDecision(d: Decision, x: { departamento: string; cuenta: string | null; titulo: string; detiene: boolean; destraba: string | null; destrabaCorto?: string | null; acciones: AccionDeDecision[]; panel: string | null }): FichaDeDecision {
  const editar = x.acciones.includes("editar")
  const cifras = (d.cifras ?? []).map((c) => ({ ...c, editable: editar && !!c.editable }))
  const acciones: Accion[] = x.acciones.includes("aceptar") ? [{ verbo: "aprobar", principal: true, destino: "firmar-tablero" }] : []
  const pantalla = x.panel ? PANTALLA_DEL_PANEL[x.panel] : undefined
  return {
    version: 1, id: d.id,
    cuenta: x.cuenta ? { client_id: d.client_id, nombre: x.cuenta } : null,
    departamento: { oficina: d.pregunta_de?.oficina ?? d.fuente ?? "", nombre: x.departamento },
    que_se_decide: x.titulo,
    ...(d.criticos?.length ? { decisivo: d.criticos.map((c) => ({ corto: decisivoCorto(c).frase, largo: c })) } : {}),
    ...(d.para_que ? { uso: { largo: d.para_que, ...(d.para_que_corto ? { corto: d.para_que_corto } : {}) } } : {}),
    ...(x.destraba ? { desbloquea: { largo: x.destraba, ...(x.destrabaCorto ? { corto: x.destrabaCorto } : {}) } } : {}),
    ...(x.detiene ? { detiene: { que: "el plan" } } : {}),
    ...(cifras.length || d.supuesto ? { propuesta: { ...(cifras.length ? { cifras } : {}), ...(d.supuesto ? { supuesto: d.supuesto } : {}), ...(editar && d.al_editar ? { al_cambiar: d.al_editar } : {}) } } : {}),
    espera: { desde: d.desde, ...(d.vence ? { vence: d.vence } : NO_VENCEN.has(d.fuente ?? "") ? { sin_limite: true as const } : {}), ...(d.version_del_documento ? { version_del_documento: d.version_del_documento } : {}), ...(d.vencida && d.vence ? { vencida: true as const } : {}) },
    origen: { fuente: d.fuente ?? "", ref: d.id },
    acciones,
    ...(pantalla ? { donde_se_hace: { pantalla } } : {}),
  }
}
