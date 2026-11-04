/**
 * CONTESTAR EN TU OFICINA (04-nov · encargo `2026-11-04-ENCARGO-LENOVO-a-CC5-decisiones-se-contestan-en-tu-oficina.md` + adendas · boceto aprobado por Emilio 18:08Z).
 * El tablero NO escribe la base. Cada acción va a la puerta de la plataforma que ya hace ese cambio, con la llave interna (que nunca llega al navegador):
 *   · responder una pregunta  → primero `POST /api/finanzas/responder` (la pausa de la oficina financiera, contrato de CC1 #897); si la pregunta no es de la pausa,
 *                               `POST /api/brain/alimentar/dueno` con `evento:"respuesta"` (contrato de Cerebro, 04-nov). Nunca las dos: si la pausa la tomó, ella ya la guardó.
 *   · descartar una pregunta  → `POST /api/brain/alimentar/dueno` con `evento:"descartar"` (queda «obsoleta» con motivo; nada se borra).
 *   · firmar (aceptar)         → la acción `firmar-tablero` de la plataforma.
 * La decisión se busca de nuevo en el servidor (no se confía en lo que manda la pantalla): si ya no está, otra persona u otro lugar la resolvió.
 * Al cambiar el estado de la fila de origen, la decisión sale de Tu oficina, de la oficina de origen y de la antena a la vez (todos leen esa fila).
 * US$ 0: ninguna de estas puertas llama a un modelo.
 */
import { randomUUID } from "node:crypto"
import { TOPE_MOTIVO, TOPE_RESPUESTA, accionesDe, leerDecisiones, nombreDeOficina, type AccionDeDecision, type Decision } from "@/lib/direccion-decisiones"
import { ejecutarAccion } from "@/lib/tablero-acciones"

export const FLUJO_DE_TU_OFICINA = "tablero-tu-oficina" // el mismo que usa la ruta de la pausa (CC1 #897): aquí no hay flujo detrás, viene del tablero
export const CANAL_DE_TU_OFICINA = "dashboard · Tu oficina"
export { TOPE_MOTIVO, TOPE_RESPUESTA }

/** un paso del registro de la decisión (lo que se muestra en su detalle) */
export interface PasoDelRegistro { cuando: string | null; quien: "oficina" | "tu" | "sistema"; estado: "pregunto" | "respondiste" | "firmaste" | "descartaste" | "guardado" | "retomado" | "espera" | "fallo"; texto: string; cita?: string }
export interface ResultadoDeContestar {
  ok: boolean
  /** true = la fila de origen cambió de estado: sale de todas partes */
  sale: boolean
  /** lo que se le dice a Emilio, en una frase */
  texto: string
  registro: PasoDelRegistro[]
  /** por qué no salió (se muestra en la tarjeta, que se queda) */
  motivo?: string
}
type Fila = Record<string, unknown>
export interface DepsDeContestar { plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch; ahora?: () => Date; revisor: string; leer?: typeof leerDecisiones; firmar?: typeof ejecutarAccion; id?: () => string }

const sinBarra = (u: string) => u.replace(/\/+$/, "")
const txt = (v: unknown): string => (typeof v === "string" ? v.trim() : "")
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

async function llamar(d: DepsDeContestar, ruta: string, metodo: "GET" | "POST", cuerpo?: Fila): Promise<{ status: number; j: Fila }> {
  const base = sinBarra(d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  const r = await (d.fetchImpl ?? fetch)(`${base}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", "x-api-key": llave }, cache: "no-store", ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}) })
  const t = await r.text().catch(() => "")
  let j: Fila = {}
  try { const x = JSON.parse(t); if (x && typeof x === "object" && !Array.isArray(x)) j = x as Fila } catch { j = { detalle: t.slice(0, 300) } }
  return { status: r.status, j }
}

/** quién preguntó cada pregunta pendiente de un cliente (la puerta del dueño lo guarda: oficina + empleado). null = no se pudo leer */
export async function quienPregunto(d: Omit<DepsDeContestar, "revisor">, clientId: string): Promise<Map<string, { oficina: string; agente: string | null }> | null> {
  try {
    const { status, j } = await llamar({ ...d, revisor: "" }, `/api/brain/alimentar/dueno?client_id=${encodeURIComponent(clientId)}&limite=100`, "GET")
    if (status !== 200 || j.apagado === true || !Array.isArray(j.pendientes)) return null
    const m = new Map<string, { oficina: string; agente: string | null }>()
    for (const p of j.pendientes as Fila[]) { const id = txt(p.pregunta_id), oficina = txt(p.oficina); if (id && oficina) m.set(id, { oficina, agente: txt(p.agente) || null }) }
    return m
  } catch { return null }
}

/** la entrada que manda la pantalla, revisada */
export function validarContestar(raw: unknown): { ok: true; id: string; accion: AccionDeDecision; respuesta: string; motivo: string } | { ok: false; detalle: string } {
  const b = (raw && typeof raw === "object" ? raw : {}) as Fila
  const id = txt(b.id), accion = txt(b.accion) as AccionDeDecision, respuesta = txt(b.respuesta), motivo = txt(b.motivo)
  if (!id || id.length > 200) return { ok: false, detalle: "Falta la decisión que contestas." }
  if (!["aceptar", "editar", "responder", "descartar"].includes(accion)) return { ok: false, detalle: "Esa acción no existe." }
  if (accion === "responder" && !respuesta) return { ok: false, detalle: "Escribe tu respuesta." }
  if (respuesta.length > TOPE_RESPUESTA) return { ok: false, detalle: `La respuesta va hasta ${TOPE_RESPUESTA.toLocaleString("es-EC")} letras.` }
  if (motivo.length > TOPE_MOTIVO) return { ok: false, detalle: `El motivo va hasta ${TOPE_MOTIVO} letras.` }
  return { ok: true, id, accion, respuesta, motivo }
}

const pregunto = (dec: Decision, quien: { oficina: string } | null): PasoDelRegistro => ({ cuando: dec.desde, quien: "oficina", estado: "pregunto", texto: quien ? `Preguntó: ${nombreDeOficina(quien.oficina)}` : "La pregunta llegó a Tu oficina" })
const fallo = (registro: PasoDelRegistro[], motivo: string, ahora: string): ResultadoDeContestar => ({ ok: false, sale: false, texto: "No salió: sigue en tu lista.", motivo, registro: [...registro, { cuando: ahora, quien: "sistema", estado: "fallo", texto: motivo }] })

/** después de actuar, se lee de nuevo: «sale» solo si la fila de origen de verdad dejó de estar pendiente (la misma lectura que usan la oficina y la antena) */
async function confirmarQueSalio(d: DepsDeContestar, id: string, r: ResultadoDeContestar): Promise<ResultadoDeContestar> {
  if (!r.ok || !r.sale) return r
  const l = await (d.leer ?? leerDecisiones)({ plataformaUrl: d.plataformaUrl, llave: d.llave, fetchImpl: d.fetchImpl }).catch(() => null)
  if (!l || !l.ok) return r // no se pudo confirmar: la próxima lectura lo dirá
  if (!l.datos.decisiones.some((x) => x.id === id)) return r
  return { ...r, sale: false, motivo: "Se guardó, pero la decisión sigue abierta en su oficina: por eso sigue en tu lista.", registro: [...r.registro, { cuando: r.registro.at(-1)?.cuando ?? null, quien: "sistema", estado: "fallo", texto: "La decisión no se cerró en su oficina" }] }
}

export async function contestarDecision(raw: unknown, d: DepsDeContestar): Promise<{ status: number; cuerpo: ResultadoDeContestar | { ok: false; error: string; detalle: string } }> {
  const r = await contestarSinConfirmar(raw, d)
  if (r.status !== 200 || !("registro" in r.cuerpo)) return r
  const v = validarContestar(raw)
  return { status: 200, cuerpo: await confirmarQueSalio(d, v.ok ? v.id : "", r.cuerpo) }
}

async function contestarSinConfirmar(raw: unknown, d: DepsDeContestar): Promise<{ status: number; cuerpo: ResultadoDeContestar | { ok: false; error: string; detalle: string } }> {
  const v = validarContestar(raw)
  if (!v.ok) return { status: 400, cuerpo: { ok: false, error: "entrada_invalida", detalle: v.detalle } }
  const lectura = await (d.leer ?? leerDecisiones)({ plataformaUrl: d.plataformaUrl, llave: d.llave, fetchImpl: d.fetchImpl })
  if (!lectura.ok) return { status: 502, cuerpo: { ok: false, error: "sin_lectura", detalle: "No pude confirmar que la decisión sigue pendiente: no se hizo nada." } }
  const dec = lectura.datos.decisiones.find((x) => x.id === v.id)
  if (!dec) return { status: 409, cuerpo: { ok: false, error: "ya_no_esta", detalle: "Esta decisión ya no está pendiente: se resolvió en otro lugar." } }
  if (!accionesDe(dec).includes(v.accion)) return { status: 409, cuerpo: { ok: false, error: "accion_no_permitida", detalle: "Esta decisión no se contesta así." } }
  const ahora = (d.ahora ?? (() => new Date()))().toISOString()
  const ejecucion = `tablero:${(d.id ?? randomUUID)()}`

  try {
    if (dec.tipo === "firma_de_finanzas" && v.accion === "aceptar") {
      const base: PasoDelRegistro[] = [{ cuando: dec.desde, quien: "oficina", estado: "pregunto", texto: "La oficina financiera pidió tu firma" }]
      const r = await (d.firmar ?? ejecutarAccion)("firmar-tablero", { tablero_id: dec.id }, { revisor: d.revisor, plataformaUrl: d.plataformaUrl, llave: d.llave, fetchImpl: d.fetchImpl })
      if (r.status !== 200 || r.cuerpo.ok !== true) return { status: 200, cuerpo: fallo(base, `La firma no se guardó: ${txt(r.cuerpo.detalle) || "la plataforma no la aceptó"}.`, ahora) }
      return { status: 200, cuerpo: { ok: true, sale: true, texto: "Firmado.", registro: [...base, { cuando: ahora, quien: "tu", estado: "firmaste", texto: "Firmaste el tablero financiero" }, { cuando: ahora, quien: "sistema", estado: "guardado", texto: "El tablero quedó firmado" }] } }
    }

    if (dec.tipo !== "pregunta_al_dueno" || !dec.client_id) return { status: 409, cuerpo: { ok: false, error: "accion_no_permitida", detalle: "Esta decisión no se contesta así." } }
    const quienes = await quienPregunto(d, dec.client_id)
    const quien = quienes?.get(dec.id) ?? dec.pregunta_de ?? null
    const base = [pregunto(dec, quien)]

    if (v.accion === "descartar") {
      const motivo = (v.motivo ? `Emilio la descartó en Tu oficina: ${v.motivo}` : "Emilio la descartó en Tu oficina").slice(0, TOPE_MOTIVO)
      const { status, j } = await llamar(d, "/api/brain/alimentar/dueno", "POST", { evento: "descartar", client_id: dec.client_id, pregunta_id: dec.id, motivo, dry_run: false, workflow_id: FLUJO_DE_TU_OFICINA, workflow_execution_id: ejecucion })
      if (status !== 200 || j.ok !== true || j.apagado === true) return { status: 200, cuerpo: fallo(base, `No se pudo descartar: ${txt(j.detalle) || txt(j.error) || `la plataforma respondió ${status}`}.`, ahora) }
      if (Number(j.descartadas ?? 0) < 1) return { status: 200, cuerpo: fallo(base, "La pregunta ya no estaba pendiente en el cerebro.", ahora) }
      return { status: 200, cuerpo: { ok: true, sale: true, texto: "Descartada.", registro: [...base, { cuando: ahora, quien: "tu", estado: "descartaste", texto: v.motivo ? `La descartaste: ${v.motivo}` : "La descartaste" }, { cuando: ahora, quien: "sistema", estado: "guardado", texto: "Quedó archivada como obsoleta; nada se borró" }] } }
    }

    // responder: 1) la pausa de la oficina financiera; 2) si no es suya, la puerta del dueño
    const tema = dec.subtipo ?? ""
    const tu: PasoDelRegistro = { cuando: ahora, quien: "tu", estado: "respondiste", texto: "Respondiste", cita: v.respuesta }
    const pausa = await llamar(d, "/api/finanzas/responder", "POST", { client_id: dec.client_id, tema, respuesta: v.respuesta, quien: d.revisor })
    if (pausa.status !== 200 && pausa.status !== 404 && pausa.status !== 405) return { status: 200, cuerpo: fallo(base, `La oficina financiera no pudo leer tu respuesta (${pausa.status}). No se guardó en ningún lado: vuelve a enviarla.`, ahora) }
    if (pausa.status === 200 && pausa.j.es_de_la_pausa === true) {
      const faltan = Array.isArray(pausa.j.faltan) ? pausa.j.faltan.length : 0
      const pasos: PasoDelRegistro[] = [...base, tu]
      if (pausa.j.en_el_cerebro === true) pasos.push({ cuando: ahora, quien: "sistema", estado: "guardado", texto: "Guardó tu respuesta en el cerebro como dato confirmado por ti" })
      pasos.push(pausa.j.soltada === true ? { cuando: ahora, quien: "sistema", estado: "retomado", texto: "El plan siguió con tus respuestas" }
        : { cuando: ahora, quien: "sistema", estado: "espera", texto: faltan ? `El plan sigue cuando contestes ${plural(faltan, "la pregunta que falta", `las ${faltan} que faltan`)}, o solo, 15 minutos después de tu última respuesta` : "El plan sigue solo, 15 minutos después de tu última respuesta" })
      if (pausa.j.en_el_cerebro !== true) return { status: 200, cuerpo: { ok: true, sale: false, texto: "El plan ya usa tu respuesta.", motivo: "El cerebro no la recibió: por eso la pregunta sigue en tu lista. Puedes enviarla de nuevo.", registro: [...pasos, { cuando: ahora, quien: "sistema", estado: "fallo", texto: "El cerebro no recibió la respuesta" }] } }
      return { status: 200, cuerpo: { ok: true, sale: true, texto: "Contestada.", registro: pasos } }
    }
    if (!quien) return { status: 200, cuerpo: fallo(base, "No encontré qué oficina hizo esta pregunta, y el cerebro lo necesita para guardar tu respuesta. No se guardó nada.", ahora) }
    const { status, j } = await llamar(d, "/api/brain/alimentar/dueno", "POST", {
      evento: "respuesta", client_id: dec.client_id, pregunta_id: dec.id, tema: tema.slice(0, 80), pregunta: (dec.titulo_interno ?? dec.titulo).slice(0, 1000), respuesta: v.respuesta,
      canal: CANAL_DE_TU_OFICINA, mensaje_ref: `oficina:${dec.id}`, respondido_en: ahora, preguntado_por: { oficina: quien.oficina, agente: quien.agente ?? quien.oficina },
      dry_run: false, workflow_id: FLUJO_DE_TU_OFICINA, workflow_execution_id: ejecucion,
    })
    if (status !== 200 || j.ok !== true || j.apagado === true) return { status: 200, cuerpo: fallo([...base, tu], `El cerebro no guardó tu respuesta: ${txt(j.detalle) || txt(j.error) || `respondió ${status}`}.`, ahora) }
    return { status: 200, cuerpo: { ok: true, sale: true, texto: "Contestada.", registro: [...base, tu, { cuando: ahora, quien: "sistema", estado: "guardado", texto: "Guardó tu respuesta en el cerebro como dato confirmado por ti; todas las oficinas la leen así" }] } }
  } catch (e) {
    return { status: 200, cuerpo: fallo([], `No se pudo contactar a la plataforma: ${e instanceof Error ? e.message : String(e)}. No sé si se guardó: actualiza antes de reintentar.`, ahora) }
  }
}
