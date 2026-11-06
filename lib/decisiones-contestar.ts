/**
 * CONTESTAR EN TU OFICINA (04-nov · encargo `2026-11-04-ENCARGO-LENOVO-a-CC5-decisiones-se-contestan-en-tu-oficina.md` + adendas · boceto aprobado por Emilio 18:08Z).
 * El tablero NO escribe la base. Cada acción va a la puerta de la plataforma que ya hace ese cambio, con la llave interna (que nunca llega al navegador):
 *   · responder una pregunta  → primero `POST /api/finanzas/responder` (la pausa de la oficina financiera, contrato de CC1 #897); si la pregunta no es de la pausa,
 *                               `POST /api/dueno/preguntas` con `accion:"responder"` (la ruta de la plataforma, #939: guarda la ficha en el cerebro y cierra la fila). Nunca las dos.
 *   · descartar una pregunta  → `POST /api/dueno/preguntas` con `accion:"descartar"` (queda «descartada» con motivo; nada se borra).
 *   (06-nov · condición A de CC7 para #939/#940: el tablero deja la puerta del cerebro para las preguntas; la puerta ya no acepta «descartar»)
 *   · firmar (aceptar)         → la acción `firmar-tablero` de la plataforma.
 *   · cambiar una cifra        → `recalcular-tablero` para verla (no firma) y `firmar-tablero` con `cambios`. Lo propuesto sale de la lectura del servidor, nunca de la pantalla.
 * La decisión se busca de nuevo en el servidor (no se confía en lo que manda la pantalla): si ya no está, otra persona u otro lugar la resolvió.
 * Al cambiar el estado de la fila de origen, la decisión sale de Tu oficina, de la oficina de origen y de la antena a la vez (todos leen esa fila).
 * US$ 0: ninguna de estas puertas llama a un modelo.
 */
import { randomUUID } from "node:crypto"
import { TOPE_MOTIVO, TOPE_RESPUESTA, accionesDe, faltaQueLeer, leerCifras, leerDecisiones, nombreDeOficina, textoDeCifra, type AccionDeDecision, type CifraDeFirma, type Decision } from "@/lib/direccion-decisiones"
import { ejecutarAccion } from "@/lib/tablero-acciones"
import { yaQuedoEnElCerebro } from "@/lib/cerebro-dueno"

export const FLUJO_DE_TU_OFICINA = "tablero-tu-oficina" // el mismo que usa la ruta de la pausa (CC1 #897): aquí no hay flujo detrás, viene del tablero
export const CANAL_DE_TU_OFICINA = "dashboard · Tu oficina"
export { TOPE_MOTIVO, TOPE_RESPUESTA }
/** el tope de `pregunta` en la puerta del dueño (`MAX_PREGUNTA`): más larga, la puerta rechaza la respuesta entera */
export const TOPE_PREGUNTA = 600

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
  /** al cambiar una cifra: cómo quedaría todo, antes de firmar */
  recalculo?: { cifras: CifraDeFirma[]; alertas: string[] }
  /** al cambiar una cifra que no cuadra: la más cercana que sí */
  alcanzable?: number
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
    const { status, j } = await llamar({ ...d, revisor: "" }, `/api/dueno/preguntas?client_id=${encodeURIComponent(clientId)}`, "GET")
    if (status !== 200 || j.ok !== true || !Array.isArray(j.pendientes)) return null
    const m = new Map<string, { oficina: string; agente: string | null }>()
    for (const p of j.pendientes as Fila[]) { const id = txt(p.pregunta_id), oficina = txt(p.oficina); if (id && oficina) m.set(id, { oficina, agente: txt(p.agente) || null }) }
    return m
  } catch { return null }
}

/** la entrada que manda la pantalla, revisada */
export type AccionDeContestar = AccionDeDecision | "recalcular"
export function validarContestar(raw: unknown): { ok: true; id: string; accion: AccionDeContestar; respuesta: string; motivo: string; cambio: { clave: string; firmado: number } | null } | { ok: false; detalle: string } {
  const b = (raw && typeof raw === "object" ? raw : {}) as Fila
  const id = txt(b.id), accion = txt(b.accion) as AccionDeContestar, respuesta = txt(b.respuesta), motivo = txt(b.motivo)
  if (!id || id.length > 200) return { ok: false, detalle: "Falta la decisión que contestas." }
  if (!["aceptar", "editar", "recalcular", "responder", "descartar"].includes(accion)) return { ok: false, detalle: "Esa acción no existe." }
  if (accion === "responder" && !respuesta) return { ok: false, detalle: "Escribe tu respuesta." }
  if (respuesta.length > TOPE_RESPUESTA) return { ok: false, detalle: `La respuesta va hasta ${TOPE_RESPUESTA.toLocaleString("es-EC")} letras.` }
  if (motivo.length > TOPE_MOTIVO) return { ok: false, detalle: `El motivo va hasta ${TOPE_MOTIVO} letras.` }
  const c = (b.cambio && typeof b.cambio === "object" ? b.cambio : {}) as Fila
  const cambio = txt(c.clave) && typeof c.firmado === "number" && Number.isFinite(c.firmado) && c.firmado > 0 ? { clave: txt(c.clave), firmado: c.firmado } : null
  if ((accion === "editar" || accion === "recalcular") && !cambio) return { ok: false, detalle: "Escribe la cifra con un número mayor que 0." }
  return { ok: true, id, accion, respuesta, motivo, cambio }
}

/** por qué la plataforma no aceptó el cambio de una cifra, en palabras de negocio (su detalle trae los nombres internos de las cifras) */
const MOTIVO_DEL_CAMBIO: Record<string, string> = {
  presupuesto_no_cuadra: "Con ese dinero el reparto entre canales no cuadra.",
  meta_en_cero: "Con esa cifra la meta de ventas queda en cero: no hay plan que firmar.",
  cifra_demasiado_grande: "Esa cifra da un resultado demasiado grande para guardarlo.",
  cifras_cambiaron: "Las cifras cambiaron desde que abriste esta tarjeta: actualiza y míralas de nuevo.",
  huella_no_coincide: "El tablero cambió desde que lo abriste: actualiza y míralo de nuevo.",
  no_se_puede_recalcular: "Con este tablero no se puede calcular con certeza lo que depende de ese cambio.",
  corrida_viva: "La oficina financiera está trabajando en este cliente: prueba cuando termine.",
  no_esta_sin_firma: "Este tablero ya no espera firma: actualiza.",
  no_es_el_vigente: "Ya hay un tablero más nuevo: actualiza.",
  sin_cambios: "Esa cifra es la misma que propuso la oficina.",
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
  if (faltaQueLeer(dec)) return { status: 409, cuerpo: { ok: false, error: "falta_informacion", detalle: "Esta firma no trae las cifras que se firman: la oficina financiera debe mandarlas. No se firmó." } }
  if (!accionesDe(dec).includes(v.accion === "recalcular" ? "editar" : v.accion)) return { status: 409, cuerpo: { ok: false, error: "accion_no_permitida", detalle: "Esta decisión no se contesta así." } }
  const ahora = (d.ahora ?? (() => new Date()))().toISOString()
  const ejecucion = `tablero:${(d.id ?? randomUUID)()}`

  try {
    if (v.accion === "editar" || v.accion === "recalcular") {
      const cifra = dec.cifras?.find((c) => c.clave === v.cambio?.clave)
      if (!cifra?.editable || !v.cambio) return { status: 409, cuerpo: { ok: false, error: "accion_no_permitida", detalle: "Esa cifra no se puede cambiar." } }
      const cambios = [{ clave: cifra.clave, propuesto: cifra.valor, firmado: v.cambio.firmado }]
      const base: PasoDelRegistro[] = [{ cuando: dec.desde, quien: "oficina", estado: "pregunto", texto: `La oficina financiera propuso: ${cifra.nombre}, ${textoDeCifra(cifra)}` }]
      const r = await (d.firmar ?? ejecutarAccion)(v.accion === "editar" ? "firmar-tablero" : "recalcular-tablero", { tablero_id: dec.id, cambios }, { revisor: d.revisor, plataformaUrl: d.plataformaUrl, llave: d.llave, fetchImpl: d.fetchImpl })
      if (r.status !== 200 || r.cuerpo.ok !== true) {
        const pl = (r.cuerpo.plataforma ?? {}) as Fila
        const motivo = MOTIVO_DEL_CAMBIO[txt(pl.error) || txt(r.cuerpo.plataforma_error)] ?? "La plataforma no aceptó el cambio."
        return { status: 200, cuerpo: { ...fallo(base, v.accion === "editar" ? `No se firmó. ${motivo}` : motivo, ahora), ...(typeof pl.alcanzable === "number" ? { alcanzable: pl.alcanzable } : {}) } }
      }
      const res = (r.cuerpo.resultado ?? {}) as Fila
      const recalculo = { cifras: leerCifras(res.cifras), alertas: Array.isArray(res.alertas) ? res.alertas.filter((x): x is string => typeof x === "string") : [] }
      if (v.accion === "recalcular") return { status: 200, cuerpo: { ok: true, sale: false, texto: "Así quedaría.", registro: [], recalculo } }
      return { status: 200, cuerpo: { ok: true, sale: true, texto: "Firmado.", recalculo, registro: [...base, { cuando: ahora, quien: "tu", estado: "firmaste", texto: `Firmaste con tu cambio: ${cifra.nombre}, ${textoDeCifra({ valor: v.cambio.firmado, unidad: cifra.unidad })}` }, { cuando: ahora, quien: "sistema", estado: "guardado", texto: "El tablero quedó firmado con tu cambio; lo que propuso la oficina se conserva" }] } }
    }
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
      const { status, j } = await llamar(d, "/api/dueno/preguntas", "POST", { accion: "descartar", client_id: dec.client_id, pregunta_id: dec.id, motivo, decidido_por: d.revisor || "emilio", workflow_id: FLUJO_DE_TU_OFICINA, workflow_execution_id: ejecucion })
      if (status === 409) return { status: 200, cuerpo: fallo(base, "La pregunta ya no estaba pendiente: alguien la cerró antes.", ahora) }
      if (status !== 200 || j.ok !== true || j.descartada !== true) return { status: 200, cuerpo: fallo(base, `No se pudo descartar: ${txt(j.detalle) || txt(j.error) || `la plataforma respondió ${status}`}.`, ahora) }
      return { status: 200, cuerpo: { ok: true, sale: true, texto: "Descartada.", registro: [...base, { cuando: ahora, quien: "tu", estado: "descartaste", texto: v.motivo ? `La descartaste: ${v.motivo}` : "La descartaste" }, { cuando: ahora, quien: "sistema", estado: "guardado", texto: "Quedó archivada con tu motivo; nada se borró" }] } }
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
    // la ruta de la plataforma saca de la fila quién preguntó, el tema y la pregunta: el tablero solo dice cuál, qué respondiste y quién
    const { status, j } = await llamar(d, "/api/dueno/preguntas", "POST", {
      accion: "responder", client_id: dec.client_id, pregunta_id: dec.id, respuesta: v.respuesta, decidido_por: d.revisor || "emilio", // CC1 06-nov: vacío = 400 en la ruta
      canal: CANAL_DE_TU_OFICINA, mensaje_ref: `oficina:${dec.id}`, respondido_en: ahora, workflow_id: FLUJO_DE_TU_OFICINA, workflow_execution_id: ejecucion,
    })
    if (status === 409) {
      // CC7 06-nov: tu palabra no se pierde. Si ya quedó en el cerebro, no se repite; si no, va como dato suelto por la puerta del cerebro (como el buzón)
      const cerrada: PasoDelRegistro = { cuando: ahora, quien: "sistema", estado: "guardado", texto: "La pregunta ya la había cerrado otro" }
      if (yaQuedoEnElCerebro(txt(j.detalle))) return { status: 200, cuerpo: { ok: true, sale: true, texto: "Contestada.", registro: [...base, tu, cerrada, { cuando: ahora, quien: "sistema", estado: "guardado", texto: "Tu respuesta ya había quedado en el cerebro" }] } }
      if (!tema) return { status: 200, cuerpo: fallo([...base, tu], "La pregunta ya no estaba pendiente y no tiene tema para guardar tu respuesta como dato suelto. No se guardó.", ahora) }
      const s = await llamar(d, "/api/brain/alimentar/dueno", "POST", {
        evento: "respuesta", client_id: dec.client_id, tema: tema.slice(0, 80), pregunta: (dec.titulo_interno ?? dec.titulo).slice(0, TOPE_PREGUNTA), respuesta: v.respuesta,
        canal: CANAL_DE_TU_OFICINA, mensaje_ref: `oficina:${dec.id}`, respondido_en: ahora, preguntado_por: { oficina: quien?.oficina ?? "dashboard", agente: quien?.agente ?? "emilio" },
        dry_run: false, workflow_id: FLUJO_DE_TU_OFICINA, workflow_execution_id: ejecucion,
      })
      if (s.status !== 200 || s.j.ok !== true || s.j.apagado === true) return { status: 200, cuerpo: fallo([...base, tu], `La pregunta ya no estaba pendiente y tu respuesta tampoco se pudo guardar como dato suelto: ${txt(s.j.detalle) || txt(s.j.error) || `respondió ${s.status}`}.`, ahora) }
      return { status: 200, cuerpo: { ok: true, sale: true, texto: "Contestada.", registro: [...base, tu, cerrada, { cuando: ahora, quien: "sistema", estado: "guardado", texto: "Tu respuesta quedó en el cerebro como dato confirmado por ti" }] } }
    }
    if (status !== 200 || j.ok !== true || j.guardada !== true) return { status: 200, cuerpo: fallo([...base, tu], `El cerebro no guardó tu respuesta: ${txt(j.detalle) || txt(j.error) || `respondió ${status}`}.`, ahora) }
    return { status: 200, cuerpo: { ok: true, sale: true, texto: "Contestada.", registro: [...base, tu, { cuando: ahora, quien: "sistema", estado: "guardado", texto: "Guardó tu respuesta en el cerebro como dato confirmado por ti; todas las oficinas la leen así" }] } }
  } catch (e) {
    return { status: 200, cuerpo: fallo([], `No se pudo contactar a la plataforma: ${e instanceof Error ? e.message : String(e)}. No sé si se guardó: actualiza antes de reintentar.`, ahora) }
  }
}
