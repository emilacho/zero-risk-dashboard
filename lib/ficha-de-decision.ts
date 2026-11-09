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
export const NOMBRE_DE_LA_PANTALLA: Record<Pantalla, { ir: string; nombre: string; propio: boolean }> = {
  plan: { ir: "Ir al", nombre: "Plan de Marketing", propio: true }, piezas: { ir: "Ir a", nombre: "Piezas", propio: false }, gran_idea: { ir: "Ir a la", nombre: "Gran idea", propio: false }, manual: { ir: "Ir al", nombre: "Manual de marca", propio: false },
}
/** NOMBRES PROPIOS DEL SISTEMA (Emilio, 09-nov · regla del estilo base): mayúscula en cada palabra principal; dentro del texto, una línea dorada sutil debajo.
 *  Uno nuevo se agrega aquí solo con el nombre que dio Emilio (si no está definido, se pregunta por Lenovo; no se inventa) */
export const NOMBRES_PROPIOS: readonly string[] = ["Plan de Marketing", "Campaña de Marketing", "Tablero Financiero", "Oficina Financiera"]

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
  espera: { desde: string | null; vence?: string | null; sin_limite?: true; al_vencer?: string }
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
export function fichaDeLaPregunta(d: Decision, x: { departamento: string; detiene: boolean; destraba: string | null; conAsumir: boolean; responder: boolean; descartar: boolean }): FichaDeDecision {
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
    ...(x.destraba ? { desbloquea: { largo: x.destraba, ...(d.destraba && d.destraba_corto ? { corto: d.destraba_corto } : {}) } } : {}),
    ...(x.detiene ? { detiene: { que: "el plan" } } : {}),
    ...(d.supuesto ? { propuesta: { supuesto: d.supuesto } } : {}),
    // la pregunta no trae plazo: la fila no lo sabe (guion rojo), salvo que la plataforma mande uno
    espera: { desde: d.desde, ...(d.vence ? { vence: d.vence } : {}) },
    origen: { fuente: d.fuente ?? "", ref: d.id },
    acciones,
  }
}
