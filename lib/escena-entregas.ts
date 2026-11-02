/**
 * LA ESCENA VIVA · SPRINT 3 (CC4 · 02-nov · respuesta de Lenovo 13:18Z + corrección de Emilio 13:21Z): la entrega al pizarrón, la mesa de Dirección y la luz de firma.
 * Todo PURO (sin red ni reloj) y de SOLO LECTURA. Las lecturas viven en `escena-avatares-datos.ts`.
 *  · Entrega = un encargo de `oficina_encargos` que quedó entregado (`estado` empieza con «cerrado» y no es «cerrado_por_tope»); la entrega la hace el último empleado con turno de
 *    agente en `oficina_turnos` de ese encargo; el título sale de la fila del calendario (`sala_ref.fila`). Los cuadros del pizarrón muestran solo lo vigente (máx. 12; el más viejo se apaga).
 *  · Revisión viva = `jefatura_revisiones` de una pieza sin `cerrado_en`; los jefes que revisan salen de `jefatura_pasos`. Mientras dura, quien entregó camina al escritorio de Dirección
 *    y los jefes se encienden en el escritorio que dice `oficina_directorio` (nada se supone; `activo=false` NO los saca de Dirección: solo significa que no entran a los turnos).
 *  · «corrige» (reglas de CC1, `RESPUESTA-CC1-a-CC4-LENOVO-dos-datos-para-la-escena`): `jefatura_revisiones.resultado` NO dice si devolvió (dice cómo cerró). Sale cuando (a) la jefatura devuelve:
 *    un paso `jefatura_pasos` `correccion:%` en `hecho`, atribuido a `jefatura_pasos.agente`; o (b) devuelve Emilio: una pieza de `hitl_queue` (pidió cambios, o la rechazó él de verdad), un
 *    pedido de `plan_cambios` de plan, o uno de manual. Sin prueba ni ensayo.
 *  · Firma = `hitl_queue` pendiente y vigente (sin `expires_at` vencido). El endpoint de la bandeja devuelve vencidas como pendientes: aquí NO se usa.
 */
import { mesaDeEscritorio, type EscenaDatos, type MesaViva, type NombreDeAgente, type Punto, type Sentado, type TarjetaDelDirectorio } from "@/lib/escena-avatares"
import { nombreCanonico } from "@/lib/organigrama"
import { haceCuanto } from "@/lib/oficinas"
import { nombreLegible } from "@/lib/trabajo-en-vivo"

type Fila = Record<string, unknown>
const t = (v: unknown): string | null => (v == null || v === "" ? null : String(v))

export const MAXIMO_DE_CUADROS = 12
export const VIGENCIA_DE_LA_ENTREGA_H = 24
export const REVISION_VIVA_H = 3
export const MINUTOS_DE_CORRIGE = 10
/** de quién es cada campo del manual (copia de `CAMPOS_PROPONIBLES[campo].agente` de `src/lib/manual/propuesta.ts` de la plataforma, 02-nov: es el dueño asignado, no un registro de quién lo escribió) */
export const DUENO_DEL_CAMPO_DEL_MANUAL: Record<string, string> = {
  mision: "brand-strategist", proposito: "brand-strategist", positioning: "brand-strategist", propuestas_de_valor: "brand-strategist", vision: "brand-strategist", historia_y_origen: "brand-strategist",
  voice_description: "content-creator", personalidad: "content-creator", tagline_opciones: "content-creator", mensajes_clave: "content-creator", valores: "content-creator", nunca_hace: "content-creator", tono_por_canal: "content-creator", reglas_de_escritura: "content-creator",
  customer_angle: "jefe-client-success", retention_notes: "jefe-client-success", productos: "jefe-client-success", sedes: "jefe-client-success",
  direccion_de_fotografia: "creative-director-mesa", uso_del_logo: "design-visual-storyteller", jerarquia_tipografica: "design-visual-storyteller",
}
/** cuánto se queda la tarjeta de la entrega frente al pizarrón antes de quedar como cuadro encendido */
export const TARJETA_MS = 8000
export const MAXIMO_JUNTOS_EN_EL_PIZARRON = 4

/** el pizarrón de la foto (`marketing-2560`): la pantalla grande de rejilla, a la izquierda de la sala. Medido sobre la foto: 18 cuadros (6×3), de arriba abajo y de izquierda a derecha. Desde el encargo del pizarrón de métricas (02-nov) son cuadros de MÉTRICAS (`lib/escena-metricas.ts`), no de entregas */
const COL_X0 = 890, COL_PASO = 30.6, ANCHO = 25, ALTO = 27, SUBE = 12
const FILA_Y0 = [414, 445, 478]
export const CUADROS_DEL_PIZARRON: Punto[][] = Array.from({ length: 18 }, (_, i) => {
  const c = Math.floor(i / 3), r = i % 3
  const x = COL_X0 + COL_PASO * c, y = FILA_Y0[r] - 14 * c
  const p = (dx: number, dy: number): Punto => ({ x: Math.round(x + dx), y: Math.round(y + dy) })
  return [p(0, 0), p(ANCHO, -SUBE), p(ANCHO, -SUBE + ALTO), p(0, ALTO)]
})
/** el piso frente al pizarrón: donde se para quien entrega */
export const LUGAR_DEL_PIZARRON: Punto = { x: 1010, y: 548 }
/** dónde se para cada quien si llegan varios a la vez (el primero al centro) */
export const PUESTOS_EN_EL_PIZARRON: Punto[] = [{ x: 0, y: 0 }, { x: -34, y: 14 }, { x: 34, y: -12 }, { x: -6, y: 30 }].map((d) => ({ x: LUGAR_DEL_PIZARRON.x + d.x, y: LUGAR_DEL_PIZARRON.y + d.y }))
/** la tarjeta de la entrega se dibuja sobre el pizarrón */
export const ANCLA_DE_LA_TARJETA: Punto = { x: 985, y: 392 }
/** el panel luminoso vertical del borde derecho: la «puerta» hacia Tu oficina (medido sobre la foto) */
export const PANEL_DE_FIRMA: Punto[] = [{ x: 1692, y: 525 }, { x: 1733, y: 546 }, { x: 1733, y: 613 }, { x: 1692, y: 598 }]
export const ENLACE_A_TU_OFICINA = "/nuevo/oficina"

export interface EntregaViva { id: string; agente: string | null; titulo: string; cerrado_en: string; /** su escritorio (clave de mesa) y su nombre legible: los pone `conRevisiones` con el directorio */ mesa?: string | null; nombre?: string | null }
export interface RevisionViva {
  id: string; encargo_id: string
  /** quien entregó la pieza (null si no hay turno de agente registrado) */
  entregador: string | null
  /** los jefes que revisan (nombres tal como los trae `jefatura_pasos`) */
  revisores: string[]
  /** la jefatura la está revisando ahora (lo que devuelve va en `correcciones`, no aquí) */
  estado: "viva"
  desde: string
  cerrado_en: string | null
}
/** alguien a quien le devolvieron un trabajo: vuelve a su escritorio con la marca «corrige» durante MINUTOS_DE_CORRIGE */
export interface CorreccionViva { agente: string; origen: "jefatura" | "emilio_pieza" | "emilio_plan" | "emilio_manual"; desde: string }
export interface EntregasDeLaEscena {
  correcciones?: CorreccionViva[]
  /** las entregas vigentes, de la más nueva a la más vieja (máx. MAXIMO_DE_CUADROS) */
  entregas: EntregaViva[]
  revisiones: RevisionViva[]
  firma: { pendientes: number }
}

const ES_ENTREGA_FALLIDA = /fallid|tope|cancel|abort/i

export interface LecturaDeEntregas {
  encargos: Fila[]   // oficina_encargos: id, estado, sala_ref, cerrado_en
  turnos: Fila[]     // oficina_turnos: encargo_id, agente, tipo, inicio, fin
  filas: Fila[]      // cadena_calendario_filas: id, tema, red
  revisiones: Fila[] // jefatura_revisiones VIVAS de piezas: id, artifact_id, estado, creado_en, cerrado_en
  pasos: Fila[]      // jefatura_pasos de esas revisiones: revision_id, agente, tipo, estado
  /** «corrige» · jefatura: jefatura_pasos `correccion:%` en hecho (revision_id, agente, inicio, fin) */
  pasosDeCorreccion?: Fila[]
  /** «corrige» · Emilio, pieza: hitl_queue content_piece_review edited/rejected (id, status, reviewer, decision, metadata, decided_at) */
  decisiones?: Fila[]
  /** «corrige» · Emilio, plan o manual: plan_cambios (id, plan_id, documento, campos_liberados, creado_en) */
  cambios?: Fila[]
  /** revisiones para atribuir (id, artifact_id, productores[{agente}], prueba, dry_run) */
  atribucion?: Fila[]
  bandeja: Fila[]    // hitl_queue pendientes: id, expires_at
  ahora: Date
}

const filaDelEncargo = (e: Fila): string | null => { const f = ((e.sala_ref as Fila | null) ?? {}).fila as Fila | undefined; return f?.id ? String(f.id) : null }

export function armarEntregas(x: LecturaDeEntregas): EntregasDeLaEscena {
  const ahora = x.ahora.getTime()
  const temaDe = new Map(x.filas.map((f) => [String(f.id), [t(f.tema), t(f.red)].filter(Boolean).join(" · ")]))
  // quien entregó: el último turno de agente del encargo (por fin, y si no hay, por inicio)
  const turnoDe = new Map<string, { agente: string; cuando: string }>()
  for (const u of x.turnos) {
    if (t(u.tipo) !== "agente" || !t(u.agente) || !t(u.encargo_id)) continue
    const cuando = t(u.fin) ?? t(u.inicio) ?? ""
    const k = String(u.encargo_id), previo = turnoDe.get(k)
    if (!previo || cuando > previo.cuando) turnoDe.set(k, { agente: String(u.agente), cuando })
  }
  const entregas: EntregaViva[] = x.encargos
    .filter((e) => /^cerrad/i.test(String(e.estado ?? "")) && !ES_ENTREGA_FALLIDA.test(String(e.estado ?? "")) && t(e.cerrado_en) && ahora - Date.parse(String(e.cerrado_en)) <= VIGENCIA_DE_LA_ENTREGA_H * 3_600_000)
    .sort((a, b) => (String(a.cerrado_en) < String(b.cerrado_en) ? 1 : -1))
    .slice(0, MAXIMO_DE_CUADROS)
    .map((e) => ({ id: String(e.id), agente: turnoDe.get(String(e.id))?.agente ?? null, titulo: temaDe.get(filaDelEncargo(e) ?? "") || "pieza entregada", cerrado_en: String(e.cerrado_en) }))

  const entregadorDe = (encargoId: string) => turnoDe.get(encargoId)?.agente ?? null
  const revisiones: RevisionViva[] = []
  for (const r of x.revisiones) {
    const encargo = t(r.artifact_id), creado = t(r.creado_en)
    if (!encargo || !creado) continue
    const cerrado = t(r.cerrado_en)
    const viva = !cerrado && ahora - Date.parse(creado) <= REVISION_VIVA_H * 3_600_000
    if (!viva) continue
    const revisores = [...new Set(x.pasos.filter((p) => String(p.revision_id) === String(r.id) && t(p.tipo) === "agente" && t(p.agente)).map((p) => String(p.agente)))]
    revisiones.push({ id: String(r.id), encargo_id: encargo, entregador: entregadorDe(encargo), revisores, estado: "viva", desde: creado, cerrado_en: cerrado })
  }
  const pendientes = x.bandeja.filter((b) => !t(b.expires_at) || Date.parse(String(b.expires_at)) > ahora).length
  return { entregas, revisiones, firma: { pendientes }, correcciones: armarCorrecciones(x) }
}

const obj = (v: unknown): Fila => (v && typeof v === "object" && !Array.isArray(v) ? (v as Fila) : {})
/** una decisión de Emilio que devuelve la pieza (regla de CC1): pidió cambios; o la rechazó él de verdad (no una limpieza, una superación, un vencimiento ni una prueba) */
export function devolvioEmilio(x: Fila): boolean {
  const d = obj(x.decision), quien = String(x.reviewer ?? "")
  if (x.status === "edited") return d.pidio_cambios === true || d.pidio_cambios === "true"
  if (x.status !== "rejected") return false
  if ("vencida" in d || "superada" in d || "no_es_decision_del_dueno" in d) return false
  return !!quien && !/^(sistema|oficina-)/i.test(quien) && !/prueba/i.test(quien) && !/^limpieza/i.test(quien)
}
const productoresDe = (r: Fila | undefined): string[] => (r && Array.isArray(r.productores) ? [...new Set(r.productores.map((p) => t(obj(p).agente)).filter((a): a is string => !!a))] : [])
const reciente = (cuando: string | null, ahora: number): cuando is string => !!cuando && ahora - Date.parse(cuando) <= MINUTOS_DE_CORRIGE * 60_000 && ahora >= Date.parse(cuando)

/** a quién le devolvieron algo hace poco, con las reglas de CC1; lo que no se puede atribuir con datos reales no marca a nadie */
export function armarCorrecciones(x: LecturaDeEntregas): CorreccionViva[] {
  const ahora = x.ahora.getTime()
  const atribucion = x.atribucion ?? []
  const reales = new Map(atribucion.filter((r) => r.prueba !== true && r.dry_run !== true).map((r) => [String(r.id), r]))
  const out: CorreccionViva[] = []
  // (a) la jefatura devolvió: un paso de corrección hecho, atribuido a quien corrigió
  for (const p of x.pasosDeCorreccion ?? []) {
    const cuando = t(p.fin) ?? t(p.inicio), agente = t(p.agente)
    if (!agente || !reciente(cuando, ahora) || !/^correccion:/.test(String(p.paso ?? "correccion:")) || (t(p.estado) && p.estado !== "hecho")) continue
    if (atribucion.length && !reales.has(String(p.revision_id))) continue // revisión de prueba o ensayo
    out.push({ agente, origen: "jefatura", desde: cuando })
  }
  // (b) Emilio devolvió una pieza: a todos los productores de su revisión; sin revisión, a quien hizo el encargo (último turno de agente)
  for (const d of x.decisiones ?? []) {
    const cuando = t(d.decided_at)
    if (!reciente(cuando, ahora) || !devolvioEmilio(d)) continue
    const m = obj(d.metadata)
    const rev = t(m.jefatura_revision_id) ? reales.get(String(m.jefatura_revision_id)) : undefined
    let quienes = productoresDe(rev)
    if (!quienes.length && t(m.oficina_encargo_id)) {
      const u = x.turnos.filter((q) => String(q.encargo_id) === String(m.oficina_encargo_id) && t(q.tipo) === "agente" && t(q.agente)).sort((a, b) => ((t(b.fin) ?? t(b.inicio) ?? "") < (t(a.fin) ?? t(a.inicio) ?? "") ? -1 : 1))[0]
      if (u) quienes = [String(u.agente)]
    }
    for (const agente of quienes) out.push({ agente, origen: "emilio_pieza", desde: cuando })
  }
  // (c) Emilio pidió cambios al plan o al manual: cuenta el pedido al crearse
  for (const c of x.cambios ?? []) {
    const cuando = t(c.creado_en)
    if (!reciente(cuando, ahora)) continue
    if (c.documento === "plan") {
      const rev = atribucion.find((r) => String(r.artifact_id) === String(c.plan_id) && r.prueba !== true && r.dry_run !== true)
      for (const agente of productoresDe(rev)) out.push({ agente, origen: "emilio_plan", desde: cuando })
    } else if (c.documento === "manual") {
      const campos = Array.isArray(c.campos_liberados) ? c.campos_liberados.map(String) : typeof c.campos_liberados === "string" ? [c.campos_liberados] : []
      for (const agente of new Set(campos.map((k) => DUENO_DEL_CAMPO_DEL_MANUAL[k]).filter((a): a is string => !!a))) out.push({ agente, origen: "emilio_manual", desde: cuando })
    }
  }
  // un empleado, una marca (la más reciente)
  const por = new Map<string, CorreccionViva>()
  for (const c of out) { const k = nombreCanonico(c.agente), p = por.get(k); if (!p || c.desde > p.desde) por.set(k, c) }
  return [...por.values()]
}

/**
 * Pone en las mesas lo que dicen las revisiones: los jefes que revisan se encienden en SU escritorio (el que dice el directorio, no uno supuesto);
 * quien entregó camina al escritorio de Dirección mientras la revisión sigue viva, y si la jefatura devuelve, vuelve al suyo con la marca «corrige».
 * Devuelve `sinEscritorio`: los jefes que revisan pero el directorio no les da escritorio (se dicen, no se mueven).
 */
export function conRevisiones(escena: EscenaDatos, ent: EntregasDeLaEscena, o: { directorio: TarjetaDelDirectorio[]; agentes: NombreDeAgente[]; ahora: Date }): { escena: EscenaDatos; sinEscritorio: string[] } {
  const nombres = new Map(o.agentes.map((a) => [nombreCanonico(a.name), a.display_name || nombreLegible(a.name)]))
  const nombre = (a: string) => nombres.get(nombreCanonico(a)) ?? nombreLegible(a)
  const entregas = ent.entregas.map((e) => ({ ...e, mesa: e.agente ? mesaDeEscritorio(e.agente, o.directorio)?.mesa ?? null : null, nombre: e.agente ? nombre(e.agente) : null }))
  const conEntregas: EntregasDeLaEscena = { ...ent, entregas }
  if (!ent.revisiones.length && !(ent.correcciones ?? []).length) return { escena: { ...escena, entregas: conEntregas }, sinEscritorio: [] }
  const mesas: MesaViva[] = escena.mesas.map((m) => ({ ...m, sentados: [...m.sentados] }))
  const sinEscritorio: string[] = []
  const fuente = "la revisión de la jefatura"
  const sienta = (agente: string, mesa: MesaViva["clave"], tarea: string, desde: string, extra: Partial<Sentado> = {}, origen: Sentado["origen_de_la_mesa"] = "directorio") => {
    const k = nombreCanonico(agente)
    for (const m of mesas) m.sentados = m.sentados.filter((s) => nombreCanonico(s.agente) !== k) // un empleado, un puesto
    const destino = mesas.find((m) => m.clave === mesa)
    if (!destino) return
    destino.sentados.push({ agente, nombre: nombre(agente), mesa, estado: "trabajando", cliente: null, flujo: "Revisión de la jefatura", paso: null, tarea, desde, hace: haceCuanto(desde, o.ahora), gasto_usd: null, fuente, origen_de_la_mesa: origen, ...extra })
  }
  const enSala = new Set(escena.sala?.reunion?.estado === "en_curso" ? escena.sala.reunion.participantes.map((p) => nombreCanonico(p.agente)) : [])
  for (const r of ent.revisiones) {
    if (r.estado === "viva") {
      for (const j of r.revisores) {
        if (enSala.has(nombreCanonico(j))) continue
        const m = mesaDeEscritorio(j, o.directorio)
        if (!m) { sinEscritorio.push(j); continue }
        sienta(j, m.mesa, "revisa una pieza", r.desde, {}, m.origen)
      }
      if (r.entregador && !enSala.has(nombreCanonico(r.entregador))) sienta(r.entregador, "direccion", "lleva su entrega a la revisión", r.desde, { viene_de: mesaDeEscritorio(r.entregador, o.directorio)?.mesa })
    }
  }
  // «corrige»: vuelve a su escritorio quien recibió una devolución (de la jefatura o de Emilio) hace poco, salvo quien está en la reunión de la sala
  for (const c of ent.correcciones ?? []) {
    if (enSala.has(nombreCanonico(c.agente))) continue
    const m = mesaDeEscritorio(c.agente, o.directorio)
    if (m) sienta(c.agente, m.mesa, "corrige lo que le devolvieron", c.desde, { corrige: true }, m.origen)
    else sinEscritorio.push(c.agente)
  }
  for (const m of mesas) { m.trabajando = m.sentados.filter((s) => s.estado === "trabajando").length; m.fallando = m.sentados.filter((s) => s.estado === "fallo").length }
  return { escena: { ...escena, mesas, entregas: conEntregas }, sinEscritorio: [...new Set(sinEscritorio)] }
}

/** el rótulo de la luz de firma al pasar el cursor */
export const rotuloDeLaFirma = (n: number): string => (n === 1 ? "1 espera tu firma" : `${n} esperan tu firma`)
